const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GMenu = imports.gi.GMenu;
const Atk = imports.gi.Atk;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const appSys = Shell.AppSystem.get_default();

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const AppsMenu = Me.imports.appsmenu;

const PADDING = 30;

var Launcher = new Lang.Class({
    Name: 'Launcher',

    _init: function (settings, appsMenu) {
        log('MyMenu::Launcher::init');
        this._settings = settings;
        this._appsMenu = appsMenu;

        this._items = {};
        this._apps = {};

        this.actor = new St.ScrollView({
            x_fill: true,
            y_fill: false,
            y_align: St.Align.START,
            style_class: 'launcher-area',
        });

        this.menuManager = new LauncherMenuManager(this);

        this._iconeSize = this._settings.get_double('launcher-icon-size');

        this._dragBox = null;
        this._dragBoxPosition = {};

        this.actor.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.actor._delegate = this;

        let layout = new Clutter.FixedLayout();
        this._appsGrid = new St.Widget({
            style_class: 'launcher-grid',
            layout_manager: layout,
            reactive: true,
        });

        let box = new St.BoxLayout({
            vertical: true,
        });

        box.add_actor(this._appsGrid);

        this.actor.add_actor(box);

        this._loadApps();
        this._addApps();

        this._settings.connect('changed::launcher-icon-size', Lang.bind(this, this._updateItemsIconSize));
        log('MyMenu::Launcher::/init');
    },

    destroy: function () {
        this.actor.destroy();
    },

    /**
     * Add the apps from the settings to the launcher
     *
     * @private
     */
    _addApps: function () {
        let launcherData = JSON.parse(this._settings.get_string('launcher-data'));
        for (let index in launcherData) {
            let appId = launcherData[index];

            if (this._apps[appId] != undefined) {
                let postion = index.split('-');

                let xIndex = postion[0];
                let yIndex = postion[1];

                let x = this._getXGridByIndex(xIndex);
                let y = this._getXGridByIndex(yIndex);

                this._addAppItem(this._apps[appId], x, y, xIndex, yIndex);
            }
        }
    },

    /**
     * Load the apps to set it in the _apps array
     * @private
     */
    _loadApps: function () {
        this._apps = {};
        let tree = new GMenu.Tree({ menu_basename: 'applications.menu' });
        tree.load_sync();
        let root = tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let directory = iter.get_directory();
                if (!directory.get_is_nodisplay()) {
                    this._loadAppsCategory(directory);
                }
            }
        }
    },

    /**
     * Load the apps from a category
     *
     * @param dir
     * @private
     */
    _loadAppsCategory: function(dir) {
        let iter = dir.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                let entry = iter.get_entry();
                let id;
                try {
                    id = entry.get_desktop_file_id();
                } catch(e) {
                    continue;
                }
                let app = appSys.lookup_app(id);
                if (app && app.get_app_info().should_show())
                    this._apps[app.get_id()] = app;
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                if (!subdir.get_is_nodisplay())
                    this._loadAppsCategory(subdir);
            }
        }
    },

    /**
     * Drag item over the launcher
     *
     * Add the drag box over the launcher grid
     *
     * @param source source item
     * @param actor
     * @param x
     * @param y
     * @param time
     */
    handleDragOver: function(source, actor, x, y, time) {
        let app = this.getAppFromSource(source);

        if (app == null) {
            return;
        }

        x = this._getXGrid(x);
        y = this._getYGrid(y);
        let xIndex = x / this._getGidSize();
        let yIndex = y / this._getGidSize();

        if (this._dragBox != null && (this._dragBoxPosition.x != xIndex || this._dragBoxPosition.y != yIndex)) {
            this._dragBox.destroy();
            this._dragBox = null;
            this._dragBoxPosition = {};
        }

        if (this._dragBox == null) {
            let size = this._getGidSize();
            this._dragBox = new St.BoxLayout({
                fixed_position_set : true,
                fixed_x: x,
                fixed_y: y,
                style_class: 'popup-menu-item selected',
                height: size,
                width: size
            });

            this._dragBoxPosition = {x: xIndex, y: yIndex};
            this._appsGrid.add_actor(this._dragBox);
        }
    },

    /**
     * Drop item on the laucher
     *
     * Add the apps in the laucher and save the apps grid in the settings
     *
     * @param source
     * @param actor
     * @param x
     * @param y
     * @param time
     */
    acceptDrop: function (source, actor, x, y, time) {
        let app = this.getAppFromSource(source);

        if (app == null) {
            return;
        }

        x = this._getXGrid(x);
        y = this._getYGrid(y);

        let xIndex = x / this._getGidSize();
        let yIndex = y / this._getGidSize();

        this._addAppItem(app, x, y, xIndex, yIndex);

        this._dragBox.destroy();
        this._dragBox = null;
        this._dragBoxPosition = {};

        this._saveData();
    },

    /**
     * Add apps item on the launcher grid
     *
     * @param app
     * @param x
     * @param y
     * @param xIndex
     * @param yIndex
     * @private
     */
    _addAppItem: function (app, x, y, xIndex, yIndex) {
        let item = new LauncherItem(app, this._appsMenu, this._settings);

        item.connect('destroy', Lang.bind(this, this._removeAppItem));

        this.menuManager.addMenu(item.menu);

        item.setPosition(x, y, xIndex, yIndex);
        this._appsGrid.add_child(item);
        this._items[xIndex + '-' + yIndex] = item;
    },

    _removeAppItem: function (item) {

        log(item.xIndex + '-' + item.yIndex);
        delete this._items[item.xIndex + '-' + item.yIndex];
        this._saveData();
    },

    /**
     * Save the apps grid to the settings
     * @private
     */
    _saveData: function () {
        let data = {};
        for (let index in this._items) {
            let launcherItem = this._items[index];
            if (launcherItem) {
                data[index] = launcherItem.app.get_id();
            }
        }


        let dataString = JSON.stringify(data);
        this._settings.set_string('launcher-data', dataString);
        log('save data');
        log(dataString);
    },

    getAppFromSource: function (source) {
        if (source instanceof AppsMenu.AppItem) {
            return source.app;
        } else {
            return null;
        }
    },

    /**
     * Update the items icon size
     *
     * @private
     */
    _updateItemsIconSize: function () {

        let iconSize = this._getIconSize();
        for (let i = 0; i < this._items.length; i++) {
            this._items[i].updateIconSize(iconSize);
        }
    },

    _getXGrid: function(x) {
        return (x - (x % this._getGidSize()));
    },

    _getYGrid: function(y) {
        return (y - (y % this._getGidSize()));
    },

    _getXGridByIndex: function(xIndex) {
        return xIndex * this._getGidSize();
    },

    _getYGridByIndex: function(yIndex) {
        return yIndex * this._getGidSize();
    },

    _getGidSize: function () {
        return this._getIconSize() + (PADDING * 2);
    },

    _getIconSize: function () {
        return this._iconeSize;
    }
});

// Launcher item class
var LauncherItem = new Lang.Class({
    Name: 'LauncherItem',
    Extends: St.BoxLayout,

    // Initialize menu item
    _init: function (app, appsMenu, settings) {
        this._settings = settings;
        this._appsMenu = appsMenu;
        this.app = app;

        let iconSize = this._settings.get_double('launcher-icon-size');

        let padding = PADDING;
        this.parent({
            style_class: 'launcher-item popup-menu-item',
            fixed_position_set : true,
            style: 'padding: ' + padding + 'px;',
            reactive: true,
            track_hover: true,
            can_focus: true,
            accessible_role: Atk.Role.MENU_ITEM
        });


        this.xIndex = null;
        this.yIndex = null;

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this.updateIconSize(iconSize);

        this._draggable = DND.makeDraggable(this);
        this.isDraggableApp = true;
        /*this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));*/

        this._createMenu();

        this.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
        this.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.connect('touch-event', Lang.bind(this, this._onTouchEvent));
        this.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.connect('notify::hover', Lang.bind(this, this._onHoverChanged));
        this.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
        this.connect('key-focus-out', Lang.bind(this, this._onKeyFocusOut));
        this.connect('notify::visible', Lang.bind(this, this._onVisibilityChanged));
    },

    _createMenu: function () {
        this.menu = new PopupMenu.PopupMenu(this, 1.0, St.Side.LEFT);
        Main.uiGroup.add_actor(this.menu.actor);

        this.menu.actor.hide();

       /* let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        let mainBox = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-apps-menu-main-box'
        });

        mainBox._delegate = mainBox;

        section.actor.add_actor(mainBox);*/

        let deleteItem = new LauncherMenuItem('delete');//_('Delete'));
        deleteItem.connect('activate', Lang.bind(this, this._onDeleteClick));
        //mainBox.add_child(deleteItem.actor);

        this.menu.addMenuItem(deleteItem);
    },

    _onDeleteClick: function () {
        this.destroy();
    },

    _onVisibilityChanged: function () {
        if (!this.visible)
            this.menu.close();
    },

    _onButtonPressEvent: function (actor, event) {
        // This is the CSS active state
        this.add_style_pseudo_class ('active');
        return Clutter.EVENT_PROPAGATE;
    },

    _onButtonReleaseEvent: function (actor, event) {
        this.remove_style_pseudo_class ('active');
        this.activate(event);
        return Clutter.EVENT_STOP;
    },

    _onTouchEvent: function (actor, event) {
        if (event.type() == Clutter.EventType.TOUCH_END) {
            this.remove_style_pseudo_class ('active');
            this.activate(event);
            return Clutter.EVENT_STOP;
        } else if (event.type() == Clutter.EventType.TOUCH_BEGIN) {
            // This is the CSS active state
            this.add_style_pseudo_class ('active');
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _onKeyPressEvent: function (actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.activate(event);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _onKeyFocusIn: function (actor) {
        this.setActive(true);
    },

    _onKeyFocusOut: function (actor) {
        this.setActive(false);
    },

    _onHoverChanged: function (actor) {
        this.setActive(actor.hover);
    },

    setActive: function (active) {
        let activeChanged = active != this.active;
        if (activeChanged) {
            this.active = active;
            if (active) {
                this.add_style_class_name('selected');
                this.grab_key_focus();
            } else {
                this.remove_style_class_name('selected');
                // Remove the CSS active state if the user press the button and
                // while holding moves to another menu item, so we don't paint all items.
                // The correct behaviour would be to set the new item with the CSS
                // active state as well, but button-press-event is not trigered,
                // so we should track it in our own, which would involve some work
                // in the container
                this.remove_style_pseudo_class ('active');
            }
            //this.emit('active-changed', active);
        }


    },

    setPosition: function (x, y, xIndex, yIndex) {
        this.set_x(x);
        this.set_y(y);
        this.xIndex = xIndex;
        this.yIndex = yIndex;
    },

    // Update the app icon
    updateIconSize: function(iconSize) {
        this._iconBin.set_child(this.app.create_icon_texture(iconSize));
    },
    activate: function(event) {
        let mouseButton = event.get_button();
        if (mouseButton ==  Clutter.BUTTON_PRIMARY) {
            this.app.open_new_window(-1);
            this._appsMenu.button.menu.toggle();
        } else if (mouseButton ==  Clutter.BUTTON_SECONDARY) {
            this.menu.toggle();
        }
    }
});

var LauncherMenuItem = new Lang.Class({
    Name: 'LauncherMenuItem',
    Extends: PopupMenu.PopupMenuItem,

    /*_init: function (text) {
        this.parent(text);
    },

    activate: function(event) {
        this.parent(event);
    },*/
});




// Launcher menu manager
var LauncherMenuManager = new Lang.Class({
    Name: 'LauncherMenuManager',
    Extends: PopupMenu.PopupMenuManager,

    _onMenuSourceEnter: function(menu) {
        return Clutter.EVENT_PROPAGATE;
        if (!this._grabHelper.grabbed)
            return Clutter.EVENT_PROPAGATE;

        if (this._grabHelper.isActorGrabbed(menu.actor))
            return Clutter.EVENT_PROPAGATE;

        this._changeMenu(menu);
        return Clutter.EVENT_PROPAGATE;
    },
});
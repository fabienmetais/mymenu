const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GMenu = imports.gi.GMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const appSys = Shell.AppSystem.get_default();

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const AppsMenu = Me.imports.appsmenu;
const LauncherItem = Me.imports.launcheritem;

const PADDING = 30;
const COL_SPACING = 5;

var Launcher = new Lang.Class({
    Name: 'Launcher',

    _init: function (settings, appsMenu) {
        log('MyMenu::Launcher::init');
        this._settings = settings;
        this._appsMenu = appsMenu;

        this._items = {};
        this._dragMovedItems = [];
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
        this._hoverPosition = {x: null, y: null};

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

                this._addItem(this._apps[appId], x, y, xIndex, yIndex);
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
     * Add apps item on the launcher grid
     *
     * @param app
     * @param x
     * @param y
     * @param xIndex
     * @param yIndex
     * @private
     */
    _addItem: function (app, x, y, xIndex, yIndex) {
        let item = new LauncherItem.LauncherItem(app, this._appsMenu, this._settings);

        item.connect('delete', Lang.bind(this, this._deleteItem));
        item.connect('drag-begin', Lang.bind(this, this._onItemDragBegin));

        this.menuManager.addMenu(item.menu);

        item.setPosition(x, y, xIndex, yIndex);
        this._appsGrid.add_child(item.actor);

        if (this._items[xIndex] == undefined) {
            this._items[xIndex] = {};
        }

        this._items[xIndex][yIndex] = item;
    },

    /**
     * On drag begin delete item from the grid
     * @param item
     * @private
     */
    _onItemDragBegin: function (item) {
        delete this._items[item.xIndex][item.yIndex];

        if (this._items[item.xIndex].length == 0) {
            delete this._items[item.xIndex];
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
        let xIndex = this._getXIndex(x);
        let yIndex = this._getYIndex(y);
        if (this._hoverPosition.x != xIndex || this._hoverPosition.y != yIndex) {
            if (this._dragBox != null) {
                this._dragBox.destroy();
                this._dragBox = null;
            }

            this._hoverPosition = {x: xIndex, y: yIndex};

            log(!source instanceof LauncherItem.LauncherItem);
            log(source.xIndex +'!='+ xIndex +'||'+ source.yIndex +'!= '+yIndex);

            if (!source instanceof LauncherItem.LauncherItem || source.xIndex != xIndex || source.yIndex != yIndex) {
                this._moveHoverDragItem(xIndex, yIndex);
            }

            this._restoreHoverDragItem();
        }

        if (this._dragBox == null) {
            let size = this._getGridSize();
            this._dragBox = new St.BoxLayout({
                fixed_position_set : true,
                fixed_x: x,
                fixed_y: y,
                style_class: 'popup-menu-item selected',
                height: size,
                width: size
            });

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
        let xIndex = this._getXIndex(x);
        let yIndex = this._getYIndex(y);

        if (source instanceof AppsMenu.AppItem) {
            this._addItem(app, x, y, xIndex, yIndex);
        } else if (source instanceof LauncherItem.LauncherItem) {

            delete this._items[source.xIndex][source.yIndex];

            if (this._items[source.xIndex].length == 0) {
                delete this._items[source.xIndex];
            }

            let x = this._getXGridByIndex(xIndex);
            let y = this._getYGridByIndex(yIndex);
            source.setPosition(x, y, xIndex, yIndex);
            source.actor.show();

            if (this._items[xIndex] == undefined) {
                this._items[xIndex] = {};
            }

            this._items[xIndex][yIndex] = source;
        }

        this._dragBox.destroy();
        this._dragBox = null;
        this._hoverPosition = {x: null, y: null};

        this._saveData();
    },

    /**
     * Check of the item has been moved
     *
     * @param xIndex
     * @param yIndex
     *
     * @returns {boolean}
     * @private
     */
    _isMovedItem:  function (xIndex, yIndex) {
        let isMovedItem = false;
        for (let index in this._dragMovedItems) {
            let movedItem = this._dragMovedItems[index];
            if (movedItem.x == xIndex && movedItem.y == yIndex) {
                isMovedItem = true;
                break;
            }
        }

        return isMovedItem;
    },

    _moveHoverDragItem: function (xIndex, yIndex) {
        if (this._items[xIndex] != undefined && this._items[xIndex][yIndex] != undefined) {
            let item = this._items[xIndex][yIndex];

            if (item && !this._isMovedItem(xIndex, yIndex)) {
                let newYIndex = yIndex + 1;
                this._moveHoverDragItem(xIndex, newYIndex);

                let x = this._getXGridByIndex(xIndex);
                let y = this._getYGridByIndex(newYIndex);
                item.setPosition(x, y, xIndex, newYIndex);
                this._dragMovedItems.push({x: xIndex, y: newYIndex});

                log('_moveHoverDragItem from:' + xIndex + ',' + yIndex + ' to: '+ xIndex + ',' + newYIndex + '-----' + item.get_app_id());

                this._items[xIndex][newYIndex] = item;
                delete this._items[xIndex][yIndex];
            }
        }
    },

    _restoreHoverDragItem: function () {
        for (let index in this._dragMovedItems) {
            let movedItem = this._dragMovedItems[index];

            let oldYIndex = movedItem.y - 1;
            if ((this._hoverPosition.x != movedItem.x || this._hoverPosition.y != oldYIndex)
                && (this._items[movedItem.x] == undefined || this._items[movedItem.x][oldYIndex] == undefined)) {
                let item = this._items[movedItem.x][movedItem.y];
                let x = this._getXGridByIndex(movedItem.x);
                let y = this._getYGridByIndex(oldYIndex);
                item.setPosition(x, y, movedItem.x, oldYIndex);
                log ('_restoreHoverDragItem from: ' + movedItem.x + ',' + movedItem.y  + ' to: ' + movedItem.x + ',' + oldYIndex  + '-----' + item.get_app_id());

                delete this._items[movedItem.x][movedItem.y];
                this._items[movedItem.x][oldYIndex] = item;

                log(JSON.stringify(this._dragMovedItems));
                this._dragMovedItems.splice(index, 1);
                log(JSON.stringify(this._dragMovedItems));

                this._restoreHoverDragItem();
                break;
            }
        }
    },

    _deleteItem: function (item) {
        delete this._items[item.xIndex][item.yIndex];

        if (this._items[item.xIndex].length == 0) {
            delete this._items[item.xIndex];
        }
        this._saveData();
    },

    /**
     * Save the apps grid to the settings
     * @private
     */
    _saveData: function () {
        let data = {};
        for (let xIndex in this._items) {
            for (let yIndex in this._items[xIndex]) {
                let launcherItem = this._items[xIndex][yIndex];
                if (launcherItem) {
                    data[xIndex + '-' + yIndex] = launcherItem.app.get_id();
                }
            }
        }

        let dataString = JSON.stringify(data);
        this._settings.set_string('launcher-data', dataString);
    },

    getAppFromSource: function (source) {
        if (source instanceof AppsMenu.AppItem || source instanceof LauncherItem.LauncherItem) {
            return source.app;
        }else {
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

        for (let xIndex in this._items) {
            for (let yIndex in this._items[xIndex]) {
                let launcherItem = this._items[xIndex][yIndex];
                if (launcherItem) {
                    launcherItem.updateIconSize(iconSize);
                }
            }
        }
    },

    _getXGrid: function(x) {
        let xGrid = (x - (x % this._getGridSize()))

        if (xGrid != 0) {
            xGrid = xGrid + (COL_SPACING * (xGrid / this._getGridSize()));
        }
        return xGrid;
    },

    _getYGrid: function(y) {
        let yGrid = (y - (y % this._getGridSize()));

        if (yGrid != 0) {
            yGrid = yGrid + (COL_SPACING * (yGrid / this._getGridSize()));
        }

        return yGrid;
    },

    _getXIndex: function (x) {
        return (x / (this._getGridSize() + COL_SPACING));
    },
    _getYIndex: function (y) {


        return (y / (this._getGridSize() + COL_SPACING));
    },

    _getXGridByIndex: function(xIndex) {
        return (xIndex * (this._getGridSize() + COL_SPACING));
    },

    _getYGridByIndex: function(yIndex) {
        return (yIndex * (this._getGridSize() + COL_SPACING));
    },

    _getGridSize: function () {
        return this._getIconSize() + (PADDING * 2);
    },

    _getIconSize: function () {
        return this._iconeSize;
    }
});

// Launcher menu manager
var LauncherMenuManager = new Lang.Class({
    Name: 'LauncherMenuManager',
    Extends: PopupMenu.PopupMenuManager,

    _onMenuSourceEnter: function(menu) {
        return Clutter.EVENT_PROPAGATE;
        /*if (!this._grabHelper.grabbed)
            return Clutter.EVENT_PROPAGATE;

        if (this._grabHelper.isActorGrabbed(menu.actor))
            return Clutter.EVENT_PROPAGATE;
        this._changeMenu(menu);
        return Clutter.EVENT_PROPAGATE;
*/
    },
});
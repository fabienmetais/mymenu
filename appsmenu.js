const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const GMenu = imports.gi.GMenu;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const DND = imports.ui.dnd;

const appSys = Shell.AppSystem.get_default();

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Launcher = Me.imports.launcher;

const APPLICATION_ICON_SIZE = 26;

var AppsMenu = new Lang.Class({
    Name: 'MyMenu.AppsMenu',
    Extends: PopupMenu.PopupMenu,

    // Initialize the menu
    _init: function (sourceActor, arrowAlignment, arrowSide, button, settings) {
        log('MyMenu::AppsMenu::init');
        this._settings = settings;
        this.parent(sourceActor, arrowAlignment, arrowSide);
        this.button = button;

        this.currentCategoryItem = null;

        this._createPopup();

        this._createLeftBox();

        if (this._settings.get_boolean('show-launcher')) {
            this._createLauncher();
        }

        this._loadCategories();

        this._settings.connect('changed::show-launcher', Lang.bind(this, this._toggleLauncher));

        log('MyMenu::AppsMenu::/init');
    },

    _createPopup: function () {
        //PopupMenu
        let section = new PopupMenu.PopupMenuSection();
        this.addMenuItem(section);
        this.mainBox = new St.BoxLayout({
            vertical: false,
            style_class: 'main-box'
        });
        section.actor.add_actor(this.mainBox);
    },

    /**
     * Create the left box of the apps menu
     *
     * @private
     */
    _createLeftBox: function () {
        this.leftBox = new St.BoxLayout({
            vertical: true,
            style_class: 'left-box'
        });

        this.appsScrollBox = new St.ScrollView({
            x_fill: true,
            y_fill: false,
            y_align: St.Align.START,
            style_class: 'apps-menu vfade left-scroll-area'
        });

        this.appsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        /*let vscroll = this.appsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));*/

        this.categoriesBox = new St.BoxLayout({ vertical: true });
        this.appsScrollBox.add_actor(this.categoriesBox);

        this.leftBox.add(this.appsScrollBox, {
            expand: true,
            x_fill: true, y_fill: true,
            y_align: St.Align.START
        });

        this.mainBox.add(this.leftBox, {
            expand: true,
            x_fill: true,
            y_fill: true
        });
    },

    /**
     * create the apps luncher
     * @private
     */
    _createLauncher: function () {
        this.launcherBox = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-box'
        });

        this.launcher = new Launcher.Launcher(this._settings, this);

        this.launcherBox.add(this.launcher.actor, {
            expand: true,
            x_fill: true,
            y_fill: true,
            y_align: St.Align.START
        });

        this.mainBox.add(this.launcherBox, {
            expand: true,
            x_fill: true,
            y_fill: true
        });

    },

    _toggleLauncher: function () {
        log('toggleLauncher');
        if (this._settings.get_boolean('show-launcher')) {
            this._createLauncher();
            log('_createLauncher');
        } else {
            this.launcher.actor.destroy();
            this.launcher = null;
            log('destroy');
        }
    },

    _loadCategories: function () {
        this.appsByCategory = {};
        let tree = new GMenu.Tree({ menu_basename: 'applications.menu' });
        tree.load_sync();
        let root = tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let directory = iter.get_directory();
                if (!directory.get_is_nodisplay()) {
                    let categoryId = directory.get_menu_id();
                    this.appsByCategory[categoryId] = [];
                    this._loadCategory(categoryId, directory);
                    if (this.appsByCategory[categoryId].length > 0) {
                        let categoryItem = new CategoryItem(this, directory, this.appsByCategory[categoryId]);
                        this.categoriesBox.add_actor(categoryItem.actor);
                        this.categoriesBox.add_actor(categoryItem.appsBox);
                        categoryItem.appsBox.hide();
                    }
                }
            }
        }
    },

    // Load menu category data for a single category
    _loadCategory: function(categoryId, dir) {
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
                    this.appsByCategory[categoryId].push(app);
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                if (!subdir.get_is_nodisplay())
                    this._loadCategory(categoryId, subdir);
            }
        }
    },

    selectCategory: function (categoryItem) {
        if (this.currentCategoryItem != null) {
            this.currentCategoryItem.appsBox.hide();
        }

        if (this.currentCategoryItem != null && this.currentCategoryItem.getId() == categoryItem.getId()) {
            categoryItem.appsBox.hide();
            this.currentCategoryItem = null;
        } else {
            categoryItem.appsBox.show();
            this.currentCategoryItem = categoryItem;
        }
    }
});

// Removing the default behaviour which selects a hovered item if the space key is pressed.
// This avoids issues when searching for an app with a space character in its name.
var BaseMenuItem = new Lang.Class({
    Name: 'BaseMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _onKeyPressEvent: function (actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_Return ||
            symbol == Clutter.KEY_KP_Enter) {
            this.activate(event);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
});

/**
 * Category item
 * @type {Lang.Class}
 */
var CategoryItem = new Lang.Class({
    Name: 'CategoryItem',
    Extends: BaseMenuItem,

    // Initialize category item
    _init: function(appsMenu, directory, apps) {
        this.parent();
        this._appsMenu = appsMenu;
        this._directory = directory;

        let name;
        if (this._directory) {
            name = this._directory.get_name();
        } else {
            name = _("Favorites");
        }

        this._icon = new St.Icon({
            gicon: this._directory.get_icon(),
            style_class: 'popup-menu-icon',
            icon_size: APPLICATION_ICON_SIZE
        });
        this.actor.add_child(this._icon);
        let categoryLabel = new St.Label({
            text: name,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.actor.add_child(categoryLabel);
        this.actor.label_actor = categoryLabel;


        this.appsBox = new St.BoxLayout({
            vertical: true,
            style: 'margin-left: ' + (APPLICATION_ICON_SIZE + 10) + 'px;'
        });

        for (let i = 0; i < apps.length; i++) {
            let appItem = new AppItem(apps[i], this._appsMenu);
            this.appsBox.add_actor(appItem.actor);
        }
    },

    // Activate menu item (Display applications in category)
    activate: function(event) {
        this._appsMenu.selectCategory(this);
        this.parent(event);
    },

    // Set button as active, scroll to the button
    setActive: function(active, params) {
        /*if (active && !this.actor.hover) {
            this..scrollToButton(this);
        }*/
        this.parent(active, params);
    },

    getId: function () {
        return this._directory.get_menu_id();
    }
});


// Menu application item class
var AppItem = new Lang.Class({
    Name: 'AppItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    // Initialize menu item
    _init: function(app, appsMenu) {
        this.parent({
            style_class: 'app-item'
        });
        this.app = app;
        this._appsMenu = appsMenu;
        this._iconBin = new St.Bin();
        this.actor.add_child(this._iconBin);

        let appLabel = new St.Label({
            text: app.get_name(),
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.actor.add_child(appLabel);
        this.actor.label_actor = appLabel;

        let textureCache = St.TextureCache.get_default();
        let iconThemeChangedId = textureCache.connect('icon-theme-changed',
            Lang.bind(this, this._updateIcon));

        this.actor.connect('destroy', Lang.bind(this, function() {
            textureCache.disconnect(iconThemeChangedId);
        }));
        this._updateIcon();

        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
    },

    _onDragBegin: function() {
        Main.overview.beginItemDrag(this);
    },

    _onDragCancelled: function() {
        Main.overview.cancelledItemDrag(this);
    },

    _onDragEnd: function() {
        Main.overview.endItemDrag(this);
    },

    _onKeyPressEvent: function (actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_Return ||
            symbol == Clutter.KEY_KP_Enter) {
            this.activate(event);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    },

    get_app_id: function() {
        return this.app.get_id();
    },

    getDragActor: function() {
        return this.app.create_icon_texture(APPLICATION_ICON_SIZE);
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    },

    // Activate menu item (Launch application)
    activate: function(event) {
        this.app.open_new_window(-1);
        this._appsMenu.button.menu.toggle();
        this.parent(event);
    },

    setFakeActive: function(active) {
        if (active) {
          //  this._button.scrollToButton(this);
            //this.actor.add_style_pseudo_class('active');
            this.actor.add_style_class_name('selected');
        } else {
            //this.actor.remove_style_pseudo_class('active');
            this.actor.remove_style_class_name('selected');
        }
    },

    // Grab the key focus
    grabKeyFocus: function() {
        this.actor.grab_key_focus();
    },

    // Update the app icon in the menu
    _updateIcon: function() {
        this._iconBin.set_child(this.app.create_icon_texture(APPLICATION_ICON_SIZE));
    }
});
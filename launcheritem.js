
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const St = imports.gi.St;
const Signals = imports.signals;

const PADDING = 30;

// Launcher item class
var LauncherItem = new Lang.Class({
    Name: 'LauncherItem',
    /*Extends: PopupMenu.PopupBaseMenuItem,*/

    // Initialize menu item
    _init: function (app, appsMenu, settings) {
        this._settings = settings;
        this._appsMenu = appsMenu;
        this.app = app;

        let iconSize = this._settings.get_double('launcher-icon-size');
/*
        this.parent({
            style_class: 'launcher-item',
            reactive: true,
        });*/

        let boxSize = this._settings.get_double('launcher-box-size');
        let size = Math.max(boxSize, iconSize);
        this.actor = new St.BoxLayout({
            fixed_position_set : true,
            style_class: 'launcher-item',
            height: size,
            width: size,
            reactive: true,
            x_expand: true,
            y_expand: true,
            vertical: true,
            style: 'padding-left: 20px'
        });

        this.actor._delegate = this;

       /* this.actor.set_fixed_position_set(true);

        this.actor.set_height(size);
        this.actor.set_width(size);*/

        this.xIndex = null;
        this.yIndex = null;

        this._iconBin = new St.Bin({
          //  style_class: 'icon',
        });

        this.actor.add(this._iconBin, {
            expand: true,
            x_fill: true,
            y_fill: true,
            y_align: St.Align.MIDDLE,
            x_align: St.Align.MIDDLE,
        });

        this.updateIconSize(iconSize);

        this.label = new St.Label({
            text: this.app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
        });

        this.actor.add(this.label, {
            expand: true,
            x_fill: true,
            y_fill: true,
            y_align: St.Align.MIDDLE,
            x_align: St.Align.MIDDLE,
        });

        this._createMenu();
        this._setStyle();

        this._draggable = DND.makeDraggable(this.actor);
        this.isDraggableApp = true;
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));
        this.actor.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
        this.actor.connect('key-focus-out', Lang.bind(this, this._onKeyFocusOut));
        this.actor.connect('notify::visible', Lang.bind(this, this._onVisibilityChanged));

        this._settings.connect('changed::launcher-box-background', Lang.bind(this, this._setStyle));
        this._settings.connect('changed::show-launcher-box-background', Lang.bind(this, this._setStyle));

    },

    _onStyleChanged: function (actor) {
        this._spacing = 0;
    },
    _setStyle: function () {

        let style = '';
        let showBackgroundColor = this._settings.get_boolean('show-launcher-box-background');
        if (showBackgroundColor) {
            let backgroundColor = this._settings.get_string('launcher-box-background');
            let rgb = backgroundColor.split('-');
            style += 'background-color: rgb('+ rgb[0] * 255 +','+ rgb[1] * 255 +','+ rgb[2] * 255 +')';
        }

        this.actor.set_style(style);
    },

    _createMenu: function () {
        this.menu = new PopupMenu.PopupMenu(this.actor, 1.0, St.Side.LEFT);
        Main.uiGroup.add_actor(this.menu.actor);

        this.menu.actor.hide();

        let deleteItem = new LauncherMenuItem('delete');//_('Delete'));
        deleteItem.connect('activate', Lang.bind(this, this._onDeleteClick));

        this.menu.addMenuItem(deleteItem);
    },

    _onDragBegin: function() {
        this.actor.hide();
        Main.overview.beginItemDrag(this);
        this.emit('drag-begin');
    },

    _onDragCancelled: function() {
        this.actor.show();
        Main.overview.cancelledItemDrag(this);
    },

    _onDragEnd: function() {
        this.actor.show();
        Main.overview.endItemDrag(this);
    },

    get_app_id: function() {
        return this.app.get_id();
    },

    getDragActor: function() {
        let item =  new LauncherItem(this.app, this._appsMenu, this._settings);
        return item.actor;
    },

    getDragActorSource: function() {
        return this.actor;
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

    _onDeleteClick: function () {
        this.actor.destroy();
        this.emit('delete');
    },

    _onVisibilityChanged: function () {
        if (!this.actor.visible)
            this.menu.close();
    },

    _onButtonPressEvent: function (actor, event) {
        // This is the CSS active state
        this.actor.add_style_pseudo_class ('active');
        return Clutter.EVENT_PROPAGATE;
    },

    _onButtonReleaseEvent: function (actor, event) {
        this.actor.remove_style_pseudo_class ('active');
        this.activate(event);
        return Clutter.EVENT_STOP;
    },

    _onTouchEvent: function (actor, event) {
        if (event.type() == Clutter.EventType.TOUCH_END) {
            this.actor.remove_style_pseudo_class ('active');
            this.activate(event);
            return Clutter.EVENT_STOP;
        } else if (event.type() == Clutter.EventType.TOUCH_BEGIN) {
            // This is the CSS active state
            this.actor.add_style_pseudo_class ('active');
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
                this.actor.add_style_class_name('selected');
                this.actor.grab_key_focus();
            } else {
                this.actor.remove_style_class_name('selected');
                // Remove the CSS active state if the user press the button and
                // while holding moves to another menu item, so we don't paint all items.
                // The correct behaviour would be to set the new item with the CSS
                // active state as well, but button-press-event is not trigered,
                // so we should track it in our own, which would involve some work
                // in the container
                this.actor.remove_style_pseudo_class ('active');
            }
            //this.emit('active-changed', active);
        }


    },

    setPosition: function (x, y, xIndex, yIndex) {
        this.actor.set_x(x);
        this.actor.set_y(y);
        this.xIndex = xIndex;
        this.yIndex = yIndex;
    },

    // Update the app icon
    updateIconSize: function(iconSize) {
        this._iconBin.set_child(this.app.create_icon_texture(iconSize));
    },

    updateSize: function (boxSize) {
        this.actor.set_height(boxSize);
        this.actor.set_width(boxSize);
    },

    activate: function(event) {
        let mouseButton = event.get_button();
        if (mouseButton == Clutter.BUTTON_PRIMARY) {
            this.app.open_new_window(-1);
            this._appsMenu.button.menu.toggle();
        } else if (mouseButton ==  Clutter.BUTTON_SECONDARY) {
            this.menu.toggle();
        }
    }
});
Signals.addSignalMethods(LauncherItem.prototype);

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
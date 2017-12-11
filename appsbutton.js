
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const AppsMenu = Me.imports.appsmenu;

var APPS_BUTTON_ICON = { //setting: org.gnome.shell.extensions.mymenu.apps-button-icon
    Gnome: 0,
    System: 1,
    Custom: 2
};

var APPS_BUTTON_ICON_PATH = {
    Gnome: '/media/Gnome-start-here.svg'
};

var APPS_BUTTON_APPEARANCE = { // See: org.gnome.shell.extensions.mymenu.apps-button-appearance
    Icon: 0,
    Text: 1,
    Icon_Text: 2,
    Text_Icon: 3
};

var AppsButton = new Lang.Class({
    Name: 'MyMenu.ApspButton',
    Extends: PanelMenu.Button,

    // Initialize the menu
    _init: function (settings) {
        log('MyMenu::AppsButton::init');
        this._settings = settings;
        this.parent(1.0, null, false);


        this.setMenu(new AppsMenu.AppsMenu(this.actor, 1.0, St.Side.TOP, this, this._settings));
        Main.panel.menuManager.addMenu(this.menu);

        this._appsButtonWidget = new AppsButtonWidget();
        this.actor.add_actor(this._appsButtonWidget.actor);
       // this.actor.name = 'panelApplications';

        let widget = this.getWidget();
        widget.hidePanelText();
        widget.hideArrowIcon();

        this._settings.connect('changed::apps-button-appearance', Lang.bind(this, this._setAppearance));

        this._setAppearance();

        log('MyMenu::AppsButton::/init');
    },


    // Handle changes in menu open state
    _onOpenStateChanged: function(menu, open) {
        if (open) {

        }
        this.parent(menu, open);
    },

    getWidget: function() {
        return this._appsButtonWidget;
    },

    /**
     * Set the apps button appearance
     *
     * @private
     */
    _setAppearance: function() {
        let widget = this.getWidget();
        switch (this._settings.get_enum('apps-button-appearance')) {
            case APPS_BUTTON_APPEARANCE.Text:
                widget.hidePanelIcon();
                widget.showPanelText();
                break;
            case APPS_BUTTON_APPEARANCE.Icon_Text:
                widget.hidePanelIcon();
                widget.hidePanelText();
                widget.showPanelIcon();
                widget.showPanelText();
                break;
            case APPS_BUTTON_APPEARANCE.Text_Icon:
                widget.hidePanelIcon();
                widget.hidePanelText();
                widget.showPanelText();
                widget.showPanelIcon();
                break;
            case APPS_BUTTON_APPEARANCE.Icon: /* falls through */
            default:
                widget.hidePanelText();
                widget.showPanelIcon();
        }
        this._setArrow();
    },

    /**
     * Show or hide the arrow of the apps button
     *
     * @private
     */
    _setArrow: function() {
        let widget = this.getWidget();
        if (this._settings.get_boolean('enable-apps-button-arrow')){
            widget.hideArrowIcon();
            widget.showArrowIcon();
        } else {
            widget.hideArrowIcon();
        }
    },

    // Update the icon of the menu button as specified in the settings
    _setButtonIcon: function() {
        let iconFilepath = this._settings.get_string('custom-apps-button-icon');
        let widget = this.getWidget();
        let stIcon = widget.getPanelIcon();

        switch (this._settings.get_enum('apps-button-icon')) {
            case APPS_BUTTON_ICON.Custom:
                if (GLib.file_test(iconFilepath, GLib.FileTest.EXISTS)) {
                    stIcon.set_gicon(Gio.icon_new_for_string(iconFilepath));
                    break;
                }
            case APPS_BUTTON_ICON.Gnome:
                let appsButtonIconPath = Me.path + APPS_BUTTON_ICON_PATH.Gnome;
                if (GLib.file_test(appsButtonIconPath, GLib.FileTest.EXISTS)) {
                    stIcon.set_gicon(Gio.icon_new_for_string(appsButtonIconPath));
                    break;
                }
            case APPS_BUTTON_ICON.System:
            default:
                stIcon.set_icon_name('start-here-symbolic');
        }
    },
});

/**
 * Widget for the apps button
 *
 * @type {Lang.Class}
 */
var AppsButtonWidget = new Lang.Class({
    Name: 'MyMenu.AppsButtonWidget',

    _init: function() {
        this.actor = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
            pack_start: false
        });
        this._arrowIcon = PopupMenu.arrowIcon(St.Side.BOTTOM);
        this._icon = new St.Icon({
            icon_name: 'start-here-symbolic',
            style_class: 'popup-menu-icon'
        });
        this._label = new St.Label({
            text: _("Applications"),
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.actor.add_child(this._icon);
        this.actor.add_child(this._label);
        this.actor.add_child(this._arrowIcon);
    },

    getPanelLabel: function() {
        return this._label;
    },

    getPanelIcon: function() {
        return this._icon;
    },

    showArrowIcon: function() {
        if (!this.actor.contains(this._arrowIcon)) {
            this.actor.add_child(this._arrowIcon);
        }
    },

    hideArrowIcon: function() {
        if (this.actor.contains(this._arrowIcon)) {
            this.actor.remove_child(this._arrowIcon);
        }
    },

    showPanelIcon: function() {
        if (!this.actor.contains(this._icon)) {
            this.actor.add_child(this._icon);
        }
    },

    hidePanelIcon: function() {
        if (this.actor.contains(this._icon)) {
            this.actor.remove_child(this._icon);
        }
    },

    showPanelText: function() {
        if (!this.actor.contains(this._label)) {
            this.actor.add_child(this._label);
        }
    },

    hidePanelText: function() {
        if (this.actor.contains(this._label)) {
            this.actor.remove_child(this._label);
        }
    }
});
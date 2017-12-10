
const Lang = imports.lang;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var ICON_SIZES = [ 16, 24, 32, 40, 48 ];

/**
 * Notebook widget
 */
const Notebook = new GObject.Class({
    Name: 'MyMenu.MyMenuNotebook',
    GTypeName: 'MyMenuNotebook',
    Extends: Gtk.Notebook,

    _init: function() {
        this.parent({
            margin_left: 6,
            margin_right: 6
        });
    },

    append_page: function(notebookPage) {
        Gtk.Notebook.prototype.append_page.call(
            this,
            notebookPage,
            notebookPage.getTitleLabel()
        );
    }
});

/**
 * Notebook page widget
 */
const NotebookPage = new GObject.Class({
    Name: 'MyMenu.MyMenuNotebookPage',
    GTypeName: 'MyMenuNotebookPage',
    Extends: Gtk.Box,

    _init: function(title) {
        this.parent({
            orientation: Gtk.Orientation.VERTICAL,
            margin: 24,
            spacing: 20,
            homogeneous: false
        });
        this._title = new Gtk.Label({
            label: "<b>" + title + "</b>",
            use_markup: true,
            xalign: 0
        });
    },

    getTitleLabel: function() {
        return this._title;
    }
});


/**
 * Frame Box widget
 */
const FrameBox = new Lang.Class({
    Name: 'MyMenu.FrameBox',
    GTypeName: 'MyMenuFrameBox',
    Extends: Gtk.Frame,

    _init: function(label) {
        this.parent({ label_yalign: 1, label: label });
        this._listBox = new Gtk.ListBox();
        this._listBox.set_selection_mode(Gtk.SelectionMode.NONE);
        Gtk.Frame.prototype.add.call(this, this._listBox);
    },

    add: function(boxRow) {
        this._listBox.add(boxRow);
    }
});

/**
 * Frame Box Row widget
 */
const FrameBoxRow = new Lang.Class({
    Name: 'MyMenu.FrameBoxRow',
    GTypeName: 'MyMenuFrameBoxRow',
    Extends: Gtk.ListBoxRow,

    _init: function() {
        this.parent({});
        this._grid = new Gtk.Grid({
            margin: 5,
            column_spacing: 20,
            row_spacing: 20
        });
        Gtk.ListBoxRow.prototype.add.call(this, this._grid);
    },

    add: function(widget) {
        this._grid.add(widget);
    }
});

/**
 * Note book page for button settings
 *
 * @type {Lang.Class}
 */
const ButtonPage = new Lang.Class({
    Name: 'ButtonPage',
    Extends: NotebookPage,

    _init: function(settings) {
        this.parent(_('Apps button'));

        this._settings = settings;

        /*
         * Apps button appearance frame box
         */
       // let appsButtonAppearanceFrame = new FrameBox();
        let appearanceRow = new FrameBoxRow();
        let appearanceLabel = new Gtk.Label({
            label: _("Appearance"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });

        let appearanceCombo = new Gtk.ComboBoxText({ halign:Gtk.Align.END });
        appearanceCombo.append_text(_("Icon"));
        appearanceCombo.append_text(_("Text"));
        appearanceCombo.append_text(_("Icon and Text"));
        appearanceCombo.append_text(_("Text and Icon"));
        appearanceCombo.set_active(this._settings.get_enum('apps-button-appearance'));
        appearanceCombo.connect('changed', Lang.bind (this, function(widget) {
            this._settings.set_enum('apps-button-appearance', widget.get_active());
        }));

        appearanceRow.add(appearanceLabel);
        appearanceRow.add(appearanceCombo);
        //appsButtonAppearanceFrame.add(appsButtonAppearanceRow);
        this.add(appearanceRow);
    }
});



/**
 * Note book page for menu settings
 *
 * @type {Lang.Class}
 */
const MenuPage = new Lang.Class({
    Name: 'MenuPage',
    Extends: NotebookPage,

    _init: function(settings) {
        this.parent(_('Menu'));

        this._settings = settings;



        let launcherFrameBox = new FrameBox(_("Launcher"));

        //Show launcher switch
        let showLauncherRow = new FrameBoxRow();
        let showLauncherLabel = new Gtk.Label({
            label: _("Show launcher"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });

        let showLauncherSwitch = new Gtk.Switch({ halign: Gtk.Align.END });
        showLauncherSwitch.set_active(this._settings.get_boolean('show-launcher'));
        showLauncherSwitch.connect('notify::active', Lang.bind(this, function(check) {
            this._settings.set_boolean('show-launcher', check.get_active());
        }));

        showLauncherRow.add(showLauncherLabel);
        showLauncherRow.add(showLauncherSwitch);
        launcherFrameBox.add(showLauncherRow);


        // launcher icon size
        let launcherIconSizeRow = new FrameBoxRow();
        let iconSize = this._settings.get_double('launcher-icon-size');
        let launcherIconSizeLabel = new Gtk.Label({
            label: _('Icon size'),
            use_markup: true,
            xalign: 0
        });
        let hscale = new Gtk.HScale({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 64,
                step_increment: 1,
                page_increment: 1,
                page_size: 0
            }),
            digits: 0,
            round_digits: 0,
            hexpand: true,
            value_pos: Gtk.PositionType.RIGHT
        });
        hscale.connect('format-value', function(scale, value) { return value.toString() + ' px'; });
        ICON_SIZES.forEach(function(num) {
            hscale.add_mark(num, Gtk.PositionType.BOTTOM, num.toString());
        });
        hscale.set_value(iconSize);
        hscale.connect('value-changed', Lang.bind(this, function(){
            this._settings.set_double('launcher-icon-size', hscale.get_value());
        }));

        launcherIconSizeRow.add(launcherIconSizeLabel);
        launcherIconSizeRow.add(hscale);

        launcherFrameBox.add(launcherIconSizeRow)
        this.add(launcherFrameBox);
    }
});


function init() {
    Convenience.initTranslations(Me.metadata['gettext-domain']);
}

function buildPrefsWidget() {
    log('MyMenu::buildPrefsWidget');
    let settings = Convenience.getSettings(Me.metadata['settings-schema']);

    let box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 5,
        border_width: 5
    });
    let notebook = new Notebook();

    let buttonPage = new ButtonPage(settings);
    notebook.append_page(buttonPage);

    let menuPage = new MenuPage(settings);
    notebook.append_page(menuPage);

    box.add(notebook);
    box.show_all();
    log('MyMenu::/buildPrefsWidget');
    return box;
}
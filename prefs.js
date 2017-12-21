
const Lang = imports.lang;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var ICON_SIZES = [ 16, 24, 32, 40, 48 ];
var BOX_SIZES = [ 32, 40, 48, 56, 64, 76, 88, 100];

function hexToDec(hex) {
    return hex.toLowerCase().split('').reduce( (result, ch) =>
        result * 16 + '0123456789abcdefgh'.indexOf(ch), 0);
}

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


        /*                       launcher icon size                     */
        let launcherIconSizeRow = new FrameBoxRow();
        let iconSize = this._settings.get_double('launcher-icon-size');

        let launcherIconSizeLabel = new Gtk.Label({
            label: _('Icon size'),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });

        let launcherIconSizeHscale = new Gtk.HScale({
            adjustment: new Gtk.Adjustment({
                lower: ICON_SIZES[0],
                upper: ICON_SIZES[ICON_SIZES.length -1],
                step_increment: 1,
                page_increment: 1,
                page_size: 0
            }),
            draw_value: false,
            digits: 0,
            round_digits: 0,
            hexpand: true,
            value_pos: Gtk.PositionType.RIGHT
        });
        launcherIconSizeHscale.connect('format-value', function(scale, value) { return value.toString() + ' px'; });
        ICON_SIZES.forEach(function(num) {
            launcherIconSizeHscale.add_mark(num, Gtk.PositionType.BOTTOM, num.toString());
        });
        launcherIconSizeHscale.set_value(iconSize);

        let launcherIconSizeValueLabel = new Gtk.Label({
            label: iconSize + ' px',
            use_markup: true,
            xalign: 0,
        });

        launcherIconSizeHscale.connect('value-changed', Lang.bind(this, function(){
            let value = launcherIconSizeHscale.get_value();
            this._settings.set_double('launcher-icon-size', value);
            launcherIconSizeValueLabel.set_label(value.toString() + ' px');
        }));

        launcherIconSizeRow.add(launcherIconSizeLabel);
        launcherIconSizeRow.add(launcherIconSizeHscale);
        launcherIconSizeRow.add(launcherIconSizeValueLabel);

        launcherFrameBox.add(launcherIconSizeRow);

        /*                       launcher box size                     */
        let launcherBoxSizeRow = new FrameBoxRow();
        let boxSize = this._settings.get_double('launcher-box-size');
        let launcherBoxSizeLabel = new Gtk.Label({
            label: _('Box size'),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });

        let launcherBoxSizeHscale = new Gtk.HScale({
            adjustment: new Gtk.Adjustment({
                lower: BOX_SIZES[0],
                upper: BOX_SIZES[BOX_SIZES.length - 1],
                step_increment: 1,
                page_increment: 1,
                page_size: 0
            }),
            draw_value: false,
            digits: 0,
            round_digits: 0,
            hexpand: true,
            value_pos: Gtk.PositionType.RIGHT
        });
        launcherBoxSizeHscale.connect('format-value', function(scale, value) { return value.toString() + ' px'; });
        BOX_SIZES.forEach(function(num) {
            launcherBoxSizeHscale.add_mark(num, Gtk.PositionType.BOTTOM, num.toString());
        });
        launcherBoxSizeHscale.set_value(boxSize);

        let launcherBoxSizeValueLabel = new Gtk.Label({
            label: boxSize + ' px',
            use_markup: true,
            xalign: 0,
        });

        launcherBoxSizeHscale.connect('value-changed', Lang.bind(this, function() {
            let value = launcherBoxSizeHscale.get_value();
            this._settings.set_double('launcher-box-size', value);
            launcherBoxSizeValueLabel.set_label(value.toString() + ' px');
        }));

        launcherBoxSizeRow.add(launcherBoxSizeLabel);
        launcherBoxSizeRow.add(launcherBoxSizeHscale);
        launcherBoxSizeRow.add(launcherBoxSizeValueLabel);

        launcherFrameBox.add(launcherBoxSizeRow);


        /*                       launcher box background                     */
        let showLauncherBoxBackgroundRow = new FrameBoxRow();
        let showLauncherBoxBackgroundLabel = new Gtk.Label({
            label: _("Show item background"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });

        let showLauncherBoxBackgroundSwitch = new Gtk.Switch({ halign: Gtk.Align.END });
        showLauncherBoxBackgroundSwitch.set_active(this._settings.get_boolean('show-launcher-box-background'));
        showLauncherBoxBackgroundSwitch.connect('notify::active', Lang.bind(this, function(check) {
            this._settings.set_boolean('show-launcher-box-background', check.get_active());
        }));

        showLauncherBoxBackgroundRow.add(showLauncherBoxBackgroundLabel);
        showLauncherBoxBackgroundRow.add(showLauncherBoxBackgroundSwitch);
        launcherFrameBox.add(showLauncherBoxBackgroundRow);

        /*                       launcher box background                     */
        let launcherBoxColorRow = new FrameBoxRow();
        let boxColor = this._settings.get_string('launcher-box-background');

        let boxColorArray = boxColor.split('-');
        let launcherBoxColorLabel = new Gtk.Label({
            label: _('Default item background'),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });

        let launcherBoxColorButton = new Gtk.ColorButton({
            halign: Gtk.Align.END
        });
        let color = new Gdk.RGBA();
        color.red = boxColorArray[0];
        color.green = boxColorArray[1];
        color.blue = boxColorArray[2];
        color.alpha = 1;

        launcherBoxColorButton.set_rgba(color);
        launcherBoxColorButton.connect("color-set", Lang.bind(this, Lang.bind(this, function(button){
            let color = button.get_rgba();
            log(color.red +'-'+ color.green +'-'+ color.blue);
            this._settings.set_string('launcher-box-background', color.red +'-'+ color.green +'-'+ color.blue);
        })));

        launcherBoxColorRow.add(launcherBoxColorLabel);
        launcherBoxColorRow.add(launcherBoxColorButton);

        launcherFrameBox.add(launcherBoxColorRow);


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
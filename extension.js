const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const AppsButton = Me.imports.appsbutton;

const Main = imports.ui.main;

let appsButton;
let settings;

function init() {
    log('MyMenu::init');
    Convenience.initTranslations(Me.metadata['gettext-domain']);
}

function enable() {
    log('MyMenu::enable');
    settings = Convenience.getSettings(Me.metadata['settings-schema']);
    appsButton = new AppsButton.AppsButton(settings);

    Main.panel.addToStatusArea('mymenu-apps-button', appsButton, 0, 'left');
    log('MyMenu::/enable');
}

function disable() {
    log('MyMenu::disable');

    Main.panel.menuManager.removeMenu(appsButton.menu);
    Main.panel.statusArea['mymenu-apps-button'] = null;
    appsButton.destroy();//remove the button
    log('MyMenu::/disable');
}



import { app, BrowserWindow, Menu, MenuItem, dialog, nativeTheme } from 'electron';
import AppMenu from './AppMenu'
import Settings from './Settings';

export class MainProcess {
  mainWindow: BrowserWindow;
  appMenu: AppMenu;
  settings: Settings;
  constructor() {
    nativeTheme.themeSource = 'dark';    
    app.on('ready', () => {
      this.createWindow();
    })
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.createWindow()
      }
    });
  }

  createWindow (){
    this.settings = new Settings();
    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        nodeIntegration: true
      }
      // fullscreenable:false,
      // maximizable:false
    });
    // mainWindow.webContents.openDevTools();
    this.mainWindow.loadFile('index.html');
    this.mainWindow.on('closed', function () {
      this.mainWindow = null
    });
    this.appMenu = new AppMenu(this);
    this.rebuildMenu();
  }

  rebuildMenu() {
    Menu.setApplicationMenu(this.appMenu.createMenu());
  }
}

new MainProcess();
import { app, BrowserWindow, Menu, MenuItem, dialog, nativeTheme } from 'electron';
import AppMenu from './AppMenu'
import Settings from './Settings';
import MainEventType from '../common/MainEventType';

// 一些暴露给render-process的全局变量
export interface Global {
  settings: Settings
}
declare var global: Global;

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

  createWindow() {
    this.settings = new Settings();
    global.settings = this.settings;
    
    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        enableRemoteModule: true,
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


export default new MainProcess();


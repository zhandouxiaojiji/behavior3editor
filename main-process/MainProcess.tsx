import { app, BrowserWindow, Menu, MenuItem, dialog, nativeTheme } from "electron";
import AppMenu from "./AppMenu";
import Settings from "./Settings";
import MainEventType from "../common/MainEventType";
import electronLocalshortcut from "electron-localshortcut";

// 一些暴露给render-process的全局变量
export interface Global {
    settings: Settings;
}
declare var global: Global;

export class MainProcess {
    mainWindow: BrowserWindow;
    appMenu: AppMenu;
    settings: Settings;
    constructor() {
        nativeTheme.themeSource = "dark";
        app.on("ready", () => {
            this.createWindow();
            this.registerShortcut("CmdOrCtrl+C", () => {
                this.mainWindow.webContents.send(MainEventType.COPY_NODE);
            });
            this.registerShortcut("CmdOrCtrl+V", () => {
                this.mainWindow.webContents.send(MainEventType.PASTE_NODE);
            });
            this.registerShortcut("CmdOrCtrl+Z", () => {
                this.mainWindow.webContents.send(MainEventType.UNDO);
            });
            this.registerShortcut(process.platform === "darwin" ? "Cmd+Shift+Z" : "ctrl+y", () => {
                this.mainWindow.webContents.send(MainEventType.REDO);
            });
        });
        app.on("window-all-closed", () => {
            if (process.platform !== "darwin") {
                app.quit();
            }
        });
        app.on("activate", () => {
            if (this.mainWindow === null) {
                this.createWindow();
            }
        });
    }

    registerShortcut(accelerator: string | string[], callback: () => void) {
        electronLocalshortcut.register(this.mainWindow, accelerator, callback);
    }

    createWindow() {
        this.settings = new Settings();
        global.settings = this.settings;

        this.mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
            // fullscreenable:false,
            // maximizable:false
        });

        require("@electron/remote/main").initialize();
        require("@electron/remote/main").enable(this.mainWindow.webContents);
        this.mainWindow.maximize();
        // mainWindow.webContents.openDevTools();
        this.mainWindow.loadFile("index.html");
        this.mainWindow.on("closed", function () {
            this.mainWindow = null;
        });
        this.appMenu = new AppMenu(this);
        this.rebuildMenu();
    }

    rebuildMenu() {
        Menu.setApplicationMenu(this.appMenu.createMenu());
    }
}

export default new MainProcess();

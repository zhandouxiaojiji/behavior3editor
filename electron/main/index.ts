import { app, BrowserWindow, shell, ipcMain } from "electron";
import { release } from "node:os";
import path, { join } from "node:path";
import { update } from "./update";

import * as fs from "fs";

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, "../");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

interface Workspace {
  projectPath?: string;
  window: BrowserWindow;
}

const preload = "../preload/index.js";
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");
const windows: Workspace[] = [];

async function createWindow(projectPath?: string) {
  const win = new BrowserWindow({
    title: "Behaviour3 Editor",
    frame: false,
    width: 1280,
    height: 800,
    minHeight: 600,
    minWidth: 800,
    closable: true,
    minimizable: true,
    maximizable: true,
    titleBarStyle: "hidden",
    titleBarOverlay:
      process.platform === "darwin"
        ? true
        : { color: "#0d1117", height: 35, symbolColor: "#7d8590" },
    backgroundColor: "#0d1117",
    trafficLightPosition: { x: 10, y: 10 },
    icon: join(process.env.PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  const workspace = { projectPath, window: win };
  windows.push(workspace);

  win.maximizable = true;

  if (process.env.VITE_DEV_SERVER_URL) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.maximize();
    win.loadFile(indexHtml);
  }

  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(1);
    if (workspace.projectPath) {
      win?.webContents.send("open-project", workspace.projectPath);
    }

    const nextWin = BrowserWindow.getAllWindows().at(-1);
    if (nextWin) {
      nextWin.focus();
      nextWin.webContents.send("refresh-app-men");
    }

    win.focus();
  });

  win.on("closed", () => {
    const index = windows.findIndex((w) => w.window === win);
    windows.splice(index, 1);
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  require("@electron/remote/main").enable(win.webContents);

  // Apply electron-updater
  // update(win);
}

app.whenReady().then(() => {
  require("@electron/remote/main").initialize();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  createWindow();
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();

  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (event, arg: string | undefined) => {
  if (arg) {
    let workspace = windows.find((v) => v.projectPath === arg);
    if (workspace) {
      workspace.window.focus();
      return;
    }

    workspace = windows.find((v) => v.window.webContents.id === event.sender.id);
    if (!workspace.projectPath) {
      workspace.projectPath = arg;
      workspace.window.webContents.send("open-project", arg);
      return;
    }
  }

  createWindow(arg);
});

ipcMain.handle("trashItem", (_, arg: string) => {
  arg = arg.replace(/\//g, path.sep);
  shell.trashItem(arg).catch((e) => console.error(e));
});

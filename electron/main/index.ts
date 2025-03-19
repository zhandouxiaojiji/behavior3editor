import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";
import { VERSION, type FileVarDecl } from "../../src/misc/b3type";
import * as b3util from "../../src/misc/b3util";
import Path from "../../src/misc/path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check command line arguments
let buildProject: string | undefined;
let buildOutput: string | undefined;
let buildHelp: boolean = false;

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--project") {
    buildProject = argv[i + 1];
    i++;
  } else if (arg === "--build") {
    buildOutput = argv[i + 1];
    i++;
  } else if (arg === "--help") {
    buildHelp = true;
  }
}

const printHelp = () => {
  console.log(`Usage: Behavior3 Editor ${VERSION} [options]`);
  console.log("Options:");
  console.log("  --project <path>  Set the project path");
  console.log("  --build <path>    Set the build output path");
  console.log("  --help            Print this help");
};

if (buildOutput || buildProject || buildHelp) {
  if (buildHelp) {
    printHelp();
    app.quit();
    process.exit(1);
  } else if (!buildOutput || !buildProject) {
    console.error("build output or project is not set");
    printHelp();
    app.quit();
    process.exit(1);
  }
  try {
    let hasError = false;
    const project = Path.posixPath(buildProject!);
    const buildDir = Path.posixPath(buildOutput!);
    console.log("start build project:", project);
    if (!project.endsWith(".b3-workspace")) {
      throw new Error(`'${project}' is not a workspace`);
    }
    const workdir = Path.dirname(project);
    b3util.initWorkdir(workdir, (msg) => {
      console.error(`${msg}`);
    });
    for (const path of Path.ls(Path.dirname(project), true)) {
      if (path.endsWith(".json")) {
        const buildpath = buildDir + "/" + path.substring(workdir.length + 1);
        const treeModel = b3util.createBuildData(path);
        if (!treeModel) {
          continue;
        }
        if (treeModel.export === false) {
          console.log("skip:", buildpath);
          continue;
        }
        console.log("build:", buildpath);
        const declare: FileVarDecl = {
          import: treeModel.import.map((v) => ({ path: v, vars: [], depends: [] })),
          declvar: treeModel.declvar.map((v) => ({ name: v.name, desc: v.desc })),
          subtree: [],
        };
        b3util.refreshDeclare(treeModel, declare);
        if (!b3util.checkNodeData(treeModel?.root)) {
          hasError = true;
        }
        fs.mkdirSync(Path.dirname(buildpath), { recursive: true });
        fs.writeFileSync(buildpath, JSON.stringify(treeModel, null, 2));
      }
    }
    if (hasError) {
      console.error("build failed***");
      app.quit();
      process.exit(1);
    } else {
      console.log("build completed");
    }
  } catch (error) {
    console.error("build failed***");
    app.quit();
    process.exit(1);
  }
  app.quit();
  process.exit(0);
}

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

interface Workspace {
  projectPath?: string;
  window: BrowserWindow;
}

const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");
const windows: Workspace[] = [];

async function createWindow(projectPath?: string) {
  const win = new BrowserWindow({
    title: "Behaviour3 Editor",
    icon: Path.join(process.env.VITE_PUBLIC, "favicon.ico"),
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

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.maximize();
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
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

    if (buildOutput && buildProject && windows.length === 0) {
      app.exit(0);
    } else {
      buildOutput = undefined;
      buildProject = undefined;
    }
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  require("@electron/remote/main").enable(win.webContents);

  // Auto update
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
ipcMain.handle("open-win", (event, arg) => {
  if (arg) {
    let workspace = windows.find((v) => v.projectPath === arg);
    if (workspace) {
      workspace.window.focus();
      return;
    }

    workspace = windows.find((v) => v.window.webContents.id === event.sender.id);
    if (workspace && !workspace.projectPath) {
      workspace.projectPath = arg;
      workspace.window.webContents.send("open-project", arg);
      return;
    }
  }

  createWindow(arg);
});

ipcMain.handle("trashItem", (_, arg) => {
  arg = arg.replace(/\//g, path.sep);
  shell.trashItem(arg).catch((e) => console.error(e));
});

ipcMain.handle("showItemInFolder", (_, arg) => {
  arg = arg.replace(/\//g, path.sep);
  shell.showItemInFolder(arg);
});

import { BrowserView, Menu, app, shell, dialog, BrowserWindow, MenuItem, WebContents } from 'electron';
import MainEventType from '../common/MainEventType';
import { MainProcess } from './main';
import Settings from './Settings';

export default class AppMenu {
  private mainProcess: MainProcess;
  private mainWindow: BrowserWindow;
  private webContents: WebContents;
  private settings: Settings;

  constructor(mainProcess: MainProcess) {
    this.mainProcess = mainProcess;
    this.mainWindow = mainProcess.mainWindow;
    this.settings = mainProcess.settings;
  }

  createMenu() {
    const menu: Menu = new Menu();
    menu.append(this.createFileMenu());
    menu.append(this.createNodeMenu());
    menu.append(this.createSettingsMenu());
    menu.append(this.createToolsMenu());
    return menu;
  }

  private createFileMenu() {
    return new MenuItem({
      label: "行为树",
      submenu: [
        {
          label: "打开文件",
          accelerator: "Ctrl+O",
          click: () => {
            (async () => {
              const res = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                  { name: "Json", extensions: ['json'] }
                ]
              });
              this.webContents.send(MainEventType.OPEN_FILE, res.filePaths[0]);
            })();
          }
        },
        {
          label: "打开目录",
          accelerator: "Ctrl+Shift+O",
          click: () => {
            (async () => {
              const res = await dialog.showOpenDialog({
                properties: ['openDirectory']
              });
              if (res.filePaths.length > 0) {
                this.webContents.send(MainEventType.OPEN_WORKSPACE, res.filePaths[0]);
              }
            })();
          }
        },
        { type: 'separator' },
        {
          label: "最近打开",
          submenu: []
        },
        {
          label: "最近目录",
          submenu: [
            { label: "master" },
            { label: "分支0908" },
          ]
        },
        { type: 'separator' },
        {
          label: "关闭",
          click: () => {
            app.quit();
          }
        }
      ]
    });
  }

  private createSettingsMenu() {
    return new MenuItem({
      label: "设置",
      submenu: [
        {
          label: "节点定义",
          submenu: [
            {
              label: "选择文件",
              click: () => {
                (async () => {
                  const res = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [
                      { name: "Json", extensions: ['json'] }
                    ]
                  });
                  if (res.filePaths.length > 0) {
                    const nodeConfigPath = res.filePaths[0];
                    this.settings.set({ nodeConfigPath });
                    this.mainProcess.rebuildMenu();
                  }
                })();
              }
            },
            { type: 'separator' },
            { label: this.settings.nodeConfigPath, }
          ]
        }
      ]
    });
  }

  private createToolsMenu() {
    return new MenuItem({
      label: "开发工具",
      submenu: [
        {
          label: "打开控制台",
          accelerator: "Ctrl+Shift+I",
          click: (_, browserWindow) => {
            browserWindow.webContents.toggleDevTools();
          }
        },
        {
          label: "重载",
          accelerator: "Ctrl+R",
          click: (_, browserWindow) => {
            browserWindow.reload();
          }
        },
      ]
    });
  }

  private createNodeMenu() {
    return new MenuItem({
      label: "新建节点"
    });
  }
}
import { Menu, app, dialog, BrowserWindow, MenuItem, WebContents, MenuItemConstructorOptions } from 'electron';
import MainEventType from '../common/MainEventType';
import { MainProcess } from './MainProcess';
import Settings from './Settings';

export default class AppMenu {
  private mainProcess: MainProcess;
  private mainWindow: BrowserWindow;
  private webContents: WebContents;
  private settings: Settings;

  constructor(mainProcess: MainProcess) {
    this.mainProcess = mainProcess;
    this.mainWindow = mainProcess.mainWindow;
    this.webContents = mainProcess.mainWindow.webContents;
    this.settings = mainProcess.settings;
  }

  createMenu() {
    const menu: Menu = new Menu();
    menu.append(this.createWorkspaceMenu());
    menu.append(this.createFileMenu());
    menu.append(this.createNodeMenu());
    menu.append(this.createToolsMenu());
    return menu;
  }

  private createFileMenu() {
    const fileItems: MenuItemConstructorOptions[] = [];
    for (let path of this.settings.recentFiles) {
      fileItems.push({
        label: path,
        click: () => {
          console.log("open recent file", path);
        }
      })
    }


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
              if (res.filePaths.length > 0) {
                const path = res.filePaths[0];
                if (this.settings.recentFiles.indexOf(path) < 0) {
                  this.settings.recentFiles.unshift(path);
                  this.settings.save();
                  this.mainProcess.rebuildMenu();
                }
                this.webContents.send(MainEventType.OPEN_FILE, path);
              }
            })();
          }
        },
        { type: 'separator' },
        {
          label: "最近打开",
          submenu: fileItems,
        },

        { type: 'separator' },
        {
          label: "保存",
          click: () => {
            this.webContents.send(MainEventType.SAVE);
          },
        },
        {
          label: "全部保存",
          click: () => {
            this.webContents.send(MainEventType.SAVE_ALL);
          },
        },
      ]
    });
  }

  private createWorkspaceMenu() {
    const openWorkspace = (path: string) => {
      this.settings.curWorkspace.setFilepath(path);
      this.settings.curWorkspace.load();
      this.settings.pushRecentWorkspace(path);
      this.mainProcess.rebuildMenu();
      this.webContents.send(MainEventType.OPEN_DIR, this.settings.curWorkspace.getWorkdir());
    };
    const saveToNewPath = () => {
      (async () => {
        const res = await dialog.showSaveDialog({
          properties: ['showOverwriteConfirmation'],
          filters: [
            { name: "Json", extensions: ['json'] }
          ]
        });
        if (!res.canceled) {
          this.settings.curWorkspace.setFilepath(res.filePath);
          this.settings.curWorkspace.save();
        }
      })();
    }
    const recentItems: MenuItemConstructorOptions[] = [];
    for (let path of this.settings.recentWorkspaces) {
      recentItems.push({
        label: path,
        click: () => {
          console.log("open recent workspace", path);
          openWorkspace(path);
        }
      })
    }
    return new MenuItem({
      label: "工作区",
      submenu: [
        {
          label: "打开",
          click: () => {
            (async () => {
              const res = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                  { name: "Json", extensions: ['json'] }
                ]
              });
              if (res.filePaths.length > 0) {
                openWorkspace(res.filePaths[0]);
              }
            })();
          }
        },
        {
          label: "保存",
          click: () => {
            if (this.settings.curWorkspace.getFilepath()) {
              this.settings.curWorkspace.save();
            } else {
              saveToNewPath();
            }
          }
        },
        {
          label: '另存为',
          click: () => {
            saveToNewPath();
          },
        },
        {
          label: "最近打开",
          submenu: recentItems,
        },
        { type: 'separator' },
        {
          label: "打开目录",
          accelerator: "Ctrl+Shift+O",
          click: () => {
            if (!this.settings.curWorkspace.getNodeConfPath()) {
              dialog.showErrorBox("警告", "请先指定节点定义配置!");
              return;
            }
            (async () => {
              const res = await dialog.showOpenDialog({
                properties: ['openDirectory']
              });
              if (res.filePaths.length > 0) {
                const path = res.filePaths[0];
                this.settings.curWorkspace.setWorkdir(path);
                this.settings.curWorkspace.save();
                this.webContents.send(MainEventType.OPEN_DIR, path);
              }
            })();
          }
        },
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
                    this.settings.curWorkspace.setNodeConfPath(nodeConfigPath);
                    this.mainProcess.rebuildMenu();
                  }
                })();
              }
            },
            { type: 'separator' },
            { label: this.settings.nodeConfPath, }
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
    const classifyItems: MenuItemConstructorOptions[] = [];
    const map: { [key: string]: MenuItemConstructorOptions } = {}
    for (let t of this.settings.nodeClassify) {
      let item: MenuItemConstructorOptions = {
        id: t.classify,
        label: `${t.classify}(${t.desc})`,
        submenu: [],
      };
      classifyItems.push(item);
      map[t.classify] = item;
    }
    const other: MenuItemConstructorOptions = {
      id: 'other',
      label: "其它",
      submenu: [],
    };
    var hasOther = false;

    for (let node of this.settings.nodeConfig) {
      const item: MenuItemConstructorOptions = {
        label: `${node.name}(${node.desc})`,
        click: () => {
          console.log("create node", node.name);
          this.webContents.send(MainEventType.CREATE_NODE, node.name);
        }
      }
      let typeItem = map[node.type];
      if (!typeItem) {
        typeItem = other;
        hasOther = true;
      }
      if (typeItem.submenu instanceof Menu) {
        console.log("typeItem.submenu error", typeItem);
      } else {
        typeItem.submenu.push(item);
      }
    }

    if (hasOther) {
      classifyItems.push(other);
    }

    const unknonwItem: MenuItemConstructorOptions = {
      label: '空白节点',
      click: () => {
        this.webContents.send(MainEventType.CREATE_NODE, 'unknow');
      }
    }
    classifyItems.push(unknonwItem);

    return new MenuItem({
      label: "新建节点",
      submenu: classifyItems
    });
  }
}
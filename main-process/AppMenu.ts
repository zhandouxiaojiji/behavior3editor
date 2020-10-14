import { BrowserView, Menu, app, shell, dialog, BrowserWindow, MenuItem } from 'electron';
import EventType from '../common/EventType';

export function initMenu(mainWindow: BrowserWindow) {
  const menu: Menu = new Menu();
  const fileMenu: MenuItem = new MenuItem({
    label: "行为树",
    submenu: [
      {
        label: "打开文件",
        accelerator: "Ctrl+O",
        click: () => {
          (async () => {
            const res = await dialog.showOpenDialog({
              properties: ['openFile', 'openDirectory']
            });
            console.log("open res", res);
            mainWindow.webContents.send(EventType.MAIN_OPEN_FILE, res);
          })();
        }
      },
      {
        label: "打开目录",
        accelerator: "Ctrl+Shift+O"

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

  const toolsMenu: MenuItem = new MenuItem({
    label: "开发工具",
    submenu: [
      {
        label: "重载",
        accelerator: "Ctrl+R",
        click: (_, browserWindow) => {
          browserWindow.reload();
        }
      },
      {
        label: "打开控制台",
        accelerator: "Ctrl+Shift+I",
        click: (_, browserWindow) => {
          browserWindow.webContents.toggleDevTools();
        }
      }
    ]
  });

  menu.append(fileMenu);
  menu.append(toolsMenu);

  Menu.setApplicationMenu(menu);
}

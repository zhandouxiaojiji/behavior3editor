import { BrowserView, Menu, app, shell, dialog, BrowserWindow, MenuItem } from 'electron';

export function initMenu () {
  const menu: Menu = new Menu();
  const menuItem: MenuItem = new MenuItem({
    label: "test",
  });
  menu.append(menuItem);
  Menu.setApplicationMenu(menu);
}

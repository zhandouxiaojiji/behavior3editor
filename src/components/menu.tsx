import { useSetting } from "@/contexts/setting-context";
import { useWorkspace } from "@/contexts/workspace-context";
import * as b3util from "@/misc/b3util";
import i18n from "@/misc/i18n";
import { Hotkey, isMacos, sendInputEvent } from "@/misc/keys";
import { CheckOutlined } from "@ant-design/icons";
import { Menu as AppMenu, BrowserWindow, app, dialog } from "@electron/remote";
import { Button, DropDownProps, Dropdown, Flex, FlexProps, LayoutProps, Space } from "antd";
import { ItemType } from "antd/es/menu/hooks/useItems";
import { ipcRenderer } from "electron";
import { MenuItemConstructorOptions } from "electron/renderer";
import * as fs from "fs";
import { FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PiTreeStructureFill } from "react-icons/pi";

const MenuItemLabel: FC<FlexProps> = (itemProps) => {
  return (
    <Flex
      gap="50px"
      style={{ minWidth: "160px", justifyContent: "space-between", alignItems: "center" }}
      {...itemProps}
    ></Flex>
  );
};

const getFocusedWebContents = () => {
  return BrowserWindow.getFocusedWindow()?.webContents;
};

ipcRenderer.on("open-project", (_, dir) => {
  useWorkspace.getState().init(dir);
});

ipcRenderer.on("refresh-app-men", () => {
  // trigger refresh
  useSetting.getState().load();
});

export const Menu: FC<LayoutProps> = () => {
  const { t } = useTranslation();
  const [trigger, setTrigger] = useState<DropDownProps["trigger"]>(["click"]);
  const workspace = {
    batchProject: useWorkspace((state) => state.batchProject),
    buildProject: useWorkspace((state) => state.buildProject),
    createProject: useWorkspace((state) => state.createProject),
    editing: useWorkspace((state) => state.editing),
    init: useWorkspace((state) => state.init),
    open: useWorkspace((state) => state.open),
    openProject: useWorkspace((state) => state.openProject),
    path: useWorkspace((state) => state.path),
    save: useWorkspace((state) => state.save),
    saveAll: useWorkspace((state) => state.saveAll),
    workdir: useWorkspace((state) => state.workdir),
  };
  const enabled = !!workspace.workdir;
  const homedir = app.getPath("home");
  const settings = {
    recent: useSetting((state) => state.recent),
  };

  const menuTemplate: MenuItemConstructorOptions[] = useMemo(() => {
    const recentWorkspaces: MenuItemConstructorOptions[] = settings.recent.map((path, i) => ({
      id: "menu.file.recent" + i,
      label: path.replace(homedir, "~"),
      click: () => workspace.openProject(path),
    }));
    return [
      // { role: 'appMenu' }
      ...(isMacos
        ? [
            {
              id: "menu.app",
              label: app.name,
              submenu: [
                { label: t("about"), role: "about" },
                { type: "separator" },
                { label: t("services"), role: "services" },
                { type: "separator" },
                { label: t("hide"), role: "hide" },
                { label: t("hideOthers"), role: "hideOthers" },
                { label: t("unhide"), role: "unhide" },
                { type: "separator" },
                { label: t("quit"), role: "quit" },
              ],
            },
          ]
        : []),
      {
        id: "menu.file",
        label: t("menu.file"),
        submenu: [
          {
            id: "menu.file.newFile",
            label: t("newFile"),
            accelerator: "CmdOrCtrl+N",
            enabled: enabled,
            click: () => {
              console.log("newFile");
              const path = dialog.showSaveDialogSync({
                properties: ["showOverwriteConfirmation"],
                filters: [{ name: "Json", extensions: ["json"] }],
              });
              if (path) {
                fs.writeFileSync(path, JSON.stringify(b3util.createNewTree(path), null, 2));
                workspace.open(path);
              }
            },
          },
          {
            id: "menu.file.newWindow",
            label: t("newWindow"),
            click: () => {
              ipcRenderer.invoke("open-win");
            },
          },
          { type: "separator" },
          {
            id: "menu.file.openProject",
            label: t("openProject"),
            click: () => workspace.openProject(),
          },
          {
            id: "menu.file.createProject",
            label: t("createProject"),
            click: () => workspace.createProject(),
          },
          { id: "menu.file.recent", label: t("recent"), submenu: recentWorkspaces },
          { type: "separator" },
          {
            id: "menu.file.save",
            label: t("save"),
            accelerator: "CmdOrCtrl+S",
            enabled: enabled,
            click: () => {
              console.log("save1");
              workspace.save();
            },
          },
          {
            id: "menu.file.saveAs",
            label: t("saveAs"),
            accelerator: "Shift+CmdOrCtrl+S",
            enabled: enabled,
          },
          {
            id: "menu.file.saveAll",
            label: t("saveAll"),
            accelerator: "Alt+CmdOrCtrl+S",
            enabled: enabled,
            click: () => workspace.saveAll(),
          },
          { type: "separator" },
          {
            id: "menu.file.build",
            label: t("build"),
            accelerator: "CmdOrCtrl+B",
            enabled: enabled,
            click: () => {
              workspace.buildProject();
            },
          },
          {
            id: "menu.file.batch",
            label: t("batch"),
            enabled: enabled,
            click: () => workspace.batchProject(),
          },
        ],
      },
      {
        id: "menu.edit",
        label: t("menu.edit"),
        submenu: [
          {
            id: "menu.edit.undo",
            label: t("undo"),
            enabled: enabled,
            accelerator: Hotkey.Undo,
            click: () => {
              sendInputEvent(Hotkey.Undo);
              getFocusedWebContents()?.undo();
            },
          },
          {
            id: "menu.edit.redo",
            label: t("redo"),
            enabled: enabled,
            accelerator: Hotkey.Redo,
            click: () => {
              sendInputEvent(Hotkey.Redo);
              getFocusedWebContents()?.redo();
            },
          },
          { type: "separator" },
          {
            id: "menu.edit.copy",
            label: t("copy"),
            enabled: enabled,
            accelerator: Hotkey.Copy,
            click: () => {
              sendInputEvent(Hotkey.Copy);
              getFocusedWebContents()?.copy();
            },
          },
          {
            id: "menu.edit.paste",
            label: t("paste"),
            enabled: enabled,
            accelerator: Hotkey.Paste,
            click: () => {
              sendInputEvent(Hotkey.Paste);
              getFocusedWebContents()?.paste();
            },
          },
          {
            id: 'menu.edit.cut',
            label: t('cut'),
            enabled: enabled,
            accelerator: Hotkey.Cut,
            click: () => {
              getFocusedWebContents()?.cut()
            }
          },
          {
            id: 'menu.edit.selectAll',
            label: t('selectAll'),
            enabled: enabled,
            accelerator: Hotkey.SelectAll,
            click: () => {
              getFocusedWebContents()?.selectAll()
            }
          },
          { type: "separator" },
          {
            id: "menu.edit.insertNode",
            label: t("insertNode"),
            enabled: enabled,
            click: () => {
              workspace.editing?.dispatch("insert");
            },
          },
          {
            id: "menu.edit.deleteNode",
            label: t("deleteNode"),
            enabled: enabled,
            click: () => {
              workspace.editing?.dispatch("delete");
            },
          },
        ],
      },
      // { role: 'viewMenu' }
      {
        id: "menu.view",
        label: t("menu.view"),
        submenu: [
          {
            id: "menu.view.reload",
            label: t("reload"),
            accelerator: "CmdOrCtrl+R",
            click: () => {
              const path = workspace.path;
              getFocusedWebContents()?.reload();
              workspace.init(path);
            },
          },
          {
            id: "menu.view.devTools",
            label: t("devTools"),
            accelerator: "Alt+CmdOrCtrl+I",
            click: () => {
              getFocusedWebContents()?.openDevTools();
            },
          },
          { type: "separator" },
          {
            id: "menu.view.actualSize",
            label: t("actualSize"),
            click: () => {
              const webContents = getFocusedWebContents();
              if (webContents) {
                webContents.setZoomFactor(1);
              }
            },
          },
          {
            id: "menu.view.zoomIn",
            label: t("zoomIn"),
            click: () => {
              const webContents = getFocusedWebContents();
              if (webContents) {
                webContents.setZoomFactor(webContents.getZoomFactor() + 0.1);
              }
            },
          },
          {
            id: "menu.view.zoomOut",
            label: t("zoomOut"),
            click: () => {
              const webContents = getFocusedWebContents();
              if (webContents) {
                webContents.setZoomFactor(webContents.getZoomFactor() - 0.1);
              }
            },
          },
          { type: "separator" },
          {
            id: "menu.view.fullscreen",
            label: t("fullscreen"),
            click: () => {
              const window = BrowserWindow.getFocusedWindow();
              if (window) {
                window.setFullScreen(!window.isFullScreen());
              }
            },
          },
          { type: "separator" },
          {
            id: "menu.view.language",
            label: t("language"),
            submenu: [
              {
                id: "menu.view.language.english",
                label: "English",
                type: "radio",
                checked: i18n.language?.startsWith("en"),
                click: () => {
                  i18n.changeLanguage("en");
                },
              },
              {
                id: "menu.view.language.chinese",
                label: "简体中文",
                type: "radio",
                checked: i18n.language?.startsWith("zh"),
                click: () => {
                  i18n.changeLanguage("zh");
                },
              },
            ],
          },
        ],
      },
      {
        id: "menu.help",
        label: t("menu.help"),
        submenu: [
          {
            id: "menu.help.about",
            label: t("reportIssue"),
            click: () => {
              window.open("https://github.com/zhandouxiaojiji/behavior3editor");
            },
          },
        ],
      },
    ] as MenuItemConstructorOptions[];
  }, [t, workspace.workdir, settings.recent, workspace.editing]);

  if (isMacos) {
    const menu = AppMenu.buildFromTemplate(menuTemplate);
    AppMenu.setApplicationMenu(menu);
  }

  if (!process.env.VITE_DEV_SERVER_URL && isMacos) {
    return <div />;
  }

  return (
    <Flex className="b3-menu" vertical={false} align="center" style={{ paddingLeft: "10px" }}>
      <PiTreeStructureFill size="25px" style={{ paddingRight: "5px" }} />
      <Space size={2} className="b3-no-drag-region">
        {menuTemplate.map((item, index) => {
          const items = item.submenu as MenuItemConstructorOptions[];
          if (item.label === app.name) {
            return undefined;
          }
          const createItem = (option: MenuItemConstructorOptions): ItemType => {
            if (option.type === "separator") {
              return {
                type: "divider",
              };
            }
            const keys = (option.accelerator?.split("+") ?? []).map((key) => {
              const lowerKey = key.toLowerCase();
              if (lowerKey.indexOf("alt") !== -1) {
                return isMacos ? "⌥" : "Alt";
              } else if (
                lowerKey.indexOf("cmdorctrl") !== -1 ||
                lowerKey.indexOf("ctrl") !== -1 ||
                lowerKey.indexOf("meta") !== -1
              ) {
                return isMacos ? "⌘" : "Ctrl";
              } else if (lowerKey.indexOf("shift") !== -1) {
                return isMacos ? "⇧" : "Shift";
              } else {
                return key.toUpperCase().replace("=", "+");
              }
            });
            const ctrl = keys.indexOf("ctrl");
            if (ctrl >= 0) {
              keys.splice(ctrl, 1);
              keys.unshift("Ctrl");
            }
            const subItems = option.submenu as MenuItemConstructorOptions[] | undefined;
            return {
              label: (
                <MenuItemLabel>
                  <div>
                    {option.type === "radio" && option.checked && (
                      <CheckOutlined style={{ paddingRight: "5px" }} />
                    )}
                    {option.type === "radio" && !option.checked && (
                      <div
                        style={{
                          display: "inline-block",
                          width: "20px",
                        }}
                      ></div>
                    )}
                    {option.label}
                  </div>
                  <div>{keys.join(isMacos ? " " : "+")}</div>
                </MenuItemLabel>
              ),
              key: option.id ?? "",
              disabled: option.enabled === false,
              onClick: () => {
                option.click?.(null!, null!, null!);
              },
              children: subItems?.map((subOption) => createItem(subOption)),
            };
          };
          return (
            <Dropdown
              trigger={trigger}
              key={`menu${index}`}
              dropdownRender={(node) => {
                return <div className="b3-app-menu">{node}</div>;
              }}
              menu={{
                items: items.map((value) => createItem(value)),
              }}
            >
              <Button type="text" size="small" onClick={() => setTrigger(["hover"])}>
                {item.label}
              </Button>
            </Dropdown>
          );
        })}
      </Space>
    </Flex>
  );
};

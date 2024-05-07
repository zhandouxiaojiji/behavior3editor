import { FileTreeType, useWorkspace } from "@/contexts/workspace-context";
import { NodeDef, getNodeType } from "@/misc/b3type";
import * as b3util from "@/misc/b3util";
import { modal } from "@/misc/hooks";
import { Hotkey, isHotkeyPressed, isMacos, useHotkeys } from "@/misc/keys";
import Path from "@/misc/path";
import { DownOutlined } from "@ant-design/icons";
import { Button, Dropdown, Flex, FlexProps, Input, MenuProps, Space, Tree } from "antd";
import { ItemType } from "antd/es/menu/hooks/useItems";
import { ipcRenderer, shell } from "electron";
import * as fs from "fs";
import React, { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsBoxFill } from "react-icons/bs";
import { FaExclamationTriangle, FaSwatchbook } from "react-icons/fa";
import { FiCommand, FiDelete } from "react-icons/fi";
import { IoMdReturnLeft } from "react-icons/io";
import { PiTreeStructureFill } from "react-icons/pi";

const { DirectoryTree } = Tree;

type MenuInfo = Parameters<Exclude<MenuProps["onClick"], undefined>>[0];
type MenuEvent =
  | "open"
  | "newFile"
  | "newFolder"
  | "revealFile"
  | "rename"
  | "delete"
  | "paste"
  | "copy"
  | "move"
  | "duplicate";

export type NodeTreeType = {
  title: string;
  def?: NodeDef;
  icon?: React.ReactNode;
  isLeaf?: boolean;
  children?: NodeTreeType[];
  style?: React.CSSProperties;
};

const findFile = (path: string | undefined, node: FileTreeType): FileTreeType | undefined => {
  if (!path) {
    return;
  } else if (node.path === path) {
    return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const ret = findFile(path, child);
      if (ret) {
        return ret;
      }
    }
  }
};

const findParent = (node: FileTreeType, parent?: FileTreeType): FileTreeType | undefined => {
  if (parent && parent.children) {
    if (parent.children?.indexOf(node) >= 0) {
      return parent;
    }
    for (const child of parent.children) {
      const v = findParent(node, child);
      if (v) {
        return v;
      }
    }
  }
};

const resolveKeys = (path: string, node: FileTreeType, keys: React.Key[]) => {
  if (node.path === path) {
    return true;
  }
  if (node.children) {
    keys.push(node.path);
    for (const child of node.children) {
      if (resolveKeys(path, child, keys)) {
        return true;
      }
    }
    keys.pop();
  }
  return false;
};

// rename file
const renameFile = (oldPath: string, newPath: string) => {
  const workspace = useWorkspace.getState();
  if (fs.existsSync(newPath)) {
    return false;
  } else if (oldPath !== newPath) {
    try {
      fs.renameSync(oldPath, newPath);
      const isDirectory = fs.statSync(newPath).isDirectory();
      for (const editor of workspace.editors) {
        if (isDirectory) {
          if (editor.path.startsWith(oldPath)) {
            editor.dispatch("rename", editor.path.replace(oldPath, newPath));
          }
        } else {
          if (editor.path === oldPath) {
            editor.dispatch("rename", newPath);
          }
        }
      }
      return true;
    } catch (e) {
      console.error(e);
    }
  }
  return false;
};

export const Explorer: FC = () => {
  const workspace = {
    close: useWorkspace((state) => state.close),
    editing: useWorkspace((state) => state.editing),
    editors: useWorkspace((state) => state.editors),
    fileTree: useWorkspace((state) => state.fileTree),
    nodeDefs: useWorkspace((state) => state.nodeDefs),
    workdir: useWorkspace((state) => state.workdir),
    onEditingNodeDef: useWorkspace((state) => state.onEditingNodeDef),
    open: useWorkspace((state) => state.open),
  };
  const { t } = useTranslation();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(
    workspace.fileTree?.path ? [workspace.fileTree.path] : []
  );
  const [copyFile, setCopyFile] = useState("");
  const [newName, setNewName] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ItemType[]>([]);

  if (workspace.fileTree) {
    workspace.fileTree.icon = (
      <Flex justify="center" align="center" style={{ height: "100%" }}>
        <FaSwatchbook />
      </Flex>
    );
  }

  const nodeTree = useMemo(() => {
    const data: NodeTreeType = {
      title: t("nodeDefinition"),
      icon: (
        <Flex justify="center" align="center" style={{ height: "100%" }}>
          <PiTreeStructureFill size={19} />
        </Flex>
      ),
      children: [],
      style: {
        fontWeight: "bold",
        fontSize: "13px",
      },
    };
    workspace.nodeDefs.forEach((nodeDef) => {
      let catalog = data.children?.find((nt) => nt.title === nodeDef.type);
      if (!catalog) {
        const type = getNodeType(nodeDef);
        catalog = {
          title: nodeDef.type,
          children: [],
          icon: (
            <Flex justify="center" align="center" style={{ height: "100%" }}>
              <img
                className="b3-node-icon"
                style={{ width: "13px", height: "13px", color: "white" }}
                src={`./icons/${type}.svg`}
              />
            </Flex>
          ),
        };
        data.children?.push(catalog);
      }
      catalog.children?.push({
        title: `${nodeDef.name}(${nodeDef.desc})`,
        isLeaf: true,
        def: nodeDef,
        icon: nodeDef.icon ? (
          <Flex justify="center" align="center" style={{ height: "100%" }}>
            <img
              className="b3-node-icon"
              key={catalog.title}
              style={{ width: "13px", height: "13px", color: "white" }}
              src={
                process.env.VITE_DEV_SERVER_URL && isMacos
                  ? `${Path.basename(workspace.workdir)}/${nodeDef.icon}`
                  : `${workspace.workdir}/${nodeDef.icon}`
              }
            />
          </Flex>
        ) : (
          <Flex justify="center" align="center" style={{ height: "100%" }}>
            <BsBoxFill style={{ width: "12px", height: "12px", color: "white" }} />{" "}
          </Flex>
        ),
      });
    });
    data.children?.sort((a, b) => a.title.localeCompare(b.title));
    data.children?.forEach((child) =>
      child.children?.sort((a, b) => a.title.localeCompare(b.title))
    );
    return data;
  }, [t, workspace.nodeDefs]);

  useEffect(() => {
    if (workspace.editing) {
      const keys: React.Key[] = [];
      resolveKeys(workspace.editing.path, workspace.fileTree!, keys);
      for (const k of expandedKeys) {
        if (keys.indexOf(k) === -1) {
          keys.push(k);
        }
      }
      setExpandedKeys(keys);
      setSelectedKeys([workspace.editing.path]);
    }
  }, [workspace.editing]);

  const keysRef = useHotkeys<HTMLDivElement>(
    [
      Hotkey.F2,
      Hotkey.Enter,
      Hotkey.Copy,
      Hotkey.Paste,
      Hotkey.Delete,
      Hotkey.MacDelete,
      Hotkey.Escape,
      Hotkey.Duplicate,
    ],
    (event) => {
      event.preventDefault();
      const node = findFile(selectedKeys[0], workspace.fileTree!);
      if (isHotkeyPressed(Hotkey.F2) || (isMacos && isHotkeyPressed(Hotkey.Enter))) {
        if (node && node !== workspace.fileTree) {
          node.editing = true;
          setNewName("");
        }
      } else if (isHotkeyPressed(Hotkey.Delete) || isHotkeyPressed(Hotkey.MacDelete)) {
        if (node && node !== workspace.fileTree) {
          dispatch("delete", node);
        }
      } else if (isHotkeyPressed(Hotkey.Escape)) {
        if (node) {
          node.editing = false;
          setNewName(null);
        }
      } else if (isHotkeyPressed(Hotkey.Duplicate)) {
        if (node && node.isLeaf) {
          dispatch("duplicate", node);
        }
      } else if (isHotkeyPressed(Hotkey.Copy)) {
        if (node && node.isLeaf) {
          dispatch("copy", node);
        }
      } else if (isHotkeyPressed(Hotkey.Paste)) {
        if (node) {
          dispatch("paste", node);
        }
      }
    }
  );

  const submitRename = (node: FileTreeType) => {
    if (!newName) {
      if (fs.existsSync(node.path)) {
        node.editing = false;
      } else {
        const parent = findParent(node, workspace.fileTree);
        if (parent && parent.children) {
          parent.children = parent.children.filter((v) => v !== node);
        }
      }
      setNewName(null);
      return;
    }
    if (node.path.endsWith("/:")) {
      node.path = Path.dirname(node.path) + "/" + newName.replace(/[^\w. _-]+/g, "");
      node.title = Path.basename(node.path);
      fs.mkdirSync(node.path);
    } else if (node.path.endsWith("/.json")) {
      node.path = Path.dirname(node.path) + "/" + newName.replace(/[^\w. _-]+/g, "") + ".json";
      node.title = Path.basename(node.path);
      fs.writeFileSync(node.path, JSON.stringify(b3util.createNewTree(node.title), null, 2));
      workspace.open(node.path);
    } else {
      const newpath = Path.dirname(node.path) + "/" + newName + Path.extname(node.path);
      if (renameFile(node.path, newpath)) {
        setSelectedKeys([newpath]);
      }
    }
    node.editing = false;
    setNewName(null);
  };

  const dispatch = (event: MenuEvent, node: FileTreeType, dest?: FileTreeType) => {
    switch (event) {
      case "open": {
        workspace.open(node.path);
        break;
      }
      case "newFolder": {
        const folderNode: FileTreeType = {
          path: node.path + "/:",
          title: "",
          children: [],
          editing: true,
        };
        node.children?.unshift(folderNode);
        setNewName("");
        if (expandedKeys.indexOf(node.path) === -1) {
          setExpandedKeys([node.path, ...expandedKeys]);
        }
        break;
      }
      case "newFile": {
        const folderNode: FileTreeType = {
          path: node.path + "/.json",
          title: "",
          isLeaf: true,
          editing: true,
        };
        node.children?.unshift(folderNode);
        setNewName("");
        if (expandedKeys.indexOf(node.path) === -1) {
          setExpandedKeys([node.path, ...expandedKeys]);
        }
        break;
      }
      case "paste": {
        if (copyFile) {
          let folder = node.path;
          if (node.isLeaf) {
            folder = Path.dirname(node.path);
          }
          const newPath = folder + "/" + Path.basename(copyFile);
          if (fs.existsSync(newPath)) {
            if (node.path === newPath) {
              dispatch("duplicate", node);
            } else {
              const alert = modal.confirm({
                centered: true,
                content: (
                  <Flex vertical gap="middle">
                    <div>
                      <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
                    </div>
                    <div>{t("explorer.replaceFile", { name: Path.basename(copyFile) })}</div>
                  </Flex>
                ),
                footer: (
                  <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
                    <Flex vertical gap="6px">
                      <Button
                        danger
                        onClick={() => {
                          workspace.close(newPath);
                          renameFile(node.path, newPath);
                          alert.destroy();
                        }}
                      >
                        {t("replace")}
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => {
                          alert.destroy();
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </Flex>
                  </Flex>
                ),
              });
            }
          } else {
            fs.copyFileSync(copyFile, newPath);
          }
        }
        break;
      }
      case "copy": {
        setCopyFile(node.path);
        break;
      }
      case "duplicate": {
        for (let i = 1; ; i++) {
          const dupName = Path.basenameWithoutExt(node.path) + " " + i + ".json";
          const dupPath = Path.dirname(node.path) + "/" + dupName;
          if (!fs.existsSync(dupPath)) {
            fs.copyFileSync(node.path, dupPath);
            setSelectedKeys([dupPath]);
            break;
          }
        }
        break;
      }
      case "delete": {
        if (node === workspace.fileTree) {
          return;
        }
        if (node.isLeaf) {
          const alert = modal.confirm({
            centered: true,
            content: (
              <Flex vertical gap="middle">
                <div>
                  <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
                </div>
                <div>{t("explorer.deleteFile", { name: node.title })}</div>
              </Flex>
            ),
            footer: (
              <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
                <Flex vertical gap="6px">
                  <Button
                    onClick={() => {
                      alert.destroy();
                      if (node.path === workspace.editing?.path) {
                        workspace.close(node.path);
                      }
                      ipcRenderer.invoke("trashItem", node.path);
                    }}
                  >
                    {t("moveToTrash")}
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      alert.destroy();
                    }}
                  >
                    {t("cancel")}
                  </Button>
                </Flex>
                <div style={{ fontSize: "11px", textAlign: "center" }}>
                  {t("explorer.restoreFileInfo")}
                </div>
              </Flex>
            ),
          });
        } else {
          const alert = modal.confirm({
            centered: true,
            content: (
              <Flex vertical gap="middle">
                <div>
                  <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
                </div>
                <div>{t("explorer.deleteFolder", { name: node.title })}</div>
              </Flex>
            ),
            footer: (
              <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
                <Flex vertical gap="6px">
                  <Button
                    onClick={() => {
                      workspace.editors.forEach((editor) => {
                        if (editor.path.startsWith(node.path + "/")) {
                          workspace.close(editor.path);
                        }
                      });
                      ipcRenderer.invoke("trashItem", node.path);
                      alert.destroy();
                    }}
                  >
                    {t("moveToTrash")}
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      alert.destroy();
                    }}
                  >
                    {t("cancel")}
                  </Button>
                </Flex>
                <div style={{ fontSize: "11px", textAlign: "center" }}>
                  {t("explorer.restoreFileInfo")}
                </div>
              </Flex>
            ),
          });
        }
        break;
      }
      case "move": {
        try {
          const newPath = dest!.path + "/" + Path.basename(node.path);
          const doMove = () => {
            fs.renameSync(node.path, newPath);
            for (const editor of workspace.editors) {
              if (editor.path.startsWith(node.path)) {
                editor.dispatch("rename", dest!.path + "/" + Path.basename(editor.path));
              }
              console.log("editor move", editor.path === newPath, editor.path, newPath);
              if (editor.path.startsWith(newPath)) {
                console.log("editor reload", editor.path === newPath, editor.path, newPath);
                editor.dispatch("reload");
              }
            }
          };
          if (fs.existsSync(newPath)) {
            const alert = modal.confirm({
              centered: true,
              content: (
                <Flex vertical gap="middle">
                  <div>
                    <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
                  </div>
                  <div>{t("explorer.replaceFile", { name: Path.basename(node.path) })}</div>
                </Flex>
              ),
              footer: (
                <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
                  <Flex vertical gap="6px">
                    <Button
                      danger
                      onClick={() => {
                        console.log("close file", newPath);
                        workspace.close(node.path);
                        doMove();
                        alert.destroy();
                      }}
                    >
                      {t("replace")}
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => {
                        alert.destroy();
                      }}
                    >
                      {t("cancel")}
                    </Button>
                  </Flex>
                </Flex>
              ),
            });
          } else {
            doMove();
          }
        } catch (error) {
          console.error("move file:", error);
        }
        break;
      }
      case "revealFile":
        ipcRenderer.invoke("showItemInFolder", node.path);
        break;
      case "rename": {
        node.editing = true;
        setNewName("");
        break;
      }
    }
  };

  // context menu
  const fileContextMenu = useMemo(() => {
    const MenuItem: FC<FlexProps> = (itemProps) => {
      return (
        <Flex
          gap="50px"
          style={{ minWidth: "200px", justifyContent: "space-between", alignItems: "center" }}
          {...itemProps}
        ></Flex>
      );
    };

    const arr: MenuProps["items"] = [
      {
        label: (
          <MenuItem>
            <div>{t("open")}</div>
          </MenuItem>
        ),
        key: "open",
      },
      {
        label: (
          <MenuItem>
            <div>{t("copy")}</div>
            <div>{isMacos ? "⌘ C" : "Ctrl+C"}</div>
          </MenuItem>
        ),
        key: "copy",
      },
      {
        label: (
          <MenuItem>
            <div>{t("duplicate")}</div>
            <div>{isMacos ? "⌘ D" : "Ctrl+D"}</div>
          </MenuItem>
        ),
        key: "duplicate",
      },
      {
        label: (
          <MenuItem>
            <div>{isMacos ? t("revealFileOnMac") : t("revealFileOnWindows")}</div>
          </MenuItem>
        ),
        key: "revealFile",
      },
      {
        label: (
          <MenuItem>
            <div>{t("rename")}</div>
            {isMacos && <IoMdReturnLeft />}
            {!isMacos && <div>F2</div>}
          </MenuItem>
        ),
        key: "rename",
      },
      {
        label: (
          <MenuItem>
            <div>{t("delete")}</div>
            {isMacos && (
              <Space size={6}>
                <FiCommand />
                <FiDelete />
              </Space>
            )}
          </MenuItem>
        ),
        key: "delete",
      },
    ];
    return arr;
  }, [t]);

  const directoryContextMenu = useMemo(() => {
    const MenuItem: FC<FlexProps> = (itemProps) => {
      return (
        <Flex
          gap="50px"
          style={{ minWidth: "200px", justifyContent: "space-between", alignItems: "center" }}
          {...itemProps}
        ></Flex>
      );
    };

    const arr: MenuProps["items"] = [
      {
        label: (
          <MenuItem>
            <div>{t("newFile")}</div>
          </MenuItem>
        ),
        key: "newFile",
      },
      {
        label: (
          <MenuItem>
            <div>{t("newFolder")}</div>
          </MenuItem>
        ),
        key: "newFolder",
      },
      {
        label: (
          <MenuItem>
            <div>{isMacos ? t("revealFileOnMac") : t("revealFileOnWindows")}</div>
          </MenuItem>
        ),
        key: "revealFile",
      },
      {
        label: (
          <MenuItem>
            <div style={{ color: copyFile ? "inherit" : "gray" }}>{t("paste")}</div>
            <div style={{ color: copyFile ? "inherit" : "gray" }}>{isMacos ? "⌘ V" : "Ctrl+V"}</div>
          </MenuItem>
        ),
        key: "paste",
      },
      {
        label: (
          <MenuItem>
            <div>{t("rename")}</div>
            {isMacos && <IoMdReturnLeft />}
            {!isMacos && <div>F2</div>}
          </MenuItem>
        ),
        key: "rename",
      },
      {
        label: (
          <MenuItem>
            <div>{t("delete")}</div>
            {isMacos && (
              <Space size={6}>
                <FiCommand />
                <FiDelete />
              </Space>
            )}
          </MenuItem>
        ),
        key: "delete",
      },
    ];
    return arr;
  }, [t, copyFile]);

  const onClick = (info: MenuInfo) => {
    const node = findFile(selectedKeys[0], workspace.fileTree!) ?? workspace.fileTree;
    if (node) {
      dispatch(info.key as MenuEvent, node);
    }
  };

  if (!workspace.fileTree) {
    return null;
  }

  return (
    <Flex
      className="b3-explorer"
      vertical
      ref={keysRef}
      tabIndex={-1}
      style={{ height: "100%" }}
      onContextMenuCapture={() => {
        setContextMenu(directoryContextMenu);
      }}
    >
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("explorer.title")}</span>
      </div>
      <Flex
        vertical
        className={isMacos ? undefined : "b3-overflow"}
        style={{ overflow: "auto", height: "100%", paddingBottom: "20px" }}
      >
        <Dropdown menu={{ items: contextMenu, onClick }} trigger={["contextMenu"]}>
          <div>
            <DirectoryTree
              tabIndex={-1}
              treeData={workspace.fileTree ? [workspace.fileTree] : []}
              fieldNames={{ key: "path" }}
              onExpand={(keys) => {
                setExpandedKeys(keys);
              }}
              onRightClick={(info) => {
                if (info.node.isLeaf) {
                  setContextMenu(fileContextMenu);
                }
                setSelectedKeys([info.node.path]);
              }}
              onSelect={(_, info) => {
                const node = info.selectedNodes.at(0);
                if (node) {
                  if (!node.children) {
                    workspace.open(node.path);
                  }
                  setSelectedKeys([node.path]);
                }
                if (node && !node.children) {
                  workspace.open(node.path);
                }
              }}
              onDrop={(info) => {
                dispatch("move", info.dragNode, info.node);
              }}
              titleRender={(node) => {
                if (node.editing) {
                  return (
                    <div style={{ display: "inline-flex" }}>
                      <Input
                        defaultValue={Path.basenameWithoutExt(node.title)}
                        autoFocus
                        style={{ padding: "0px 0px", borderRadius: "2px" }}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewName(e.target.value)}
                        onPressEnter={() => {
                          if (newName) {
                            submitRename(node);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyUp={(e) => {
                          if (e.code === Hotkey.Escape) {
                            if (!fs.existsSync(node.path)) {
                              const parent = findParent(node, workspace.fileTree);
                              if (parent && parent.children) {
                                parent.children = parent.children.filter((v) => v !== node);
                              }
                            }
                            node.editing = false;
                            setNewName(null);
                          }
                        }}
                        onBlur={() => submitRename(node)}
                      ></Input>
                    </div>
                  );
                } else {
                  return (
                    <div style={{ flex: 1, width: 0, minWidth: 0 }}>
                      <div
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {node.title}
                      </div>
                    </div>
                  );
                }
              }}
              allowDrop={(options) => {
                return !options.dropNode.isLeaf;
              }}
              onDragStart={(e) => {
                e.event.dataTransfer.setData("explore-file", e.node.path);
              }}
              defaultExpandedKeys={[workspace.fileTree.path]}
              draggable={newName !== null ? false : { icon: false }}
              expandedKeys={expandedKeys}
              switcherIcon={<DownOutlined />}
              selectedKeys={selectedKeys}
            />
          </div>
        </Dropdown>
        <DirectoryTree
          tabIndex={-1}
          fieldNames={{ key: "title" }}
          treeData={nodeTree ? [nodeTree] : []}
          draggable={{ icon: false, nodeDraggable: (node) => !!node.isLeaf }}
          titleRender={(node) => (
            <div style={{ flex: 1, width: 0, minWidth: 0 }}>
              <div
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.title}
              </div>
            </div>
          )}
          onSelect={(_, info) => {
            const node = info.node;
            if (node && node.isLeaf) {
              workspace.onEditingNodeDef({
                data: node.def!,
              });
            }
          }}
          onDragStart={(e) => {
            e.event.dataTransfer.setData("explore-node", e.node.def?.name ?? "");
          }}
          switcherIcon={<DownOutlined />}
        />
      </Flex>
    </Flex>
  );
};

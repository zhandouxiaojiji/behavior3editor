import { useSetting } from "@/contexts/setting-context";
import { EditorStore, useWorkspace } from "@/contexts/workspace-context";
import { modal } from "@/misc/hooks";
import { Hotkey, isHotkeyPressed, isMacos, setInputFocus, useHotkeys } from "@/misc/keys";
import Path from "@/misc/path";
import { app } from "@electron/remote";
import { Button, Flex, Layout, Space, Tabs, Tag, Tooltip } from "antd";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaExclamationTriangle, FaRegFolderOpen } from "react-icons/fa";
import { PiTreeStructureFill } from "react-icons/pi";
import { VscNewFolder, VscRepo } from "react-icons/vsc";
import useForceUpdate from "use-force-update";
import { useWindowSize } from "usehooks-ts";
import { Editor } from "./editor";
import { Explorer } from "./explorer";
import { Inspector } from "./inspector";
import { TitleBar } from "./titlebar";

const { Header, Content, Sider } = Layout;

export const Workspace: FC = () => {
  const workspace = {
    buildProject: useWorkspace((state) => state.buildProject),
    close: useWorkspace((state) => state.close),
    createProject: useWorkspace((state) => state.createProject),
    edit: useWorkspace((state) => state.edit),
    editing: useWorkspace((state) => state.editing),
    editors: useWorkspace((state) => state.editors),
    fileTree: useWorkspace((state) => state.fileTree),
    find: useWorkspace((state) => state.find),
    init: useWorkspace((state) => state.init),
    isShowingSearch: useWorkspace((state) => state.isShowingSearch),
    onShowingSearch: useWorkspace((state) => state.onShowingSearch),
    openProject: useWorkspace((state) => state.openProject),
    save: useWorkspace((state) => state.save),
  };
  const settings = {
    recent: useSetting((state) => state.recent),
  };
  const [isShowingSave, setShowingSave] = useState(false);
  const { t } = useTranslation();
  const forceUpdate = useForceUpdate();
  const { width = 0, height = 0 } = useWindowSize();

  const keysRef = useHotkeys<HTMLDivElement>(
    [Hotkey.Save, Hotkey.CloseEditor, Hotkey.SearchTree, Hotkey.Build, Hotkey.SearchNode],
    (event) => {
      if (isHotkeyPressed(Hotkey.Save)) {
        event.preventDefault();
        workspace.save();
      } else if (isHotkeyPressed(Hotkey.CloseEditor)) {
        if (workspace.editing) {
          event.preventDefault();
          if (workspace.editing.unsave) {
            showSaveDialog(workspace.editing);
          } else {
            workspace.close(workspace.editing.path);
          }
        }
      } else if (isHotkeyPressed(Hotkey.SearchTree)) {
        event.preventDefault();
        workspace.onShowingSearch(true);
      } else if (isHotkeyPressed(Hotkey.Build)) {
        event.preventDefault();
        workspace.buildProject();
      } else if (isHotkeyPressed(Hotkey.SearchNode)) {
        event.preventDefault();
        workspace.editing?.dispatch("searchNode");
      }
    }
  );

  useEffect(() => {
    if (!workspace.isShowingSearch && !isShowingSave) {
      keysRef.current?.focus();
    }
  }, [workspace.isShowingSearch]);

  const showSaveDialog = (editor: EditorStore) => {
    if (isShowingSave) {
      return;
    }
    setShowingSave(true);
    const alert = modal.confirm({
      centered: true,
      content: (
        <Flex vertical gap="middle">
          <div>
            <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
          </div>
          <div>{t("workspace.saveOnClose", { name: Path.basename(editor.path) })}</div>
        </Flex>
      ),
      footer: (
        <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
          <Flex vertical gap="6px">
            <Button
              type="primary"
              onClick={() => {
                editor.dispatch("save");
                workspace.close(editor.path);
                alert.destroy();
                keysRef.current?.focus();
                setShowingSave(false);
              }}
            >
              {t("save")}
            </Button>
            <Button
              danger
              onClick={() => {
                workspace.close(editor.path);
                alert.destroy();
                keysRef.current?.focus();
                setShowingSave(false);
              }}
            >
              {t("donotSave")}
            </Button>
          </Flex>
          <Button
            onClick={() => {
              alert.destroy();
              keysRef.current?.focus();
              setShowingSave(false);
            }}
          >
            {t("cancel")}
          </Button>
        </Flex>
      ),
    });
  };

  const showSaveAllDialog = (unsaves: EditorStore[]) => {
    if (isShowingSave) {
      return;
    }
    setShowingSave(true);
    const alert = modal.confirm({
      centered: true,
      content: (
        <Flex vertical gap="middle">
          <div>
            <FaExclamationTriangle style={{ fontSize: "60px", color: "#FADB14" }} />
          </div>
          {unsaves.length == 1 && (
            <div>{t("workspace.saveOnClose", { name: Path.basename(unsaves[0].path) })}</div>
          )}
          {unsaves.length > 1 && (
            <>
              <div>{t("workspace.saveAllOnClose", { count: unsaves.length })}</div>
              <Flex vertical style={{ fontSize: "12px" }}>
                {unsaves.map((editor) => (
                  <div>{Path.basename(editor.path)}</div>
                ))}
              </Flex>
            </>
          )}
        </Flex>
      ),
      footer: (
        <Flex vertical gap="middle" style={{ paddingTop: "30px" }}>
          <Flex vertical gap="6px">
            <Button
              type="primary"
              onClick={() => {
                unsaves.forEach((editor) => editor.dispatch("save"));
                alert.destroy();
                window.close();
                setShowingSave(false);
              }}
            >
              {unsaves.length > 1 ? t("saveAll") : t("save")}
            </Button>
            <Button
              danger
              onClick={() => {
                workspace.editors.length = 0;
                alert.destroy();
                window.close();
                setShowingSave(false);
              }}
            >
              {t("donotSave")}
            </Button>
          </Flex>
          <Button
            onClick={() => {
              alert.destroy();
              setShowingSave(false);
            }}
          >
            {t("cancel")}
          </Button>
        </Flex>
      ),
    });
  };

  window.onbeforeunload = (e) => {
    const unsaves = workspace.editors.filter((editor) => editor.unsave);
    if (unsaves.length) {
      showSaveAllDialog(unsaves);
      return false;
    }
  };

  return (
    <Layout
      className="b3-workspace"
      tabIndex={-1}
      ref={keysRef}
      style={{ width: width, height: height }}
    >
      <Header
        style={{
          padding: "0px",
          height: "fit-content",
          borderBottom: `1px solid var(--b3-color-border)`,
        }}
      >
        <TitleBar />
      </Header>
      <Layout
        hasSider
        style={{ overflow: "hidden" }}
        onFocus={(e) => {
          setInputFocus(e.target);
        }}
      >
        {workspace.fileTree && (
          <Sider
            width={300}
            style={{
              height: "100%",
              borderRight: `1px solid var(--b3-color-border)`,
            }}
          >
            <Explorer />
          </Sider>
        )}
        <Content>
          {!workspace.fileTree && (
            <Flex vertical align="center" style={{ height: "100%" }}>
              <Flex
                vertical
                style={{
                  fontSize: "15px",
                  width: "fit-content",
                  height: "100%",
                  paddingTop: "50px",
                  paddingBottom: "50px",
                }}
              >
                <Flex
                  align="center"
                  gap="5px"
                  style={{ fontSize: "40px", fontWeight: "600", marginBottom: "10px" }}
                >
                  <PiTreeStructureFill size="50px" />
                  <div>Behavior3 Editor</div>
                </Flex>
                <Flex vertical style={{ paddingLeft: "55px", paddingBottom: "15px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "500" }}>{t("start")}</div>
                  <Flex
                    align="center"
                    gap="5px"
                    style={{
                      width: "fit-content",
                      fontWeight: "500",
                      cursor: "pointer",
                      color: "var(--ant-color-primary)",
                    }}
                    onClick={() => workspace.createProject()}
                  >
                    <VscNewFolder size="20px" />
                    {t("createProject")}
                  </Flex>
                  <Flex
                    align="center"
                    gap="5px"
                    style={{
                      fontWeight: "500",
                      width: "fit-content",
                      cursor: "pointer",
                      color: "var(--ant-color-primary)",
                    }}
                    onClick={() => workspace.openProject()}
                  >
                    <VscRepo size="19px" />
                    {t("openProject")}
                  </Flex>
                </Flex>
                <Flex vertical style={{ paddingLeft: "55px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "500" }}>{t("recent")}</div>
                  <div style={{ overflow: "auto", height: "100%" }}>
                    {settings.recent.map((path) => {
                      const homedir = app.getPath("home");
                      return (
                        <div key={path}>
                          <span
                            onClick={() => workspace.openProject(path)}
                            style={{
                              color: "var(--ant-color-primary)",
                              fontWeight: "500",
                              cursor: "pointer",
                              marginRight: "15px",
                            }}
                          >
                            {Path.basename(path)}
                          </span>
                          <span>{Path.dirname(path).replace(homedir, "~")}</span>
                        </div>
                      );
                    })}
                  </div>
                </Flex>
              </Flex>
            </Flex>
          )}
          {workspace.editors.length == 0 && (
            <Flex vertical align="center" justify="center" style={{ height: "100%" }}>
              <Flex
                vertical
                gap="10px"
                style={{
                  color: "gray",
                  fontSize: "15px",
                  width: "fit-content",
                  paddingTop: "50px",
                  marginRight: "150px",
                  paddingBottom: "50px",
                }}
              >
                {[
                  { label: t("searchFile"), hotkeys: isMacos ? "⌘ P" : "Ctrl + P" },
                  { label: t("build"), hotkeys: isMacos ? "⌘ B" : "Ctrl + B" },
                  { label: t("searchNode"), hotkeys: isMacos ? "⌘ F" : "Ctrl + F" },
                  { label: t("insertNode"), hotkeys: "Enter" },
                  { label: t("deleteNode"), hotkeys: "Backspace" },
                ].map((v) => (
                  <Flex
                    key={v.label}
                    gap="20px"
                    style={{
                      minWidth: "200px",
                    }}
                  >
                    <span style={{ width: "150px", textAlign: "end" }}>{v.label}</span>
                    <Space size={5}>
                      {v.hotkeys.split(" ").map((key, index) => (
                        <div key={index}>
                          {key === "+" && <div>+</div>}
                          {key !== "+" && (
                            <Tag style={{ color: "gray", fontSize: "14px", marginRight: 0 }}>
                              {key}
                            </Tag>
                          )}
                        </div>
                      ))}
                    </Space>
                  </Flex>
                ))}
              </Flex>
            </Flex>
          )}
          {workspace.editors.length > 0 && (
            <Tabs
              hideAdd
              type="editable-card"
              activeKey={workspace.editing?.path}
              onEdit={(activeKey, action) => {
                if (action === "remove") {
                  const path = activeKey as string;
                  const editor = workspace.find(path);
                  if (editor && editor.unsave) {
                    showSaveDialog(editor);
                  } else {
                    workspace.close(path);
                  }
                }
              }}
              onChange={(activeKey) => {
                workspace.edit(activeKey);
              }}
              items={workspace.editors.map((v) => {
                return {
                  label: (
                    <Tooltip
                      arrow={false}
                      placement="bottom"
                      mouseEnterDelay={1}
                      // mouseLeaveDelay={100}
                      color="#010409"
                      overlayStyle={{ userSelect: "none", WebkitUserSelect: "none" }}
                      autoAdjustOverflow={true}
                      overlayInnerStyle={{
                        width: "fit-content",
                        border: "1px solid var(--b3-color-border)",
                        borderRadius: "4px",
                      }}
                      title={<div style={{ width: "max-content" }}>{v.path}</div>}
                    >
                      {`${Path.basename(v.path)}${v.unsave ? "*" : ""}`}
                    </Tooltip>
                  ),
                  key: v.path,
                  children: <Editor data={v} onUpdate={forceUpdate} />,
                };
              })}
            />
          )}
        </Content>
        <Inspector />
      </Layout>
    </Layout>
  );
};

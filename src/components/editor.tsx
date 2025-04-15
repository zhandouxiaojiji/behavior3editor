import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined } from "@ant-design/icons";
import { useSize } from "ahooks";
import { Button, Dropdown, Flex, FlexProps, Input, InputRef, MenuProps } from "antd";
import * as fs from "fs";
import React, { FC, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiDelete } from "react-icons/fi";
import { IoMdReturnLeft } from "react-icons/io";
import { RiFocus3Line } from "react-icons/ri";
import { VscCaseSensitive } from "react-icons/vsc";
import { mergeRefs } from "react-merge-refs";
import { useDebounceCallback } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";
import {
  EditEvent,
  EditNode,
  EditorStore,
  EditTree,
  useWorkspace,
} from "../contexts/workspace-context";
import i18n from "../misc/i18n";
import { Hotkey, isMacos, useKeyDown } from "../misc/keys";
import { mergeClassNames } from "../misc/util";
import { FilterOption, Graph } from "./graph";
import "./register-node";

export interface EditorProps extends React.HTMLAttributes<HTMLElement> {
  data: EditorStore;
  onChange: () => void;
}

const createMenu = () => {
  const t = i18n.t;
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
          <div>{t("copy")}</div>
          <div>{isMacos ? "⌘ C" : "Ctrl+C"}</div>
        </MenuItem>
      ),
      key: "copy",
    },
    {
      label: (
        <MenuItem>
          <div>{t("paste")}</div>
          <div>{isMacos ? "⌘ V" : "Ctrl+V"}</div>
        </MenuItem>
      ),
      key: "paste",
    },
    {
      label: (
        <MenuItem>
          <div>{t("replace")}</div>
          <div>{isMacos ? "⇧ ⌘ V" : "Ctrl+Shift+V"} </div>
        </MenuItem>
      ),
      key: "replace",
    },
    {
      label: (
        <MenuItem>
          <div>{t("insertNode")}</div>
          <div>{isMacos ? <IoMdReturnLeft /> : "Enter"}</div>
        </MenuItem>
      ),
      key: "insert",
    },
    {
      label: (
        <MenuItem>
          <div>{t("deleteNode")}</div>
          <div>{isMacos ? <FiDelete /> : "Backspace"}</div>
        </MenuItem>
      ),
      key: "delete",
    },
    {
      label: (
        <MenuItem>
          <div>{t("editSubtree")}</div>
          <div></div>
        </MenuItem>
      ),
      key: "editSubtree",
    },
    {
      label: (
        <MenuItem>
          <div>{t("saveAsSubtree")}</div>
          <div></div>
        </MenuItem>
      ),
      key: "saveAsSubtree",
    },
  ];
  return arr;
};

const hotkeyMap: Record<string, EditEvent> = {
  [Hotkey.Copy]: "copy",
  [Hotkey.Replace]: "replace",
  [Hotkey.Paste]: "paste",
  [Hotkey.Insert]: "insert",
  [Hotkey.Enter]: "insert",
  [Hotkey.Delete]: "delete",
  [Hotkey.Backspace]: "delete",
  [Hotkey.Undo]: "undo",
  [Hotkey.Redo]: "redo",
};

export const Editor: FC<EditorProps> = ({ onChange, data: editor, ...props }) => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      editing: state.editing,
    }))
  );

  const keysRef = useRef<HTMLDivElement>(null);
  useKeyDown(
    [
      Hotkey.Copy,
      Hotkey.Replace,
      Hotkey.Paste,
      Hotkey.Insert,
      Hotkey.Enter,
      Hotkey.Delete,
      Hotkey.Backspace,
    ],
    keysRef,
    (e, key) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      editor.dispatch?.(hotkeyMap[key]);
    }
  );

  useKeyDown([Hotkey.Undo, Hotkey.Redo], null, (e, key) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    e.stopPropagation();
    editor.dispatch?.(hotkeyMap[key]);
  });

  const searchInputRef = useRef<InputRef>(null);
  const graphRef = useRef(null);
  const sizeRef = useRef(null);
  const editorSize = useSize(sizeRef);
  const { t } = useTranslation();
  const menuItems = useMemo(() => createMenu(), [t]);
  const [graph, setGraph] = useState<Graph>(null!);

  const [showingSearch, setShowingSearch] = useState(false);
  const [filterOption, setFilterOption] = useState<FilterOption>({
    results: [],
    index: 0,
    filterStr: "",
    filterCase: false,
    filterFocus: true,
    filterType: "content",
    placeholder: "",
  });

  const onSearchChange = async (option: FilterOption) => {
    option.results.length = 0;
    graph.hightlightSearch(option, graph.data.root);
    setFilterOption({
      ...option,
    });
    if (option.results.length > 0) {
      const idx = option.index < option.results.length ? option.index : 0;
      graph.expandElement();
      graph.focusNode(option.results[idx]);
    } else {
      graph.selectNode(null);
    }
  };

  const updateSearchState = () => {
    const option = { ...filterOption };
    option.results.length = 0;
    graph.hightlightSearch(option, graph.data.root);
    setFilterOption({
      ...option,
    });
  };

  const onDebounceSearchChange = useDebounceCallback(onSearchChange, 100);

  const nextResult = () => {
    const { results, index } = filterOption;
    if (results.length > 0) {
      const idx = (index + 1) % results.length;
      setFilterOption({ ...filterOption, index: idx });
      graph.expandElement();
      graph.focusNode(results[idx]);
    }
  };

  const prevResult = () => {
    const { results, index } = filterOption;
    if (results.length > 0) {
      const idx = (index + results.length - 1) % results.length;
      setFilterOption({ ...filterOption, index: idx });
      graph.expandElement();
      graph.focusNode(results[idx]);
    }
  };

  const searchByType = (type: FilterOption["filterType"]) => {
    let placeholder = "";
    const filterType = type;
    // todo multiple parameter format judgment
    switch (type) {
      case "id":
        placeholder = t("jumpNode");
        break;
      default:
        placeholder = t("searchNode");
        break;
    }
    if (!showingSearch) {
      setFilterOption({ ...filterOption, placeholder, filterType });
      setShowingSearch(true);
      return;
    }
    if (filterOption.filterType === type) {
      return searchInputRef.current?.focus();
    }
    setShowingSearch(false);
    setTimeout(() => {
      setShowingSearch(true);
      setFilterOption({ ...filterOption, placeholder, filterType });
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === Hotkey.Enter) {
      nextResult();
    } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyF") {
      searchByType("content");
    } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyG") {
      searchByType("id");
    }
    e.stopPropagation();
  };

  editor.dispatch = async (event: EditEvent, data: unknown) => {
    if (event === "close") {
      graph.destroy();
    } else if (event === "copy") {
      graph.copyNode();
    } else if (event === "paste") {
      await graph.pasteNode();
    } else if (event === "delete") {
      await graph.deleteNode();
    } else if (event === "insert") {
      await graph.createNode();
    } else if (event === "replace") {
      graph.replaceNode();
    } else if (event === "save") {
      await graph.save();
      onChange();
      editor.changed = false;
      editor.mtime = Date.now();
      updateSearchState();
    } else if (event === "undo") {
      await graph.undo();
      updateSearchState();
    } else if (event === "redo") {
      await graph.redo();
      updateSearchState();
    } else if (event === "refresh") {
      await graph.refresh();
      editor.mtime = fs.statSync(editor.path).mtimeMs;
    } else if (event === "reload") {
      graph.reload();
      editor.mtime = fs.statSync(editor.path).mtimeMs;
      editor.changed = false;
    } else if (event === "rename") {
      editor.path = data as string;
    } else if (event === "updateTree") {
      graph.updateTree(data as EditTree);
    } else if (event === "updateNode") {
      graph.updateNode(data as EditNode);
    } else if (event === "searchNode") {
      searchByType("content");
    } else if (event === "jumpNode") {
      searchByType("id");
    } else if (event === "editSubtree") {
      graph.editSubtree();
    } else if (event === "saveAsSubtree") {
      graph.saveAsSubtree();
    } else if (event === "clickVar") {
      graph.clickVar(data as string);
    }
    keysRef.current?.focus();
  };

  if (graph) {
    graph.onChange = () => {
      if (!editor.changed) {
        editor.changed = true;
        onChange();
      }
    };
    graph.onUpdateSearch = () => {
      if (filterOption.filterStr) {
        onSearchChange({
          ...filterOption,
          filterType: "content",
        });
      }
    };
  }

  // check should rebuild graph
  useEffect(() => {
    if (!editorSize || (editorSize.width === 0 && editorSize.height === 0)) {
      return;
    }

    if (!graph) {
      setGraph(new Graph(editor, graphRef));
    }

    if (graph && workspace.editing === editor) {
      graph.setSize(editorSize.width, editorSize.height);

      graph.refreshSubtree().then(() => {
        if (editor.focusId) {
          graph.focusNode(editor.focusId);
          editor.focusId = null;
        } else if (graph.selectedId) {
          graph.selectNode(graph.selectedId);
        }
      });
    }
  }, [editorSize, workspace.editing, graph]);

  useEffect(() => {
    if (graph) {
      graph.refresh();
    }
  }, [t]);

  return (
    <div
      {...props}
      className="b3-editor"
      ref={mergeRefs([sizeRef, keysRef])}
      tabIndex={-1}
      style={{ maxWidth: "inherit", maxHeight: "inherit" }}
    >
      {showingSearch && (
        <Flex
          style={{
            position: "absolute",
            width: "100%",
            justifyContent: "end",
            paddingRight: "10px",
            paddingTop: "10px",
            zIndex: 100,
          }}
        >
          <Flex
            style={{
              backgroundColor: "#161b22",
              padding: "4px 10px 4px 10px",
              borderRadius: "4px",
              borderLeft: "3px solid #f78166",
              boxShadow: "0 0 8px 2px #0000005c",
              alignItems: "center",
            }}
          >
            <Input
              ref={searchInputRef}
              placeholder={filterOption.placeholder}
              autoFocus
              size="small"
              style={{
                borderRadius: "2px",
                paddingTop: "1px",
                paddingBottom: "1px",
                paddingRight: "2px",
              }}
              onChange={(e) =>
                onDebounceSearchChange({
                  ...filterOption,
                  filterStr: e.currentTarget.value,
                  index: 0,
                })
              }
              onKeyDownCapture={handleKeyDown}
              suffix={
                <Flex gap="2px" style={{ alignItems: "center" }}>
                  {filterOption.filterType !== "id" && (
                    <Button
                      type="text"
                      size="small"
                      className={mergeClassNames(
                        "b3-editor-filter",
                        filterOption.filterCase && "b3-editor-filter-selected"
                      )}
                      icon={<VscCaseSensitive style={{ width: "18px", height: "18px" }} />}
                      onClick={() =>
                        onSearchChange({
                          ...filterOption,
                          filterCase: !filterOption.filterCase,
                        })
                      }
                    />
                  )}
                  <Button
                    type="text"
                    size="small"
                    className={mergeClassNames(
                      "b3-editor-filter",
                      filterOption.filterFocus && "b3-editor-filter-selected"
                    )}
                    icon={<RiFocus3Line />}
                    onClick={() => {
                      onSearchChange({
                        ...filterOption,
                        filterFocus: !filterOption.filterFocus,
                      });
                    }}
                  />
                </Flex>
              }
            />
            <div style={{ padding: "0 10px 0 5px", minWidth: "40px" }}>
              {filterOption.results.length
                ? `${filterOption.index + 1}/${filterOption.results.length}`
                : ""}
            </div>
            {filterOption.filterType !== "id" && (
              <Button
                icon={<ArrowDownOutlined />}
                type="text"
                size="small"
                style={{ width: "30px" }}
                disabled={filterOption.results.length === 0}
                onClick={nextResult}
              />
            )}
            {filterOption.filterType !== "id" && (
              <Button
                icon={<ArrowUpOutlined />}
                type="text"
                size="small"
                style={{ width: "30px" }}
                disabled={filterOption.results.length === 0}
                onClick={prevResult}
              />
            )}
            <Button
              icon={<CloseOutlined />}
              type="text"
              size="small"
              style={{ width: "30px" }}
              onClick={() => {
                setShowingSearch(false);
                onSearchChange({
                  results: [],
                  index: 0,
                  filterCase: false,
                  filterFocus: true,
                  filterStr: "",
                  filterType: "content",
                  placeholder: "",
                });
                keysRef.current?.focus();
              }}
            />
          </Flex>
        </Flex>
      )}

      <Dropdown
        menu={{ items: menuItems, onClick: (info) => editor.dispatch?.(info.key as EditEvent) }}
        trigger={["contextMenu"]}
      >
        <div tabIndex={-1} style={{ width: "100%", height: "100%" }} ref={graphRef} />
      </Dropdown>
    </div>
  );
};

import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined } from "@ant-design/icons";
import G6, { G6GraphEvent, Item, Matrix, TreeGraph } from "@antv/g6";
import { dialog } from "@electron/remote";
import { useSize } from "ahooks";
import { Button, Dropdown, Flex, FlexProps, Input, InputRef, MenuProps } from "antd";
import { clipboard } from "electron";
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
import { ImportDef, isExprType, NodeModel, TreeGraphData, TreeModel, VarDef } from "../misc/b3type";
import * as b3util from "../misc/b3util";
import { message } from "../misc/hooks";
import i18n from "../misc/i18n";
import { Hotkey, isMacos, useKeyDown } from "../misc/keys";
import Path from "../misc/path";
import { mergeClassNames, readJson, writeTree } from "../misc/util";
import "./register-node";
import { calcTreeDataSize } from "./register-node";

export interface EditorProps extends React.HTMLAttributes<HTMLElement> {
  data: EditorStore;
  onUpdate: () => void;
}

interface FilterOption {
  results: string[];
  index: number;
  filterStr: string;
  filterCase: boolean;
  filterFocus: boolean;
  filterType: "content" | "id";
  placeholder: string;
}

const createTreeData = (node: NodeModel, parent?: string) => {
  return b3util.createTreeData(node, parent, calcTreeDataSize);
};

const refreshTreeData = (data: TreeGraphData) => {
  data.size = calcTreeDataSize(data);
  if (data.children) {
    for (const child of data.children) {
      refreshTreeData(child);
    }
  }
};

const isTreeUpdated = (editor: EditorStore, editTree: EditTree) => {
  if (
    editor.data.firstid !== editTree.firstid ||
    editor.data.export !== editTree.export ||
    editor.data.name !== editTree.name ||
    editor.data.desc !== editTree.desc
  ) {
    return true;
  }

  let max = Math.max(editor.declare.declvar.length, editTree.declvar.length);
  for (let i = 0; i < max; i++) {
    const v1: VarDef | undefined = editor.declare.declvar[i];
    const v2: VarDef | undefined = editTree.declvar[i];
    if (v1?.name !== v2?.name || v1?.desc !== v2?.desc) {
      return true;
    }
  }

  max = Math.max(editor.data.group.length, editTree.group.length);
  for (let i = 0; i < max; i++) {
    if (editor.data.group[i] !== editTree.group[i]) {
      return true;
    }
  }

  max = Math.max(editor.declare.import.length, editTree.import.length);
  for (let i = 0; i < max; i++) {
    const v1: ImportDef | undefined = editor.declare.import[i];
    const v2: ImportDef | undefined = editTree.import[i];
    if (v1?.path !== v2?.path) {
      return true;
    }
  }

  return false;
};

const isSubtreeUpdated = (data: TreeGraphData) => {
  if (data.path) {
    if (b3util.files[data.path] !== data.lastModified) {
      return true;
    }
  }
  if (data.children) {
    for (const child of data.children) {
      if (isSubtreeUpdated(child)) {
        return true;
      }
    }
  }
  return false;
};

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

export const Editor: FC<EditorProps> = ({ onUpdate: updateState, data: editor, ...props }) => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      refresh: state.refresh,
      editing: state.editing,
      editingNode: state.editingNode,
      editingTree: state.editingTree,
      nodeDefs: state.nodeDefs,
      onEditingNode: state.onEditingNode,
      onEditingTree: state.onEditingTree,
      open: state.open,
      relative: state.relative,
      updateFileMeta: state.updateFileMeta,
      workdir: state.workdir,
    }))
  );

  const searchInputRef = useRef<InputRef>(null);
  const graphRef = useRef(null);
  const sizeRef = useRef(null);
  const editorSize = useSize(sizeRef);
  const { t } = useTranslation();
  const menuItems = useMemo(() => createMenu(), [t]);

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

  const onSearchChange = (option: FilterOption) => {
    option.results.length = 0;
    editor.searchingText = option.filterStr;
    filterNodes(option, editor.root);
    setFilterOption({
      ...option,
    });
    if (option.results.length > 0) {
      const idx = option.index < option.results.length ? option.index : 0;
      recursiveOpenCollapsed(option.results[idx]);
      editor.graph.focusItem(option.results[idx]);
      selectNode(option.results[idx]);
    } else {
      selectNode(null);
    }
    editor.graph.findAll("node", () => true).forEach((item) => item.draw());
  };

  const updateSearchState = () => {
    const option = { ...filterOption };
    option.results.length = 0;
    filterNodes(option, editor.root);
    setFilterOption({
      ...option,
    });
    editor.graph.findAll("node", () => true).forEach((item) => item.draw());
  };

  const onDebounceSearchChange = useDebounceCallback(onSearchChange, 200);

  const onChange = () => {
    if (!editor.unsave) {
      editor.unsave = true;
      updateState();
    }
  };

  const findParent = (node: TreeGraphData) => {
    if (node.parent) {
      return findDataById(node.parent);
    } else {
      return null;
    }
  };

  const findHightlight = (node: TreeGraphData, highlight: string[], changed?: TreeGraphData[]) => {
    changed ||= [];
    if (node.highlightInput || node.highlightOutput || node.highlightArgs) {
      node.highlightInput = false;
      node.highlightOutput = false;
      node.highlightArgs = false;
      changed.push(node);
    }

    if (node.input) {
      for (const v of node.input) {
        if (highlight.includes(v)) {
          node.highlightInput = true;
          changed.push(node);
          break;
        }
      }
    }

    if (node.output) {
      for (const v of node.output) {
        if (highlight.includes(v)) {
          node.highlightOutput = true;
          changed.push(node);
          break;
        }
      }
    }

    node.def.args?.forEach((arg) => {
      if (isExprType(arg.type)) {
        const expr = node.args?.[arg.name] as string | string[] | undefined;
        if (typeof expr === "string") {
          for (const v of b3util.parseExpr(expr)) {
            if (highlight.includes(v)) {
              node.highlightArgs = true;
              changed.push(node);
              break;
            }
          }
        } else if (expr instanceof Array) {
          loop: for (const str of expr) {
            for (const v of b3util.parseExpr(str)) {
              if (highlight.includes(v)) {
                node.highlightArgs = true;
                changed.push(node);
                break loop;
              }
            }
          }
        }
      }
    });

    node.children?.forEach((child: TreeGraphData) => findHightlight(child, highlight, changed));

    return changed;
  };

  const findDataById = (id: string) => {
    const traverse = (node: TreeGraphData): TreeGraphData | undefined => {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const result = traverse(child);
          if (result) {
            return result;
          }
        }
      }
    };
    return traverse(editor.root) as TreeGraphData;
  };

  const includeString = (content: string | undefined, option: FilterOption) => {
    if (!content || typeof content !== "string") {
      return false;
    } else if (option.filterCase) {
      return content.includes(option.filterStr);
    } else {
      return content.toLowerCase().includes(option.filterStr.toLowerCase());
    }
  };

  const filterNodes = (option: FilterOption, node: TreeGraphData | null) => {
    if (node) {
      node.highlightGray = option.filterFocus && !!option.filterStr;
      if (option.filterStr) {
        let found = false;
        if (option.filterType === "id") {
          if (option.filterStr === node.id) {
            found = true;
          }
        } else {
          if (
            includeString(node.name, option) ||
            includeString(node.desc || node.def.desc, option)
          ) {
            found = true;
          }
          if (!found && node.input) {
            for (const str of node.input) {
              if (includeString(str, option)) {
                found = true;
                break;
              }
            }
          }
          if (!found && node.args) {
            loop: for (const str in node.args) {
              const value = node.args[str];
              if (typeof value === "string") {
                if (includeString(value, option)) {
                  found = true;
                  break loop;
                }
              } else if (value instanceof Array) {
                for (const v of value) {
                  if (includeString(v, option)) {
                    found = true;
                    break loop;
                  }
                }
              }
            }
          }
          if (!found && node.output) {
            for (const str of node.output) {
              if (includeString(str, option)) {
                found = true;
                break;
              }
            }
          }
          if (!found && node.path) {
            if (includeString(node.path, option)) {
              found = true;
            }
          }
        }
        if (found) {
          option.results.push(node.id);
          node.highlightGray = false;
        }
      }
      node.children?.forEach((child: TreeGraphData) => filterNodes(option, child));
    }
  };

  const isAncestor = (ancestor: TreeGraphData, node: TreeGraphData): boolean => {
    if (ancestor.id === node.parent) {
      return true;
    } else if (node.parent) {
      return isAncestor(ancestor, findDataById(node.parent));
    } else {
      return false;
    }
  };

  const isSubtreeNode = (node: TreeGraphData | null): boolean => {
    if (node?.path) {
      return true;
    } else if (node?.parent) {
      return isSubtreeNode(findParent(node));
    } else {
      return false;
    }
  };

  const findSubtree = (node: TreeGraphData | null): TreeGraphData | null => {
    if (node?.path) {
      return node;
    } else if (node?.parent) {
      return findSubtree(findParent(node));
    } else {
      return null;
    }
  };

  const refresh = () => {
    const rootNode = b3util.createNode(editor.root);
    editor.modifiedTime = fs.statSync(editor.path).mtimeMs;
    editor.root = createTreeData(rootNode);
    editor.autoId = b3util.refreshTreeDataId(editor.root, editor.data.firstid);
    editor.graph.changeData(editor.root);
    editor.graph.layout();
    if (editor.selectedId) {
      selectNode(editor.selectedId);
    }
    restoreViewport();
  };

  const reload = () => {
    const file = readJson(editor.path) as TreeModel;
    editor.root = createTreeData(file.root);
    editor.autoId = b3util.refreshTreeDataId(editor.root, editor.data.firstid);
    editor.unsave = false;
    updateState();
    if (editor.graph) {
      editor.graph.changeData(editor.root);
      editor.graph.layout();
      restoreViewport();
    }
  };

  const checkSubtree = () => {
    if (editor.graph && isSubtreeUpdated(editor.root)) {
      refresh();
      pushHistory();
      onChange();
    }
  };

  const clearDragDstState = () => {
    if (editor.dragDstId) {
      setItemState(editor.dragDstId, "dragRight", false);
      setItemState(editor.dragDstId, "dragDown", false);
      setItemState(editor.dragDstId, "dragUp", false);
      editor.dragDstId = undefined;
    }
  };

  const clearDragSrcState = () => {
    if (editor.dragSrcId) {
      setItemState(editor.dragSrcId, "dragSrc", false);
      editor.dragSrcId = undefined;
    }
  };

  const setItemState = (item: string | Item, state: string, value: string | boolean) => {
    if (typeof item === "string") {
      item = editor.graph.findById(item);
    }
    if (item) {
      editor.graph.setItemState(item, state, value);
    }
  };

  const updateNode = (editNode: EditNode) => {
    const newNode = editNode.data;
    const data = findDataById(editNode.data.id.toString());
    const oldNode = b3util.createNode(data, false);
    if (b3util.isNodeEqual(oldNode, newNode)) {
      return;
    }
    b3util.copyFromNode(data, newNode);
    data.def = workspace.nodeDefs.get(data.name)!;
    data.size = calcTreeDataSize(data);
    if (oldNode.path !== newNode.path) {
      refresh();
      selectNode(null);
      selectNode(data.id);
    } else {
      const item = editor.graph.findById(data.id);
      item.draw();
    }
    pushHistory();
    onChange();
  };

  const updateTree = (editTree: EditTree) => {
    if (isTreeUpdated(editor, editTree)) {
      editor.data.desc = editTree.desc || "";
      editor.data.export = editTree.export !== false;
      editor.data.group = editTree.group;
      editor.data.firstid = editTree.firstid ?? 1;
      editor.declare.declvar = editTree.declvar || [];
      editor.declare.import = editTree.import || [];
      editor.data.import = editor.declare.import.map((v) => v.path).sort();
      editor.data.declvar = editor.declare.declvar
        .map((v) => ({ ...v }))
        .sort((a, b) => a.name.localeCompare(b.name));
      workspace.refresh(editor.path);
      pushHistory();
      refresh();
      onChange();
    }
  };

  const clickVar = (...names: string[]) => {
    const changed = findHightlight(editor.root, names);
    if (changed.length > 0) {
      const refreshHighlight = (node: TreeGraphData) => {
        const item = editor.graph.findById(node.id);
        if (names.length > 0) {
          node.highlightGray = !(node.highlightInput || node.highlightOutput || node.highlightArgs);
        } else {
          node.highlightGray = false;
        }
        item.draw();
        if (node.children) {
          node.children.forEach(refreshHighlight);
        }
      };
      refreshHighlight(editor.root);
    }
    if (names.length === 0 && editor.searchingText) {
      const matrix = editor.graphMatrix;
      const selectedId = editor.selectedId;
      onSearchChange({
        ...filterOption,
        filterType: "content",
        filterStr: editor.searchingText,
      });
      editor.graphMatrix = matrix;
      selectNode(selectedId);
      restoreViewport();
    }
  };

  const selectNode = (id: string | null) => {
    if (editor.selectedId) {
      setItemState(editor.selectedId, "selected", false);
      setItemState(editor.selectedId, "hover", false);
    }

    editor.selectedId = id;

    if (editor.selectedId) {
      const data = findDataById(editor.selectedId);
      workspace.onEditingNode({
        data: b3util.createNode(data, false),
        editable: !isSubtreeNode(data),
        limitError: !b3util.checkChildrenLimit(data),
      });
      setItemState(editor.selectedId, "selected", true);
    } else {
      workspace.onEditingTree(editor);
    }
  };

  const restoreViewport = () => {
    if (editor.graphMatrix) {
      editor.graph.getGroup().setMatrix(editor.graphMatrix);
    }
  };

  const pushHistory = () => {
    editor.historyStack.length = ++editor.historyIndex;
    editor.historyStack.push(
      JSON.stringify(
        {
          ...editor.data,
          root: b3util.createNode(editor.root),
        },
        null,
        2
      )
    );
  };

  const copyNode = () => {
    if (editor.selectedId) {
      const data = findDataById(editor.selectedId);
      if (data) {
        const str = JSON.stringify(b3util.createNode(data), null, 2);
        clipboard.writeText(str);
      }
    }
  };

  const pasteNode = () => {
    if (!editor.selectedId) {
      message.warning(t("node.noNodeSelected"));
      return;
    }

    if (isSubtreeNode(findDataById(editor.selectedId))) {
      message.warning(t("node.editSubtreeDenied"));
      return;
    }

    try {
      const str = clipboard.readText();
      if (!str || str === "") {
        return;
      }
      const curNodeData = findDataById(editor.selectedId);
      const data = createTreeData(JSON.parse(str), editor.selectedId);
      editor.autoId = b3util.refreshTreeDataId(data, editor.autoId);
      selectNode(null);
      curNodeData.children ||= [];
      curNodeData.children.push(data);
      refreshItem(curNodeData);
      updateGrahp();
      pushHistory();
      onChange();
    } catch (error) {
      message.error(t("node.pasteDataError"));
      console.log(error);
    }
  };

  const replaceNode = () => {
    if (!editor.selectedId) {
      message.warning(t("node.noNodeSelected"));
      return;
    }

    if (isSubtreeNode(findDataById(editor.selectedId))) {
      message.warning(t("node.editSubtreeDenied"));
      return;
    }

    try {
      const str = clipboard.readText();
      if (!str || str === "") {
        return;
      }
      const curNodeData = findDataById(editor.selectedId);
      if (curNodeData.parent) {
        const parentData = findDataById(curNodeData.parent);
        const idx = parentData.children!.indexOf(curNodeData);
        const data = createTreeData(JSON.parse(str), editor.selectedId);
        editor.autoId = b3util.refreshTreeDataId(data, editor.autoId);
        parentData.children![idx] = data;
        refreshItem(parentData);
        updateGrahp();
      } else {
        editor.root = createTreeData(JSON.parse(str), editor.selectedId);
        editor.autoId = b3util.refreshTreeDataId(editor.root, editor.data.firstid);
        editor.graph.changeData(editor.root);
        editor.graph.render();
        editor.graph.layout();
      }
      selectNode(null);
      pushHistory();
      onChange();
    } catch (error) {
      message.error(t("node.pasteDataError"));
      console.log(error);
    }
  };

  const createNode = () => {
    if (!editor.selectedId) {
      message.warning(t("node.noNodeSelected"));
      return;
    }

    if (isSubtreeNode(findDataById(editor.selectedId))) {
      message.warning(t("node.editSubtreeDenied"));
      return;
    }

    const curNodeData = findDataById(editor.selectedId);
    const newNodeData: NodeModel = {
      id: editor.autoId++,
      name: "unknow",
    };
    curNodeData.children ||= [];
    curNodeData.children.push(createTreeData(newNodeData, editor.selectedId));
    refreshItem(curNodeData);
    updateGrahp();
    pushHistory();
    onChange();
  };

  const deleteNode = () => {
    if (!editor.selectedId) {
      return;
    }

    if (editor.selectedId === "1") {
      message.warning(t("node.deleteRootNodeDenied"));
      return;
    }

    const data = findDataById(editor.selectedId);

    if (isSubtreeNode(data) && !data.path) {
      message.warning(t("node.editSubtreeDenied"));
      return;
    }

    const parentData = findParent(data)!;
    parentData.children = parentData.children!.filter((e) => e.id !== editor.selectedId);
    refreshItem(parentData);
    selectNode(null);
    updateGrahp();
    pushHistory();
    onChange();
  };

  const refreshItem = (data: TreeGraphData) => {
    editor.graph.findById(data.id)?.draw();
  };

  const useStackData = (str: string) => {
    const data = JSON.parse(str) as TreeModel;
    editor.data = data;
    editor.root = createTreeData(data.root);
    editor.declare.import = data.import.map((v) => ({ path: v, vars: [], depends: [] }));
    editor.declare.declvar = data.declvar.map((v) => ({ ...v }));
    editor.autoId = b3util.refreshTreeDataId(editor.root, editor.data.firstid);
    editor.graph.changeData(editor.root);
    editor.graph.layout();
    restoreViewport();
    onChange();

    if (workspace.editingTree) {
      workspace.onEditingTree(editor);
    } else if (workspace.editingNode) {
      selectNode(workspace.editingNode.data.id.toString());
    }
  };

  const updateGrahp = () => {
    editor.graph.changeData();
    editor.graph.layout();
  };

  const undo = () => {
    if (editor.historyIndex > 0) {
      useStackData(editor.historyStack[--editor.historyIndex]);
      updateSearchState();
    }
  };

  const redo = () => {
    if (editor.historyIndex < editor.historyStack.length - 1) {
      useStackData(editor.historyStack[++editor.historyIndex]);
      updateSearchState();
    }
  };

  const rename = (newPath: string) => {
    editor.path = newPath;
  };

  const save = () => {
    if (b3util.isNewVersion(editor.data.version)) {
      message.error(t("alertNewVersion", { version: editor.data.version }), 6);
      return;
    }
    const path = editor.path;
    editor.autoId = b3util.refreshTreeDataId(editor.root, editor.data.firstid);
    editor.data.root = b3util.createFileData(editor.root);
    editor.modifiedTime = Date.now();
    writeTree(path, editor.data);
    workspace.updateFileMeta(editor);
    editor.unsave = false;
    editor.graph.changeData(editor.root);
    editor.graph.layout();
    restoreViewport();
    updateSearchState();
    updateState();
  };

  const editSubtree = () => {
    if (!editor.selectedId) {
      message.warning(t("node.noNodeSelected"));
      return;
    }

    const data = findSubtree(findDataById(editor.selectedId));
    if (data?.path) {
      const path = `${workspace.workdir}/${data.path}`;
      workspace.open(path, Number(editor.selectedId) - Number(data.id) + 1);
    }
  };

  const saveAsSubtree = () => {
    if (!editor.selectedId) {
      message.warning(t("node.noNodeSelected"));
      return;
    }
    if (editor.selectedId === "1") {
      message.warning(t("node.saveAsSubtree"));
      return;
    }
    setTimeout(() => {
      let subpath = dialog.showSaveDialogSync({
        defaultPath: workspace.workdir,
        properties: ["showOverwriteConfirmation"],
        filters: [{ name: "Json", extensions: ["json"] }],
      });

      if (!subpath) {
        return;
      }

      subpath = subpath.replaceAll(Path.sep, "/");
      if (subpath.indexOf(workspace.workdir) === -1) {
        message.warning(t("node.subtreePathError"));
        return;
      }

      const data = findDataById(editor.selectedId!);
      const subroot = b3util.createFileData(data);
      const subtreeModel = {
        name: Path.basename(subpath).slice(0, -5),
        root: subroot,
        desc: data.desc,
      } as TreeModel;
      fs.writeFileSync(subpath, JSON.stringify(subtreeModel, null, 2));
      data.path = workspace.relative(subpath);
      refresh();
      pushHistory();
      onChange();
    }, 200);
  };

  const createGraph = (ref: React.MutableRefObject<null>) => {
    editor.graph = new TreeGraph({
      container: ref.current!,
      animate: false,
      maxZoom: 2,
      minZoom: 0.4,
      modes: {
        default: [
          "drag-canvas",
          "zoom-canvas",
          "click-select",
          "hover",
          {
            type: "collapse-expand",
            trigger: "dblclick",
            onChange: (item, collapsed) => {
              if (!item) {
                return;
              }
              selectNode(item.getID());
              const data = item.getModel();
              data.collapsed = collapsed;
              setItemState(item, "collapsed", data.collapsed as boolean);
              const icon = data.collapsed ? G6.Marker.expand : G6.Marker.collapse;
              const marker = item
                .get("group")
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .find((ele: any) => ele.get("name") === "collapse-icon");
              editor.graph.refresh();
              marker.attr("symbol", icon);
              return true;
            },
          },
        ],
      },
      defaultEdge: {
        type: "cubic-horizontal",
        size: 2.5,
        style: {
          stroke: "#A3B1BF",
        },
      },
      defaultNode: {
        type: "TreeNode",
      },
      layout: {
        type: "compactBox",
        direction: "LR",
        getHGap: () => 30,
        getWidth: (d: TreeGraphData) => {
          return d.size![0];
        },
        getHeight: (d: TreeGraphData) => {
          return d.size![1];
        },
      },
    });

    editor.graph.on("viewportchange", (data) => {
      if (data.action === "translate" || data.action === "zoom") {
        editor.graphMatrix = data.matrix as Matrix;
      }
    });

    editor.graph.on("node:click", (e: G6GraphEvent) => {
      const names: string[] = [];
      if (e.shape.cfg.name === "input-text") {
        const data = findDataById(e.item.getID());
        data.input?.forEach((v) => v && names.push(v));
      } else if (e.shape.cfg.name === "output-text") {
        const data = findDataById(e.item.getID());
        data.output?.forEach((v) => v && names.push(v));
      }
      clickVar(...names);
    });

    editor.graph.on("node:contextmenu", (e: G6GraphEvent) => {
      selectNode(e.item.getID());
    });

    editor.graph.on("node:mouseenter", (e: G6GraphEvent) => {
      if (!e.item.hasState("selected")) {
        setItemState(e.item, "hover", true);
      }
    });

    editor.graph.on("node:mouseleave", (e: G6GraphEvent) => {
      if (!e.item.hasState("selected")) {
        setItemState(e.item, "hover", false);
      }
    });

    editor.graph.on("nodeselectchange", (e: G6GraphEvent) => {
      if (e.target) {
        selectNode((e.target as unknown as Item).getID());
      } else {
        selectNode(null);
      }
    });

    editor.graph.on("node:dragstart", (e: G6GraphEvent) => {
      editor.dragSrcId = e.item.getID();
      setItemState(editor.dragSrcId, "dragSrc", true);
    });

    editor.graph.on("node:dragend", (e: G6GraphEvent) => {
      if (editor.dragSrcId) {
        setItemState(editor.dragSrcId, "dragSrc", false);
        editor.dragSrcId = undefined;
      }
    });

    editor.graph.on("node:dragover", (e: G6GraphEvent) => {
      const dstNodeId = e.item.getID();
      if (dstNodeId === editor.dragSrcId) {
        return;
      }

      clearDragDstState();

      const box = e.item.getBBox();
      if (e.x > box.minX + box.width * 0.6) {
        setItemState(dstNodeId, "dragRight", true);
      } else if (e.y > box.minY + box.height * 0.5) {
        setItemState(dstNodeId, "dragDown", true);
      } else {
        setItemState(dstNodeId, "dragUp", true);
      }
      editor.dragDstId = dstNodeId;
    });

    editor.graph.on("node:dragleave", (e: G6GraphEvent) => {
      clearDragDstState();
    });

    editor.graph.on("node:drop", (e: G6GraphEvent) => {
      const dstNode = e.item;

      let srcNodeId = editor.dragSrcId;
      let dragDir;
      if (dstNode.hasState("dragRight")) {
        dragDir = "dragRight";
      } else if (dstNode.hasState("dragDown")) {
        dragDir = "dragDown";
      } else if (dstNode.hasState("dragUp")) {
        dragDir = "dragUp";
      }

      clearDragSrcState();
      clearDragDstState();

      if (e.originalEvent instanceof DragEvent) {
        const dragEvent = e.originalEvent as DragEvent;
        const exploreFile = dragEvent.dataTransfer?.getData("explore-file");
        const exploreNode = dragEvent.dataTransfer?.getData("explore-node");
        const dstData = findDataById(dstNode.getID());

        if (exploreNode) {
          const newTreeData: TreeGraphData = createTreeData(
            {
              id: editor.autoId++,
              name: exploreNode,
            },
            dstData.id
          );
          dstData.children ||= [];
          dstData.children.push(newTreeData);
          refreshItem(dstData);
          srcNodeId = newTreeData.id;
        } else if (exploreFile && exploreFile !== editor.path) {
          const newTreeData: TreeGraphData = createTreeData(
            {
              id: editor.autoId++,
              name: "unknow",
              path: workspace.relative(exploreFile),
            },
            dstData.id
          );
          dstData.children ||= [];
          dstData.children.push(newTreeData);
          refreshItem(dstData);
          srcNodeId = newTreeData.id;
          editor.autoId = b3util.refreshTreeDataId(newTreeData, Number(srcNodeId));
        }
      }

      if (!srcNodeId) {
        console.log("no drag src");
        return;
      }

      if (srcNodeId === dstNode.getID()) {
        console.log("drop same node");
        return;
      }

      const srcData = findDataById(srcNodeId);
      const srcParent = findParent(srcData);
      const dstData = findDataById(dstNode.getID());
      const dstParent = findParent(dstData);
      if (!srcParent) {
        console.log("no parent!");
        return;
      }

      if (isAncestor(srcData, dstData)) {
        console.log("cannot move to child");
        return;
      }

      const removeSrc = () => {
        srcParent.children = srcParent.children!.filter((value) => value.id !== srcData.id);
      };

      if (dragDir === "dragRight") {
        removeSrc();
        if (!dstData.children) {
          dstData.children = [];
        }
        srcData.parent = dstData.id;
        dstData.children.push(srcData);
      } else if (dragDir === "dragUp") {
        if (!dstParent) {
          return;
        }
        removeSrc();
        const idx = dstParent.children!.findIndex((value) => value.id === dstData.id);
        srcData.parent = dstParent.id;
        dstParent.children!.splice(idx, 0, srcData);
      } else if (dragDir === "dragDown") {
        if (!dstParent) {
          return;
        }
        removeSrc();
        const idx = dstParent.children!.findIndex((value) => value.id === dstData.id);
        srcData.parent = dstParent.id;
        dstParent.children!.splice(idx + 1, 0, srcData);
      } else {
        return;
      }

      refreshItem(srcParent);
      refreshItem(dstData);

      updateGrahp();
      pushHistory();
      onChange();
    });

    refreshTreeData(editor.root);
    editor.graph.data(editor.root);
    editor.graph.render();
    if (editor.graphMatrix) {
      restoreViewport();
    } else {
      editor.graph.fitCenter();
    }
  };

  const keysRef = useRef<HTMLDivElement>(null);

  useKeyDown(Hotkey.Copy, keysRef, () => copyNode());
  useKeyDown(Hotkey.Replace, keysRef, () => replaceNode());
  useKeyDown(Hotkey.Paste, keysRef, () => pasteNode());
  useKeyDown(Hotkey.Undo, keysRef, () => undo());
  useKeyDown(Hotkey.Redo, keysRef, () => redo());
  useKeyDown([Hotkey.Insert, Hotkey.Enter], keysRef, () => createNode());
  useKeyDown([Hotkey.Delete, Hotkey.Backspace], keysRef, () => deleteNode());

  editor.dispatch = (event: EditEvent, data: unknown) => {
    switch (event) {
      case "copy": {
        copyNode();
        break;
      }
      case "paste": {
        pasteNode();
        break;
      }
      case "delete": {
        deleteNode();
        break;
      }
      case "insert": {
        createNode();
        break;
      }
      case "replace": {
        replaceNode();
        break;
      }
      case "save": {
        save();
        break;
      }
      case "undo": {
        undo();
        break;
      }
      case "redo": {
        redo();
        break;
      }
      case "refresh": {
        refresh();
        break;
      }
      case "reload": {
        reload();
        break;
      }
      case "rename": {
        rename(data as string);
        break;
      }
      case "updateTree": {
        updateTree(data as EditTree);
        break;
      }
      case "updateNode": {
        updateNode(data as EditNode);
        break;
      }
      case "searchNode": {
        searchByType("content");
        break;
      }
      case "jumpNode": {
        searchByType("id");
        break;
      }
      case "editSubtree": {
        editSubtree();
        break;
      }
      case "saveAsSubtree": {
        saveAsSubtree();
        break;
      }
      case "clickVar": {
        clickVar(data as string);
        break;
      }
    }
  };

  // check should rebuild graph
  useEffect(() => {
    if (!editorSize || (editorSize.width === 0 && editorSize.height === 0)) {
      return;
    }

    if (!editor.graph) {
      createGraph(graphRef);
    }

    if (
      editor.graph.getWidth() !== editorSize.width ||
      editor.graph.getHeight() !== editorSize.height
    ) {
      editor.graph.changeSize(editorSize.width, editorSize.height);
    }

    if (editor.selectedId) {
      const id = editor.selectedId;
      setTimeout(() => {
        editor.graph.focusItem(id);
        selectNode(id);
      }, 50);
    }
  }, [editorSize, workspace.editing]);

  // check should repaint node
  useEffect(() => {
    if (workspace.editing === editor) {
      checkSubtree();
      editor.graph && refresh();
    }
  }, [workspace.editing, t]);

  const nextResult = () => {
    const { results, index } = filterOption;
    if (results.length > 0) {
      const idx = (index + 1) % results.length;
      recursiveOpenCollapsed(results[idx]);
      editor.graph.focusItem(results[idx]);
      selectNode(results[idx]);
      setFilterOption({ ...filterOption, index: idx });
    }
  };

  const prevResult = () => {
    const { results, index } = filterOption;
    if (results.length > 0) {
      const idx = (index + results.length - 1) % results.length;
      recursiveOpenCollapsed(results[idx]);
      editor.graph.focusItem(results[idx]);
      selectNode(results[idx]);
      setFilterOption({ ...filterOption, index: idx });
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

  const recursiveOpenCollapsed = (id: string) => {
    const recursiveFun = (searchId: string) => {
      const data = findDataById(searchId);
      if (searchId !== id && data.collapsed) {
        data.collapsed = undefined;
      }
      if (data.parent) {
        recursiveFun(data.parent);
      }
    };
    recursiveFun(id);
    updateGrahp();
  };

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
        menu={{ items: menuItems, onClick: (info) => editor.dispatch(info.key as EditEvent) }}
        trigger={["contextMenu"]}
      >
        <div tabIndex={-1} style={{ width: "100%", height: "100%" }} ref={graphRef} />
      </Dropdown>
    </div>
  );
};

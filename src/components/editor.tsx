import {
  EditEvent,
  EditNode,
  EditTree,
  EditorStore,
  useWorkspace,
} from "@/contexts/workspace-context";
import { NodeModel, TreeGraphData, TreeModel } from "@/misc/b3type";
import * as b3util from "@/misc/b3util";
import { message } from "@/misc/hooks";
import { Hotkey, isHotkeyPressed, isMacos, useHotkeys } from "@/misc/keys";
import Path from "@/misc/path";
import G6, { G6GraphEvent, Item, TreeGraph } from "@antv/g6";
import { dialog } from "@electron/remote";
import { useSize } from "ahooks";
import { Dropdown, Flex, FlexProps, MenuProps } from "antd";
import { clipboard } from "electron";
import * as fs from "fs";
import React, { FC, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiDelete } from "react-icons/fi";
import { IoMdReturnLeft } from "react-icons/io";
import { mergeRefs } from "react-merge-refs";
import "./register-node";

export interface EditorProps extends React.HTMLAttributes<HTMLElement> {
  data: EditorStore;
  onUpdate: () => void;
}

export const Editor: FC<EditorProps> = ({ onUpdate: updateState, data: editor, ...props }) => {
  const workspace = {
    editing: useWorkspace((state) => state.editing),
    onEditingNode: useWorkspace((state) => state.onEditingNode),
    onEditingTree: useWorkspace((state) => state.onEditingTree),
    open: useWorkspace((state) => state.open),
    workdir: useWorkspace((state) => state.workdir),
  };
  const graphRef = useRef(null);
  const sizeRef = useRef(null);
  const editorSize = useSize(sizeRef);
  const { t } = useTranslation();

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
    if (node.highlightInput || node.highlightOutput) {
      node.highlightInput = false;
      node.highlightOutput = false;
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

    node.children?.forEach((child: TreeGraphData) => findHightlight(child, highlight, changed));

    return changed;
  };

  const findDataById = (id: string) => {
    return editor.graph.findDataById(id) as TreeGraphData;
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

  const reload = () => {
    const rootData = findDataById("1");
    const rootNode = b3util.createNode(rootData);
    editor.data = b3util.createTreeData(rootNode);
    editor.autoId = b3util.refreshTreeDataId(editor.data);
    editor.graph.changeData(editor.data);
    editor.graph.layout();
    restoreViewport();
  };

  const checkSubtree = () => {
    if (editor.graph) {
      const data = findDataById("1");
      if (b3util.isSubtreeUpdated(data)) {
        reload();
        pushHistory();
        onChange();
      }
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
    data.size = b3util.calcTreeDataSize(data);
    if (oldNode.path !== newNode.path) {
      reload();
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
    if (editor.desc !== editTree.data.desc) {
      editor.desc = editTree.data.desc || "";
      onChange();
    }
  };

  const selectNode = (id: string | null) => {
    if (id && id === editor.selectedId) {
      setItemState(editor.selectedId, "selected", true);
      setItemState(editor.selectedId, "hover", false);
      return;
    }

    if (editor.selectedId) {
      setItemState(editor.selectedId, "selected", false);
      setItemState(editor.selectedId, "hover", false);
    }

    editor.selectedId = id;

    if (editor.selectedId) {
      const data = findDataById(editor.selectedId);
      workspace.onEditingTree(null);
      workspace.onEditingNode({
        data: b3util.createNode(data, false),
        editable: !isSubtreeNode(data),
      });
      setItemState(editor.selectedId, "selected", true);
    } else {
      workspace.onEditingTree({
        data: {
          name: editor.name,
          desc: editor.desc,
          root: null!,
        },
      });
    }
  };

  const restoreViewport = () => {
    if (editor.graphMatrix) {
      editor.graph.getGroup().setMatrix(editor.graphMatrix);
    }
  };

  const pushHistory = () => {
    editor.historyStack.length = ++editor.historyIndex;
    editor.historyStack.push(b3util.createNode(findDataById("1")));
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
      if (!str || str == "") {
        return;
      }
      const curNodeData = findDataById(editor.selectedId);
      const data = b3util.createTreeData(JSON.parse(str), editor.selectedId);
      editor.autoId = b3util.refreshTreeDataId(data, editor.autoId);
      selectNode(null);
      curNodeData.children ||= [];
      curNodeData.children.push(data);
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
      if (!str || str == "") {
        return;
      }
      const curNodeData = findDataById(editor.selectedId);
      if (curNodeData.parent) {
        const parentData = findDataById(curNodeData.parent);
        const idx = parentData.children!.indexOf(curNodeData);
        const data = b3util.createTreeData(JSON.parse(str), editor.selectedId);
        editor.autoId = b3util.refreshTreeDataId(data, editor.autoId);
        parentData.children![idx] = data;
        updateGrahp();
      } else {
        editor.data = b3util.createTreeData(JSON.parse(str), editor.selectedId);
        editor.autoId = b3util.refreshTreeDataId(editor.data);
        editor.graph.changeData(editor.data);
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
    curNodeData.children.push(b3util.createTreeData(newNodeData, editor.selectedId));
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
    parentData.children = parentData.children!.filter((e) => e.id != editor.selectedId);
    selectNode(null);
    updateGrahp();
    pushHistory();
    onChange();
  };

  const useStackData = (data: NodeModel) => {
    editor.data = b3util.createTreeData(data);
    editor.autoId = b3util.refreshTreeDataId(editor.data);
    editor.graph.changeData(editor.data);
    editor.graph.layout();
    restoreViewport();
    onChange();
  };

  const updateGrahp = () => {
    editor.graph.changeData();
    editor.graph.layout();
  };

  const undo = () => {
    if (editor.historyIndex > 0) {
      const data = editor.historyStack[--editor.historyIndex];
      useStackData(data);
    }
  };

  const redo = () => {
    if (editor.historyIndex < editor.historyStack.length - 1) {
      const data = editor.historyStack[++editor.historyIndex];
      useStackData(data);
    }
  };

  const rename = (newPath: string) => {
    editor.path = newPath;
    editor.size.width = 0;
    editor.size.height = 0;
  };

  const save = () => {
    if (editor.unsave || !fs.existsSync(editor.path)) {
      const path = editor.path;
      const data = findDataById("1");
      editor.autoId = b3util.refreshTreeDataId(data);
      const root = b3util.createFileData(data);
      const treeModel = {
        name: Path.basenameWithoutExt(path),
        root,
        desc: editor.desc,
      } as TreeModel;
      fs.writeFileSync(path, JSON.stringify(treeModel, null, 2));
      editor.unsave = false;

      editor.data = b3util.createTreeData(root);
      editor.autoId = b3util.refreshTreeDataId(editor.data);
      editor.graph.changeData(editor.data);
      editor.graph.layout();
      restoreViewport();

      updateState();
    }
  };

  const editSubtree = () => {
    if (!editor.selectedId) {
      message.warning(t("node.noNodeSelected"));
      return;
    }
    const d1 = findDataById(editor.selectedId);
    const data = findSubtree(findDataById(editor.selectedId));
    if (data?.path) {
      const path = `${workspace.workdir}/${data.path}`;
      workspace.open(path);
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
      const subpath = dialog.showSaveDialogSync({
        defaultPath: workspace.workdir,
        properties: ["showOverwriteConfirmation"],
        filters: [{ name: "Json", extensions: ["json"] }],
      });
      if (!subpath) {
        return;
      }
      if (subpath.indexOf(workspace.workdir) == -1) {
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
      data.path = subpath.substring(workspace.workdir.length + 1);
      reload();
      pushHistory();
      onChange();
    }, 200);
  };

  const destroyGraph = () => {
    if (editor.graph) {
      editor.graph.destroy();
      editor.graph = undefined!;
    }
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
        getHGap: () => 60,
        getWidth: (d: TreeGraphData) => {
          return 150;
        },
        getHeight: (d: TreeGraphData) => {
          if (d.size) {
            return d.size[1];
          } else {
            return 50;
          }
        },
      },
    });

    editor.graph.on("viewportchange", (data: any) => {
      if (data.action == "translate" || data.action == "zoom") {
        editor.graphMatrix = data.matrix;
      }
    });

    editor.graph.on("node:click", (e: G6GraphEvent) => {
      const highlight: string[] = [];
      if (e.shape.cfg.name === "input-text") {
        const data = findDataById(e.item.getID());
        data.input?.forEach((v) => v && highlight.push(v));
      } else if (e.shape.cfg.name === "output-text") {
        const data = findDataById(e.item.getID());
        data.output?.forEach((v) => v && highlight.push(v));
      }
      const changed = findHightlight(findDataById("1"), highlight);
      changed.forEach((v) => {
        const item = editor.graph.findById(v.id);
        item.draw();
      });
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
      const srcNodeId = editor.dragSrcId;
      const dstNode = e.item;

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

      if (!srcNodeId) {
        console.log("no drag src");
        return;
      }

      if (srcNodeId == dstNode.getID()) {
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
        srcParent.children = srcParent.children!.filter((value) => value.id != srcData.id);
      };

      if (dragDir == "dragRight") {
        removeSrc();
        if (!dstData.children) {
          dstData.children = [];
        }
        srcData.parent = dstData.id;
        dstData.children.push(srcData);
      } else if (dragDir == "dragUp") {
        if (!dstParent) {
          return;
        }
        removeSrc();
        const idx = dstParent.children!.findIndex((value) => value.id == dstData.id);
        srcData.parent = dstParent.id;
        dstParent.children!.splice(idx, 0, srcData);
      } else if (dragDir == "dragDown") {
        if (!dstParent) {
          return;
        }
        removeSrc();
        const idx = dstParent.children!.findIndex((value) => value.id == dstData.id);
        srcData.parent = dstParent.id;
        dstParent.children!.splice(idx + 1, 0, srcData);
      } else {
        return;
      }

      updateGrahp();
      pushHistory();
      onChange();
    });

    editor.graph.data(editor.data);
    editor.graph.render();
    if (editor.graphMatrix) {
      restoreViewport();
    } else {
      editor.graph.fitCenter();
    }
  };

  const keysRef = useHotkeys<HTMLDivElement>(
    [
      Hotkey.Copy,
      Hotkey.Paste,
      Hotkey.Save,
      Hotkey.Replace,
      Hotkey.Undo,
      Hotkey.Redo,
      Hotkey.Insert,
      Hotkey.Delete,
      Hotkey.Enter,
      Hotkey.Backspace,
    ],
    (event) => {
      event.preventDefault();
      if (isHotkeyPressed(Hotkey.Copy)) {
        copyNode();
      } else if (isHotkeyPressed(Hotkey.Replace)) {
        replaceNode();
      } else if (isHotkeyPressed(Hotkey.Paste)) {
        pasteNode();
      } else if (isHotkeyPressed(Hotkey.Redo)) {
        redo();
      } else if (isHotkeyPressed(Hotkey.Undo)) {
        undo();
      } else if (isHotkeyPressed(Hotkey.Insert) || isHotkeyPressed(Hotkey.Enter)) {
        createNode();
      } else if (isHotkeyPressed(Hotkey.Delete) || isHotkeyPressed(Hotkey.Backspace)) {
        deleteNode();
      }
    }
  );

  if (!editor.dispatch) {
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
        case "editSubtree": {
          editSubtree();
          break;
        }
        case "saveAsSubtree": {
          saveAsSubtree();
          break;
        }
      }
    };
  }

  useEffect(() => {
    if (!editorSize || (editorSize.width === 0 && editorSize.height === 0)) {
      return;
    }

    if (editor.size.width !== editorSize.width || editor.size.height !== editorSize.height) {
      destroyGraph();
    }

    if (!editor.graph) {
      createGraph(graphRef);
      editor.size.width = editorSize.width;
      editor.size.height = editorSize.height;
    }
  });

  useEffect(() => {
    if (workspace.editing === editor) {
      checkSubtree();
    }
  }, [workspace.editing]);

  const menuItems = useMemo(() => {
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
  }, [t]);

  useEffect(() => {
    if (editor.graph) {
      editor.graph.changeData(editor.data);
      editor.graph.layout();
      restoreViewport();
    }
  }, [t]);

  type MenuInfo = Parameters<Exclude<MenuProps["onClick"], undefined>>[0];
  const onClick = useCallback((info: MenuInfo) => {
    editor.dispatch?.(info.key as EditEvent);
  }, []);

  return (
    <div
      {...props}
      className="b3-editor"
      ref={mergeRefs([sizeRef, keysRef])}
      tabIndex={-1}
      style={{ maxWidth: "inherit", maxHeight: "inherit" }}
    >
      <Dropdown menu={{ items: menuItems, onClick }} trigger={["contextMenu"]}>
        <div tabIndex={-1} style={{ width: "100%", height: "100%" }} ref={graphRef} />
      </Dropdown>
    </div>
  );
};

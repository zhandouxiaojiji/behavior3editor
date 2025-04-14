import {
  CanvasEvent as G6CanvasEvent,
  Graph as G6Graph,
  GraphOptions as G6GraphOptions,
  NodeData as G6NodeData,
  NodeEvent as G6NodeEvent,
  Rect as G6Rect,
  IPointerEvent as IG6PointerEvent,
  treeToGraphData,
} from "@antv/g6";
import { dialog } from "@electron/remote";
import assert from "assert";
import { clipboard } from "electron";
import * as fs from "fs";
import { ObjectType } from "../behavior3/src/behavior3";
import { EditNode, EditorStore, EditTree, useWorkspace } from "../contexts/workspace-context";
import { ImportDecl, isExprType, NodeData, TreeData, VarDecl } from "../misc/b3type";
import * as b3util from "../misc/b3util";
import { message } from "../misc/hooks";
import i18n from "../misc/i18n";
import Path from "../misc/path";
import { readTree, writeTree } from "../misc/util";
import { TreeNodeState, TreeNodeStyle } from "./register-node";

type G6NodeState = Exclude<G6GraphOptions["node"], undefined>["state"];

type IGraph = {
  context: {
    behavior?: {
      currentTarget: unknown;
    };
  };
};

const workspace = useWorkspace.getState();

export interface FilterOption {
  results: string[];
  index: number;
  filterStr: string;
  filterCase: boolean;
  filterFocus: boolean;
  filterType: "content" | "id";
  placeholder: string;
}

export class Graph {
  onChange?: () => void;
  onUpdateSearch?: () => void;

  private _graph: G6Graph;
  private _historyStack: string[] = [];
  private _historyIndex: number = 0;
  private _dragId?: string;
  private _dropId?: string;
  private _selectedId: string | null = null;

  constructor(readonly editor: EditorStore, ref: React.RefObject<HTMLDivElement>) {
    this._graph = new G6Graph({
      container: ref.current!,
      behaviors: ["drag-canvas", "zoom-canvas", "hover-activate"],
      animation: false,
      zoomRange: [0.25, 2],
      node: {
        type: "TreeNode",
        style: {
          radius: 4,
          fill: "white",
          size: [260, 50],
          ports: [{ placement: "right" }, { placement: "left" }],
        },
        state: TreeNodeStyle as G6NodeState,
      },
      edge: {
        type: "cubic-horizontal",
        style: {
          lineWidth: 2,
          stroke: "#A3B1BF",
        },
        animation: {
          enter: false,
        },
      },
      layout: {
        type: "compact-box",
        direction: "LR",
        sortBy: (nodeA: G6NodeData, nodeB: G6NodeData) => {
          const dataA = nodeA.data as unknown as NodeData;
          const dataB = nodeB.data as unknown as NodeData;
          return Number(dataA.id) - Number(dataB.id);
        },
        getHeight: ({ data }: { data: NodeData }) => data.size![1],
        getWidth: ({ data }: { data: NodeData }) => data.size![0],
        getVGap: () => 10,
        getHGap: () => 30,
      },
    });
    this._graph.on(G6CanvasEvent.CLICK, this._onCanvasClick.bind(this));
    this._graph.on(G6NodeEvent.CONTEXT_MENU, this._onContextMenu.bind(this));
    this._graph.on(G6NodeEvent.CLICK, this._onClick.bind(this));
    this._graph.on(G6NodeEvent.DRAG_START, this._onDragStart.bind(this));
    this._graph.on(G6NodeEvent.DRAG_END, this._onDragEnd.bind(this));
    this._graph.on(G6NodeEvent.DRAG_ENTER, this._onDragEnter.bind(this));
    this._graph.on(G6NodeEvent.DRAG_LEAVE, this._onDragLeave.bind(this));
    this._graph.on(G6NodeEvent.DRAG, this._onDrag.bind(this));
    this._graph.on(G6NodeEvent.DROP, this._onDrop.bind(this));
    this._update(editor.data);
    this._historyIndex = -1;
    this._storeHistory(false);
  }

  destroy() {
    this._graph.destroy();
  }

  get data() {
    return this.editor.data;
  }

  private _storeHistory(changed: boolean = true) {
    if (this._graph.rendered) {
      this.editor.data.root = this._nodeToData("1");
    }
    const str = JSON.stringify(this.data, null, 2);
    if (this._historyStack[this._historyIndex] !== str) {
      this._historyStack.length = ++this._historyIndex;
      this._historyStack.push(str);
      if (changed) {
        this.onChange?.();
      }
    }
  }

  private async _applyHistory(str: string) {
    // clear node inspector
    this.selectNode(null);
    const data = JSON.parse(str) as TreeData;
    this.editor.declare.import = data.import.map((v) => ({ path: v, vars: [], depends: [] }));
    this.editor.declare.vars = data.vars.map((v) => ({ ...v }));
    await this._update(data);
    // update tree inspector
    this.selectNode(null);
    this.onChange?.();
  }

  private async _update(data: TreeData, refreshId: boolean = true) {
    this.editor.data = data;
    if (refreshId) {
      b3util.refreshNodeData(this.data.root, 1);
    }

    workspace.refresh(this.editor.path);

    // clear current target avoid hover error
    const graph = this._graph as unknown as IGraph;
    if (graph.context.behavior) {
      graph.context.behavior.currentTarget = null;
    }

    this._graph.clear();
    this._graph.setData(
      treeToGraphData(data.root, {
        getNodeData: (node) => {
          return {
            id: node.id,
            prefix: this.data.prefix,
            data: node as unknown as Record<string, unknown>,
            children: node.children?.map((child) => child.id),
          };
        },
      })
    );
    await this._render();
  }

  setSize(width: number, height: number) {
    const [w, h] = this._graph.getSize();
    if (w !== width || h !== height) {
      this._graph.setSize(width, height);
    }
  }

  async undo() {
    if (this._historyIndex > 0) {
      await this._applyHistory(this._historyStack[--this._historyIndex]);
    }
  }

  async redo() {
    if (this._historyIndex < this._historyStack.length - 1) {
      await this._applyHistory(this._historyStack[++this._historyIndex]);
    }
  }

  private _nodeToData(id: string) {
    const node = this._graph.getElementData(id) as G6NodeData;
    const data = { ...node.data } as unknown as NodeData;
    if (node.children) {
      data.children = [];
      for (const child of node.children) {
        data.children.push(this._nodeToData(child));
      }
    } else {
      data.children = undefined;
    }
    return data;
  }

  private async _render() {
    if (!this._graph.rendered) {
      await this._graph.render();
    }
    const zoom = this._graph.getZoom();
    await this._graph.zoomTo(1, false);
    const [x, y] = this._graph.getPosition();
    await this._graph.translateTo([0, 0], false);
    await this._graph.render();
    await this._graph.translateTo([x, y], false);
    await this._graph.zoomTo(zoom, false);
  }

  private _getAncestors(id: string): G6NodeData[] {
    return this._graph.getAncestorsData(id, "tree") as G6NodeData[];
  }

  private _findSubtreeRoot(id: string): G6NodeData | null {
    const node = this._graph.getNodeData(id);
    const data = node.data as unknown as NodeData | undefined;
    if (data?.path) {
      return node;
    } else {
      return this._getAncestors(id).find((v) => (v.data as unknown as NodeData)?.path) ?? null;
    }
  }

  private _isSubtreeNode(id: string | null | undefined): boolean {
    return !!(id && this._findSubtreeRoot(id));
  }

  private _findParent(id: string) {
    return this._graph.getParentData(id, "tree") as G6NodeData | null;
  }

  private _findHightlight(
    node: NodeData,
    highlight: string[],
    changed?: [NodeData, TreeNodeState[]][]
  ) {
    changed ||= [];

    if (highlight.length > 0) {
      const states: TreeNodeState[] = [];

      for (const v of node.input ?? []) {
        if (highlight.includes(v)) {
          states.push("highlightinput");
          break;
        }
      }

      for (const v of node.output ?? []) {
        if (highlight.includes(v)) {
          states.push("highlightoutput");
          break;
        }
      }

      const def = b3util.nodeDefs.get(node.name);
      loop: for (const arg of def.args ?? []) {
        if (isExprType(arg.type)) {
          const expr = node.args?.[arg.name] as string | string[] | undefined;
          if (typeof expr === "string") {
            for (const v of b3util.parseExpr(expr)) {
              if (highlight.includes(v)) {
                states.push("highlightargs");
                break loop;
              }
            }
          } else if (expr instanceof Array) {
            for (const str of expr) {
              for (const v of b3util.parseExpr(str)) {
                if (highlight.includes(v)) {
                  states.push("highlightargs");
                  break loop;
                }
              }
            }
          }
        }
      }

      if (states.length > 0) {
        changed.push([node, states]);
      } else {
        changed.push([node, ["highlightgray"]]);
      }
    } else {
      changed.push([node, []]);
    }

    node.children?.forEach((child) => this._findHightlight(child, highlight, changed));

    return changed;
  }

  async expandElement() {
    for (const node of this._graph.getNodeData()) {
      await this._graph.expandElement(node.id, false);
    }
  }

  clickVar(...names: string[]) {
    console.debug("click variable:", names);
    const nodes = this._findHightlight(this.data.root, names);
    for (const [node, states] of nodes) {
      const oldStates = this._getState(node.id).sort();
      const newStates = [...oldStates.filter((v) => !this._isHighlightState(v)), ...states].sort();
      if (oldStates.length !== newStates.length || oldStates.some((v, i) => v !== newStates[i])) {
        this._setState(node.id, newStates);
      }
    }
    if (names.length === 0) {
      this.onUpdateSearch?.();
    }
  }

  private _includeString(content: string | undefined, option: FilterOption) {
    if (!content || typeof content !== "string") {
      return false;
    } else if (option.filterCase) {
      return content.includes(option.filterStr);
    } else {
      return content.toLowerCase().includes(option.filterStr.toLowerCase());
    }
  }

  hightlightSearch(option: FilterOption, node: NodeData | null) {
    if (!node) {
      return;
    }

    let highlightGray = option.filterFocus && !!option.filterStr;

    if (option.filterStr) {
      const def = b3util.nodeDefs.get(node.name);
      let found = false;
      if (option.filterType === "id") {
        if (option.filterStr === node.id) {
          found = true;
        }
      } else {
        if (
          this._includeString(node.name, option) ||
          this._includeString(node.desc || def.desc, option)
        ) {
          found = true;
        }
        if (!found && node.input) {
          for (const str of node.input) {
            if (this._includeString(str, option)) {
              found = true;
              break;
            }
          }
        }
        if (!found && node.args) {
          loop: for (const str in node.args) {
            const value = node.args[str];
            if (typeof value === "string") {
              if (this._includeString(value, option)) {
                found = true;
                break loop;
              }
            } else if (value instanceof Array) {
              for (const v of value) {
                if (this._includeString(v, option)) {
                  found = true;
                  break loop;
                }
              }
            }
          }
        }
        if (!found && node.output) {
          for (const str of node.output) {
            if (this._includeString(str, option)) {
              found = true;
              break;
            }
          }
        }
        if (!found && node.path) {
          if (this._includeString(node.path, option)) {
            found = true;
          }
        }
      }
      if (found) {
        option.results.push(node.id);
        highlightGray = false;
      }
    }

    const states = this._getState(node.id).filter((v) => !this._isHighlightState(v));
    if (highlightGray) {
      states.push("highlightgray");
    }
    this._setState(node.id, states);

    node.children?.forEach((child) => this.hightlightSearch(option, child));
  }

  private _isTreeUpdated(editTree: EditTree) {
    if (
      this.data.prefix !== editTree.prefix ||
      this.data.export !== editTree.export ||
      this.data.name !== editTree.name ||
      this.data.desc !== editTree.desc
    ) {
      return true;
    }

    let max = Math.max(this.editor.declare.vars.length, editTree.vars.length);
    for (let i = 0; i < max; i++) {
      const v1: VarDecl | undefined = this.editor.declare.vars[i];
      const v2: VarDecl | undefined = editTree.vars[i];
      if (v1?.name !== v2?.name || v1?.desc !== v2?.desc) {
        return true;
      }
    }

    max = Math.max(this.data.group.length, editTree.group.length);
    for (let i = 0; i < max; i++) {
      if (this.data.group[i] !== editTree.group[i]) {
        return true;
      }
    }

    max = Math.max(this.editor.declare.import.length, editTree.import.length);
    for (let i = 0; i < max; i++) {
      const v1: ImportDecl | undefined = this.editor.declare.import[i];
      const v2: ImportDecl | undefined = editTree.import[i];
      if (v1?.path !== v2?.path) {
        return true;
      }
    }

    return false;
  }

  async updateTree(editTree: EditTree) {
    if (this._isTreeUpdated(editTree)) {
      this.data.desc = editTree.desc || "";
      this.data.export = editTree.export !== false;
      this.data.group = editTree.group;
      this.data.prefix = editTree.prefix ?? "";
      this.data.import = editTree.import.map((v) => v.path).sort();
      this.data.vars = editTree.vars
        .map((v) => ({ ...v }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.editor.declare.vars = editTree.vars || [];
      this.editor.declare.import = editTree.import || [];
      workspace.refresh(this.editor.path);
      await this.refresh();
      this._storeHistory();
    }
  }

  async updateNode(editNode: EditNode) {
    const node = this._graph.getNodeData(editNode.data.id);
    const data = node.data as unknown as NodeData;
    if (b3util.isNodeEqual(data, editNode.data)) {
      return;
    }

    // update node
    node.data = { ...editNode.data, size: b3util.calcSize(editNode.data) };
    this._graph.updateNodeData([node]);
    await this._graph.draw();

    // update subtree
    if (data.path !== editNode.data.path) {
      this.editor.data.root = this._nodeToData("1");
      await this.refresh();
    }

    this._storeHistory();
  }

  async refresh() {
    this.selectNode(null);
    await this._update(this.data);
    this.selectNode(null);
  }

  async reload() {
    this.selectNode(null);
    await this._update(readTree(this.editor.path));
    this._storeHistory(false);
    this.selectNode(null);
  }

  async focusNode(id: string) {
    this.selectNode(id);
    await this._graph.translateTo([0, 0], false);
    await this._graph.focusElement(id, true);
  }

  get selectedId() {
    return this._selectedId;
  }

  selectNode(id: string | null) {
    if (this._selectedId && id !== this._selectedId) {
      this._setState(
        this._selectedId,
        this._getState(this._selectedId).filter((v) => v !== "selected")
      );
    }

    this._selectedId = id;

    if (this._selectedId) {
      const node = this._graph.getNodeData(this._selectedId);
      const data = node.data as unknown as NodeData;
      workspace.onEditingNode({
        data: { ...data },
        prefix: this.data.prefix,
        disabled: this._isSubtreeNode(node.id),
        subtreeEditable: !this._isSubtreeNode(this._findParent(node.id)?.id),
      });
      const states = this._getState(this._selectedId);
      this._setState(this._selectedId, [...states, "selected"]);
    } else {
      workspace.onEditingTree(this.editor);
    }
  }

  private _onContextMenu(e: IG6PointerEvent<G6Rect>) {
    this.selectNode(e.target.id);
  }

  private _onCanvasClick(e: IG6PointerEvent<G6Rect>) {
    this.selectNode(null);
  }

  private _onClick(e: IG6PointerEvent<G6Rect>) {
    const names: string[] = [];
    const originalTarget = e.originalTarget;
    if (originalTarget.className === "input-text") {
      const node = this._graph.getNodeData(e.target.id);
      const data = node.data as unknown as NodeData;
      data.input?.forEach((v) => v && names.push(v));
    } else if (originalTarget.className === "output-text") {
      const node = this._graph.getNodeData(e.target.id);
      const data = node.data as unknown as NodeData;
      data.output?.forEach((v) => v && names.push(v));
    }
    this.clickVar(...names);
    this.selectNode(e.target.id);
  }

  private _isDragState(state: string): boolean {
    return (
      state === "dragsrc" || state === "dragup" || state === "dragdown" || state === "dragright"
    );
  }

  private _isHighlightState(state: string): boolean {
    return (
      state === "highlightgray" ||
      state === "highlightinput" ||
      state === "highlightoutput" ||
      state === "highlightargs"
    );
  }

  private _getState(id: string) {
    return this._graph.getElementState(id) as TreeNodeState[];
  }

  private _setState(id: string, states: TreeNodeState[]) {
    this._graph.setElementState(id, states);
  }

  private _clearDragState(id: string) {
    const states = this._getState(id).filter((v) => !this._isDragState(v));
    this._setState(id, states);
  }

  private _onDragStart(e: IG6PointerEvent<G6Rect>) {
    const { target } = e;
    const states = this._getState(target.id);
    this._setState(target.id, ["dragsrc", ...states]);
    this._dragId = target.id;
    console.log("drag start", target.id);
  }

  private _onDragEnd(e: IG6PointerEvent<G6Rect>) {
    if (!this._dragId) {
      return;
    }
    if (e.target.id !== this._dragId) {
      console.warn("cancel drag", this._dragId, e.target.id);
      this._clearDragState(this._dragId);
    }
    const { target } = e;
    this._clearDragState(target.id);
    this._dragId = undefined;
    console.log("drag end", target.id);
  }

  private _onDragEnter(e: IG6PointerEvent<G6Rect>) {
    const { target } = e;
    if (target.id !== this._dragId) {
      this._dropId = target.id;
    }
  }

  private _onDragLeave(e: IG6PointerEvent<G6Rect>) {
    const { target } = e;
    if (target.id !== this._dragId) {
      this._clearDragState(target.id);
      this._dropId = undefined;
    }
  }

  private _onDrag(e: IG6PointerEvent<G6Rect>) {
    if (!this._dropId) {
      return;
    }
    const id = this._dropId;
    const pos = this._graph.getElementPosition(id);
    const data = this._graph.getNodeData(id).data as unknown as NodeData;
    const [w, h] = data.size!;
    const x = e.canvas.x - pos[0];
    const y = e.canvas.y - pos[1];
    const states = this._getState(id);
    let dragto: TreeNodeState | undefined;
    if (x > w / 2) {
      dragto = "dragright";
    } else if (y > h / 2) {
      dragto = "dragdown";
    } else if (y < h / 2) {
      dragto = "dragup";
    }
    if (dragto && !states.includes(dragto)) {
      // console.log(`drag node: drop=${id} dropto=${dragto}`, states);
      this._setState(id, [dragto, ...states.filter((v) => !this._isDragState(v))]);
    }
  }

  private async _onDrop(e: IG6PointerEvent<G6Rect>) {
    const srcId = this._dragId!;
    const dstId = e.target.id;

    this._dragId = undefined;
    this._dropId = undefined;

    const dstStates = this._getState(e.target.id);
    const dragto: TreeNodeState = dstStates.find((v) => this._isDragState(v))!;

    this._clearDragState(srcId);
    this._clearDragState(dstId);

    if (srcId === e.target.id) {
      console.log("drop same node");
      return;
    }

    const ancestors = this._getAncestors(dstId);
    if (
      ancestors.some((v) => v.id === srcId) ||
      ((dragto === "dragdown" || dragto === "dragup") && dstId === "1")
    ) {
      message.error(i18n.t("node.dropDenied"));
      return;
    }

    if (this._isSubtreeNode(dstId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    console.log(`drop node: drag=${srcId} target=${dstId} dropto=${dragto}`);

    if (e.originalEvent instanceof DragEvent) {
      // const dragEvent = e.originalEvent as DragEvent;
      // const exploreFile = dragEvent.dataTransfer?.getData("explore-file");
      // const exploreNode = dragEvent.dataTransfer?.getData("explore-node");
      // const dstData = findDataById(destNode.getID());
      // if (exploreNode) {
      //   const newTreeData: TreeGraphData = createTreeData(
      //     {
      //       id: editor.autoId++,
      //       name: exploreNode,
      //     },
      //     dstData.id
      //   );
      //   dstData.children ||= [];
      //   dstData.children.push(newTreeData);
      //   refreshItem(dstData);
      //   srcNodeId = newTreeData.id;
      // } else if (exploreFile && exploreFile !== editor.path) {
      //   const newTreeData: TreeGraphData = createTreeData(
      //     {
      //       id: editor.autoId++,
      //       name: "unknow",
      //       path: workspace.relative(exploreFile),
      //     },
      //     dstData.id
      //   );
      //   dstData.children ||= [];
      //   dstData.children.push(newTreeData);
      //   refreshItem(dstData);
      //   srcNodeId = newTreeData.id;
      //   editor.autoId = b3util.refreshTreeDataId(newTreeData, Number(srcNodeId));
      // }
    }

    const root = this._nodeToData("1");

    const srcParentId = this._graph.getParentData(srcId, "tree")?.id;
    const dstParentId = this._graph.getParentData(dstId, "tree")?.id;

    let srcData: NodeData | undefined;
    let dstData: NodeData | undefined;
    let srcParentData: NodeData | undefined;
    let dstParentData: NodeData | undefined;

    b3util.dfs(root, (node) => {
      if (node.id === srcId) {
        srcData = node;
      }
      if (node.id === dstId) {
        dstData = node;
      }
      if (node.id === srcParentId) {
        srcParentData = node;
      }
      if (node.id === dstParentId) {
        dstParentData = node;
      }
    });

    assert(srcData, srcId);
    assert(dstData, dstId);
    assert(srcParentData, srcParentId);

    if (dragto === "dragright") {
      srcParentData.children?.remove(srcData);
      dstData.children ||= [];
      dstData.children.push(srcData);
    } else if (dragto === "dragup") {
      assert(dstParentData, dstParentId);
      srcParentData.children?.remove(srcData);
      const idx = dstParentData.children!.findIndex((v) => v.id === dstId);
      dstParentData.children?.insertAt(idx, srcData);
    } else if (dragto === "dragdown") {
      assert(dstParentData, dstParentId);
      srcParentData.children?.remove(srcData);
      const idx = dstParentData.children!.findIndex((v) => v.id === dstId);
      dstParentData.children?.insertAt(idx + 1, srcData);
    }
    await this._update({ ...this.data, root }, false);
    this._storeHistory();
  }

  copyNode() {
    if (this._selectedId) {
      const node = this._graph.getNodeData(this._selectedId);
      if (node) {
        const data = node.data as unknown as NodeData;
        const str = JSON.stringify(b3util.createNode(data));
        clipboard.writeText(str);
      }
    }
  }

  async pasteNode() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    try {
      const str = clipboard.readText();
      if (!str || str === "") {
        return;
      }
      console.debug("parse node:", str);

      const root = this._nodeToData("1");
      let dstData: NodeData | undefined;
      b3util.dfs(root, (node) => {
        if (node.id === this._selectedId) {
          dstData = node;
        }
      });

      assert(dstData, this._selectedId);
      dstData.children ||= [];
      dstData.children.push(JSON.parse(str) as NodeData);
      this.selectNode(null);
      await this._update({ ...this.data, root });
      this._storeHistory();
    } catch (error) {
      message.error(i18n.t("node.pasteDataError"));
      console.log(error);
    }
  }

  async replaceNode() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    try {
      const str = clipboard.readText();
      if (!str || str === "") {
        return;
      }

      const root = this._nodeToData("1");
      let dstData: NodeData | undefined;
      b3util.dfs(root, (node) => {
        if (node.id === this._selectedId) {
          dstData = node;
        }
      });

      assert(dstData, this._selectedId);
      Object.keys(dstData).forEach((k) => delete (dstData as unknown as ObjectType)[k]);
      Object.assign(dstData, JSON.parse(str));
      this.selectNode(null);
      await this._update({ ...this.data, root });
      this._storeHistory();
    } catch (error) {
      message.error(i18n.t("node.pasteDataError"));
      console.log(error);
    }
  }

  async createNode() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    const root = this._nodeToData("1");
    let dstData: NodeData | undefined;
    b3util.dfs(root, (node) => {
      if (node.id === this._selectedId) {
        dstData = node;
      }
    });

    assert(dstData, this._selectedId);
    dstData.children ||= [];
    dstData.children.push({ id: "", name: "unknow" });
    await this._update({ ...this.data, root });
    this._storeHistory();
  }

  async deleteNode() {
    if (!this._selectedId) {
      return;
    }

    if (this._selectedId === "1") {
      message.error(i18n.t("node.deleteRootNodeDenied"));
      return;
    }

    const subtreeRoot = this._getAncestors(this._selectedId)
      .reverse()
      .find((v) => (v.data as unknown as NodeData)?.path);

    if (subtreeRoot && subtreeRoot.id !== this._selectedId) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    const root = this._nodeToData("1");
    const parentId = this._findParent(this._selectedId)?.id;
    b3util.dfs(root, (n) => {
      if (n.id === parentId) {
        n.children = n.children?.filter((v) => v.id !== this._selectedId);
      }
    });
    this.selectNode(null);
    await this._update({ ...this.data, root });
    this._storeHistory();
  }

  private _isSubtreeUpdated(data: NodeData) {
    let updated = false;
    b3util.dfs(data, (node) => {
      if (node.path && b3util.files[node.path] !== node.mtime) {
        updated = true;
      }
    });
    return updated;
  }

  async refreshSubtree() {
    if (this._isSubtreeUpdated(this.data.root)) {
      this.selectNode(null);
      await this.refresh();
      this._storeHistory();
    }
  }

  async save() {
    if (b3util.isNewVersion(this.data.version)) {
      message.error(i18n.t("alertNewVersion", { version: this.data.version }), 6);
      return;
    }
    await this._update({ ...this.data, root: this._nodeToData("1") });
    writeTree(this.editor.path, {
      ...this.data,
      root: b3util.createNode(this.data.root),
    });
    workspace.updateFileMeta(this.editor);
  }

  editSubtree() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    const node = this._findSubtreeRoot(this._selectedId);
    const data = node?.data as unknown as NodeData | undefined;
    if (data?.path) {
      const path = `${workspace.workdir}/${data.path}`;
      workspace.open(path, (Number(this._selectedId) - Number(data.id) + 1).toString());
    }
  }

  async saveAsSubtree() {
    if (!this._selectedId) {
      message.error(i18n.t("node.noNodeSelected"));
      return;
    }

    if (this._selectedId === "1") {
      message.error(i18n.t("node.subtreeSaveRootError"));
      return;
    }

    if (this._isSubtreeNode(this._selectedId)) {
      message.error(i18n.t("node.editSubtreeDenied"));
      return;
    }

    const ret = await dialog.showSaveDialog({
      defaultPath: workspace.workdir,
      properties: ["showOverwriteConfirmation"],
      filters: [{ name: "Json", extensions: ["json"] }],
    });

    if (ret.canceled) {
      return;
    }

    const subpath = ret.filePath.replaceAll(Path.sep, "/");
    if (subpath.indexOf(workspace.workdir) === -1) {
      message.error(i18n.t("node.subtreePathError"));
      return;
    }

    const node = this._graph.getNodeData(this._selectedId);
    const data = node.data as unknown as NodeData;
    const subroot = b3util.createFileData(data);
    const subtreeModel = {
      name: Path.basenameWithoutExt(subpath),
      root: subroot,
      desc: data.desc,
    } as TreeData;
    fs.writeFileSync(subpath, JSON.stringify(subtreeModel, null, 2));
    data.path = workspace.relative(subpath);
    await this.refresh();
    this._storeHistory();
  }
}

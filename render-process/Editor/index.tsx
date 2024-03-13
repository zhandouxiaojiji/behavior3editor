import G6, { TreeGraph } from "@antv/g6";
import { G6GraphEvent } from "@antv/g6/lib/interface/behavior";
import { Col, Row, message } from "antd";
import * as fs from "fs";
import * as path from "path";
import * as React from "react";
import {
    BehaviorNodeModel,
    BehaviorTreeModel,
    GraphNodeModel,
} from "../../common/BehaviorTreeModel";
import * as Utils from "../../common/Utils";
import Settings from "../../main-process/Settings";
import NodePanel from "./NodePanel";
import TreePanel from "./TreePanel";

import { Item, Matrix } from "@antv/g6/lib/types";
import { clipboard } from "electron";
import "./Editor.css";

export interface EditorProps {
    filepath: string;
    onChangeSaveState: (unsave: boolean) => void;
    onOpenSubtree: (path: string) => void;
}

interface EditorState {
    curNodeId?: string;
    blockNodeSelectChange?: boolean;
    viewportMatrix?: Matrix;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
    private ref: React.RefObject<any>;
    state: EditorState = {};
    isInEditor: boolean = false;

    private graph: TreeGraph;
    private dragSrcId: string;
    private dragDstId: string;
    private autoId: number;
    private undoStack: BehaviorNodeModel[] = [];
    private redoStack: BehaviorNodeModel[] = [];
    private treeModel: BehaviorTreeModel;
    private settings: Settings;
    private data: GraphNodeModel;
    private unsave: boolean = false;

    constructor(props: EditorProps) {
        super(props);
        this.ref = React.createRef();

        this.settings = Utils.getRemoteSettings();
        const str = fs.readFileSync(this.props.filepath, "utf8");
        this.treeModel = JSON.parse(str);
        this.data = Utils.createTreeData(this.treeModel.root, this.settings);
        this.autoId = Utils.refreshNodeId(this.data);
    }

    shouldComponentUpdate(nextProps: EditorProps, nextState: EditorState) {
        return (
            this.props.filepath != nextProps.filepath || this.state.curNodeId != nextState.curNodeId
        );
    }

    setItemState(item: string | Item, state: string, value: string | boolean) {
        if (typeof item === "string") {
            item = this.graph.findById(item);
        }
        if (item) {
            this.graph.setItemState(item, state, value);
        }
    }

    findParent(node: GraphNodeModel) {
        if (node.parent) {
            return this.graph.findDataById(node.parent) as GraphNodeModel;
        } else {
            return null;
        }
    }

    findSubtree(node?: GraphNodeModel): GraphNodeModel | null {
        if (node?.path) {
            return node;
        } else if (node?.parent) {
            return this.findSubtree(this.findParent(node));
        } else {
            return null;
        }
    }

    isSubtreeNode(node?: GraphNodeModel): boolean {
        if (node?.path) {
            return true;
        } else if (node?.parent) {
            return this.isSubtreeNode(this.findParent(node));
        } else {
            return false;
        }
    }

    isAncestor(ancestor: GraphNodeModel, node: GraphNodeModel): boolean {
        if (ancestor.id === node.parent) {
            return true;
        } else if (node.parent) {
            return this.isAncestor(
                ancestor,
                this.graph.findDataById(node.parent) as GraphNodeModel
            );
        } else {
            return false;
        }
    }

    componentDidMount() {
        const graph = new TreeGraph({
            container: this.ref.current,
            width: window.screen.width * 0.66,
            height: window.screen.height,
            animate: false,
            maxZoom: 2,
            // fitCenter: true,
            modes: {
                default: ["drag-canvas", "zoom-canvas", "click-select", "hover"],
            },
            defaultEdge: {
                type: "cubic-horizontal",
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
                getHGap: () => 50,
                getWidth: (d: GraphNodeModel) => {
                    return 150;
                },
                getHeight: (d: GraphNodeModel) => {
                    if (d.size) {
                        return d.size[1];
                    } else {
                        return 50;
                    }
                },
            },
        });

        graph.on("viewportchange", (data: any) => {
            if (data.action == "translate" || data.action == "zoom") {
                this.state.viewportMatrix = data.matrix;
            }
        });

        graph.on("contextmenu", (e: G6GraphEvent) => {
            require("@electron/remote").Menu.getApplicationMenu().popup();
        });

        graph.on("canvas:mouseover", () => {
            this.isInEditor = true;
        });

        graph.on("canvas:mouseleave", () => {
            this.isInEditor = false;
        });

        graph.on("node:click", (e: G6GraphEvent) => {
            if (e.shape.cfg.name === "collapse-icon") {
                const item = e.item;
                this.onSelectNode(item.getID());
                const data = item.getModel();
                if ((data as unknown as GraphNodeModel).children?.length > 0) {
                    data.collapsed = !data.collapsed;
                    graph.setItemState(item, "collapsed", data.collapsed as boolean);
                    e.shape.attr("symbol", data.collapsed ? G6.Marker.expand : G6.Marker.collapse);
                    this.graph.layout();
                }
            }
        });

        graph.on("node:dblclick", (e: G6GraphEvent) => {
            const data = this.findSubtree(e.item.getModel() as unknown as GraphNodeModel);
            if (data) {
                this.props.onOpenSubtree(data.path);
            }
        });

        graph.on("node:mouseenter", (e: G6GraphEvent) => {
            const { item } = e;
            if (item.hasState("selected")) {
                return;
            }
            this.setItemState(item, "hover", true);
        });

        graph.on("node:mouseleave", (e: G6GraphEvent) => {
            const { item } = e;
            if (item.hasState("selected")) {
                return;
            }
            this.setItemState(item, "hover", false);
        });

        graph.on("nodeselectchange", (e: G6GraphEvent) => {
            if (this.state.blockNodeSelectChange) {
                // ** 重置选中效果
                this.onSelectNode(this.state.curNodeId);
                return;
            }
            if (e.target) {
                this.onSelectNode(e.target.getID());
            } else {
                this.onSelectNode(null);
            }
        });

        const clearDragDstState = () => {
            if (this.dragDstId) {
                this.setItemState(this.dragDstId, "dragRight", false);
                this.setItemState(this.dragDstId, "dragDown", false);
                this.setItemState(this.dragDstId, "dragUp", false);
                this.dragDstId = null;
            }
        };

        const clearDragSrcState = () => {
            if (this.dragSrcId) {
                this.setItemState(this.dragSrcId, "dragSrc", false);
                this.dragSrcId = null;
            }
        };

        graph.on("node:dragstart", (e: G6GraphEvent) => {
            this.dragSrcId = e.item.getID();
            this.setItemState(this.dragSrcId, "dragSrc", true);
        });
        graph.on("node:dragend", (e: G6GraphEvent) => {
            if (this.dragSrcId) {
                this.setItemState(this.dragSrcId, "dragSrc", false);
                this.dragSrcId = null;
            }
        });

        graph.on("node:dragover", (e: G6GraphEvent) => {
            const dstNodeId = e.item.getID();
            if (dstNodeId == this.dragSrcId) {
                return;
            }

            if (this.dragDstId) {
                this.setItemState(this.dragDstId, "dragRight", false);
                this.setItemState(this.dragDstId, "dragDown", false);
                this.setItemState(this.dragDstId, "dragUp", false);
            }

            const box = e.item.getBBox();
            if (e.x > box.minX + box.width * 0.6) {
                this.setItemState(dstNodeId, "dragRight", true);
            } else if (e.y > box.minY + box.height * 0.5) {
                this.setItemState(dstNodeId, "dragDown", true);
            } else {
                this.setItemState(dstNodeId, "dragUp", true);
            }
            this.dragDstId = dstNodeId;
        });

        graph.on("node:dragleave", (e: G6GraphEvent) => {
            clearDragDstState();
        });

        graph.on("node:drop", (e: G6GraphEvent) => {
            const srcNodeId = this.dragSrcId;
            const dstNode = e.item;

            var dragDir;
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

            const rootData = graph.findDataById("1");
            const srcData = graph.findDataById(srcNodeId) as GraphNodeModel;
            const srcParent = this.findParent(srcData);
            const dstData = graph.findDataById(dstNode.getID()) as GraphNodeModel;
            const dstParent = this.findParent(dstData);
            if (!srcParent) {
                console.log("no parent!");
                return;
            }

            if (this.isAncestor(srcData, dstData)) {
                // 不能将父节点拖到自已的子孙节点
                console.log("cannot move to child");
                return;
            }

            const removeSrc = () => {
                this.pushUndoStack();
                srcParent.children = srcParent.children.filter((e) => e.id != srcData.id);
            };
            console.log("dstNode", dstNode);
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
                const idx = dstParent.children.findIndex((e) => e.id == dstData.id);
                srcData.parent = dstParent.id;
                dstParent.children.splice(idx, 0, srcData);
            } else if (dragDir == "dragDown") {
                if (!dstParent) {
                    return;
                }
                removeSrc();
                const idx = dstParent.children.findIndex((e) => e.id == dstData.id);
                srcData.parent = dstParent.id;
                dstParent.children.splice(idx + 1, 0, srcData);
            } else {
                return;
            }

            // console.log("cur data", graph.findDataById('1'));
            this.changeWithoutAnim();
        });

        graph.data(this.data);
        graph.render();
        graph.fitCenter();
        graph.set("animate", true);

        this.graph = graph;

        this.forceUpdate();
    }

    /**
     * remember the last matrix that triggered by Translate or Zoom action , and restore that matrix where the graph is reconstruct.
     */
    restoreViewport() {
        if (this.state.viewportMatrix) {
            this.graph.getGroup().setMatrix(this.state.viewportMatrix);
        }
    }

    onSelectNode(curNodeId: string | null) {
        const graph = this.graph;

        if (this.state.curNodeId) {
            this.setItemState(this.state.curNodeId, "selected", false);
            this.setItemState(this.state.curNodeId, "hover", false);
        }

        this.setState({ curNodeId });
        if (this.state.curNodeId) {
            this.setItemState(this.state.curNodeId, "selected", true);
        }
    }

    createNode(name: string) {
        if (!this.isInEditor) {
            return;
        }

        console.log("editor create node", name);
        const { curNodeId } = this.state;
        if (!curNodeId) {
            message.warn("未选中节点");
            return;
        }
        this.pushUndoStack();
        const curNodeData = this.graph.findDataById(curNodeId);
        const newNodeData: BehaviorNodeModel = {
            id: this.autoId++,
            name: name,
        };
        if (!curNodeData.children) {
            curNodeData.children = [];
        }
        curNodeData.children.push(Utils.createTreeData(newNodeData, this.settings, curNodeId));
        this.changeWithoutAnim();
    }

    deleteNode() {
        console.log("editor delete node");
        const { curNodeId } = this.state;
        if (!curNodeId) {
            return;
        }

        if (curNodeId === "1") {
            message.warn("根节点不能删除!");
            return;
        }

        this.onSelectNode(null);
        this.pushUndoStack();
        const parentData = this.findParent(this.graph.findDataById(curNodeId) as GraphNodeModel);
        parentData.children = parentData.children.filter((e) => e.id != curNodeId);
        this.changeWithoutAnim();
    }

    changeWithoutAnim() {
        this.graph.set("animate", false);
        this.graph.changeData();
        this.graph.layout();
        this.graph.set("animate", true);

        this.props.onChangeSaveState(true);
        this.unsave = true;
    }

    save() {
        if (!this.unsave) {
            return;
        }
        const { filepath } = this.props;
        const data = this.graph.findDataById("1") as GraphNodeModel;
        this.autoId = Utils.refreshNodeId(data);
        const root = Utils.createFileData(data);
        const treeModel = {
            name: path.basename(filepath).slice(0, -5),
            root,
            desc: this.treeModel.desc,
        } as BehaviorTreeModel;
        fs.writeFileSync(filepath, JSON.stringify(treeModel, null, 2));
        this.props.onChangeSaveState(false);
        this.unsave = false;

        const treeData = Utils.createTreeData(root, this.settings);
        this.autoId = Utils.refreshNodeId(treeData);

        this.graph.set("animate", false);
        this.graph.changeData(treeData);
        this.graph.layout();
        this.restoreViewport();
        this.graph.set("animate", true);
    }

    saveAsSubtree(subpath: string) {
        const { curNodeId } = this.state;
        if (!curNodeId) {
            message.warn("未选择一个节点");
            return;
        } else if (curNodeId == "1") {
            message.warn("根节点不能保存为子树");
            return;
        }
        const workdir = this.settings.workdir;
        if (subpath.indexOf(workdir) == -1) {
            message.warn("请保存在工作区中");
            return;
        }
        const data = this.graph.findDataById(curNodeId) as GraphNodeModel;
        const subroot = Utils.createFileData(data);
        const subtreeModel = {
            name: path.basename(subpath).slice(0, -5),
            root: subroot,
            desc: data.desc,
        } as BehaviorTreeModel;
        fs.writeFileSync(subpath, JSON.stringify(subtreeModel, null, 2));
        this.pushUndoStack();
        data.path = subpath.substring(workdir.length + 1);
        this.unsave = true;
        this.save();
    }

    reload() {
        if (!this.unsave) {
            const data = this.graph.findDataById("1") as GraphNodeModel;
            this.autoId = Utils.refreshNodeId(data);
            const root = Utils.createFileData(data);
            const treeData = Utils.createTreeData(root, this.settings);
            this.autoId = Utils.refreshNodeId(treeData);
            this.graph.set("animate", false);
            this.graph.changeData(treeData);
            this.graph.layout();
            this.restoreViewport();
            this.graph.set("animate", true);
        }
    }

    getTreeModel() {
        const { filepath } = this.props;
        const data = this.graph.findDataById("1") as GraphNodeModel;
        this.autoId = Utils.refreshNodeId(data);
        const root = Utils.createFileData(data);
        return {
            name: path.basename(filepath).slice(0, -5),
            root,
            desc: this.treeModel.desc,
        } as BehaviorTreeModel;
    }

    copyNode() {
        if (!this.isInEditor) {
            return;
        }

        console.log("editor copy node");
        const { curNodeId } = this.state;
        if (!curNodeId) {
            return;
        }
        const data = this.graph.findDataById(curNodeId) as GraphNodeModel;
        if (data) {
            const str = JSON.stringify(Utils.cloneNodeData(data), null, 2);
            console.log("copy:", str);
            clipboard.writeText(str);
        }
    }

    pasteNode() {
        if (!this.isInEditor) {
            return;
        }

        const { curNodeId } = this.state;
        if (!curNodeId) {
            message.warn("未选中节点");
            return;
        }

        const curNodeData = this.graph.findDataById(curNodeId);
        try {
            const str = clipboard.readText();
            if (!str || str == "") {
                return;
            }
            console.log("paste:", str);
            const data = Utils.createTreeData(JSON.parse(str), this.settings, curNodeId);
            this.autoId = Utils.refreshNodeId(data, this.autoId);
            this.onSelectNode(null);
            if (!curNodeData.children) {
                curNodeData.children = [];
            }
            this.pushUndoStack();
            curNodeData.children.push(data);
            // this.autoId = Utils.refreshNodeId(this.graph.findDataById("1") as GraphNodeModel);
            this.changeWithoutAnim();
        } catch (error) {
            // message.error("粘贴数据有误");
            console.log(error);
        }
    }

    useStackData(data: BehaviorNodeModel) {
        this.graph.set("animate", false);
        this.data = Utils.createTreeData(data, this.settings);
        this.autoId = Utils.refreshNodeId(this.data);
        this.graph.changeData(this.data);
        this.graph.layout();
        this.restoreViewport();
        this.graph.set("animate", true);

        this.props.onChangeSaveState(true);
        this.unsave = true;
    }

    pushUndoStack(keepRedo?: boolean) {
        this.undoStack.push(Utils.cloneNodeData(this.graph.findDataById("1") as GraphNodeModel));
        console.log("push undo", this.undoStack);
        if (!keepRedo) {
            this.redoStack = [];
        }
    }

    pushRedoStack() {
        this.redoStack.push(Utils.cloneNodeData(this.graph.findDataById("1") as GraphNodeModel));
        console.log("push redo", this.redoStack);
    }

    undo() {
        if (this.undoStack.length == 0) {
            return;
        }
        const data = this.undoStack.pop();
        this.pushRedoStack();
        this.useStackData(data);
    }

    redo() {
        if (this.redoStack.length == 0) {
            return;
        }
        const data = this.redoStack.pop();
        this.pushUndoStack(true);
        this.useStackData(data);
    }

    changeTreeDesc(desc: string) {
        this.treeModel.desc = desc;
        this.settings.setTreeDesc(this.props.filepath, desc);
        this.unsave = true;
        this.save();
    }

    render() {
        const { curNodeId } = this.state;
        console.log("render tree", curNodeId);
        var curNode: any;
        if (curNodeId) {
            curNode = this.graph.findDataById(curNodeId);
        }

        return (
            <div className="editor">
                <Row className="editorBd">
                    <Col
                        span={18}
                        className="editorContent"
                        ref={this.ref}
                        onMouseDownCapture={(event) => {
                            this.state.blockNodeSelectChange = false;
                        }}
                    />
                    <Col
                        span={6}
                        className="editorSidebar"
                        onMouseDownCapture={(event) => {
                            this.state.blockNodeSelectChange = true;
                        }}
                    >
                        {curNode ? (
                            <NodePanel
                                model={curNode}
                                isSubtreeNode={this.isSubtreeNode(curNode)}
                                settings={this.settings}
                                updateNode={(id, forceUpdate) => {
                                    if (forceUpdate) {
                                        const data: GraphNodeModel = this.graph.findDataById(
                                            id
                                        ) as GraphNodeModel;
                                        data.conf = this.settings.getNodeConf(data.name);
                                        data.size = Utils.calcTreeNodeSize(data);
                                        this.changeWithoutAnim();
                                        this.save();
                                        return;
                                    }
                                    const item = this.graph.findById(id);
                                    item.draw();
                                    this.props.onChangeSaveState(true);
                                    this.unsave = true;
                                }}
                                pushUndoStack={() => {
                                    this.pushUndoStack();
                                }}
                            />
                        ) : (
                            <TreePanel
                                model={this.treeModel}
                                onRenameTree={(name: string) => {}}
                                onRemoveTree={() => {}}
                                onChangeTreeDesc={(desc) => {
                                    this.changeTreeDesc(desc);
                                }}
                            />
                        )}
                    </Col>
                </Row>
            </div>
        );
    }
}

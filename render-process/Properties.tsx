import React, { Component } from "react";
import { Menu, Input, Tree ,Dropdown} from "antd";
import * as fs from "fs";
import * as path from "path";
import { ipcRenderer } from "electron";
import MainEventType from "../common/MainEventType";
import { DataNode } from "antd/lib/tree";
import { IconType } from "rc-tree/lib/interface";

const { Search } = Input;
const { DirectoryTree } = Tree;

export interface PropertiesProps {
    workdir: string;
    onOpenTree: (path: string) => void;
    onDeleteTree: (path: string) => void;
}

class FileDataNode implements DataNode {
    checkable?: boolean;
    children?: FileDataNode[];
    disabled?: boolean;
    disableCheckbox?: boolean;
    icon?: IconType;
    isLeaf?: boolean;
    key: React.ReactText;
    title?: React.ReactNode;
    selectable?: boolean;
    switcherIcon?: IconType;
    className?: string;
    style?: React.CSSProperties;

    parent: FileDataNode;

    public constructor(init?: Partial<FileDataNode>) {
        Object.assign(this, init);
    }

    get isFolder() {
        return this.isLeaf !== void 0 && !this.isLeaf;
    }

    get name() {
        return this.title as string;
    }

    get path() {
        return this.key as string;
    }

    loadChilds(recursive?: boolean) {
        const folder = this.key as string;
        if (folder == "" || !fs.existsSync(folder)) {
            return [];
        }
        const files = fs.readdirSync(folder);
        const list: FileDataNode[] = [];
        files.forEach((filename) => {
            const fullPath = path.join(folder, filename);
            const stat = fs.statSync(fullPath);
            const isFolder = stat.isDirectory();
            const name = isFolder ? filename : filename.slice(0, -5);
            const node = new FileDataNode({
                title: name,
                key: fullPath,
                isLeaf: !isFolder,
                parent: this,
            });

            node.children = isFolder&&recursive ? (node.loadChilds(recursive) as FileDataNode[]) : [],

            list.push(node);
        });
        return list;
    }

    addChild(filePath: string) {
        const isDir = fs.statSync(filePath).isDirectory();
        const newNode = new FileDataNode({
            title: path.basename(filePath),
            key: filePath,
            isLeaf: !isDir,
            parent: this,
            children: [],
        });
        this.children = [newNode, ...this.children];
    }

    removeFromParent() {
        const parent = this.parent;
        if (parent) {
            const index = parent.children.indexOf(this);
            parent.children.splice(index, 1);
        }
    }

    expandSelf(recursive?: boolean) {
        if (this.isFolder) this.children = this.loadChilds(recursive);
    }

    findChild(key: string): FileDataNode {
        for (const child of this.children) {
            if (child.key == key) {
                return child;
            } else {
                const ret = child.findChild(key);
                if (ret) {
                    return ret;
                }
            }
        }
        return null;
    }

    // name:string;
    // path: string;
    // isFolder : boolean;
    // isEditing?: boolean;
    // children?: NodeData[];
}

interface PropertiesState {
    root: FileDataNode;
}

const NodeActions: { [x: string]: string } = {
    ["create"]: "New Tree",
    ["createFolder"]: "New Folder",
    ["rename"]: "Rename",
    ["delete"]: "Delete",
    ["reveal_in_explorer"]: "Reveal In File Explorer",
};

export default class Properties extends Component<PropertiesProps> {
    state: PropertiesState = {
        root: null,
    };

    curWorkdir: string = "";

    shouldComponentUpdate(nextProps: PropertiesProps) {
        const shouldUpdate = this.curWorkdir != nextProps.workdir;
        this.curWorkdir = nextProps.workdir;
        return shouldUpdate;
    }

    componentDidMount() {
        ipcRenderer.on(MainEventType.CREATE_TREE, (event: any, path: string) => {
            console.log("on Create tree", path);
            this.props.onOpenTree(path);
            this.state.root.expandSelf();
            this.forceUpdate();
        });

        var workdir = this.props.workdir;
        if (workdir == "") {
            return;
        }
        const root = this.getRootNode(workdir);
        root.expandSelf();
        this.setState({ root: root });
    }

    getRootNode(workdir: string) {
        return new FileDataNode({
            title: path.basename(workdir),
            key: workdir,
            isLeaf: false,
            parent: null,
            children: [],
        });
    }

    // renderContextMeun(selectedNode: FileDataNode) {
    //     const actions = Object.keys(NodeActions);
    //     return (
    //         <Menu>
    //             {actions.map((action) => {
    //                 const displayName: string = NodeActions[action];
    //                 return (
    //                     <Menu.Item
    //                         key={action}
    //                         onClick={(info) => {
    //                             //this.handleContextMenu({ node: selectedNode, action:{action} });
    //                         }}
    //                     >{displayName}
    //                     </Menu.Item>
    //                 );
    //             })}
    //         </Menu>
    //     );
    // }

    // renderNode(node:FileDataNode){
    //     return (<Dropdown
    //         overlay={this.renderContextMeun(node)}
    //         trigger={["contextMenu"]}
    //     >
    //         <div>{node.title}</div>
    //     </Dropdown>)
    // }

    render() {
        console.log("render Properties");
        const { onOpenTree, onDeleteTree, workdir } = this.props;
        const root = this.state.root;
        const nodes = root ? [root] : [];
        return nodes.length ? (
            <DirectoryTree
                selectable
                showLine
                expandAction="click"
                treeData={nodes}
                defaultExpandedKeys={[root.key]}
                onCheck={(node) => console.log("onCheck")}
                onSelect={(keys, info) => {
                    console.log("onSelect", keys, info);
                    if (info.node.isLeaf) {
                        onOpenTree(keys[0] as string);
                    }
                }}
                onExpand={(keys, info) => {
                    console.log("onExpand", info);
                    if (info.expanded && !info.node.expanded) {
                        //let newRoot = _.cloneDeep(root);
                        const node = root.findChild(info.node.key as string);
                        if (node) {
                            node.expandSelf();
                            this.setState({ root: root });
                            this.forceUpdate();
                        }
                    }
                }}
                onLoad={(keys, info) => console.log("onLoad", keys, info)}
                onRightClick={(event) => console.log("onRightClick", event)}
            ></DirectoryTree>
        ) : (
            `Work Dir (${workdir}) Empty`
        );
    }
}

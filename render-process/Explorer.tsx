import React, { ChangeEvent, Component } from "react";
import { Input } from "antd";
import { Tree } from "shineout";
import { FolderOutlined, FileOutlined, FolderOpenOutlined } from "@ant-design/icons";
import * as fs from "fs";
import * as path from "path";
import { ipcRenderer } from "electron";
import MainEventType from "../common/MainEventType";
import Settings from "../main-process/Settings";
import * as Utils from "../common/Utils";

const { Search } = Input;
const DirectoryTree = Tree;


class FileDataNode {
    name: string; //display name
    desc: string; //describe
    filepath: string; //file full path
    isFolder: boolean;

    settings: Settings;

    parent: FileDataNode;
    visible: boolean = true;
    children: FileDataNode[];

    public constructor(init?: Partial<FileDataNode>, settings?: Settings) {
        Object.assign(this, init);
        this.settings = settings;
    }

    get id() {
        return this.filepath;
    }

    get text() {
        if (!this.desc) {
            return this.name;
        }
        return `${this.name}(${this.desc})`;
    }

    get path() {
        return this.filepath;
    }

    public getRenderData() {
        if (!this.visible) {
            return null;
        }
        let ret = new FileDataNode({
            name: this.name,
            desc: this.isFolder ? undefined : this.settings.getTreeDesc(this.filepath),
            filepath: this.filepath,
            isFolder: this.isFolder,
            children: new Array(),
        }, this.settings);

        for (const child of this.children) {
            const data = child.getRenderData();
            if (data) {
                ret.children.push(data);
            }
        }
        return ret;
    }

    loadChilds(recursive?: boolean) {
        const folder = this.path;
        if (folder == "" || !fs.existsSync(folder)) {
            return [];
        }
        const files = fs.readdirSync(folder).filter((f) => {
            return f.endsWith(".json");
        });
        const list: FileDataNode[] = [];
        files.forEach((filename) => {
            const fullPath = path.join(folder, filename);
            const stat = fs.statSync(fullPath);
            const isFolder = stat.isDirectory();
            const name = isFolder ? filename : filename.slice(0, -5);
            const node = new FileDataNode({
                name: name,
                desc: isFolder ? undefined : this.settings.getTreeDesc(fullPath),
                filepath: fullPath,
                isFolder: isFolder,
                parent: this,
            }, this.settings);

            (node.children =
                isFolder && recursive ? (node.loadChilds(recursive) as FileDataNode[]) : []),
                list.push(node);
        });
        list.sort((a, b) => {
            const av = a.isFolder ? 100 : 0;
            const bv = b.isFolder ? 100 : 0;
            return bv - av;
        });
        return list;
    }

    addChild(filePath: string) {
        const isDir = fs.statSync(filePath).isDirectory();
        const newNode = new FileDataNode({
            name: path.basename(filePath),
            filepath: filePath,
            isFolder: isDir,
            parent: this,
            children: [],
        }, this.settings);
        this.children = [newNode, ...this.children];
    }

    removeFromParent() {
        const parent = this.parent;
        if (parent) {
            const index = parent.children.indexOf(this);
            parent.children.splice(index, 1);
        }
    }

    expandSelf(recursive: boolean = true) {
        if (this.isFolder) {
            this.children = this.loadChilds(recursive);
        }
    }

    findChild(id: string): FileDataNode {
        for (const child of this.children) {
            if (child.id == id) {
                return child;
            } else {
                const ret = child.findChild(id);
                if (ret) {
                    return ret;
                }
            }
        }
        return null;
    }

    getList(): FileDataNode[] {
        let ret = new Array<FileDataNode>(this);
        for (const child of this.children) {
            const childList = child.getList();
            ret.push(...childList);
        }
        return ret;
    }

    setVisible(keyWord: string) {
        let ret = false;
        for (let i = this.children.length - 1; i >= 0; i--) {
            const child = this.children[i];
            if (!child.isFolder) {
                const keyStr = child.text;
                child.visible = keyStr.includes(keyWord);
            } else {
                child.visible = child.setVisible(keyWord);
            }
            ret = child.visible || ret;
        }
        return ret;
    }

    // name:string;
    // path: string;
    // isFolder : boolean;
    // isEditing?: boolean;
    // children?: NodeData[];
}

const NodeActions: { [x: string]: string } = {
    ["create"]: "New Tree",
    ["createFolder"]: "New Folder",
    ["rename"]: "Rename",
    ["delete"]: "Delete",
    ["reveal_in_explorer"]: "Reveal In File Explorer",
};

interface ExplorerNodeProps {
    visible: boolean;
    title: string;
    selected: boolean;
    expended: boolean;
    isLeaf: boolean;
    searchKey: string;
}
class ExplorerNode extends Component<ExplorerNodeProps> {
    shouldComponentUpdate(nextProps: ExplorerNodeProps) {
        return JSON.stringify(this.props) != JSON.stringify(nextProps);
    }

    render() {
        const { title, visible, selected, expended, isLeaf, searchKey } = this.props;
        if (!visible) {
            return null;
        }

        const index = title.indexOf(searchKey);
        const beforeStr = title.substr(0, index);
        const afterStr = title.substr(index + searchKey.length);

        return (
            <div
                className={selected ? "explorer-node-selected" : "explorer-node"}
            >
                {!isLeaf ? (expended ? <FolderOpenOutlined /> : <FolderOutlined />) : <FileOutlined />}
                {isLeaf && index > -1 ? (
                    <span className="explorer-node-title">
                        {beforeStr}
                        <span className="explorer-node-search-value">{searchKey}</span>
                        {afterStr}
                    </span>
                ) : (
                        <span className="explorer-node-title">{title}</span>
                    )}
            </div>
        );
    }
}

export interface ExplorerProps {
    workdir: string;
    onOpenTree: (path: string) => void;
    onDeleteTree: (path: string) => void;
}


interface ExplorerState {
    root: FileDataNode;
    searchKey: string;
    selectedKey: string;
    defaultExpandedKeys: string[];
    expandedKeys: string[];
    autoExpandParent: boolean;
    rightClickNode: {
        pageX: number;
        pageY: number;
        key: string;
    };
}

export default class Explorer extends Component<ExplorerProps> {
    state: ExplorerState = {
        root: this.getRootNode(this.props.workdir),
        searchKey: "",
        selectedKey: "",
        rightClickNode: null,
        expandedKeys: [],
        defaultExpandedKeys: [],
        autoExpandParent: true,
    };

    curWorkdir: string = "";
    settings: Settings;

    shouldComponentUpdate(nextProps: ExplorerProps) {
        const shouldUpdate = this.curWorkdir != nextProps.workdir;
        this.curWorkdir = nextProps.workdir;
        return shouldUpdate;
    }

    componentDidMount() {
        this.settings = Utils.getRemoteSettings();
        ipcRenderer.on(MainEventType.CREATE_TREE, (event: any, path: string) => {
            console.log("on Create tree", path);
            this.props.onOpenTree(path);
            this.state.root.expandSelf();
            this.forceUpdate();
        });

        ipcRenderer.on(MainEventType.OPEN_DIR, (event: any, workdir: any, workspace: string) => {
            console.log("prop on open workspace", workspace);
            this.updateRoot();
            this.forceUpdate();
        });

        this.updateRoot();
    }

    updateRoot() {
        var workdir = this.props.workdir;
        if (!workdir || workdir === "") {
            return;
        }
        const root = this.getRootNode(workdir);
        root.expandSelf()
        this.setState({
            root: root,
            expandedKeys: [root.id],
            defaultExpandedKeys: [root.id],
        });

        this.forceUpdate();
    }

    getRootNode(workdir: string) {
        if (workdir && workdir !== "") {
            return new FileDataNode({
                name: path.basename(workdir),
                filepath: workdir,
                isFolder: true,
                parent: null,
                children: []
            }, this.settings);
        } else {
            return null;
        }
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

    handleOnSearch(value: string) {
        const expandedKeys = this.state.root
            .getList()
            .map((item) => {
                if (item.isFolder) return null;
                const title = item.text;
                if (title.includes(value) && item.parent) {
                    return item.parent.id;
                }
                return null;
            })
            .filter((item, i, self) => item && self.indexOf(item) === i);

        const root = this.state.root;
        root.setVisible(value || "");
        if (value && value.length > 0) {
            this.setState({
                root: root,
                searchKey: value,
                expandedKeys: expandedKeys,
                autoExpandParent: true,
            });
        } else {
            this.setState({
                root: root,
                searchKey: "",
                expandedKeys: this.state.defaultExpandedKeys,
                autoExpandParent: false,
            });
        }

        this.forceUpdate();
    }

    selectNode(id: string) {
        this.setState({
            selectedKey: id
        });
        this.forceUpdate();
    }

    renderItem(node: FileDataNode) {
        return (<ExplorerNode
            visible={node.visible}
            title={node.text}
            selected={this.state.selectedKey == node.id}
            expended={this.state.expandedKeys.includes(node.id)}
            isLeaf={!node.isFolder}
            searchKey={this.state.searchKey}
        />);
    }

    render() {
        console.log("render Explorer");
        const { onOpenTree, onDeleteTree, workdir } = this.props;

        const root = this.state.root;
        if (!workdir || workdir === "" || !root) {
            return `请打开workspace.json文件`;
        }

        const nodes = [root.getRenderData()];

        return (
            <div>
                <Search
                    allowClear
                    placeholder="Search"
                    // onChange={(e) => {
                    //     const value = e.target.value?.toLowerCase();
                    //     this.handleOnSearch(value);
                    // }}
                    onSearch={(value, event) => {
                        this.handleOnSearch(value?.toLowerCase());
                    }}
                />

                <DirectoryTree
                    keygen="id"
                    data={nodes}
                    line={false}
                    doubleClickExpand
                    defaultExpanded={[root.id]}
                    expanded={this.state.expandedKeys}
                    value={[this.state.selectedKey]}
                    onExpand={(expanded) => {
                        this.setState({ expandedKeys: expanded })
                        this.forceUpdate();
                    }}
                    renderItem={this.renderItem.bind(this)}
                    onClick={(node: FileDataNode) => {
                        if (!node.isFolder) {
                            onOpenTree(node.path);
                        }
                    }}
                ></DirectoryTree>
            </div>
        );
    }
}

import React, { ChangeEvent, Component } from "react";
import path from "path";
import request from "../../services/request";
import TreeNode, { Node, NodeAction, NodeDict } from "./TreeNode";
import icon from "../icon";
import Search from "../Search";
import { Modal, Menu, Dropdown } from "antd";
import { shell } from "electron";

export interface TreeProps {
    className: string;
    basePath: string;
    disableContextMenu?: boolean;
    filter: (path: string) => boolean;
    onItemSelected?: (node: Node) => void;
    onItemDeleted?: (node: Node) => void;
}

interface TreeState {
    nodes?: NodeDict;
    currentFile?: { name: string; path: string };
    overwrite?: boolean;
    dragdrop?: {
        sourceNode: Node;
        destinationNode?: Node;
    };
}

export default class Tree extends Component<TreeProps, TreeState> {
    state: TreeState = {
        dragdrop: {
            sourceNode: null,
            destinationNode: null,
        },
    };

    constructor(props: TreeProps) {
        super(props);
    }

    _getRootNode() {
        return {
            [this.props.basePath]: {
                name: path.basename(this.props.basePath),
                path: this.props.basePath,
                type: "directory",
                isOpen: false,
                children: null,
            } as Node,
        };
    }

    componentDidMount() {
        this.setState({
            nodes: this._getRootNode(),
        });

        // Open first level folders
        this.openFolders();

        console.log("componentDidMount", this.state);
    }

    openFolders = async () => {
        let nodes = this._getRootNode();
        const rootNode = nodes[this.props.basePath];
        const children = await this.getChildNodes(rootNode, this.props.filter);

        rootNode.children = children;
        rootNode.isOpen = true;

        for (const path in children) {
            if (children.hasOwnProperty(path)) {
                const node = children[path];

                if (node.type === "directory") {
                    const subChildren = await this.getChildNodes(node, this.props.filter);
                    node.children = { ...subChildren };
                    node.isOpen = true;
                }
            }
        }

        this.setState({
            nodes: nodes,
        });
    };

    getChildNodes = async (node: Node, filter: (path: string) => boolean) => {
        // if (!node.children) {
        //     return null;
        // }
        let children = (await request.tree(node.path)) as NodeDict;
        let result: NodeDict = {};
        for (const path in children) {
            if (children.hasOwnProperty(path)) {
                const node = children[path];
                if (node.type == "directory" || filter(node.path)) {
                    result[node.path] = node;
                }
            }
        }
        return result;
    };

    handleClick = async (event: React.MouseEvent, selectedNode: Node) => {
        event.stopPropagation();

        // If folder is clicked and the folder is already open, we will close it
        if (selectedNode.isOpen === true) {
            this.emptyChildren(this.state.nodes, selectedNode);
            selectedNode.isOpen = false;
            return;
        }

        if (selectedNode.type === "file") {
            this.setState({
                currentFile: {
                    name: selectedNode.name,
                    path: selectedNode.path,
                },
            });
        }

        selectedNode.isOpen = !selectedNode.isOpen;

        if(selectedNode.type === "directory"){
            // Get children of a selected node
            const newChildren = await this.getChildNodes(selectedNode, this.props.filter);

            // Add the new children to the selected folder
            this.addToChildren(this.state.nodes, selectedNode, newChildren);
        }

        // Propagate the selected item to the parent component
        this.props.onItemSelected(selectedNode);
    };

    handleOnMove = async () => {
        try {
            const response = await request.dragDrop({
                source: this.state.dragdrop.sourceNode.path,
                destination: this.state.dragdrop.destinationNode.path,
                overwrite: this.state.overwrite,
            });
            if (response.status === 201) {
                this.removeItem(this.state.nodes, this.state.dragdrop.sourceNode);
                this.emptyChildren(this.state.nodes, this.state.dragdrop.destinationNode);
            }
        } catch (error) {
            Modal.error({
                title: "Error",
                content: "Item already exists in the destination",
                centered: true,
            });
        }

        this.setState({
            overwrite: false,
        });
    };

    renameNode = async (selectedNode: Node,newFileName:string) => {
        try {
            const response = await request.renameNode({
                oldPath: selectedNode.path,
                newFileName: newFileName,
            });
            if (response.status === 200) {
                // Add the Item to state
                let newNode = selectedNode;
                newNode.name = newFileName;
                newNode.path = response.data.newFilePath;
                this.addItem(this.state.nodes, newNode);
            }
        } catch (error) {
            Modal.error({
                title: "Error",
                content: `A ${
                    selectedNode.type === "file" ? "file" : "folder"
                } with that name already exists`,
                centered: true,
            });
        }
    };

    handleOnDelete = async (selectedNode: Node) => {
        const response = await request.deleteNode(selectedNode.path);
        if (response.status === 200) {
            this.props.onItemDeleted && this.props.onItemDeleted(selectedNode);
            this.removeItem(this.state.nodes, selectedNode);
        }else{
            Modal.error({
                title: "Delete File/Folder Error",
                content: `${response.statusText}`,
                centered: true,
            });
        }
    };

    handleContextMenu = (data: { node: Node; action: NodeAction }) => {

        const { node, action } = data;

        switch (action) {
            case "create":{
                //TODO new file
                const baseDir = path.dirname(node.path) ;
                const defaultNewName="NewTree.json";
                const newFilePath = `${baseDir}${path.sep}${defaultNewName}`;
                this.addToChildren(this.state.nodes, node, {
                    [newFilePath]:{
                        name:defaultNewName,
                        path:newFilePath,
                        type:"file",
                        isEditing:true,
                        isOpen: false,
                        children: null,
                    }
                });
            }
            break;
            case "create_folder":{
                //TODO: new folder
                const baseDir = path.dirname(node.path) ;
                const defaultNewName="NewTree.json";
                const newFilePath = `${baseDir}${path.sep}${defaultNewName}`;
                this.addToChildren(this.state.nodes, node, {
                    [newFilePath]:{
                        name:defaultNewName,
                        path:newFilePath,
                        type:"directory",
                        isEditing:true,
                        isOpen: false,
                        children: null,
                    }
                });
            }
            break;
            case "reveal_in_explorer":{
                shell.showItemInFolder(node.path);
            }
            break;
            case "rename":{
                node.isEditing = true;
                const nodes = this.state.nodes;
                this.setState({nodes:nodes});
            }
            break;
            case "delete":{
                Modal.confirm({
                    title: "Delete Confirmation",
                    content: `You are about to delete ${node.path}`,
                    centered: true,
                    okText: "Delete",
                    onOk: () => this.handleOnDelete(node),
                });
            }
            break;
        }
    };

    // Adds children to a selected folder
    addToChildren = (nodes: NodeDict, selectedNode: Node, newChildren: NodeDict) => {
        for (const path in nodes) {
            const iterator = nodes[path];

            if (iterator.type === "file") {
                continue;
            }

            if (selectedNode.path.includes(iterator.path)) {
                // If its exactly the same path append the new node in its children array
                if (selectedNode.path === iterator.path) {
                    iterator.children = { ...newChildren, ...iterator.children };

                    // Prepare a new version of the current state
                    const newNodes = this.state.nodes;

                    // Set the new state
                    this.setState({
                        nodes: newNodes,
                    });
                    break;
                } else {
                    // If its a partial match, then get inside its children and perform iteration until exact match is not found
                    this.addToChildren(iterator.children, selectedNode, newChildren);
                }
            }
        }
    };

    // Removes children from a selected folder
    emptyChildren = (nodes: NodeDict, selectedNode: Node) => {
        for (let path in nodes) {
            const iterator = nodes[path];

            if (iterator.type === "file") {
                continue;
            }

            if (selectedNode.path.includes(iterator.path)) {
                // If its exactly the same path append the new node in its children array
                if (selectedNode.path === iterator.path) {
                    iterator.children = {};
                    iterator.isOpen = false;

                    // Prepare a new version of the current state
                    const newNodes = this.state.nodes;

                    // Set the new state
                    this.setState({
                        nodes: newNodes,
                    });
                    break;
                } else {
                    // If its a partial match, then get inside its children and perform iteration until exact match is not found
                    this.emptyChildren(iterator.children, selectedNode);
                }
            }
        }
    };

    // Add an item (file or folder) to the nodes array
    addItem = (nodes: NodeDict, selectedNode: Node) => {
        for (const path in nodes) {
            const iterator = nodes[path];

            if (selectedNode.path.includes(iterator.path)) {
                // If its exactly the same path append the new node in its children object
                if (selectedNode.path === iterator.path) {
                    // Add the element to the nodes object
                    nodes[path] = selectedNode;

                    // Prepare a new version of the current state
                    const newNodes = this.state.nodes;

                    // Set the new state
                    this.setState({
                        nodes: newNodes,
                    });
                    break;
                } else {
                    // If its a partial match, then get inside its children and perform iteration until exact match is not found
                    this.addItem(iterator.children, selectedNode);
                }
            }
        }
    };

    // Removes an item (file or folder) from the nodes array
    removeItem = (nodes: NodeDict, selectedNode: Node) => {
        for (const path in nodes) {
            const iterator = nodes[path];

            if (selectedNode.path.includes(iterator.path)) {
                // If its exactly the same path append the new node in its children array
                if (selectedNode.path === iterator.path) {
                    // Remove the element from the nodes array
                    // nodes.splice(path, 1);
                    delete nodes[path];

                    // Prepare a new version of the current state
                    const newNodes = this.state.nodes;

                    // Set the new state
                    this.setState({
                        nodes: newNodes,
                    });
                    break;
                } else {
                    // If its a partial match, then get inside its children and perform iteration until exact match is not found
                    this.removeItem(iterator.children, selectedNode);
                }
            }
        }
    };

    // Toggles the overwrite checkbox
    toggleOverwrite = () => {
        this.setState({
            overwrite: !this.state.overwrite,
        });
    };

    // Drag & Drop handlers
    onDrop = (event: React.DragEvent<HTMLDivElement>, selectedNode: Node) => {
        event.preventDefault();
        event.stopPropagation();

        if (selectedNode.type === "file") {
            Modal.error({
                title: "Error",
                content: "Destination is not a directory",
                centered: true,
            });
            return;
        }

        this.setState(
            {
                dragdrop: {
                    sourceNode: this.state.dragdrop.sourceNode,
                    destinationNode: selectedNode,
                },
            },
            async () => {
                Modal.confirm({
                    title: "Confirm Move",
                    content: `
                        <p>
                            You are about to move <strong>${this.state.dragdrop.sourceNode.name}</strong>
                        </p>
                        <p>to</p>
                        <p>
                            ${selectedNode.path}
                        </p>`,
                    centered: true,
                    okText: "Delete",
                    onOk: () => this.handleOnMove(),
                });
            }
        );
    };

    onDrag = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    onDragOver = (event: React.DragEvent<HTMLDivElement>) => event.preventDefault();

    onDragStart = (event: React.DragEvent<HTMLDivElement>, selectedNode: Node) => {
        event.stopPropagation();

        this.setState({
            dragdrop: {
                sourceNode: selectedNode,
                destinationNode: this.state.dragdrop.destinationNode,
            },
        });
        const id = (event.target as HTMLDivElement).id;
        event.dataTransfer.setData("text/plain", id);
    };

    renderContextMeun(node: Node) {
        return (
            <Menu>
                <Menu.Item
                    key="create"
                    onClick={(info) => {
                        this.handleContextMenu({ node: node, action: "create" });
                    }}
                >
                    New Tree
                </Menu.Item>
                <Menu.Item
                    key="create_folder"
                    onClick={(info) => {
                        this.handleContextMenu({ node: node, action: "create_folder" });
                    }}
                >
                    New Folder
                </Menu.Item>
                <Menu.Item
                    key="reveal_in_explorer"
                    onClick={(info) => {
                        this.handleContextMenu({ node: node, action: "reveal_in_explorer" });
                    }}
                >
                    Reveal In File Explorer
                </Menu.Item>
                <Menu.Divider/>
                <Menu.Item
                    key="rename"
                    onClick={(info) => {
                        this.handleContextMenu({ node: node, action: "rename" });
                    }}
                >
                    Rename
                </Menu.Item>
                <Menu.Item
                    key="delete"
                    onClick={(info) => {
                        this.handleContextMenu({ node: node, action: "delete" });
                    }}
                >
                    Delete
                </Menu.Item>
            </Menu>
        );
    }

    render() {
        if (!this.state.nodes) {
            return <p>Loading...</p>;
        }
        return (
            <div className={`container ${this.props.className}`}>
                <Search basePath={this.props.basePath} onItemSelected={this.props.onItemSelected} />
                <div className="indent-root">
                    {Object.keys(this.state.nodes).map((path) => {
                        const node = this.state.nodes[path];
                        return (
                            <div key={path}>
                                <Dropdown
                                    overlay={this.renderContextMeun(node)}
                                    trigger={["contextMenu"]}
                                >
                                    <div
                                        onClick={(event) => {
                                            this.handleClick(event, node);
                                        }}
                                        className="item-wrapper mb"
                                    >
                                        {icon.file(node)}{" "}{node.name}
                                    </div>
                                </Dropdown>

                                <TreeNode
                                    node={node}
                                    currentFile={this.state.currentFile}
                                    contextMenu={this.renderContextMeun.bind(this)}
                                    handleClick={this.handleClick}
                                    onDragStart={this.onDragStart}
                                    onDrag={this.onDrag}
                                    onDragOver={this.onDragOver}
                                    onDrop={this.onDrop}
                                    onRenameNode={this.renameNode}
                                    disableContextMenu={this.props.disableContextMenu}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
}

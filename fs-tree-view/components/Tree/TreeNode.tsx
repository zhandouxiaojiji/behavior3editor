import { Menu, Dropdown, Input } from "antd";
import React from "react";
import icon from "../icon";

export interface Node {
    name: string;
    path: string;
    extension?: string;
    type?: "directory" | "file";
    //size?: number;
    isOpen?: boolean;
    isEditing?: boolean;
    children?: NodeDict;
}

export type NodeDict = { [key: string]: Node };

export type NodeAction = "create" | "create_folder" | "rename" | "delete" | "reveal_in_explorer";

export interface TreeNodeProp {
    node: Node;
    currentFile: {
        name: string;
        path: string;
    };
    contextMenu: (node: Node) => JSX.Element;
    handleClick?: (event: React.MouseEvent, selectedNode: Node) => void;
    draggable?: boolean;
    onDragStart?: (event: React.DragEvent<HTMLDivElement>, data: Node) => void;
    onDrag?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop?: (event: React.DragEvent<HTMLDivElement>, data: Node) => void;
    onRenameNode?:(node:Node,newFileName:string) => void;
    disableContextMenu?: boolean;
}

let EditingText = "";

export default function TreeNode(props: TreeNodeProp) {
    const {
        node,
        currentFile,
        contextMenu,
        handleClick,
        onDragStart,
        onDrag,
        onDragOver,
        onDrop,
        onRenameNode,
        disableContextMenu,
    } = props;

    return (
        <div className="indent">
            {node.children &&
                Object.keys(node.children).map((path) => {
                    const child = node.children[path];

                    return (
                        <div
                            key={path}
                            onClick={(event) => handleClick(event, child)}
                            draggable={true}
                            onDragStart={(event) => onDragStart(event, child)}
                            onDrag={onDrag}
                            onDragOver={onDragOver}
                            onDrop={(event) => onDrop(event, child)}
                        >
                            {child.isEditing ? (
                                <Input
                                    defaultValue={child.name}
                                    onChange={(e) => {
                                        EditingText = e.currentTarget.value;
                                    }}
                                    onFocus={(e)=>{
                                        EditingText=child.name;
                                        //e.currentTarget.select();
                                        e.currentTarget.setSelectionRange(0,EditingText.lastIndexOf("."),"forward");
                                    }}
                                    onPressEnter={(e) => {
                                        if(child.isEditing){
                                            child.isEditing = false;
                                            onRenameNode(child,EditingText);
                                        }
                                    }}

                                    onBlur={(e)=>{
                                        console.log("onBlur ", EditingText);
                                        if(child.isEditing){
                                            child.isEditing = false;
                                            onRenameNode(child,EditingText);
                                        }
                                    }} 
                                    autoFocus={true}
                                />

                            ) : (
                                <Dropdown overlay={contextMenu(child)} trigger={["contextMenu"]}>
                                    <div
                                        className={
                                            currentFile && currentFile.path === child.path
                                                ? "item-wrapper blue mb"
                                                : "item-wrapper mb"
                                        }
                                    >
                                        {icon.file(child)} {child.name}
                                    </div>
                                </Dropdown>
                            )}
                            <TreeNode
                                node={child}
                                currentFile={currentFile}
                                contextMenu={contextMenu}
                                handleClick={handleClick}
                                draggable={true}
                                onDragStart={onDragStart}
                                onDrag={onDrag}
                                onDragOver={onDragOver}
                                onDrop={onDrop}
                                disableContextMenu={disableContextMenu}
                            />
                        </div>
                    );
                })}
        </div>
    );
}

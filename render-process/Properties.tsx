import React, { Component } from "react";
import { Menu, Input } from "antd";
import * as fs from "fs";
import * as path from "path";
import { ipcRenderer } from "electron";
import MainEventType from "../common/MainEventType";

const { Search } = Input;

export interface TreeFile {
    name: string;
    path: string;
}

export interface PropertiesProps {
    workdir: string;
    onOpenTree: (path: string) => void;
}

interface PropertiesState {
    treeList: TreeFile[];
}

export default class Properties extends Component<PropertiesProps> {
    state: PropertiesState = {
        treeList: [],
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
            this.forceUpdate();
        });

        var workdir = this.props.workdir;
        if (workdir == "") {
            return;
        }
        this.setState({ treeList: this.getTreeList(workdir) });
    }

    getTreeList(workdir: string) {
        if (workdir == "" || !fs.existsSync(workdir)) {
            console.log("workdir not exist", workdir);
            return [];
        }

        const files = fs.readdirSync(workdir);
        const list: TreeFile[] = [];
        files.forEach((filename) => {
            const stat = fs.statSync(path.join(workdir, filename));
            if (stat.isFile()) {
                var name = filename.slice(0, -5);
                list.push({
                    name,
                    path: workdir + "/" + name + ".json",
                });
            }
        });
        return list;
    }

    render() {
        console.log("render Properties");
        const { onOpenTree, workdir } = this.props;
        const treeList = this.getTreeList(workdir);
        return (
            <div>
                <Search placeholder="Search" onChange={() => {}} />
                <Menu mode="inline">
                    {treeList.map((tree) => (
                        <Menu.Item key={tree.name} onClick={() => onOpenTree(tree.path)}>
                            {tree.name}
                        </Menu.Item>
                    ))}
                </Menu>
            </div>
        );
    }
}

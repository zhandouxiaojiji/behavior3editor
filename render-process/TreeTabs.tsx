import Editor from "./Editor";
import React, { Component } from "react";
import { Layout, Tabs, message } from "antd";
import { ipcRenderer, remote } from "electron";
import * as path from "path";

import "antd/dist/antd.dark.css";
import MainEventType from "../common/MainEventType";
import { BehaviorTreeModel } from "../common/BehaviorTreeModel";

const { TabPane } = Tabs;

interface TreeTabsProps {}

interface TreeTabsState {
    filepaths: string[];
    curPath?: string;
}

export default class TreeTabs extends Component<TreeTabsProps, TreeTabsState> {
    state: TreeTabsState = {
        filepaths: [],
    };

    editors: { [path: string]: Editor } = {};

    componentDidMount() {
        ipcRenderer.on(MainEventType.CREATE_NODE, (event: any, name: any) => {
            const editor = this.getCurEditor();
            editor?.createNode(name);
        });

        ipcRenderer.on(MainEventType.DELETE_NODE, () => {
            const editor = this.getCurEditor();
            editor?.deleteNode();
        });

        ipcRenderer.on(MainEventType.COPY_NODE, () => {
            const editor = this.getCurEditor();
            editor?.copyNode();
        });

        ipcRenderer.on(MainEventType.PASTE_NODE, () => {
            const editor = this.getCurEditor();
            editor?.pasteNode();
        });

        ipcRenderer.on(MainEventType.SAVE, (event: any) => {
            const { curPath } = this.state;
            if (!curPath) {
                return;
            }
            const editor = this.editors[curPath];
            editor.save();
            message.success("已保存");
        });

        ipcRenderer.on(MainEventType.SAVE_ALL, (event: any) => {
            for (let k in this.editors) {
                let editor = this.editors[k];
                editor.save();
            }
            message.success("已保存所有行为树");
        });

        ipcRenderer.on(MainEventType.UNDO, () => {
            const editor = this.getCurEditor();
            editor?.undo();
        });

        ipcRenderer.on(MainEventType.REDO, () => {
            const editor = this.getCurEditor();
            editor?.redo();
        });
    }

    getOpenTreesModel() {
        const trees: BehaviorTreeModel[] = []
        for (let k in this.editors) {
            let editor = this.editors[k];
            if(editor) {
                trees.push(editor.save());
            }
        }
        return trees;
    }

    getCurEditor() {
        const { curPath } = this.state;
        if (!curPath) {
            return;
        }
        return this.editors[curPath];
    }

    openFile(path: string) {
        if (this.state.filepaths.indexOf(path) < 0) {
            const filepaths = this.state.filepaths;
            filepaths.push(path);
            this.setState({ filepaths, curPath: path });
        } else {
            this.setState({ curPath: path });
        }
    }

    closeFile(path: string) {
        const index = this.state.filepaths.indexOf(path);
        if (index >= 0) {
            const filepaths = this.state.filepaths;
            filepaths.splice(index,1);
            const length = filepaths.length;
            this.setState({ filepaths, curPath: length>0?filepaths[length-1]:null });
        } 
    }

    render() {
        console.log("render tabs");
        const { filepaths, curPath } = this.state;
        if (!curPath) {
            return <div />;
        }
        this.editors = {};
        return (
            <Tabs
                hideAdd
                className="tabs"
                type="editable-card"
                defaultActiveKey={curPath}
                activeKey={curPath}
                onChange={(activeKey) => {
                    this.setState({ curPath: activeKey });
                }}
                onEdit={(targetKey, action) => {
                    if (action == "remove") {
                        const idx = filepaths.indexOf(targetKey as string);
                        if (idx < 0) {
                            return;
                        }
                        filepaths.splice(idx, 1);
                        const nextPath = filepaths[idx - 1];
                        this.setState({ filepaths, curPath: nextPath });
                    }
                }}
            >
                {filepaths.map((filepath) => {
                    return (
                        <TabPane tab={path.basename(filepath)} key={filepath}>
                            <Editor
                                filepath={filepath}
                                ref={(ref) => {
                                    this.editors[filepath] = ref;
                                }}
                            />
                        </TabPane>
                    );
                })}
            </Tabs>
        );
    }
}

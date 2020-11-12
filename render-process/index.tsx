import * as ReactDOM from "react-dom";
import Editor from "./Editor";
import React, { Component } from "react";
import { Layout, Tabs } from "antd";
import { ipcRenderer, remote } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as Utils from "../common/Utils";
import MainEventType from "../common/MainEventType";
import Properties from "./Properties";
import Settings from "../main-process/Settings";
import G6 from "@antv/g6";

import "antd/dist/antd.dark.css";
import "./index.css";
import { ModelConfig, Item } from "@antv/g6/lib/types";
import RegisterNode from "./RegisterNode";
import TreeTabs from "./TreeTabs";

const { Header, Sider, Content, Footer } = Layout;
const { TabPane } = Tabs;

interface MainState {
    workdir: string;
    workspace: string;
}

export default class Main extends Component {
    state: MainState = {
        workdir: "",
        workspace: "",
    };

    settings: Settings;
    tabs: TreeTabs;

    componentWillMount() {
        this.updateSettings();
        RegisterNode(this.settings);
    }

    componentDidMount() {
        ipcRenderer.on(MainEventType.OPEN_FILE, (event: any, path: any) => {
            this.setState({ curPath: path });
        });

        ipcRenderer.on(MainEventType.OPEN_DIR, (event: any, workdir: any, workspace: string) => {
            console.log("on open workspace", workspace);
            document.title = workspace;
            this.setState({ workdir, workspace });
        });

        console.log("workdir", this.settings.curWorkspace.getWorkdir());
        this.setState({
            workdir: this.settings.curWorkspace.getWorkdir(),
            workspace: this.settings.curWorkspace.getFilepath(),
        });
    }

    updateSettings() {
        this.settings = Utils.getRemoteSettings();
    }

    render() {
        console.log("render main");
        const { workdir, workspace } = this.state;
        document.title = `行为树编辑器 - ${workspace}`;
        return (
            <Layout className="body">
                <Sider className="sider" width={250}>
                    <Properties
                        workdir={workdir}
                        onOpenTree={(path) => {
                            this.tabs.openFile(path);
                        }}
                    />
                </Sider>
                <Content className="content">
                    <TreeTabs
                        ref={(ref) => {
                            this.tabs = ref;
                        }}
                    />
                </Content>
            </Layout>
        );
    }
}

ReactDOM.render(<Main />, document.getElementById("root") as HTMLElement);

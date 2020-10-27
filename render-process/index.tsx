
import * as ReactDOM from "react-dom";
import Editor from "./Editor";
import React, { Component } from "react";
import { Layout, Tabs } from 'antd';
import { ipcRenderer, remote } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as Utils from '../common/Utils';
import MainEventType from "../common/MainEventType";
import Properties from "./Properties";
import Settings from "../main-process/Settings";
import G6 from '@antv/g6';

import 'antd/dist/antd.dark.css';
import './index.css';
import { ModelConfig, Item } from "@antv/g6/lib/types";
import RegisterNode from "./RegisterNode";
import TreeTabs from "./TreeTabs";

const { Header, Sider, Content, Footer } = Layout;
const { TabPane } = Tabs;


interface MainState {
  workspace: string;
}

export default class Main extends Component {
  state: MainState = {
    workspace: '',
  }

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

    ipcRenderer.on(MainEventType.OPEN_WORKSPACE, (event: any, workspace: any) => {
      console.log("on open workspace", workspace);
      document.title = workspace;
      this.setState({ workspace });
    });

    this.setState({ workspace: this.getLastWorkspace() });
  }

  getLastWorkspace() {
    return this.settings.recentWorkspaces[0];
  }

  updateSettings() {
    this.settings = Utils.getRemoteSettings();
  }

  render() {
    console.log("render main");
    const { workspace } = this.state;
    document.title = `行为树编辑器 - ${workspace}`;
    return (
      <Layout className="body">
        <Sider className="sider" width={250}>
          <Properties
            workspace={this.state.workspace}
            onOpenTree={(path) => {
              this.tabs.openFile(path);
            }}
          />
        </Sider>
        <Content className="content">
          <TreeTabs
            ref = {ref => {
              this.tabs = ref;
            }}
          />
        </Content>
      </Layout>
    )
  }
};

ReactDOM.render(
  <Main />,
  document.getElementById('root') as HTMLElement
);
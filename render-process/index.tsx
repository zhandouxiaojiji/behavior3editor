
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

const { Header, Sider, Content, Footer } = Layout;
const { TabPane } = Tabs;


interface MainState {
  workspace: string;
  filepaths: string[];
  curPath?: string;
}

export default class Main extends Component {
  state: MainState = {
    workspace: '',
    filepaths: [],
  }

  settings: Settings;

  componentWillMount() {
    this.updateSettings();
    RegisterNode(this.settings);
  }

  componentDidMount() {
    ipcRenderer.on(MainEventType.OPEN_FILE, (event: any, path: any) => {
      this.openFile(path);
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

  openFile(path: string) {
    console.log("on open file", path);
    if (this.state.filepaths.indexOf(path) < 0) {
      const filepaths = this.state.filepaths;
      filepaths.push(path);
      this.setState({ filepaths, curPath: path });
    } else {
      this.setState({ curPath: path });
    }
  }

  renderJson() {
    const path = this.state.curPath;
    if (path) {
      const str = fs.readFileSync(path, 'utf8');
      return (<div>{str}</div>)
    }
  }

  render() {
    console.log("render main");
    const { workspace, filepaths, curPath } = this.state;
    document.title = `行为树编辑器 - ${workspace}`;
    return (
      <Layout className="body">
        <Sider className="sider" width={250}>
          <Properties
            workspace={this.state.workspace}
            onOpenTree={(path) => {
              this.openFile(path);
            }}
          />
        </Sider>
        <Content className="content">
          <Tabs
            hideAdd
            className="tabs"
            type="editable-card"
            defaultActiveKey={curPath}
            activeKey={curPath}
            onChange={activeKey => {
              this.setState({ curPath: activeKey })
            }}
            onEdit={(targetKey, action) => {
              if (action == 'remove') {
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
            {
              filepaths.map(filepath => {
                return (
                  <TabPane tab={path.basename(filepath)} key={filepath}>
                    <Editor filepath={filepath} />
                  </TabPane>
                );
              })
            }
          </Tabs>
        </Content>
      </Layout>
    )
  }
};

ReactDOM.render(
  <Main />,
  document.getElementById('root') as HTMLElement
);
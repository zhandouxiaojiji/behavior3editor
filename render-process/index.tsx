
import * as ReactDOM from "react-dom";
import Editor from "./Editor";
import React, { Component } from "react";
import { Layout, Tabs } from 'antd';
import { ipcRenderer, remote } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import MainEventType from "../common/MainEventType";
import Properties from "./Properties";
import { BehaviorTreeModel } from "../common/BehaviorTreeModel";
import Settings from "../main-process/Settings";
import G6 from '@antv/g6';

import 'antd/dist/antd.dark.css';
import './index.css';

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

  componentWillMount() {
    G6.registerNode(
      'tree-node',
      {
        drawShape: function drawShape(cfg: any, group) {
          const rect = group.addShape('rect', {
            attrs: {
              fill: '#fff',
              stroke: '#666',
            },
            name: 'rect-shape',
          });
          const content = cfg.name.replace(/(.{19})/g, '$1\n');
          const text = group.addShape('text', {
            attrs: {
              text: content,
              x: 0,
              y: 0,
              textAlign: 'left',
              textBaseline: 'middle',
              fill: '#666',
            },
            name: 'rect-shape',
          });
          const bbox = text.getBBox();
          const hasChildren = cfg.children && cfg.children.length > 0;
          if (hasChildren) {
            group.addShape('marker', {
              attrs: {
                x: bbox.maxX + 12,
                y: 0,
                r: 6,
                symbol: cfg.collapsed ? G6.Marker.expand : G6.Marker.collapse,
                stroke: '#666',
                lineWidth: 2,
              },
              name: 'collapse-icon',
            });
          }
          rect.attr({
            x: bbox.minX - 4,
            y: bbox.minY - 6,
            width: bbox.width + (hasChildren ? 26 : 8),
            height: bbox.height + 12,
          });
          return rect;
        },
      },
      'single-node',
    );
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
    const settings: Settings = remote.getGlobal("settings");
    return settings.recentWorkspaces[0];
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

  loadAllTrees() {
    const workspace = this.state.workspace
    if (workspace == '' || !fs.existsSync(workspace)) {
      console.log("workspace not exist", workspace);
      return;
    }

    const files = fs.readdirSync(workspace);
    const list = []
    files.forEach((filename) => {
      console.log("load path", filename);
      const stat = fs.statSync(path.join(workspace, filename))
      if (stat.isFile()) {
        let tree = this.loadTree(filename.slice(0, -5));
        list.push(tree);
        console.log("loaded", filename);
      }
    })
  }

  loadTree(name: string) {
    const filename = this.state.workspace + '/' + name + '.json';
    if (!fs.existsSync(filename)) {
      return;
    }
    const str = fs.readFileSync(filename, 'utf8');
    let tree: BehaviorTreeModel = JSON.parse(str);
    tree.name = name;
    return tree;
  }

  renderJson() {
    const path = this.state.curPath;
    if (path) {
      const str = fs.readFileSync(path, 'utf8');
      return (<div>{str}</div>)
    }
  }

  render() {
    const { workspace, filepaths } = this.state;
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
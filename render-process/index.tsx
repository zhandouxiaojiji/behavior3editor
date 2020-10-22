
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
    const settings = this.settings;
    G6.registerNode(
      'TreeNode',
      {
        options: {
          type: 'rect',
          labelCfg: {
            style: {
              fill: 'blue',
              fontSize: 10
            }
          },
          style: {
            fill: "white",
            stroke: '#72CC4A',
            width: 150
          },
          stateStyles: {
            hover: {
              fill: '#d3adf7',
            },
            selected: {
              stroke: '#000',
              lineWidth: 3,
            },
            dragSrc: {
              fill: 'gray',
            },
            dragRight: {
              'drag-right': {
                fillOpacity: 0.6,
              }
            },
            dragUp: {
              'drag-up': {
                fillOpacity: 0.6,
              }
            },
            dragDown: {
              'drag-down': {
                fillOpacity: 0.6,
              }
            },
          },
        },
        draw(cfg, group) {
          const color = cfg.error ? '#F4664A' : '#30BF78';
          var size = cfg.size ? cfg.size as number[] : [150, 40];
          const w = size[0];
          const h = size[1];
          const r = 2;
          const shape = group.addShape('rect', {
            attrs: {
              x: -w / 2,
              y: -h / 2,
              width: w,
              height: h,
              stroke: color,
              fill: 'white',
              radius: r,
            },
            name: 'main-box',
            draggable: true,
          });

          // id text
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x: -w / 2 + 13,
              y: -h / 2 + 2,
              lineHeight: 20,
              text: cfg.id,
              textAlign: 'right',
              fill: 'black',
            },
            name: 'id-text',
          });

          const classfiy = settings.getClassify(cfg.name as string) || 'Other';
          var img = `./static/icons/${classfiy}.svg`;
          console.log(cfg.type, classfiy);
          group.addShape('image', {
            attrs: {
              x: -w / 2 + 15,
              y: -h / 2,
              height: 16,
              width: 16,
              img,
            },
            name: 'node-icon',
          });

          // name text
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x: -w / 2 + 35,
              y: -h / 2 + 2,
              lineHeight: 20,
              text: cfg.name,
              fill: 'black',
            },
            name: 'name-text',
          });

          group.addShape('rect', {
            name: 'drag-up',
            attrs: {
              x: -w / 2,
              y: -h / 2,
              width: w,
              height: h / 2,
              fill: 'blue',
              fillOpacity: 0,
            },
            draggable: true,
            // visible: false,
          });

          group.addShape('rect', {
            name: 'drag-down',
            attrs: {
              x: -w / 2,
              y: 0,
              width: w,
              height: h / 2,
              fill: 'blue',
              fillOpacity: 0,
            },
            draggable: true,
            // visible: false,
          });

          group.addShape('rect', {
            name: 'drag-right',
            attrs: {
              x: w * 0.1,
              y: -h / 2,
              width: w * 0.4,
              height: h,
              fill: 'blue',
              fillOpacity: 0,
            },
            draggable: true,
            // visible: false,
          });
          return shape;
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
                if(idx < 0) {
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
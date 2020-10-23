
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

const NODE_COLORS: any = {
  ['Composite'] : 'rgb(91,237,32)',
  ['Decorator'] : 'rgb(218,167,16)',
  ['Condition'] : 'rgb(228,20,139)',
  ['Action'] : 'rgb(91,143,249)',
  ['Other'] : 'rgb(112,112,112)',
} 

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
            width: 150,
          },
          stateStyles: {
            hover: {
              'main-box': {
                fill: 'gray',
              }
            },
            selected: {
              'main-box': {
                stroke: 'black',
                lineWidth: 3,
              },
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
          const classfiy = settings.getClassify(cfg.name as string) || 'Other';
          const color = NODE_COLORS[classfiy];
          var size = cfg.size ? cfg.size as number[] : [150, 40];
          const w = size[0];
          const h = size[1];
          const x0 = -w / 2;
          const y0 = -h / 2;
          const r = 2;
          const shape = group.addShape('rect', {
            attrs: {
              x: x0,
              y: y0,
              width: w,
              height: h,
              stroke: color,
              lineWidth: 2,
              fill: 'white',
              radius: r,
            },
            name: 'main-box',
            draggable: true,
          });

          // name bg
          group.addShape('rect', {
            attrs: {
              x: x0+1.5,
              y: y0+1.5,
              width: w-3,
              height: 16,
              fill: color,
              // radius: r,
            },
            name: 'name-bg',
            draggable: true,
          });

          // id text
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x: x0 + 13,
              y: y0 + 4,
              lineHeight: 20,
              text: cfg.id,
              textAlign: 'right',
              fill: 'black',
            },
            name: 'id-text',
          });

          // icon
          var img = `./static/icons/${classfiy}.svg`;
          console.log(cfg.type, classfiy);
          group.addShape('image', {
            attrs: {
              x: x0 + 15,
              y: y0 + 2,
              height: 14,
              width: 14,
              img,
            },
            name: 'node-icon',
          });

          // name text
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x: x0 + 35,
              y: y0 + 4,
              lineHeight: 20,
              text: cfg.name,
              fill: 'black',
            },
            name: 'name-text',
          });

          var x = x0 + 2;
          var y = y0 + 20;
          // desc text
          if(cfg.desc) {
            group.addShape('text', {
              attrs: {
                textBaseline: 'top',
                x,
                y,
                lineHeight: 20,
                text: cfg.name,
                fill: 'black',
              },
              name: 'name-text',
            });
          }
          

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

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

const { Header, Sider, Content, Footer } = Layout;
const { TabPane } = Tabs;

interface TreeTabsProps {
}

interface TreeTabsState {
  filepaths: string[];
  curPath?: string;
}

export default class TreeTabs extends Component<TreeTabsProps, TreeTabsState> {
  state: TreeTabsState = {
    filepaths: [],
  }

  componentWillMount() {
  }

  componentDidMount() {
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

  render() {
    console.log("render tabs");
    const { filepaths, curPath } = this.state;
    if (!curPath) {
      return (<div />);
    }
    return (
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
    )
  }
};
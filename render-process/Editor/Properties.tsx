import React, { Component } from "react";
import { Menu, Input } from "antd";
import * as fs from 'fs';
import * as path from 'path';
import { BehaviorTreeModel } from "../../common/BehaviorTreeModel";
import { remote } from 'electron';
import { MainProcess } from "../../main-process/MainProcess";
import Settings from "../../main-process/Settings";

const { Search } = Input;

interface TreeFile {
  name: string;
  path: string;
}

export interface PropertiesProps {
  workspace: string;
  onOpenTree: (path: string) => void;
}

interface PropertiesState {
  treeList: TreeFile[]
}

export default class Properties extends Component<PropertiesProps> {
  state: PropertiesState = {
    treeList: []
  };

  componentDidMount() {
    var workspace = this.props.workspace;
    if (workspace == '') {
      workspace = this.getLastWorkspace();
    }
    this.setState({ treeList: this.getTreeList(workspace) });
  }

  getLastWorkspace() {
    const settings: Settings = remote.getGlobal("settings");
    return settings.recentWorkspaces[0];
  }

  getTreeList(workspace: string) {
    if (workspace == '' || !fs.existsSync(workspace)) {
      console.log("workspace not exist", workspace);
      return;
    }

    const files = fs.readdirSync(workspace);
    const list: TreeFile[] = [];
    files.forEach((filename) => {
      const stat = fs.statSync(path.join(workspace, filename))
      if (stat.isFile()) {
        list.push({
          name: filename.slice(0, -5),
          path: workspace + '/' + name + '.json'
        });
      }
    })
    return list;
  }

  render() {
    const { treeList } = this.state;
    return (
      <div>
        <Search
          placeholder="Search"
          onChange={() => {

          }}
        />
        <Menu
          mode="inline"
        >
          {treeList.map((tree) => (
            <Menu.Item
              key={tree.name}
            >
              {tree.name}
            </Menu.Item>
          ))}
        </Menu>
      </div>
    )
  }
}
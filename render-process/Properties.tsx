import React, { Component } from "react";
import { Menu, Input } from "antd";
import * as fs from 'fs';
import * as path from 'path';
import { BehaviorTreeModel } from "../common/BehaviorTreeModel";
import { remote } from 'electron';
import { MainProcess } from "../main-process/MainProcess";
import Settings from "../main-process/Settings";

const { Search } = Input;

export interface TreeFile {
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

  curWorkspace: string = '';

  shouldComponentUpdate(nextProps: PropertiesProps) {
    const shouldUpdate = this.curWorkspace != nextProps.workspace;
    this.curWorkspace = nextProps.workspace;
    return shouldUpdate;
  }

  componentDidMount() {
    var workspace = this.props.workspace;
    if (workspace == '') {
      return;
    }
    this.setState({ treeList: this.getTreeList(workspace) });
  }

  getTreeList(workspace: string) {
    if (workspace == '' || !fs.existsSync(workspace)) {
      console.log("workspace not exist", workspace);
      return [];
    }

    const files = fs.readdirSync(workspace);
    const list: TreeFile[] = [];
    files.forEach((filename) => {
      const stat = fs.statSync(path.join(workspace, filename))
      if (stat.isFile()) {
        var name = filename.slice(0, -5)
        list.push({
          name,
          path: workspace + '/' + name + '.json'
        });
      }
    })
    return list;
  }

  render() {
    console.log("render Properties");
    const { onOpenTree, workspace } = this.props;
    const treeList = this.getTreeList(workspace);
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
              onClick={() => onOpenTree(tree.path)}
            >
              {tree.name}
            </Menu.Item>
          ))}
        </Menu>
      </div>
    )
  }
}
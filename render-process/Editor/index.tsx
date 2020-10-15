import React, { Component } from "react";
import { Layout } from 'antd';
import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import MainEventType from "../../common/MainEventType";
import Properties from "./Properties";
import './Editor.css';
import { BehaviorTreeModel } from "../../common/BehaviorTreeModel";

const { Header, Sider, Content, Footer } = Layout;

interface EditorState {
  workspace: string;
  filepaths: string[];
  trees: BehaviorTreeModel[];
}

export default class Editor extends Component {
  state: EditorState = {
    workspace: '',
    filepaths: [],
    trees: [],
  }

  componentDidMount() {
    ipcRenderer.on(MainEventType.OPEN_FILE, (event: any, path: any) => {
      console.log("on open file", path);
      const filepaths = this.state.filepaths;
      filepaths.push(path);
      this.setState({ filepaths });
    });

    ipcRenderer.on(MainEventType.OPEN_WORKSPACE, (event: any, workspace: any) => {
      console.log("on open workspace", workspace);
      this.setState({ workspace });
      this.loadAllTrees();
    });

    this.loadAllTrees();
  }

  loadAllTrees() {
    const workspace = this.state.workspace
    if(workspace == '' || !fs.existsSync(workspace)) {
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
    if (this.state.filepaths.length > 0) {
      const path = this.state.filepaths[0];
      const str = fs.readFileSync(path, 'utf8');
      return (<div>{str}</div>)
    }
  }

  render() {
    const { trees } = this.state;
    return (
      <Layout className="body">
        <Sider className="sider" width={250}>
          <Properties
            workspace={this.state.workspace}
            onOpenTree={(path) => {
              console.log("open tree", path);
            }}
            trees={trees}
          />
        </Sider>
        <Content className="content">
          <div>
            当前目录:{this.state.workspace}
          </div>
          <div>
            当前文件:{this.state.filepaths.join("\n")}
          </div>
          {this.renderJson()}
        </Content>
      </Layout>
    )
  }
};
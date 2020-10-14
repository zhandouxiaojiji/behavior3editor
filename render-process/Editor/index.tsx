import React, { Component } from "react";
import { DatePicker } from 'antd';
import { ipcRenderer } from 'electron';
import MainEventType from "../../common/MainEventType";

interface EditorState {
  workspace: string;
  filepaths: string[];
}

export default class Editor extends Component {
  state: EditorState = {
    workspace: '',
    filepaths: [],
  }

  componentDidMount() {
    ipcRenderer.on(MainEventType.OPEN_FILE, (event: any, path: any) => {
      console.log("on open file", path);
      const filepaths = this.state.filepaths;
      filepaths.push(path);
      this.setState({filepaths});
    });

    ipcRenderer.on(MainEventType.OPEN_WORKSPACE, (event: any, workspace: any) => {
      console.log("on open workspace", workspace);
      this.setState({workspace});
    });
  }

  render() {
    return (
      <div>
        <div>
          当前目录:{this.state.workspace}
        </div>
        <div>
          当前文件:{this.state.filepaths.join("\n")}
        </div>
      </div>
    )
  }
};
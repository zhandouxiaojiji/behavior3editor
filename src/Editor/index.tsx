import React, { Component } from "react";
import { DatePicker } from 'antd';
import { ipcRenderer } from 'electron';
import EventType from "../EventType";

interface EditorState {
  workspace: string;
}

export default class Editor extends Component {
  state: EditorState = {
    workspace: ''
  }

  componentDidMount() {
    ipcRenderer.on(EventType.MAIN_OPEN_FILE, (event: any, path: any) => {
      console.log("on", event, path);
    })
  }

  render() {
    return (
      <DatePicker />
    )
  }
};
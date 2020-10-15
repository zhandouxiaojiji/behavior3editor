import React, { Component } from "react";
import { Menu, Input } from "antd";
import * as fs from 'fs';
import { BehaviorTreeModel } from "../../common/BehaviorTreeModel";
import { remote } from 'electron';
import { MainProcess } from "../../main-process/MainProcess";
import Settings from "../../main-process/Settings";

const { Search } = Input;

export interface PropertiesProps {
  workspace: string;
  onOpenTree: (path: string) => void;
  trees: BehaviorTreeModel[];
}

interface PropertiesState {

}

export default class Properties extends Component<PropertiesProps> {
  state: PropertiesState = {

  };

  componentDidMount() {
    const settings: Settings = remote.getGlobal("settings");
    const lastWorkspace = settings.recentWorkspaces[0];
    console.log("&&&&&& last workspace", lastWorkspace);
  }

  render() {
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
          <Menu.Item>test</Menu.Item>
        </Menu>
      </div>
    )
  }
}
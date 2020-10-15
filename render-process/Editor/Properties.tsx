import React, { Component } from "react";
import { Menu, Input } from "antd";
import * as fs from 'fs';
import { BehaviorTreeModel } from "../../common/BehaviorTreeModel";

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
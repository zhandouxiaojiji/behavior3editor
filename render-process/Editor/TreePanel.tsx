import React from 'react';
import { Card } from 'antd';
import { INode } from '@antv/g6/lib/interface/item';
import { BehaviorTreeModel } from '../../common/BehaviorTreeModel';

interface TreePanelProps {
  model?: BehaviorTreeModel;
}

interface TreePanelState {
}

export default class TreePanel extends React.Component<TreePanelProps, TreePanelState> {
  state: TreePanelState = {};

  componentDidMount() {
  }

  render() {
    const { model } = this.props;
    if(!model) {
      return (<div/>)
    }
    return (
      <Card title="概况" style={{ height: "100%" }}>
        行为树:{model.name}

      </Card>
    )
  }

}


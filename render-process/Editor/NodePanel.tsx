import React from 'react';
import { Card } from 'antd';
import { INode } from '@antv/g6/lib/interface/item';

interface NodePanelProps {
  curNode: INode | null;
}

interface NodePanelState {

}

export default class Panel extends React.Component<NodePanelProps> {
  componentDidMount() {
  }

  renderNode() {
    const { curNode } = this.props;
    return (
      <div>
        {curNode.getModel().label}
      </div>
    )
  }

  render() {
    const { curNode } = this.props;
    return (
      <Card title="节点信息" style={{ height: "100%" }}>
        {curNode ? this.renderNode() : "未选中"}
      </Card>
    )
  }

}


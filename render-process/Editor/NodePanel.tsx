import React from 'react';
import { Card } from 'antd';
import { INode } from '@antv/g6/lib/interface/item';

interface NodePanelProps {
  
}

interface NodePanelState {

}

export default class NodePanel extends React.Component<NodePanelProps> {
  componentDidMount() {
  }

  renderNode() {
    return (
      <div>
        {}
      </div>
    )
  }

  render() {
    // const { curNode } = this.props;
    return (
      <Card title="节点信息" style={{ height: "100%" }}>
        {/* {curNode ? this.renderNode() : "未选中"} */}
      </Card>
    )
  }

}


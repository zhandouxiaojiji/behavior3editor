import React from 'react';
import { Card } from 'antd';
import { DetailPanel, withEditorContext } from 'gg-editor';
import { EditorContextProps } from 'gg-editor/lib/components/EditorContext';
import { INode } from '@antv/g6/lib/interface/item';

interface NodePanelProps extends EditorContextProps {
  curNode: INode | null;
}

interface NodePanelState {

}

class Panel extends React.Component<NodePanelProps> {
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

export default withEditorContext<NodePanelProps, Panel>(Panel);

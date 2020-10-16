import React from 'react';
import { Card } from 'antd';
import { DetailPanel, withEditorContext } from 'gg-editor';
import { EditorContextProps } from 'gg-editor/lib/components/EditorContext';
import { DetailPanelComponentProps } from 'gg-editor/lib/components/DetailPanel';


interface NodePanelProps extends EditorContextProps, DetailPanelComponentProps {

}

interface NodePanelState {

}

class NodePanel extends React.Component<NodePanelProps, NodePanelState> {
  render() {
    const { nodes } = this.props;
    const node = nodes[0];
    return (
      <Card>
        {node ? node.getModel().label : ''}
      </Card>
    )
  }
}

export default DetailPanel.create<NodePanelProps>('node')(withEditorContext(NodePanel));
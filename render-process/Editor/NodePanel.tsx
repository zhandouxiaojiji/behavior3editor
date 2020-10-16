import React from 'react';
import { Card } from 'antd';
import { DetailPanel, withEditorContext } from 'gg-editor';
import { EditorContextProps } from 'gg-editor/lib/components/EditorContext';
import { DetailPanelComponentProps } from 'gg-editor/lib/components/DetailPanel';


interface NodePanelProps extends EditorContextProps, DetailPanelComponentProps {

}

interface NodePanelState {

}

class Panel extends React.Component<NodePanelProps, NodePanelState> {
  render() {
    const { nodes } = this.props;
    console.log("NodePanel render", nodes);
    const node = nodes[0];
    if (node) {
      return (
        <Card title="节点信息">
          {node ? node.getModel().label : ''}
        </Card>
      )
    } else {
      return (
        <Card title="节点信息">
          未选中
        </Card>
      )
    }

  }
}

export default class NodePanel extends React.Component {
  render() {
    console.log("NodePanel render");
    return (
      <Card title="节点信息" style = {{height:"100%"}}>
        未选中fefqwefqwefwewef
      </Card>
    )
  }

}

// export default DetailPanel.create<NodePanelProps>('node')(withEditorContext(Panel));
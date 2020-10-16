import React from 'react';
import { Card } from 'antd';
import { DetailPanel, withEditorContext } from 'gg-editor';
import { EditorContextProps } from 'gg-editor/lib/components/EditorContext';


interface NodePanelProps extends EditorContextProps {

}

interface NodePanelState {

}

class Panel extends React.Component<NodePanelProps> {
  componentDidMount() {
    console.log(this.props);
    this.props.graph.on("click", (ev: any) => {
      console.log("on click", ev);
    })
  }
  render() {
    console.log("NodePanel render", this.props);
    return (
      <Card title="节点信息" style={{ height: "100%" }}>
        未选中fefqwefqwefwewef
      </Card>
    )
  }

}

export default withEditorContext<NodePanelProps, Panel>(Panel);

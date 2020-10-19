import * as React from 'react';
import GGEditor, { Mind, RegisterNode, withEditorContext } from 'gg-editor';
import { Row, Col } from 'antd';
import NodePanel from './NodePanel';
import BehaviorTree from './BehaviorTree';
import { INode } from '@antv/g6/lib/interface/item';

import './Editor.css';

export interface EditorProps {
  filepath: string;
}

interface EditorState {
  curNode: INode | null;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
  state: EditorState = {
    curNode: null
  }
  
  componentWillMount() {

  }
  componentDidMount() {
    console.log("props", this.props);
  }

  render() {
    const { curNode } = this.state;
    return (
      <GGEditor className="editor">
        <Row className="editorBd">
          <Col span={18} className="editorContent">
            <BehaviorTree
              onSelectNode={(node) => {
                console.log("onSelectNode", node);
                this.setState({ curNode: node });
              }}
            />
          </Col>
          <Col span={6} className="editorSidebar">
            <NodePanel
              curNode={curNode}
            />
          </Col>
        </Row>
      </GGEditor>
    );
  }
}
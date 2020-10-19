import * as React from 'react';
import { Row, Col } from 'antd';
import NodePanel from './NodePanel';
import { INode } from '@antv/g6/lib/interface/item';

import './Editor.css';
import { TreeGraph } from '@antv/g6';
import { TreeGraphData } from '@antv/g6/lib/types';

const data: TreeGraphData = {
  id: 'root',
  label: 'Root',
  children: [
    {
      id: 'SubTreeNode1',
      label: 'subroot1',
      children: [
        {
          id: 'SubTreeNode1.1',
          label: 'subroot1.1',
        }
      ]
    },
    {
      id: 'SubTreeNode2',
      label: 'subroot2',
      children: [
        {
          id: 'SubTreeNode2.1',
          label: 'subroot2.1',
        },
        {
          id: 'SubTreeNode2.2',
          label: 'subroot2.2',
        }
      ]
    }
  ]
};

export interface EditorProps {
  filepath: string;
}

interface EditorState {
  curNode: INode | null;
}

var uniqueId = 0;
const genContainerId = () => {
  return "graph_" + (uniqueId++);
}

export default class Editor extends React.Component<EditorProps, EditorState> {
  private containerId: string;
  state: EditorState = {
    curNode: null
  }

  graph: TreeGraph;

  constructor(props: EditorProps) {
    super(props);

    this.containerId = genContainerId();
  }

  componentWillMount() {

  }
  componentDidMount() {
    const graph = new TreeGraph({
      container: this.containerId,
      width: 800,
      height: 600,
      fitView: true,
      modes: {
        default: ['drag-canvas']
      },
      defaultEdge: {
        shape: 'cubic-horizontal',
        style: {
          stroke: '#A3B1BF'
        }
      },
      defaultNode: {
        shape: 'rect',
        labelCfg: {
          style: {
            fill: '#000000A6',
            fontSize: 10
          }
        },
        style: {
          stroke: '#72CC4A',
          width: 150
        }
      },
      layout: {
        type: 'dendrogram', // 布局类型
        direction: 'LR',    // 自左至右布局，可选的有 H / V / LR / RL / TB / BT
        nodeSep: 50,        // 节点之间间距
        rankSep: 200        // 每个层级之间的间距
      }
    });

    graph.on('click', (ev: any) => {
      const item = ev.item;
      if (!item) {
      } else if (item.getType() == "node") {
      }
    });

    graph.on('dblclick', (ev: any) => {
      const item = ev.item;
    });

    graph.on('dragenter', (ev: any) => {
      console.log("dragenter", ev);
    });

    graph.data(data);
    graph.render();
    this.graph = graph;
  }

  render() {
    const { curNode } = this.state;
    return (
      <div className="editor">
        <Row className="editorBd">
          <Col
            id={this.containerId}
            span={18}
            className="editorContent"
          />
          <Col span={6} className="editorSidebar">
            <NodePanel
              curNode={curNode}
            />
          </Col>
        </Row>
      </div>
    );
  }
}
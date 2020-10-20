import * as React from 'react';
import { Row, Col } from 'antd';
import NodePanel from './NodePanel';
import { INode } from '@antv/g6/lib/interface/item';
import G6, { TreeGraph } from '@antv/g6';
import { TreeGraphData, IG6GraphEvent } from '@antv/g6/lib/types';
import { G6GraphEvent } from '@antv/g6/lib/interface/behavior';
import './Editor.css';


export interface EditorProps {
  filepath: string;
}

interface EditorState {
  curNode: INode | null;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
  private ref: React.RefObject<any>;
  state: EditorState = {
    curNode: null
  }

  graph: TreeGraph;

  constructor(props: EditorProps) {
    super(props);
    this.ref = React.createRef();
  }

  componentDidMount() {
    const graph = new TreeGraph({
      container: this.ref.current,
      width: window.screen.width * 0.66,
      height: window.screen.height,
      fitView: true,
      fitViewPadding: [20, 20, 20, 20],
      modes: {
        default: [
          'drag-canvas',
          'click-select',
          'hover',
          {
            type: 'collapse-expand',
            trigger: 'dblclick',
            onChange: (item, collapsed) => {
              const data = item.get('model').data;
              data.collapsed = collapsed;
              return true;
            },
          },
        ]
      },
      defaultEdge: {
        type: 'cubic-horizontal',
        style: {
          stroke: '#A3B1BF'
        }
      },
      defaultNode: {
        type: 'rect',
        labelCfg: {
          style: {
            fill: 'blue',
            fontSize: 10
          }
        },
        style: {
          stroke: '#72CC4A',
          width: 150
        }
      },
      nodeStateStyles: {
        // 鼠标 hover 上节点，即 hover 状态为 true 时的样式
        hover: {
          fill: '#d3adf7',
        },
        // 鼠标点击节点，即 click 状态为 true 时的样式
        selected: {
          stroke: '#000',
          lineWidth: 3,
        },
      },
      layout: {
        type: 'dendrogram', // 布局类型
        direction: 'LR',    // 自左至右布局，可选的有 H / V / LR / RL / TB / BT
        nodeSep: 50,        // 节点之间间距
        rankSep: 200        // 每个层级之间的间距
      }
    });

    graph.on('node:mouseenter', (e: G6GraphEvent) => {
      const { item } = e;
      graph.setItemState(item, 'hover', true);
    });

    graph.on('node:mouseleave', (e: G6GraphEvent) => {
      const { item } = e;
      graph.setItemState(item, 'hover', false);
    });

    graph.on('nodeselectchange', (e: G6GraphEvent) => {
      // 当前操作的 item
      if(this.state.curNode) {
        graph.setItemState(this.state.curNode, 'selected', false);
      }
      const curNode = e.target as INode;
      this.setState({ curNode });
      if(this.state.curNode) {
        graph.setItemState(this.state.curNode, 'selected', true);
      }
    });

    graph.on('dragenter', (e: any) => {
      console.log("dragenter", e);
    });

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
            span={18}
            className="editorContent"
            ref={this.ref}
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
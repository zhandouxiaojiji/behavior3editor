import * as React from 'react';
import * as fs from 'fs';
import { Row, Col } from 'antd';
import NodePanel from './NodePanel';
import { INode } from '@antv/g6/lib/interface/item';
import G6, { TreeGraph } from '@antv/g6';
import { TreeGraphData, IG6GraphEvent } from '@antv/g6/lib/types';
import { G6GraphEvent } from '@antv/g6/lib/interface/behavior';
import './Editor.css';
import * as Utils from '../../common/Utils';
import { BehaviorTreeModel } from '../../common/BehaviorTreeModel';

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

  private graph: TreeGraph;
  private dragSrcNode: INode;
  private dragDstNode: INode;

  constructor(props: EditorProps) {
    super(props);
    this.ref = React.createRef();
  }

  componentDidMount() {
    const graph = new TreeGraph({
      container: this.ref.current,
      width: window.screen.width * 0.66,
      height: window.screen.height,
      animate: false,
      fitView: true,
      fitViewPadding: [20, 20, 20, 20],
      modes: {
        default: [
          'drag-canvas',
          'zoom-canvas',
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
        type: "TreeNode",
      },
      layout: {
        type: 'compactBox',
        direction: 'LR',
        getVGap: () => 20,
        getHGap: () => 100,
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
      if (this.state.curNode) {
        graph.setItemState(this.state.curNode, 'selected', false);
      }
      const curNode = e.target as INode;
      this.setState({ curNode });
      if (this.state.curNode) {
        graph.setItemState(this.state.curNode, 'selected', true);
      }
    });

    const clearDragDstState = () => {
      if (this.dragDstNode) {
        graph.setItemState(this.dragDstNode, 'dragRight', false);
        graph.setItemState(this.dragDstNode, 'dragDown', false);
        graph.setItemState(this.dragDstNode, 'dragUp', false);
        this.dragDstNode = null;
      }
    }

    graph.on('node:dragstart', (e: G6GraphEvent) => {
      this.dragSrcNode = e.item as INode;
      graph.setItemState(e.item, 'dragSrc', true);
    });
    graph.on('node:dragend', (e: G6GraphEvent) => {
      graph.setItemState(e.item, 'dragSrc', false);
      this.dragSrcNode = null;
    });

    graph.on('node:dragover', (e: G6GraphEvent) => {
      clearDragDstState();
      const dstNode = e.item as INode;
      if (dstNode == this.dragSrcNode) {
        return;
      }

      const box = dstNode.getBBox();
      if (e.x > box.minX + box.width * 0.6) {
        graph.setItemState(dstNode, 'dragRight', true);
      } else if (e.y > box.minY + box.height * 0.5) {
        graph.setItemState(dstNode, 'dragDown', true);
      } else {
        graph.setItemState(dstNode, 'dragUp', true);
      }
      this.dragDstNode = dstNode;
    });

    graph.on('node:dragleave', (e: G6GraphEvent) => {
      clearDragDstState();
    })

    graph.on('node:drop', (e: G6GraphEvent) => {
      const srcNode = this.dragSrcNode;
      if (!srcNode) {
        console.log("no drag src");
        return;
      }
      const dstNode = e.item as INode;

      if (srcNode == dstNode) {
        console.log("drop same node");
        return;
      }

      const rootData = graph.findDataById('1');
      console.log('rootData', rootData);
      const srcData = graph.findDataById(srcNode.getID());
      const srcParent = Utils.findParent(rootData, srcNode.getID());
      const dstData = graph.findDataById(dstNode.getID());
      const dstParent = Utils.findParent(rootData, dstNode.getID());
      console.log("srcParent", srcParent);
      if (!srcParent) {
        console.log("no parent!");
        return;
      }

      const removeSrc = () => {
        srcParent.children = srcParent.children.filter(e => e.id != srcData.id);
      }
      if (dstNode.hasState('dragRight')) {
        if(Utils.findFromAllChildren(srcData, dstData.id)) {
          console.log("cannot move to child");
          return;
        }
        removeSrc();
        if(!dstData.children) {
          dstData.children = [];
        }
        dstData.children.push(srcData);
      }

      Utils.refreshNodeId(graph.findDataById('1'));
      graph.changeData(rootData);
      // graph.layout()
      clearDragDstState();
    });

    const str = fs.readFileSync(this.props.filepath, 'utf8');
    let tree: BehaviorTreeModel = JSON.parse(str);
    const data = Utils.createTreeData(tree.root);
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
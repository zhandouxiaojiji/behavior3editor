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
  curNodeId: string | null;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
  private ref: React.RefObject<any>;
  state: EditorState = {
    curNodeId: null
  }

  private graph: TreeGraph;
  private dragSrcId: string;
  private dragDstId: string;

  constructor(props: EditorProps) {
    super(props);
    this.ref = React.createRef();
  }

  shouldComponentUpdate() {
    return !this.graph;
  }

  componentDidMount() {
    const graph = new TreeGraph({
      container: this.ref.current,
      width: window.screen.width * 0.66,
      height: window.screen.height,
      animate: false,
      // fitCenter: true,
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
              const data = item.getModel();
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
      if (item.hasState('selected')) {
        return;
      }
      graph.setItemState(item, 'hover', true);
    });

    graph.on('node:mouseleave', (e: G6GraphEvent) => {
      const { item } = e;
      if (item.hasState('selected')) {
        return;
      }
      graph.setItemState(item, 'hover', false);
    });

    graph.on('nodeselectchange', (e: G6GraphEvent) => {
      if(e.target) {
        this.onSelectNode(e.target.getID());
      } else {
        this.onSelectNode(null);
      }
    });

    const clearDragDstState = () => {
      if (this.dragDstId) {
        console.log("clearDragDstState", this.dragDstId);
        graph.setItemState(this.dragDstId, 'dragRight', false);
        graph.setItemState(this.dragDstId, 'dragDown', false);
        graph.setItemState(this.dragDstId, 'dragUp', false);
        this.dragDstId = null;
      }
    }

    const clearDragSrcState = () => {
      if (this.dragSrcId) {
        console.log("clearDragSrcId", this.dragSrcId);
        graph.setItemState(this.dragSrcId, 'dragSrc', false);
        this.dragSrcId = null;
      }
    }

    graph.on('node:dragstart', (e: G6GraphEvent) => {
      this.dragSrcId = e.item.getID();
      graph.setItemState(this.dragSrcId, 'dragSrc', true);
    });
    graph.on('node:dragend', (e: G6GraphEvent) => {
      if(this.dragSrcId) {
        graph.setItemState(this.dragSrcId, 'dragSrc', false);
        this.dragSrcId = null;
      }
    });

    graph.on('node:dragover', (e: G6GraphEvent) => {
      const dstNodeId = e.item.getID();
      if (dstNodeId == this.dragSrcId) {
        return;
      }
      
      if(this.dragDstId) {
        graph.setItemState(this.dragDstId, 'dragRight', false);
        graph.setItemState(this.dragDstId, 'dragDown', false);
        graph.setItemState(this.dragDstId, 'dragUp', false);
      }

      const box = e.item.getBBox();
      if (e.x > box.minX + box.width * 0.6) {
        graph.setItemState(dstNodeId, 'dragRight', true);
      } else if (e.y > box.minY + box.height * 0.5) {
        graph.setItemState(dstNodeId, 'dragDown', true);
      } else {
        graph.setItemState(dstNodeId, 'dragUp', true);
      }
      this.dragDstId = dstNodeId;
    });

    graph.on('node:dragleave', (e: G6GraphEvent) => {
      clearDragDstState();
    })

    graph.on('node:drop', (e: G6GraphEvent) => {
      const srcNodeId = this.dragSrcId;
      const dstNode = e.item;

      console.log("drop");

      var dragDir;
      if(dstNode.hasState('dragRight')) {
        dragDir = 'dragRight';
      } else if(dstNode.hasState('dragDown')) {
        dragDir = 'dragDown';
      } else if(dstNode.hasState('dragUp')) {
        dragDir = 'dragUp';
      }

      clearDragSrcState();
      clearDragDstState();

      if (!srcNodeId) {
        console.log("no drag src");
        return;
      }

      if (srcNodeId == dstNode.getID()) {
        console.log("drop same node");
        return;
      }

      const rootData = graph.findDataById('1');
      console.log('rootData', rootData);
      const srcData = graph.findDataById(srcNodeId);
      const srcParent = Utils.findParent(rootData, srcNodeId);
      const dstData = graph.findDataById(dstNode.getID());
      const dstParent = Utils.findParent(rootData, dstNode.getID());
      console.log("srcParent", srcParent);
      if (!srcParent) {
        console.log("no parent!");
        return;
      }

      if (Utils.findFromAllChildren(srcData, dstData.id)) {
        // 不能将父节点拖到自已的子孙节点
        console.log("cannot move to child");
        return;
      }

      const removeSrc = () => {
        srcParent.children = srcParent.children.filter(e => e.id != srcData.id);
      }
      console.log("dstNode", dstNode);
      if (dragDir == 'dragRight') {
        removeSrc();
        if (!dstData.children) {
          dstData.children = [];
        }
        dstData.children.push(srcData);
      } else if (dragDir == 'dragUp') {
        if (!dstParent) {
          return;
        }
        removeSrc();
        const idx = dstParent.children.findIndex(e => e.id == dstData.id);
        dstParent.children.splice(idx, 0, srcData);
      } else if (dragDir == 'dragDown') {
        if (!dstParent) {
          return;
        }
        removeSrc();
        const idx = dstParent.children.findIndex(e => e.id == dstData.id);
        dstParent.children.splice(idx + 1, 0, srcData);
      } else {
        return;
      }

      console.log("cur data", graph.findDataById('1'));
      graph.changeData();
      graph.layout();
    });

    const str = fs.readFileSync(this.props.filepath, 'utf8');
    let tree: BehaviorTreeModel = JSON.parse(str);
    const data = Utils.createTreeData(tree.root);
    graph.data(data);
    graph.render();
    graph.fitCenter();

    this.graph = graph;
  }

  onSelectNode(curNodeId: string | null) {
    const graph = this.graph;

    if (this.state.curNodeId) {
      graph.setItemState(this.state.curNodeId, 'selected', false);
    }

    this.setState({ curNodeId });
    if (this.state.curNodeId) {
      graph.setItemState(this.state.curNodeId, 'selected', true);
    }
  }

  render() {
    console.log("render editor")
    const { curNodeId: curNode } = this.state;
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
            />
          </Col>
        </Row>
      </div>
    );
  }
}
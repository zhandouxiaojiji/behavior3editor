import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { Row, Col, message } from 'antd';
import NodePanel from './NodePanel';
import G6, { TreeGraph } from '@antv/g6';
import { G6GraphEvent } from '@antv/g6/lib/interface/behavior';
import * as Utils from '../../common/Utils';
import { BehaviorTreeModel, GraphNodeModel, BehaviorNodeModel } from '../../common/BehaviorTreeModel';
import TreePanel from './TreePanel';
import Settings from '../../main-process/Settings';

import './Editor.css';

export interface EditorProps {
  filepath: string;
}

interface EditorState {
  curNodeId?: string;
  treeModel?: BehaviorTreeModel;
  settings?: Settings;
}

export default class Editor extends React.Component<EditorProps, EditorState> {
  private ref: React.RefObject<any>;
  state: EditorState = {};

  private graph: TreeGraph;
  private dragSrcId: string;
  private dragDstId: string;
  private autoId: number;

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
              this.onSelectNode(item.getID());
              const data = item.getModel();
              data.collapsed = collapsed;
              graph.setItemState(item, 'collapsed', data.collapsed as boolean);
              const icon = data.collapsed ? G6.Marker.expand : G6.Marker.collapse;
              const marker = item.get('group').find((ele: any) => ele.get('name') === 'collapse-icon');
              marker.attr('symbol', icon);
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
        getHGap: () => 50,
        getWidth: (d: GraphNodeModel) => {
          return 150;
        },
        getHeight: (d: GraphNodeModel) => {
          if (d.size) {
            return d.size[1];
          } else {
            return 50;
          }
        }
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
      if (e.target) {
        this.onSelectNode(e.target.getID());
      } else {
        this.onSelectNode(null);
      }
    });

    const clearDragDstState = () => {
      if (this.dragDstId) {
        graph.setItemState(this.dragDstId, 'dragRight', false);
        graph.setItemState(this.dragDstId, 'dragDown', false);
        graph.setItemState(this.dragDstId, 'dragUp', false);
        this.dragDstId = null;
      }
    }

    const clearDragSrcState = () => {
      if (this.dragSrcId) {
        graph.setItemState(this.dragSrcId, 'dragSrc', false);
        this.dragSrcId = null;
      }
    }

    graph.on('node:dragstart', (e: G6GraphEvent) => {
      this.dragSrcId = e.item.getID();
      graph.setItemState(this.dragSrcId, 'dragSrc', true);
    });
    graph.on('node:dragend', (e: G6GraphEvent) => {
      if (this.dragSrcId) {
        graph.setItemState(this.dragSrcId, 'dragSrc', false);
        this.dragSrcId = null;
      }
    });

    graph.on('node:dragover', (e: G6GraphEvent) => {
      const dstNodeId = e.item.getID();
      if (dstNodeId == this.dragSrcId) {
        return;
      }

      if (this.dragDstId) {
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

      var dragDir;
      if (dstNode.hasState('dragRight')) {
        dragDir = 'dragRight';
      } else if (dstNode.hasState('dragDown')) {
        dragDir = 'dragDown';
      } else if (dstNode.hasState('dragUp')) {
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
      const srcData = graph.findDataById(srcNodeId);
      const srcParent = Utils.findParent(rootData, srcNodeId);
      const dstData = graph.findDataById(dstNode.getID());
      const dstParent = Utils.findParent(rootData, dstNode.getID());
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

      // console.log("cur data", graph.findDataById('1'));
      this.changeWithoutAnim();
    });

    const settings = Utils.getRemoteSettings();

    const str = fs.readFileSync(this.props.filepath, 'utf8');
    let tree: BehaviorTreeModel = JSON.parse(str);
    const data = Utils.createTreeData(tree.root, settings);
    this.autoId = Utils.refreshNodeId(data);
    graph.data(data);
    graph.render();
    graph.fitCenter();
    graph.set('animate', true);

    this.graph = graph;

    this.setState({ treeModel: tree, settings });
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

  createNode(name: string) {
    console.log("editor create node", name);
    const { curNodeId, settings } = this.state;
    if (!curNodeId) {
      message.warn("未选中节点");
      return;
    }
    const curNodeData = this.graph.findDataById(curNodeId);
    const newNodeData: BehaviorNodeModel = {
      id: this.autoId++,
      name: name,
    }
    if (!curNodeData.children) {
      curNodeData.children = [];
    }
    curNodeData.children.push(Utils.createTreeData(newNodeData, settings));
    this.changeWithoutAnim();
  }

  deleteNode() {
    console.log("editor delete node");
    const { curNodeId } = this.state;
    if (!curNodeId) {
      return;
    }

    if(curNodeId == '1') {
      message.warn("根节点不能删除!");
      return;
    }

    this.onSelectNode(null);
    const rootData = this.graph.findDataById('1');
    const parentData = Utils.findParent(rootData, curNodeId);
    parentData.children = parentData.children.filter(e => e.id != curNodeId);
    this.changeWithoutAnim();
  }

  updateNode(id: string) {
    this.graph.changeData();
    this.graph.layout();
  }

  changeWithoutAnim() {
    this.graph.set('animate', false);
    this.graph.changeData();
    this.graph.layout();
    this.graph.set('animate', true);
  }

  save() {
    const { filepath } = this.props;
    const root = Utils.createFileData(this.graph.findDataById('1') as GraphNodeModel);
    fs.writeFileSync(filepath, JSON.stringify({
      name: path.basename(filepath).slice(0, -5),
      root,
      desc: root.desc,
    }));
  }

  render() {
    const { curNodeId, treeModel, settings } = this.state;
    var curNode: any;
    if (curNodeId) {
      curNode = this.graph.findDataById(curNodeId);
    }

    return (
      <div className="editor">
        <Row className="editorBd">
          <Col
            span={18}
            className="editorContent"
            ref={this.ref}
          />
          <Col span={6} className="editorSidebar">
            {
              curNode ?
                <NodePanel
                  model={curNode}
                  settings={settings}
                  updateNode={(id, forceUpdate) => {
                    if (forceUpdate) {
                      const data: any = this.graph.findDataById(id);
                      data.conf = settings.getNodeConf(data.name);
                      data.size = Utils.calcTreeNodeSize(data);
                      this.changeWithoutAnim();
                    }
                    const item = this.graph.findById(id);
                    item.draw();
                  }}
                />
                :
                <TreePanel
                  model={treeModel}
                />
            }
          </Col>
        </Row>
      </div>
    );
  }
}
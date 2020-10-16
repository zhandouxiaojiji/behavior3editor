import * as React from 'react';
import GGEditor, { Mind, RegisterNode, setAnchorPointsState } from 'gg-editor';
import { INode } from '@antv/g6/lib/interface/item';
import { MindData, Graph, GraphEvent } from 'gg-editor/lib/common/interfaces';
const data: MindData = {
  id: "1",
  label: 'Central Topic111',
  children: [
    {
      id: "2",
      label: 'Main Topic 1',
    },
    {
      id: "3",
      label: 'Main Topic 2',
    },
    {
      id: "4",
      label: 'Main Topic 3',
    },
  ],
};

interface BehaviorTreeProps {
  onSelectNode: (node: INode | null) => void;
}

class BehaviorTree extends React.Component<BehaviorTreeProps> {
  graph: Graph;
  componentDidMount() {
  }

  initGraph(graph: Graph) {
    const { onSelectNode } = this.props;
    graph.on('click', (ev: GraphEvent) => {
      console.log("click", ev);
      if (!ev.item) {
        onSelectNode(null);
      } else if (ev.item) {
        onSelectNode(ev.item);
      }
    });

    graph.on('dbclick', (ev: GraphEvent) => {
      console.log("dbclick", ev);
    });

    graph.on('dragenter', (ev: GraphEvent) => {
      console.log("dragenter", ev);
    });
    this.graph = graph;
  }

  render() {
    return (
      <Mind
        style={{ width: "70vw", height: "100vh" }}
        graphConfig={{
          fitView: true,
          maxZoom: 2,
          fitViewPadding: [20, 20, 20, 20]
        }}
        data={data}
        ref={component => {
          if (component) {
            this.initGraph(component.graph);
          }
        }}
      />
    );
  }
}

export default BehaviorTree;
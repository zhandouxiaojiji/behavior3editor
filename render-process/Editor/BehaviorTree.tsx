import * as React from 'react';
import GGEditor, { Mind, RegisterNode, constants, CommandManager } from 'gg-editor';
import { INode } from '@antv/g6/lib/interface/item';
import { MindData, Graph, GraphEvent } from 'gg-editor/lib/common/interfaces';

const { EditorCommand } = constants

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
  mind: Mind;
  componentDidMount() {
  }

  initGraph(graph: Graph) {
    const { onSelectNode } = this.props;
    graph.on('click', (ev: GraphEvent) => {
      const item = ev.item;
      if (!item) {
        onSelectNode(null);
      } else if (item.getType() == "node") {
        onSelectNode(item as INode);
      }
    });

    graph.on('dblclick', (ev: GraphEvent) => {
      console.log("dblclick", ev);
      const item = ev.item;
      if (item && item.getType() == 'node') {
        const commandManager: CommandManager = graph.get('commandManager');
        if (commandManager.canExecute(graph, EditorCommand.Fold)) {
          commandManager.execute(graph, EditorCommand.Fold);
        } else {
          commandManager.execute(graph, EditorCommand.Unfold);
        }
      }
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
          if (component && !this.graph) {
            this.initGraph(component.graph);
            this.mind = component;
          }
        }}
      />
    );
  }
}

export default BehaviorTree;
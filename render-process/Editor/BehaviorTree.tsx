import * as React from 'react';
import GGEditor, { Mind, RegisterNode, setAnchorPointsState } from 'gg-editor';
import { MindData } from 'gg-editor/lib/common/interfaces';
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

interface BehaviorTreeProps{

}

class BehaviorTree extends React.Component <BehaviorTreeProps> {
  componentDidMount() {
    // const { graph } = this.props;
    // graph.on('click', (ev: any) => {
    //   console.log("click", ev);
    // });

    // graph.on('dbclick', (ev: any) => {
    //   console.log("dbclick", ev);
    // });

    // graph.on('dragenter', (ev: any) => {
    //   console.log("dragenter", ev);
    // });
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
              console.log('graph:', component.graph);
            }
          }}
        />
    );
  }
}

export default BehaviorTree;
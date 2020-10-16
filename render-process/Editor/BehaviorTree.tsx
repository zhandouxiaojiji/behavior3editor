import * as React from 'react';
import GGEditor, { Mind, RegisterNode } from 'gg-editor';
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

export default class BehaviorTree extends React.Component {
  render() {
    return (
      <Mind
        style={{ width: "70vw", height: "100vh" }}
        graphConfig= {{fitView: true, maxZoom:2, fitViewPadding:[20, 20, 20, 20]}}
        data={data}
      />
    );
  }
}
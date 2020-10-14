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

export default class Hello extends React.Component {
  render() {
    return (
      <GGEditor style={{ background: "#242424" }}>
        <Mind
          style={{ width: 500, height: 500 }}
          data={data}
          graphConfig={{ defaultNode: { type: 'customNode' } }}
        />
        <RegisterNode
          name="customNode"
          config={{
            getCustomConfig(model: any) {
              return {
                wrapperStyle: {
                  fill: '#000000',
                },
              };
            },
          }}
          extend="bizFlowNode"
        />
      </GGEditor>
    );
  }
}

function getExclamationMarks(numChars: number) {
  return Array(numChars + 1).join('!');
}
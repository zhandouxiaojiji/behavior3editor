import React from 'react';
import { Card, Divider, Form, Input, AutoComplete, Select } from 'antd';
import { INode } from '@antv/g6/lib/interface/item';
import { BehaviorNodeModel } from '../../common/BehaviorTreeModel';
import Settings from '../../main-process/Settings';
import { FormInstance } from 'antd/lib/form';

const { Item } = Form;

interface NodePanelProps {
  model: BehaviorNodeModel;
  settings: Settings;
}

interface NodePanelState {

}

export default class NodePanel extends React.Component<NodePanelProps> {
  formRef = React.createRef<FormInstance>();

  componentDidUpdate() {
    const { model, settings } = this.props;
    this.formRef.current.setFieldsValue({
      name: model.name,
    });
  }

  onFinish = (values: any) => {
    console.log('Success:', values);
  };

  onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  };

  render() {
    const { model, settings } = this.props;
    const conf = settings.getNodeConf(model.name);
    console.log("model", model, conf);
    const title = conf.desc;

    const names: string[] = [];
    settings.nodeConfig.map((e) => {
      names.push(e.name);
    })

    const name = model.name;

    const layout = {
      labelCol: { span: 4 },
      wrapperCol: { span: 20 },
    };
    return (
      <Card title={title} style={{ height: "100%" }}>
        <Form
          {...layout}
          name="basic"
          onFinish={this.onFinish}
          ref={this.formRef}
        >
          <Item
            label="节点id"
          >
            <Input value={model.id} disabled={true} />
          </Item>
          <Item
            label="节点名称"
            name="name"
          >
            <AutoComplete
              dataSource={names}
              filterOption={(inputValue, option: any) =>
                option.props.children.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
              onChange={this.onFinish}
              defaultValue={name}
            />
          </Item>
        </Form>
      </Card>
    )
  }

}


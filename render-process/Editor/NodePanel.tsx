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
  updateNode: (id: string) => void;
}

interface NodePanelState {

}

export default class NodePanel extends React.Component<NodePanelProps> {
  formRef = React.createRef<FormInstance>();

  componentDidUpdate() {
    const { model, settings } = this.props;
    this.formRef.current.setFieldsValue({
      name: model.name,
      desc: model.desc,
    });
  }

  onFinish = (values: any) => {
    console.log('Success:', values);
    const { updateNode, model } = this.props;
    model.desc = values.desc;
    updateNode(model.id.toString());
  };

  onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  };

  handleSubmit = () => {
    console.log("handleSubmit");
    this.formRef.current.submit();
  }

  render() {
    const { model, settings } = this.props;
    const conf = settings.getNodeConf(model.name);
    const title = conf.desc;

    const options: any = [];
    settings.nodeConfig.map((e) => {
      options.push({ label: `${e.name}(${e.desc})`, value: e.name });
    })

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
          initialValues={{
            name: model.name,
            desc: model.desc,
          }}
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
              options={options}
              onBlur={this.handleSubmit}
              filterOption={(inputValue: string, option: any) => {
                return option.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }}
            />
          </Item>
          <Item
            label="节点说明"
            name="desc"
          >
            <Input onBlur={this.handleSubmit} />
          </Item>
        </Form>
      </Card>
    )
  }

}


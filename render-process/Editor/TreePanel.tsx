import React from "react";
import { Button, Card, Form, Input } from "antd";
import { BehaviorTreeModel } from "../../common/BehaviorTreeModel";
import { FormInstance } from "antd/lib/form";

const { Item } = Form;

interface TreePanelProps {
    model?: BehaviorTreeModel;
    onRenameTree: (name: string) => void;
    onRemoveTree: () => void;
    onChangeTreeDesc: (desc: string) => void;
}

interface TreePanelState {
}

const inlineFormItemLayout = {
    labelCol: {
        sm: { span: 4 },
    },
    wrapperCol: {
        sm: { span: 12 },
    },
};

export default class TreePanel extends React.Component<TreePanelProps, TreePanelState> {
    name: string = '';
    desc: string = '';
    formRef = React.createRef<FormInstance>();

    componentDidMount() {
        const { model } = this.props;
        this.name = model.name;
        this.desc = model.desc;
        this.formRef.current.resetFields();
        this.formRef.current.setFieldsValue({
            name: model.name,
            desc: model.desc,
        })
    }

    render() {
        const { model } = this.props;
        if (!model) {
            return <div />;
        }
        return (
            <Card title="概况" style={{ height: "100%" }}>
                <Form
                    {...inlineFormItemLayout}
                    ref={this.formRef}
                >
                    <Item label="行为树" name="name">
                        <Input disabled onBlur={this.handleSubmit} />
                    </Item>
                    <Item label="说明" name="desc">
                        <Input onBlur={this.handleSubmit} />
                    </Item>
                    {/* <Item>
                        <Button type='ghost' onClick={this.handleRemoveTree}>删除</Button>
                    </Item> */}
                </Form>
            </Card>
        );
    }

    handleSubmit = () => {
        const { model, onRenameTree, onChangeTreeDesc } = this.props;
        const name = this.formRef.current.getFieldValue("name");
        const desc = this.formRef.current.getFieldValue("desc");
        if (name != this.name) {
            console.log("change name", name);
            this.name = name;
            model.name = name;
            onRenameTree(name);
        }
        if (desc != this.desc) {
            console.log("change desc", desc);
            this.desc = desc;
            model.desc = desc;
            onChangeTreeDesc(desc);
        }
    }

    handleRemoveTree = () => {
        this.props.onRemoveTree();
    }
}

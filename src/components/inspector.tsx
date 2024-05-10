import { EditNode, EditTree, useWorkspace } from "@/contexts/workspace-context";
import { NodeArgType, NodeModel, TreeGraphData, TreeModel } from "@/misc/b3type";
import { Hotkey, isMacos } from "@/misc/keys";
import Path from "@/misc/path";
import { EditOutlined } from "@ant-design/icons";
import {
  AutoComplete,
  Button,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import { DefaultOptionType } from "antd/es/select";
import { FC, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";

interface OptionType extends DefaultOptionType {
  value: string;
}

const TreeInspector: FC = () => {
  const workspace = {
    editing: useWorkspace((state) => state.editing),
    editingTree: useWorkspace((state) => state.editingTree)!,
  };
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // set form values
  useEffect(() => {
    const data = workspace.editingTree.data;
    form.resetFields();
    form.setFieldValue("name", data.name);
    form.setFieldValue("desc", data.desc);
  }, [workspace.editingTree]);

  const finish = (values: any) => {
    const data = {} as TreeModel;
    data.name = values.name;
    data.desc = values.desc || undefined;
    workspace.editing?.dispatch("updateTree", {
      data: {
        name: values.name,
        desc: values.desc || undefined,
      },
    } as EditTree);
  };

  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("tree.overview")}</span>
      </div>
      <div
        className={isMacos ? undefined : "b3-overflow"}
        style={{ overflow: "auto", height: "100%", padding: "24px" }}
      >
        <Form form={form} labelCol={{ span: 8 }} onFinish={finish}>
          <Form.Item name="name" label={t("tree.name")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="desc" label={t("tree.desc")}>
            <TextArea autoSize onBlur={form.submit} />
          </Form.Item>
        </Form>
      </div>
    </>
  );
};

const NodeInspector: FC = () => {
  const workspace = {
    editing: useWorkspace((state) => state.editing),
    editingNode: useWorkspace((state) => state.editingNode)!,
    getNodeDef: useWorkspace((state) => state.getNodeDef),
    nodeDefs: useWorkspace((state) => state.nodeDefs),
    onEditingNode: useWorkspace((state) => state.onEditingNode),
    allFiles: useWorkspace((state) => state.allFiles),
    fileTree: useWorkspace((state) => state.fileTree),
    relative: useWorkspace((state) => state.relative),
  };
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // set form values
  useEffect(() => {
    const data = workspace.editingNode.data;
    const def = workspace.getNodeDef(workspace.editingNode.data.name);
    form.resetFields();
    form.setFieldValue("id", data.id);
    form.setFieldValue("name", data.name);
    form.setFieldValue("type", def.type);
    form.setFieldValue("desc", data.desc || def.desc);
    form.setFieldValue("debug", data.debug);
    form.setFieldValue("disabled", data.disabled);
    form.setFieldValue("path", data.path);
    def.args?.forEach((v) => {
      form.setFieldValue(`args.${v.name}`, data.args?.[v.name]);
    });
    def.input?.forEach((_, i) => {
      form.setFieldValue(`input.${i}`, data.input?.[i]);
    });
    def.output?.forEach((_, i) => {
      form.setFieldValue(`output.${i}`, data.output?.[i]);
    });
  }, [workspace.editingNode]);

  // auto complete for node
  const nodeOptions = useMemo(() => {
    const options: OptionType[] = [];
    workspace.nodeDefs.forEach((e) => {
      options.push({ label: `${e.name}(${e.desc})`, value: e.name });
    });
    return options;
  }, [workspace.nodeDefs]);

  // auto complete for input and output
  const inoutVarOptions = useMemo(() => {
    const options: OptionType[] = [];
    const collect = (node?: TreeGraphData) => {
      if (node) {
        node.input?.forEach((v, i) => {
          const desc = node.def.input?.[i] ?? "<unknown>";
          if (v && !options.find((option) => option.value === v)) {
            options.push({ label: `${v}(${desc})`, value: v });
          }
        });
        node.output?.forEach((v, i) => {
          const desc = node.def.output?.[i] ?? "<unknown>";
          if (v && !options.find((option) => option.value === v)) {
            options.push({ label: `${v}(${desc})`, value: v });
          }
        });
        node.children?.forEach((child) => collect(child));
      }
    };
    collect(workspace.editing?.data);
    return options;
  }, [workspace.editing]);

  // auto complete for subtree
  const subtreeOptions = useMemo(() => {
    const options: OptionType[] = [];
    workspace.allFiles.forEach((file) => {
      const value = workspace.relative(file.path);
      const desc = ""; //fileNode.desc ? `(${fileNode.desc})` : "";
      options.push({
        label: `${value}${desc}`,
        value: value,
      });
    });
    options.sort((a, b) => a.value.localeCompare(b.value));
    return options;
  }, [workspace.allFiles, workspace.fileTree]);

  const editingNode = workspace.editingNode;
  const def = workspace.getNodeDef(editingNode.data.name);
  const disabled = !editingNode.editable;

  // update value
  const finish = (values: any) => {
    const data = {} as NodeModel;
    data.id = editingNode.data.id;
    data.name = values.name;
    data.debug = values.debug || undefined;
    data.disabled = values.disabled || undefined;
    data.desc = values.desc && values.desc !== def.desc ? values.desc : undefined;
    data.path = values.path || undefined;

    def.args?.forEach((arg) => {
      const v = values[`args.${arg.name}`];
      if (v !== null && v !== undefined && v !== "") {
        data.args ||= {};
        data.args[arg.name] = v;
      }
    });

    def.input?.forEach((_, i) => {
      const v = values[`input.${i}`];
      data.input ||= [];
      data.input.push(v ?? "");
    });

    def.output?.forEach((_, i) => {
      const v = values[`output.${i}`];
      data.output ||= [];
      data.output.push(v ?? "");
    });
    workspace.editing?.dispatch("updateNode", {
      data: data,
    } as EditNode);
  };

  // change node def
  const changeNodeDef = (newname: string) => {
    if (editingNode.data.name !== newname) {
      workspace.onEditingNode({
        data: {
          id: editingNode.data.id,
          name: workspace.nodeDefs.get(newname)?.name ?? newname,
          desc: editingNode.data.desc,
          debug: editingNode.data.debug,
          disabled: editingNode.data.disabled,
        },
        editable: editingNode.editable,
      });
      finish(form.getFieldsValue());
    } else {
      form.submit();
    }
  };

  const changeSubtree = () => {
    if (form.getFieldValue("path") !== editingNode.data.path) {
      finish(form.getFieldsValue());
    } else {
      form.submit();
    }
  };

  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{def.desc}</span>
      </div>
      <div
        className={isMacos ? undefined : "b3-overflow"}
        style={{ overflow: "auto", height: "100%", padding: "24px" }}
      >
        <Form
          form={form}
          wrapperCol={{ span: "auto" }}
          labelCol={{ span: "auto" }}
          onFinish={finish}
        >
          <Form.Item
            name="id"
            label={
              <div style={{ minWidth: "80px", justifyContent: "flex-end" }}>{t("node.id")}</div>
            }
          >
            <Input disabled={true} />
          </Form.Item>
          <Form.Item
            name="type"
            label={
              <div style={{ minWidth: "80px", justifyContent: "flex-end" }}>{t("node.type")}</div>
            }
          >
            <Input disabled={true} />
          </Form.Item>
          <Form.Item label={t("node.name")} name="name">
            <AutoComplete
              disabled={disabled}
              options={nodeOptions}
              onBlur={() => changeNodeDef(form.getFieldValue("name"))}
              onSelect={changeNodeDef}
              onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
              filterOption={(inputValue: string, option?: OptionType) => {
                const label = option!.label as string;
                return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
              }}
            />
          </Form.Item>
          <Form.Item name="desc" label={t("node.desc")}>
            <TextArea autoSize disabled={disabled} onBlur={form.submit} />
          </Form.Item>
          <Form.Item label={t("node.debug")} name="debug" valuePropName="checked">
            <Switch disabled={disabled && !editingNode.data.path} onChange={form.submit} />
          </Form.Item>
          <Form.Item label={t("node.disabled")} name="disabled" valuePropName="checked">
            <Switch disabled={disabled && !editingNode.data.path} onChange={form.submit} />
          </Form.Item>
          <Form.Item label={t("node.subtree")} name="path">
            <AutoComplete
              disabled={disabled && !editingNode.data.path}
              options={subtreeOptions}
              onBlur={changeSubtree}
              onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
              filterOption={(inputValue: string, option?: OptionType) => {
                const label = option!.label as string;
                return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
              }}
            />
          </Form.Item>
          <Markdown>{def.doc}</Markdown>
          {def.input && def.input.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.inputVariable")}</h4>
              </Divider>
              {def.input.map((v, i) => {
                const required = v.indexOf("?") == -1;
                const desc = v.replace("?", "");
                return (
                  <Form.Item
                    label={desc}
                    name={`input.${i}`}
                    key={`input.${i}`}
                    rules={[{ required, message: t("node.fileRequired", { field: desc }) }]}
                  >
                    <AutoComplete
                      disabled={disabled}
                      options={inoutVarOptions}
                      onBlur={form.submit}
                      onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                      filterOption={(inputValue: string, option?: OptionType) => {
                        const label = option!.label as string;
                        return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
                      }}
                    />
                  </Form.Item>
                );
              })}
            </>
          )}
          {def.args && def.args.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.args")}</h4>
              </Divider>
              {def.args.map((v) => {
                const required = v.type.indexOf("?") == -1;
                const type = v.type.replace("?", "") as NodeArgType;
                return (
                  <Form.Item
                    name={`args.${v.name}`}
                    label={v.desc}
                    key={`args.${v.name}`}
                    initialValue={type === "boolean" ? v.default ?? false : v.default}
                    valuePropName={type === "boolean" ? "checked" : undefined}
                    rules={[{ required, message: t("node.fileRequired", { field: v.desc }) }]}
                  >
                    {type === "string" && (
                      <TextArea autoSize disabled={disabled} onBlur={form.submit} />
                    )}
                    {type === "int" && (
                      <InputNumber disabled={disabled} onBlur={form.submit} precision={0} />
                    )}
                    {type === "float" && <InputNumber disabled={disabled} onBlur={form.submit} />}
                    {type === "boolean" && <Switch disabled={disabled} onChange={form.submit} />}
                    {type === "code" && <Input disabled={disabled} onBlur={form.submit} />}
                    {type === "enum" && (
                      <Select disabled={disabled} onBlur={form.submit} onChange={form.submit}>
                        {v.options?.map((value) => {
                          return (
                            <Select.Option key={value.name} value={value.value}>
                              {value.name}
                            </Select.Option>
                          );
                        })}
                      </Select>
                    )}
                  </Form.Item>
                );
              })}
            </>
          )}
          {def.output && def.output.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.outputVariable")}</h4>
              </Divider>
              {def.output.map((v, i) => {
                const required = v.indexOf("?") == -1;
                const desc = v.replace("?", "");
                return (
                  <Form.Item
                    label={desc}
                    name={`output.${i}`}
                    key={`output.${i}`}
                    rules={[{ required, message: t("node.fileRequired", { field: desc }) }]}
                  >
                    <AutoComplete
                      disabled={disabled}
                      options={inoutVarOptions}
                      onBlur={form.submit}
                      onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                      filterOption={(inputValue: string, option?: OptionType) => {
                        const label = option!.label as string;
                        return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
                      }}
                    />
                  </Form.Item>
                );
              })}
            </>
          )}
        </Form>
        {disabled && (
          <Flex style={{ paddingTop: "30px" }}>
            <Button
              type="primary"
              style={{ width: "100%" }}
              icon={<EditOutlined />}
              onClick={() => workspace.editing?.dispatch("editSubtree")}
            >
              {t("editSubtree")}
            </Button>
          </Flex>
        )}
      </div>
    </>
  );
};

const NodeDefInspector: FC = () => {
  const workspace = {
    editingNodeDef: useWorkspace((state) => state.editingNodeDef)!,
  };
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const data = workspace.editingNodeDef.data;

  // set form values
  useEffect(() => {
    form.resetFields();
    form.setFieldValue("name", data.name);
    form.setFieldValue("type", data.type);
    form.setFieldValue("desc", data.desc);
    form.setFieldValue("doc", data.doc);
    data.input?.forEach((v, i) => {
      form.setFieldValue(`input.${i}.name`, v.replaceAll("?", ""));
    });
    data.output?.forEach((v, i) => {
      form.setFieldValue(`output.${i}.name`, v.replaceAll("?", ""));
    });
    data.args?.forEach((v, i) => {
      form.setFieldValue(`args.${i}.type`, v.type.replaceAll("?", ""));
    });
  }, [workspace.editingNodeDef]);
  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("nodeDefinition")}</span>
      </div>
      <div
        className={isMacos ? undefined : "b3-overflow"}
        style={{ overflow: "auto", height: "100%", padding: "24px" }}
      >
        <Form
          form={form}
          wrapperCol={{ span: "auto" }}
          labelCol={{ span: "auto" }}
          // onFinish={finish}
        >
          <Form.Item
            name="name"
            label={
              <div style={{ minWidth: "80px", justifyContent: "flex-end" }}>{t("node.name")}</div>
            }
          >
            <Input disabled={true} />
          </Form.Item>
          <Form.Item
            name="type"
            label={
              <div style={{ minWidth: "80px", justifyContent: "flex-end" }}>{t("node.type")}</div>
            }
          >
            <Input disabled={true} />
          </Form.Item>
          <Form.Item
            name="desc"
            label={
              <div style={{ minWidth: "80px", justifyContent: "flex-end" }}>{t("node.desc")}</div>
            }
          >
            <TextArea autoSize disabled={true} />
          </Form.Item>
          <Markdown>{data.doc}</Markdown>
          {data.input && data.input.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.inputVariable")}</h4>
              </Divider>
              {data.input.map((v, i) => {
                const required = v.indexOf("?") == -1;
                return (
                  <Form.Item
                    label={`[${i}]`}
                    name={`input.${i}.name`}
                    key={`input.${i}.name`}
                    required={required}
                  >
                    <Input disabled={true} />
                  </Form.Item>
                );
              })}
            </>
          )}
          {data.args && data.args.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.args")}</h4>
              </Divider>
              {data.args.map((v, i) => {
                const required = v.type.indexOf("?") == -1;
                return (
                  <Form.Item
                    name={`args.${i}.type`}
                    label={v.desc}
                    key={`args.${i}.type`}
                    rules={[{ required }]}
                  >
                    <Select disabled={true}>
                      {["float", "int", "string", "code", "enum", "boolean"].map((value) => {
                        return (
                          <Select.Option key={value} value={value}>
                            {value}
                          </Select.Option>
                        );
                      })}
                    </Select>
                  </Form.Item>
                );
              })}
            </>
          )}
          {data.output && data.output.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.outputVariable")}</h4>
              </Divider>
              {data.output.map((v, i) => {
                const required = v.indexOf("?") == -1;
                return (
                  <Form.Item
                    label={`[${i}]`}
                    name={`output.${i}.name`}
                    key={`output.${i}.name`}
                    required={required}
                  >
                    <Input disabled={true} />
                  </Form.Item>
                );
              })}
            </>
          )}
        </Form>
      </div>
    </>
  );
};

export const Inspector: FC = () => {
  const workspace = {
    editingNode: useWorkspace((state) => state.editingNode),
    editingTree: useWorkspace((state) => state.editingTree),
    editingNodeDef: useWorkspace((state) => state.editingNodeDef),
  };
  let isEditingNode = false;
  let isEditingTree = false;
  let isEditingNodeDef = false;
  if (workspace.editingNodeDef) {
    isEditingNodeDef = true;
  } else if (workspace.editingTree) {
    isEditingTree = true;
  } else if (workspace.editingNode) {
    isEditingNode = true;
  }
  return (
    <Flex
      vertical
      className="b3-inspector"
      style={{ height: "100%", width: "340px", borderLeft: `1px solid var(--b3-color-border)` }}
    >
      {isEditingNodeDef && <NodeDefInspector />}
      {isEditingTree && <TreeInspector />}
      {isEditingNode && <NodeInspector />}
    </Flex>
  );
};

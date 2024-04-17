import { EditNode, EditTree, FileModel, useWorkspace } from "@/contexts/workspace-context";
import { NodeModel, TreeGraphData, TreeModel } from "@/misc/b3type";
import { Hotkey } from "@/misc/keys";
import Path from "@/misc/path";
import { AutoComplete, Divider, Flex, Form, Input, InputNumber, Select, Switch } from "antd";
import { DefaultOptionType } from "antd/es/select";
import { FC, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";

interface OptionType extends DefaultOptionType {}

export const Inspector: FC = () => {
  const workspace = {
    editing: useWorkspace((state) => state.editing),
    editingNode: useWorkspace((state) => state.editingNode),
    editingTree: useWorkspace((state) => state.editingTree),
    getNodeDef: useWorkspace((state) => state.getNodeDef),
    nodeDefs: useWorkspace((state) => state.nodeDefs),
    onEditingNode: useWorkspace((state) => state.onEditingNode),
    allFiles: useWorkspace((state) => state.allFiles),
    fileTree: useWorkspace((state) => state.fileTree),
  };
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // set form values
  useEffect(() => {
    if (workspace.editingTree) {
      const data = workspace.editingTree.data;
      form.resetFields();
      form.setFieldValue("name", data.name);
      form.setFieldValue("desc", data.desc);
    } else if (workspace.editingNode) {
      const data = workspace.editingNode.data;
      const def = workspace.getNodeDef(workspace.editingNode.data.name);
      form.resetFields();
      form.setFieldValue("id", data.id);
      form.setFieldValue("name", data.name);
      form.setFieldValue("desc", data.desc);
      form.setFieldValue("debug", data.debug);
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
    }
  }, [workspace.editingNode, workspace.editingTree]);

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
          if (v && !options.find((option) => option.value !== v)) {
            options.push({ label: `${v}(${desc})`, value: v });
          }
        });
        node.output?.forEach((v, i) => {
          const desc = node.def.output?.[i] ?? "<unknown>";
          if (v && !options.find((option) => option.value !== v)) {
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
    workspace.allFiles.forEach((path) => {
      const value = Path.relative(workspace.fileTree!.path, path).replaceAll(Path.sep, "/");
      const desc = ""; //fileNode.desc ? `(${fileNode.desc})` : "";
      options.push({
        label: `${value}${desc}`,
        value: value,
      });
    });
    return options;
  }, [workspace.allFiles, workspace.fileTree]);

  if (workspace.editingTree) {
    const finish = (values: any) => {
      const data = {} as TreeModel;
      data.name = values.name;
      data.desc = values.desc || undefined;
      workspace.editing?.dispatch?.("updateTree", {
        data: {
          name: values.name,
          desc: values.desc || undefined,
        },
      } as EditTree);
    };
    return (
      <Flex className="b3-inspector" vertical style={{ height: "100%" }}>
        <div style={{ padding: "12px 24px" }}>
          <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("tree.overview")}</span>
        </div>
        <div style={{ overflow: "auto", height: "100%", padding: "24px" }}>
          <Form form={form} labelCol={{ span: 8 }} onFinish={finish}>
            <Form.Item name="name" label={t("tree.name")}>
              <Input disabled={true} />
            </Form.Item>
            <Form.Item name="desc" label={t("tree.desc")}>
              <Input onBlur={form.submit} />
            </Form.Item>
          </Form>
        </div>
      </Flex>
    );
  } else if (workspace.editingNode) {
    const editingNode = workspace.editingNode;
    const def = workspace.getNodeDef(editingNode.data.name);
    const disabled = !editingNode.editable;

    // update value
    const finish = (values: any) => {
      const data = {} as NodeModel;
      data.id = editingNode.data.id;
      data.name = values.name;
      data.debug = values.debug || undefined;
      data.desc = values.desc || undefined;
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
        data.output!.push(v ?? "");
      });
      workspace.editing?.dispatch?.("updateNode", {
        data: data,
      } as EditNode);
    };

    // change node def
    const changeNodeDef = (newname: string) => {
      if (editingNode.data.name !== newname) {
        editingNode.data = {
          id: editingNode.data.id,
          name: workspace.nodeDefs.get(newname)?.name ?? newname,
          desc: editingNode.data.desc,
          debug: editingNode.data.debug,
        };
        workspace.onEditingNode(editingNode);
        form.submit();
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
      <Flex className="b3-inspector" vertical style={{ height: "100%" }}>
        <div style={{ padding: "12px 24px" }}>
          <span style={{ fontSize: "18px", fontWeight: "600" }}>{def.desc}</span>
        </div>
        <div style={{ overflow: "auto", height: "100%", padding: "24px" }}>
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
              <Input disabled={disabled} onBlur={form.submit} />
            </Form.Item>
            <Form.Item label={t("node.debug")} name="debug" valuePropName="checked">
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
                  return (
                    <Form.Item
                      initialValue={v.default}
                      name={`args.${v.name}`}
                      label={v.desc}
                      key={`args.${v.name}`}
                      valuePropName={v.type.indexOf("boolean") >= 0 ? "checked" : undefined}
                      rules={[{ required, message: t("node.fileRequired", { field: v.desc }) }]}
                    >
                      {v.type.indexOf("string") >= 0 && (
                        <Input disabled={disabled} onBlur={form.submit} />
                      )}
                      {v.type.indexOf("int") >= 0 && (
                        <InputNumber disabled={disabled} onBlur={form.submit} precision={0} />
                      )}
                      {v.type.indexOf("float") >= 0 && (
                        <InputNumber disabled={disabled} onBlur={form.submit} />
                      )}
                      {v.type.indexOf("boolean") >= 0 && (
                        <Switch disabled={disabled} onChange={form.submit} />
                      )}
                      {v.type.indexOf("code") >= 0 && (
                        <Input onBlur={form.submit} placeholder={t("node.codePlaceholder")} />
                      )}
                      {v.type.indexOf("enum") >= 0 && (
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
        </div>
      </Flex>
    );
  } else {
    return null;
  }
};

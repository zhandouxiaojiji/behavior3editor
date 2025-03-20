import {
  AimOutlined,
  EditOutlined,
  FormOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  AutoComplete,
  Button,
  Checkbox,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
} from "antd";
import useFormInstance from "antd/es/form/hooks/useFormInstance";
import TextArea from "antd/es/input/TextArea";
import { DefaultOptionType } from "antd/es/select";
import { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import { useDebounceCallback } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";
import { EditNode, EditTree, useWorkspace } from "../contexts/workspace-context";
import {
  GroupDef,
  ImportDef,
  isBoolType,
  isEnumType,
  isExprType,
  isFloatType,
  isIntType,
  isJsonType,
  isStringType,
  NodeModel,
  TreeGraphData,
  VarDef,
} from "../misc/b3type";
import {
  checkNodeArgValue,
  checkOneof,
  getNodeArgRawType,
  isNodeArgArray,
  isNodeArgOptional,
  isValidVariableName,
  isVariadic,
  loadVarDef,
  parseExpr,
  usingGroups,
  usingVars,
} from "../misc/b3util";
import { Hotkey, isMacos } from "../misc/keys";
import { mergeClassNames } from "../misc/util";

interface OptionType extends DefaultOptionType {
  value: string;
}

interface VarDefItem extends VarDef {
  count?: number;
}

interface VarDefItemProps {
  name: number;
  disabled?: boolean;
  value?: VarDefItem;
  onChange?: (vardef: VarDefItem) => void;
  onRemove?: (name: number | number[]) => void;
}

const VarDefItem: FC<VarDefItemProps> = ({ name, onChange, onRemove, disabled, ...props }) => {
  const { t } = useTranslation();
  const form = useFormInstance();
  const [value, setValue] = useState<VarDefItem>(props.value ?? { name: "", desc: "" });
  const { editing } = useWorkspace(
    useShallow((state) => ({
      editing: state.editing,
    }))
  );

  const onSubmit = () => {
    onChange?.(value);
    form.submit();
  };

  return (
    <Flex gap={4}>
      <Space.Compact>
        <div
          style={{
            display: "flex",
            cursor: "pointer",
            alignItems: "center",
            paddingLeft: "8px",
            paddingRight: "8px",
            maxWidth: "52px",
            minWidth: "52px",
            borderTopLeftRadius: "4px",
            borderBottomLeftRadius: "4px",
            borderLeft: "1px solid #3d506c",
            borderTop: "1px solid #3d506c",
            borderBottom: "1px solid #3d506c",
          }}
          onClick={() => editing?.dispatch("clickVar", name)}
        >
          <AimOutlined />
          <span style={{ marginLeft: 4 }}>{value?.count ?? 0}</span>
        </div>
        <Input
          disabled={disabled}
          value={value.name}
          placeholder={t("tree.vars.name")}
          onBlur={onSubmit}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
        <Input
          disabled={disabled}
          value={value.desc}
          placeholder={t("tree.vars.desc")}
          onBlur={onSubmit}
          onChange={(e) => setValue({ ...value, desc: e.target.value })}
        />
      </Space.Compact>
      {!disabled && (
        <MinusCircleOutlined
          style={{ marginBottom: "6px" }}
          onClick={() => {
            onRemove?.(name);
            form.submit();
          }}
        />
      )}
      {disabled && <div style={{ width: 20 }} />}
    </Flex>
  );
};

const TreeInspector: FC = () => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      allFiles: state.allFiles,
      editing: state.editing,
      editingTree: state.editingTree!,
      fileTree: state.fileTree,
      groupDefs: state.groupDefs,
      nodeDefs: state.nodeDefs,
      relative: state.relative,
      open: state.open,
      workdir: state.workdir,
    }))
  );
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // group defs
  const groupDefs: GroupDef[] = useMemo(() => {
    return workspace.groupDefs.map((v) => ({
      name: v,
      value: workspace.editingTree.group.includes(v),
    }));
  }, [workspace.groupDefs, workspace.editingTree]);

  // using count
  const usingCount: Record<string, number> = useMemo(() => {
    const count: Record<string, number> = {};
    const collect = (node: TreeGraphData) => {
      const def = workspace.nodeDefs.get(node.name);
      if (def.input) {
        node.input?.forEach((v) => {
          count[v] = (count[v] ?? 0) + 1;
        });
      }
      if (def.output) {
        node.output?.forEach((v) => {
          count[v] = (count[v] ?? 0) + 1;
        });
      }
      if (def.args) {
        def.args.forEach((arg) => {
          const expr = node.args?.[arg.name] as string | string[] | undefined;
          if (!isExprType(arg.type) || !expr) {
            return;
          }
          if (Array.isArray(expr)) {
            expr.forEach((str) => {
              parseExpr(str).forEach((v) => {
                count[v] = (count[v] ?? 0) + 1;
              });
            });
          } else {
            parseExpr(expr).forEach((v) => {
              count[v] = (count[v] ?? 0) + 1;
            });
          }
        });
      }
      node.children?.forEach(collect);
    };
    collect(workspace.editingTree.root);
    return count;
  }, [workspace.editingTree, workspace.nodeDefs]);

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

  // set form values
  useEffect(() => {
    loadVarDef(workspace.editingTree.import);
    form.resetFields();
    form.setFieldValue("name", workspace.editingTree.name);
    form.setFieldValue("desc", workspace.editingTree.desc);
    form.setFieldValue("export", workspace.editingTree.export !== false);
    form.setFieldValue("firstid", workspace.editingTree.firstid);
    form.setFieldValue("group", groupDefs);
    form.setFieldValue(
      "declvar",
      workspace.editingTree.declvar.map((v) => ({
        name: v.name,
        desc: v.desc,
        count: usingCount[v.name] ?? 0,
      }))
    );
    form.setFieldValue(
      "import",
      workspace.editingTree.import.map((entry) => ({
        path: entry.path,
        vars: entry.vars.map((v) => ({
          name: v.name,
          count: usingCount[v.name] ?? 0,
        })),
      }))
    );
    form.setFieldValue(
      "subtree",
      workspace.editingTree.subtree.map((entry) => ({
        path: entry.path,
        vars: entry.vars.map((v) => ({
          name: v.name,
          count: usingCount[v.name] ?? 0,
        })),
      }))
    );
  }, [workspace.editingTree, groupDefs, usingCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finish = (values: any) => {
    workspace.editing?.dispatch("updateTree", {
      name: values.name,
      desc: values.desc,
      export: values.export,
      firstid: Number(values.firstid),
      group: Array.from(
        new Set(((values.group ?? []) as GroupDef[]).map((v) => (v.value ? v.name : "")))
      )
        .filter((v) => v)
        .sort((a, b) => a.localeCompare(b)),
      declvar: (values.declvar as VarDef[])
        .filter((v) => v && v.name)
        .map((v) => ({
          name: v.name,
          desc: v.desc,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      import: (values.import as ImportDef[])
        .filter((v) => v && v.path)
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((v) => ({
          path: v.path,
          vars: (v.vars ?? []).map((v1) => ({ name: v1.name, desc: v1.desc })),
        })),
    } as EditTree);
  };

  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("tree.overview")}</span>
      </div>
      <div
        className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
        style={{ overflow: "auto", height: "100%" }}
      >
        <Form
          form={form}
          wrapperCol={{ span: "auto" }}
          labelCol={{ span: "auto" }}
          onFinish={finish}
        >
          <>
            <Form.Item name="name" label={t("tree.name")}>
              <Input disabled={true} />
            </Form.Item>
            <Form.Item name="desc" label={t("tree.desc")}>
              <TextArea autoSize onBlur={form.submit} />
            </Form.Item>
            <Form.Item name="firstid" label={t("tree.firstid")}>
              <InputNumber min={1} onBlur={form.submit} />
            </Form.Item>
            <Form.Item name="export" label={t("tree.export")} valuePropName="checked">
              <Switch onChange={() => form.submit()} />
            </Form.Item>
          </>
          {groupDefs.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("tree.group")}</h4>
              </Divider>
              <Form.List name="group">
                {(items) => (
                  <Flex
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 8,
                      rowGap: 0,
                      marginLeft: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {items
                      .filter((v) => groupDefs[v.name])
                      .map((item, idx) => (
                        <Form.Item
                          key={item.key}
                          name={[item.name, "value"]}
                          valuePropName="checked"
                          style={{ marginBottom: 0 }}
                        >
                          <Checkbox onChange={form.submit}>{groupDefs[idx].name}</Checkbox>
                        </Form.Item>
                      ))}
                  </Flex>
                )}
              </Form.List>
            </>
          )}
          <>
            <Divider orientation="left">
              <h4>{t("tree.vars")}</h4>
            </Divider>
            <Form.List name="declvar">
              {(fields, { add, remove }, { errors }) => (
                <div style={{ display: "flex", flexDirection: "column", rowGap: 0 }}>
                  {fields.map((item) => (
                    <Form.Item
                      key={item.key}
                      name={item.name}
                      validateTrigger={["onChange", "onBlur"]}
                      style={{ marginBottom: 2 }}
                      rules={[
                        {
                          validator(_, value: VarDefItem) {
                            if (!value.name || !/^[_\w]+\w*$/.test(value.name)) {
                              return Promise.reject(new Error(t("tree.vars.invalidName")));
                            }
                            if (!value.desc) {
                              return Promise.reject(
                                new Error(t("fieldRequired", { field: t("tree.vars.desc") }))
                              );
                            }
                            return Promise.resolve();
                          },
                        },
                      ]}
                    >
                      <VarDefItem name={item.name} onRemove={remove} />
                    </Form.Item>
                  ))}
                  <Form.Item
                    style={{
                      marginRight: fields.length === 0 ? undefined : "18px",
                      marginTop: 4,
                      alignItems: "end",
                    }}
                  >
                    <Button
                      type="dashed"
                      onClick={() => {
                        add({});
                      }}
                      style={{ width: "100%" }}
                      icon={<PlusOutlined />}
                    >
                      {t("add")}
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </div>
              )}
            </Form.List>
          </>
          {workspace.editingTree.subtree.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("tree.vars.subtree")}</h4>
              </Divider>
              <Form.List name="subtree">
                {(items) => (
                  <div style={{ display: "flex", flexDirection: "column", rowGap: 4 }}>
                    {items.map((item) => (
                      <Space.Compact
                        key={item.key}
                        className="b3-inspector-import-item"
                        direction="vertical"
                        style={{ marginBottom: 5 }}
                      >
                        <Flex gap={4} style={{ width: "100%" }}>
                          <Form.Item
                            name={[item.name, "path"]}
                            style={{ width: "100%", marginBottom: 2 }}
                          >
                            <Select
                              disabled={true}
                              showSearch
                              options={subtreeOptions}
                              onBlur={form.submit}
                              onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                              filterOption={(value, option) => {
                                const label = option!.label as string;
                                return label.toUpperCase().includes(value.toUpperCase());
                              }}
                            />
                          </Form.Item>
                          <FormOutlined
                            onClick={() => {
                              const path = workspace.editingTree.subtree[item.name].path;
                              workspace.open(`${workspace.workdir}/${path}`);
                            }}
                          />
                        </Flex>
                        <Form.List name={[item.name, "vars"]}>
                          {(vars) => (
                            <div style={{ display: "flex", flexDirection: "column", rowGap: 0 }}>
                              {vars.map((v) => (
                                <Form.Item key={v.key} name={v.name} style={{ marginBottom: 2 }}>
                                  <VarDefItem name={v.name} disabled={true} />
                                </Form.Item>
                              ))}
                            </div>
                          )}
                        </Form.List>
                      </Space.Compact>
                    ))}
                  </div>
                )}
              </Form.List>
            </>
          )}
          <>
            <Divider orientation="left">
              <h4>{t("tree.vars.imports")}</h4>
            </Divider>
            <Form.List name="import">
              {(items, { add, remove }, { errors }) => (
                <div style={{ display: "flex", flexDirection: "column", rowGap: 4 }}>
                  {items.map((item) => (
                    <Space.Compact
                      key={item.key}
                      className="b3-inspector-import-item"
                      direction="vertical"
                      style={{ marginBottom: 5 }}
                    >
                      <Flex gap={4} style={{ width: "100%" }}>
                        <Form.Item
                          name={[item.name, "path"]}
                          style={{ width: "100%", marginBottom: 2 }}
                        >
                          <Select
                            showSearch
                            options={subtreeOptions}
                            onBlur={form.submit}
                            onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                            filterOption={(value, option) => {
                              const label = option!.label as string;
                              return label.toUpperCase().includes(value.toUpperCase());
                            }}
                          />
                        </Form.Item>
                        <MinusCircleOutlined
                          style={{ marginBottom: "6px" }}
                          onClick={() => {
                            remove(item.name);
                            form.submit();
                          }}
                        />
                      </Flex>
                      <Form.List name={[item.name, "vars"]}>
                        {(vars) => (
                          <div style={{ display: "flex", flexDirection: "column", rowGap: 0 }}>
                            {vars.map((v) => (
                              <Form.Item key={v.key} name={v.name} style={{ marginBottom: 2 }}>
                                <VarDefItem name={v.name} disabled={true} />
                              </Form.Item>
                            ))}
                          </div>
                        )}
                      </Form.List>
                    </Space.Compact>
                  ))}
                  <Form.Item
                    style={{
                      marginRight: items.length === 0 ? undefined : "18px",
                      alignItems: "end",
                    }}
                  >
                    <Button
                      type="dashed"
                      onClick={() => {
                        add({});
                      }}
                      style={{ width: "100%" }}
                      icon={<PlusOutlined />}
                    >
                      {t("add")}
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </div>
              )}
            </Form.List>
          </>
        </Form>
      </div>
    </>
  );
};

const NodeInspector: FC = () => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      editing: state.editing,
      editingNode: state.editingNode!,
      nodeDefs: state.nodeDefs,
      allFiles: state.allFiles,
      fileTree: state.fileTree,
      relative: state.relative,
      onEditingNode: state.onEditingNode,
    }))
  );

  const { t } = useTranslation();
  const [form] = Form.useForm();

  const validateFieldsLater = useDebounceCallback(
    () => form.validateFields({ recursive: true }),
    100
  );

  // set form values
  useEffect(() => {
    const data = workspace.editingNode.data;
    const def = workspace.nodeDefs.get(workspace.editingNode.data.name);
    form.resetFields();
    form.setFieldValue("id", data.id);
    form.setFieldValue("name", data.name);
    form.setFieldValue("type", def.type);
    form.setFieldValue("desc", data.desc || def.desc);
    form.setFieldValue("debug", data.debug);
    form.setFieldValue("disabled", data.disabled);
    form.setFieldValue("path", data.path);
    if (def.children === undefined || def.children === -1) {
      form.setFieldValue("children", t("node.children.unlimited"));
    } else {
      form.setFieldValue("children", def.children);
    }
    def.args?.forEach((arg) => {
      const type = getNodeArgRawType(arg);
      const value = data.args?.[arg.name];
      const name = `args.${arg.name}`;
      if (isNodeArgArray(arg)) {
        form.setFieldValue(
          name,
          (Array.isArray(value) ? value : []).map((item) => {
            if (isJsonType(type)) {
              return item === null ? "null" : JSON.stringify(item ?? arg.default, null, 2);
            } else {
              return item;
            }
          })
        );
      } else if (isJsonType(type)) {
        form.setFieldValue(
          name,
          value === null ? "null" : JSON.stringify(value ?? arg.default, null, 2)
        );
      } else {
        form.setFieldValue(name, value ?? arg.default);
      }
    });
    def.input?.forEach((_, i) => {
      if (isVariadic(def.input!, i)) {
        form.setFieldValue(`input.${i}`, data.input?.slice(i) ?? []);
      } else {
        form.setFieldValue(`input.${i}`, data.input?.[i]);
      }
    });
    def.output?.forEach((_, i) => {
      if (isVariadic(def.output!, i)) {
        form.setFieldValue(`output.${i}`, data.output?.slice(i) ?? []);
      } else {
        form.setFieldValue(`output.${i}`, data.output?.[i]);
      }
    });
    validateFieldsLater();
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
    const filter: Record<string, boolean> = {};
    const collect = (node?: TreeGraphData) => {
      if (node) {
        node.input?.forEach((v, i) => {
          let desc: string;
          const inputDef = node.def.input;
          if (inputDef && i >= inputDef.length && isVariadic(inputDef, -1)) {
            desc = inputDef[inputDef.length - 1];
          } else {
            desc = inputDef?.[i] ?? "<unknown>";
          }
          if (!filter[v]) {
            options.push({ label: `${v}(${desc})`, value: v });
            filter[v] = true;
          }
        });
        node.output?.forEach((v, i) => {
          let desc: string;
          const outputDef = node.def.output;
          if (outputDef && i >= outputDef.length && isVariadic(outputDef, -1)) {
            desc = outputDef[outputDef.length - 1];
          } else {
            desc = outputDef?.[i] ?? "<unknown>";
          }
          if (!filter[v]) {
            options.push({ label: `${v}(${desc})`, value: v });
            filter[v] = true;
          }
        });
        node.children?.forEach((child) => collect(child));
      }
    };
    if (usingVars) {
      Object.values(usingVars ?? {}).forEach((v) => {
        if (!filter[v.name]) {
          options.push({ label: `${v.name}(${v.desc})`, value: v.name });
          filter[v.name] = true;
        }
      });
    } else {
      collect(workspace.editing?.root);
    }
    return options;
  }, [workspace.editing, usingVars]);

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
  const def = workspace.nodeDefs.get(editingNode.data.name);
  const disabled = !editingNode.editable;

  // update value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finish = (values: any) => {
    const data = {} as NodeModel;
    data.id = editingNode.data.id;
    data.name = values.name;
    data.debug = values.debug || undefined;
    data.disabled = values.disabled || undefined;
    data.desc = values.desc && values.desc !== def.desc ? values.desc : undefined;
    data.path = values.path || undefined;

    if (def.args?.length) {
      def.args?.forEach((arg) => {
        const value = values[`args.${arg.name}`];
        if (value !== null && value !== undefined && value !== "") {
          data.args ||= {};
          const type = getNodeArgRawType(arg);
          if (isNodeArgArray(arg)) {
            const arr: unknown[] = [];
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (isJsonType(type)) {
                  try {
                    arr.push(item === "null" ? null : JSON.parse(item));
                  } catch {
                    /** ignore */
                  }
                } else if (item !== null && item !== undefined) {
                  arr.push(item);
                }
              });
            }
            data.args[arg.name] = arr;
          } else if (isJsonType(type)) {
            try {
              data.args[arg.name] = value === "null" ? null : JSON.parse(value);
            } catch {
              /** ignore */
            }
          } else {
            data.args[arg.name] = value;
          }
        }
      });
    } else {
      data.args = {};
    }

    if (def.input?.length) {
      def.input?.forEach((_, i) => {
        data.input ||= [];
        if (isVariadic(def.input!, i)) {
          const arr = (values[`input.${i}`] ?? []) as string[];
          data.input.push(...arr.filter((v) => typeof v === "string"));
        } else {
          const v = values[`input.${i}`];
          data.input.push(v ?? "");
        }
      });
    } else {
      data.input = [];
    }

    if (def.output?.length) {
      def.output?.forEach((_, i) => {
        data.output ||= [];
        if (isVariadic(def.output!, i)) {
          const arr = (values[`output.${i}`] ?? []) as string[];
          data.output.push(...arr.filter((v) => typeof v === "string"));
        } else {
          const v = values[`output.${i}`];
          data.output.push(v ?? "");
        }
      });
    } else {
      data.output = [];
    }

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
        className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
        style={{ overflow: "auto", height: "100%" }}
      >
        <Form
          form={form}
          wrapperCol={{ span: "auto" }}
          labelCol={{ span: "auto" }}
          onFinish={finish}
        >
          <Form.Item name="id" label={t("node.id")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item
            name="type"
            label={t("node.type")}
            rules={[
              {
                validator() {
                  if (def.group && !def.group.some((g) => usingGroups[g])) {
                    return Promise.reject(new Error(t("node.invalidGroup", { group: def.group })));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input disabled={true} />
          </Form.Item>
          <Form.Item
            name="children"
            label={t("node.children")}
            rules={[
              {
                validator() {
                  if (editingNode.limitError) {
                    return Promise.reject(new Error(t("node.invalidChildren")));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input disabled={true} />
          </Form.Item>
          <Form.Item
            label={t("node.name")}
            name="name"
            rules={[
              {
                validator() {
                  if (!workspace.nodeDefs.has(editingNode.data.name)) {
                    return Promise.reject(
                      new Error(t("node.notFound", { name: editingNode.data.name }))
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
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
          <Markdown className="b3-markdown">{def.doc}</Markdown>
          {def.input && def.input.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.inputVariable")}</h4>
              </Divider>
              {def.input.map((v, i) => {
                const required = v.indexOf("?") === -1;
                const desc = v.replace("?", "");
                if (isVariadic(def.input!, i)) {
                  return (
                    <Form.Item label={desc} key={`input.${i}`}>
                      <Form.List name={`input.${i}`}>
                        {(fields, { add, remove }, { errors }) => (
                          <div
                            style={{
                              display: "flex",
                              rowGap: 0,
                              flexDirection: "column",
                            }}
                          >
                            {fields.map((field) => (
                              <Flex key={field.key} gap={4}>
                                <Form.Item
                                  name={field.name}
                                  validateTrigger={["onChange", "onBlur"]}
                                  style={{ width: "100%", marginBottom: 5 }}
                                  rules={[
                                    {
                                      validator(_, value) {
                                        if (value && usingVars && !usingVars[value]) {
                                          return Promise.reject(
                                            new Error(
                                              t("node.undefinedVariable", { variable: value })
                                            )
                                          );
                                        }
                                        if (value && !isValidVariableName(value)) {
                                          return Promise.reject(
                                            new Error(t("node.invalidVariableName"))
                                          );
                                        }
                                        return Promise.resolve();
                                      },
                                    },
                                  ]}
                                >
                                  <AutoComplete
                                    disabled={disabled}
                                    options={inoutVarOptions}
                                    onBlur={form.submit}
                                    onInputKeyDown={(e) =>
                                      e.code === Hotkey.Escape && e.preventDefault()
                                    }
                                    filterOption={(inputValue: string, option?: OptionType) => {
                                      const label = option!.label as string;
                                      return (
                                        label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                      );
                                    }}
                                  />
                                </Form.Item>
                                <MinusCircleOutlined
                                  style={{ marginBottom: "6px" }}
                                  onClick={() => {
                                    remove(field.name);
                                    form.submit();
                                  }}
                                />
                              </Flex>
                            ))}
                            <Form.Item>
                              <Button
                                type="dashed"
                                onClick={() => {
                                  add("");
                                }}
                                style={{ width: fields.length === 0 ? "100%" : "200px" }}
                                icon={<PlusOutlined />}
                              >
                                {t("add")}
                              </Button>
                              <Form.ErrorList errors={errors} />
                            </Form.Item>
                          </div>
                        )}
                      </Form.List>
                    </Form.Item>
                  );
                } else {
                  return (
                    <Form.Item
                      label={desc}
                      name={`input.${i}`}
                      key={`input.${i}`}
                      rules={[
                        { required, message: t("fieldRequired", { field: desc }) },
                        ({ getFieldValue, setFieldValue, isFieldValidating, validateFields }) => ({
                          validator(_, value) {
                            if (value && usingVars && !usingVars[value]) {
                              return Promise.reject(
                                new Error(t("node.undefinedVariable", { variable: value }))
                              );
                            }
                            if (value && !isValidVariableName(value)) {
                              return Promise.reject(new Error(t("node.invalidVariableName")));
                            }
                            const arg = def.args?.find(
                              (a) => a.oneof && v.replace("?", "") === a.oneof
                            );
                            if (arg) {
                              const argName = `args.${arg.name}`;
                              if (!isFieldValidating(argName)) {
                                setFieldValue(`input.${i}`, value);
                                validateFields([argName]);
                              }
                              if (!checkOneof(getFieldValue(argName) ?? "", value)) {
                                return Promise.reject(
                                  new Error(
                                    t("node.oneof.error", {
                                      input: v,
                                      arg: arg.name,
                                      desc: arg.desc ?? "",
                                    })
                                  )
                                );
                              } else {
                                return Promise.resolve();
                              }
                            }

                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <AutoComplete
                        disabled={disabled}
                        options={inoutVarOptions}
                        onBlur={form.submit}
                        onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                        filterOption={(inputValue: string, option?: OptionType) => {
                          const label = option!.label as string;
                          return label.toUpperCase().includes(inputValue.toUpperCase());
                        }}
                      />
                    </Form.Item>
                  );
                }
              })}
            </>
          )}
          {def.args && def.args.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.args")}</h4>
              </Divider>
              {def.args.map((arg) => {
                const required = !isNodeArgOptional(arg);
                const type = getNodeArgRawType(arg);
                if (isNodeArgArray(arg)) {
                  return (
                    <Form.Item key={`args.${arg.name}`}>
                      <Form.List name={`args.${arg.name}`}>
                        {(items, { add, remove }, { errors }) => (
                          <div style={{ display: "flex", rowGap: 0, flexDirection: "column" }}>
                            {items.map((item, idx) => (
                              <Flex key={item.key} gap={4}>
                                <Form.Item
                                  name={item.name}
                                  label={idx === 0 ? `${arg.desc}[${idx}]` : `[${idx}]`}
                                  validateTrigger={["onChange", "onBlur"]}
                                  style={{ width: "100%", marginBottom: 5 }}
                                  initialValue={
                                    isBoolType(type) ? arg.default ?? false : arg.default
                                  }
                                  valuePropName={isBoolType(type) ? "checked" : undefined}
                                  rules={[
                                    {
                                      required,
                                      message: t("fieldRequired", { field: arg.desc }),
                                    },
                                    () => ({
                                      validator(_, value) {
                                        if (usingVars && isExprType(type) && value) {
                                          for (const v of parseExpr(value)) {
                                            if (!usingVars![v]) {
                                              return Promise.reject(
                                                new Error(
                                                  t("node.undefinedVariable", { variable: v })
                                                )
                                              );
                                            }
                                          }
                                        }
                                        if (isJsonType(type)) {
                                          try {
                                            if (value !== "null") {
                                              JSON.parse(value);
                                            }
                                          } catch (e) {
                                            return Promise.reject(
                                              new Error(t("node.invalidValue"))
                                            );
                                          }
                                        } else if (
                                          !checkNodeArgValue(editingNode.data, arg, value, true)
                                        ) {
                                          return Promise.reject(new Error(t("node.invalidValue")));
                                        }
                                        return Promise.resolve();
                                      },
                                    }),
                                  ]}
                                >
                                  {isStringType(type) && (
                                    <TextArea autoSize disabled={disabled} onBlur={form.submit} />
                                  )}
                                  {isJsonType(type) && (
                                    <TextArea autoSize disabled={disabled} onBlur={form.submit} />
                                  )}
                                  {isIntType(type) && (
                                    <InputNumber
                                      disabled={disabled}
                                      onBlur={form.submit}
                                      precision={0}
                                    />
                                  )}
                                  {isFloatType(type) && (
                                    <InputNumber disabled={disabled} onBlur={form.submit} />
                                  )}
                                  {isBoolType(type) && (
                                    <Switch disabled={disabled} onChange={form.submit} />
                                  )}
                                  {isExprType(type) && (
                                    <Input disabled={disabled} onBlur={form.submit} />
                                  )}
                                  {isEnumType(type) && (
                                    <Select
                                      showSearch
                                      disabled={disabled}
                                      onBlur={form.submit}
                                      onChange={form.submit}
                                      options={(arg.options ?? []).map((option) => {
                                        return {
                                          value: option.value,
                                          label: `${option.name}(${option.value})`,
                                        };
                                      })}
                                      filterOption={(value, option) => {
                                        value = value.toUpperCase();
                                        return !!option?.label
                                          .toLocaleUpperCase()
                                          .includes(value.toUpperCase());
                                      }}
                                    />
                                  )}
                                </Form.Item>
                                <MinusCircleOutlined
                                  style={{ marginBottom: "6px" }}
                                  onClick={() => {
                                    remove(item.name);
                                    form.submit();
                                  }}
                                />
                              </Flex>
                            ))}
                            <Form.Item
                              label={items.length === 0 ? arg.desc : undefined}
                              style={{
                                marginLeft: items.length === 0 ? undefined : "100px",
                                marginRight: items.length === 0 ? undefined : "18px",
                                alignItems: "end",
                              }}
                            >
                              <Button
                                type="dashed"
                                onClick={() => {
                                  add(arg.default ?? isBoolType(type) ? false : "");
                                  if (isBoolType(type)) {
                                    form.submit();
                                  }
                                }}
                                style={{ width: "100%" }}
                                icon={<PlusOutlined />}
                                danger={items.length === 0 && !isNodeArgOptional(arg)}
                              >
                                {t("add")}
                              </Button>
                              <Form.ErrorList errors={errors} />
                            </Form.Item>
                          </div>
                        )}
                      </Form.List>
                    </Form.Item>
                  );
                } else {
                  return (
                    <Form.Item
                      name={`args.${arg.name}`}
                      key={`args.${arg.name}`}
                      label={arg.desc}
                      initialValue={isBoolType(type) ? arg.default ?? false : arg.default}
                      valuePropName={isBoolType(type) ? "checked" : undefined}
                      rules={[
                        { required, message: t("fieldRequired", { field: arg.desc }) },
                        ({ getFieldValue, setFieldValue, isFieldValidating, validateFields }) => ({
                          validator(_, value) {
                            if (usingVars && isExprType(type) && value) {
                              for (const v of parseExpr(value)) {
                                if (!usingVars![v]) {
                                  return Promise.reject(
                                    new Error(t("node.undefinedVariable", { variable: v }))
                                  );
                                }
                              }
                            }
                            if (value && isJsonType(type)) {
                              try {
                                if (value !== "null") {
                                  JSON.parse(value);
                                }
                              } catch (e) {
                                return Promise.reject(new Error(t("node.invalidValue")));
                              }
                            } else if (value === null && !required) {
                              value = undefined;
                            }
                            if (!checkNodeArgValue(editingNode.data, arg, value)) {
                              return Promise.reject(new Error(t("node.invalidValue")));
                            }
                            if (!arg.oneof) {
                              return Promise.resolve();
                            }
                            const idx = def.input?.findIndex(
                              (input) => input.replace("?", "") === arg.oneof
                            );
                            if (idx === undefined || idx < 0) {
                              return Promise.reject(
                                new Error(t("node.oneof.inputNotfound", { input: arg.oneof }))
                              );
                            }
                            const inputName = `input.${idx}`;
                            if (!isFieldValidating(inputName)) {
                              setFieldValue(`args.${arg.name}`, value);
                              validateFields([inputName]);
                            }
                            if (!checkOneof(getFieldValue(inputName) ?? "", value)) {
                              return Promise.reject(
                                new Error(
                                  t("node.oneof.error", {
                                    input: def.input![idx],
                                    arg: arg.name,
                                    desc: arg.desc ?? "",
                                  })
                                )
                              );
                            } else {
                              return Promise.resolve();
                            }
                          },
                        }),
                      ]}
                    >
                      {isStringType(type) && (
                        <TextArea autoSize disabled={disabled} onBlur={form.submit} />
                      )}
                      {isJsonType(type) && (
                        <TextArea autoSize disabled={disabled} onBlur={form.submit} />
                      )}
                      {isIntType(type) && (
                        <InputNumber disabled={disabled} onBlur={form.submit} precision={0} />
                      )}
                      {isFloatType(type) && (
                        <InputNumber disabled={disabled} onBlur={form.submit} />
                      )}
                      {isBoolType(type) && <Switch disabled={disabled} onChange={form.submit} />}
                      {isExprType(type) && <Input disabled={disabled} onBlur={form.submit} />}
                      {isEnumType(type) && (
                        <Select
                          showSearch
                          disabled={disabled}
                          onBlur={form.submit}
                          onChange={form.submit}
                          options={(arg.options ?? []).map((option) => {
                            return {
                              value: option.value,
                              label: `${option.name}(${option.value})`,
                            };
                          })}
                          filterOption={(value, option) => {
                            value = value.toUpperCase();
                            return !!option?.label
                              .toLocaleUpperCase()
                              .includes(value.toUpperCase());
                          }}
                        />
                      )}
                    </Form.Item>
                  );
                }
              })}
            </>
          )}
          {def.output && def.output.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.outputVariable")}</h4>
              </Divider>
              {def.output.map((v, i) => {
                const required = v.indexOf("?") === -1;
                const desc = v.replace("?", "");
                if (isVariadic(def.output!, i)) {
                  return (
                    <Form.Item label={desc} key={`output.${i}`}>
                      <Form.List name={`output.${i}`}>
                        {(fields, { add, remove }, { errors }) => (
                          <div
                            style={{
                              display: "flex",
                              rowGap: 0,
                              flexDirection: "column",
                            }}
                          >
                            {fields.map((field) => (
                              <Flex key={field.key} gap={4}>
                                <Form.Item
                                  name={field.name}
                                  validateTrigger={["onChange", "onBlur"]}
                                  style={{ width: "100%", marginBottom: 5 }}
                                  rules={[
                                    {
                                      validator(_, value) {
                                        if (value && usingVars && !usingVars[value]) {
                                          return Promise.reject(
                                            new Error(
                                              t("node.undefinedVariable", { variable: value })
                                            )
                                          );
                                        }
                                        if (value && !isValidVariableName(value)) {
                                          return Promise.reject(
                                            new Error(t("node.invalidVariableName"))
                                          );
                                        }
                                        return Promise.resolve();
                                      },
                                    },
                                  ]}
                                >
                                  <AutoComplete
                                    disabled={disabled}
                                    options={inoutVarOptions}
                                    onBlur={form.submit}
                                    onInputKeyDown={(e) =>
                                      e.code === Hotkey.Escape && e.preventDefault()
                                    }
                                    filterOption={(value: string, option?: OptionType) => {
                                      const label = option!.label as string;
                                      return (
                                        label.toUpperCase().indexOf(value.toUpperCase()) !== -1
                                      );
                                    }}
                                  />
                                </Form.Item>
                                <MinusCircleOutlined
                                  style={{ marginBottom: "6px" }}
                                  onClick={() => {
                                    remove(field.name);
                                    form.submit();
                                  }}
                                />
                              </Flex>
                            ))}
                            <Form.Item>
                              <Button
                                type="dashed"
                                onClick={() => {
                                  add("");
                                }}
                                style={{ width: fields.length === 0 ? "100%" : "200px" }}
                                icon={<PlusOutlined />}
                              >
                                {t("add")}
                              </Button>
                              <Form.ErrorList errors={errors} />
                            </Form.Item>
                          </div>
                        )}
                      </Form.List>
                    </Form.Item>
                  );
                } else {
                  return (
                    <Form.Item
                      label={desc}
                      name={`output.${i}`}
                      key={`output.${i}`}
                      rules={[
                        { required, message: t("fieldRequired", { field: desc }) },
                        {
                          validator(_, value) {
                            if (value && usingVars && !usingVars[value]) {
                              return Promise.reject(
                                new Error(t("node.undefinedVariable", { variable: value }))
                              );
                            }
                            if (value && !isValidVariableName(value)) {
                              return Promise.reject(new Error(t("node.invalidVariableName")));
                            }
                            return Promise.resolve();
                          },
                        },
                      ]}
                    >
                      <AutoComplete
                        disabled={disabled}
                        options={inoutVarOptions}
                        onBlur={form.submit}
                        onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                        filterOption={(value: string, option?: OptionType) => {
                          const label = option!.label as string;
                          return label.toUpperCase().indexOf(value.toUpperCase()) !== -1;
                        }}
                      />
                    </Form.Item>
                  );
                }
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
  const workspace = useWorkspace(
    useShallow((state) => ({
      editingNodeDef: state.editingNodeDef!,
    }))
  );
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const def = workspace.editingNodeDef.data;

  // set form values
  useEffect(() => {
    form.resetFields();
    form.setFieldValue("name", def.name);
    form.setFieldValue("type", def.type);
    form.setFieldValue("desc", def.desc);
    form.setFieldValue("doc", def.doc);
    if (def.children === undefined || def.children === -1) {
      form.setFieldValue("children", t("node.children.unlimited"));
    } else {
      form.setFieldValue("children", def.children);
    }
    def.input?.forEach((v, i) => {
      form.setFieldValue(`input.${i}.name`, v.replaceAll("?", ""));
    });
    def.output?.forEach((v, i) => {
      form.setFieldValue(`output.${i}.name`, v.replaceAll("?", ""));
    });
    def.args?.forEach((v, i) => {
      form.setFieldValue(`args.${i}.type`, v.type.replaceAll("?", ""));
    });
  }, [workspace.editingNodeDef]);
  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("nodeDefinition")}</span>
      </div>
      <div
        className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
        style={{ overflow: "auto", height: "100%" }}
      >
        <Form
          form={form}
          wrapperCol={{ span: "auto" }}
          labelCol={{ span: "auto" }}
          // onFinish={finish}
        >
          <Form.Item name="name" label={t("node.name")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="type" label={t("node.type")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="children" label={t("node.children")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="desc" label={t("node.desc")}>
            <TextArea autoSize disabled={true} />
          </Form.Item>
          <Markdown className="b3-markdown">{def.doc}</Markdown>
          {def.input && def.input.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.inputVariable")}</h4>
              </Divider>
              {def.input.map((v, i) => {
                const required = v.indexOf("?") === -1;
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
          {def.args && def.args.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.args")}</h4>
              </Divider>
              {def.args.map((v, i) => {
                const required = v.type.indexOf("?") === -1;
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
          {def.output && def.output.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.outputVariable")}</h4>
              </Divider>
              {def.output.map((v, i) => {
                const required = v.indexOf("?") === -1;
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
      style={{ height: "100%", width: "360px", borderLeft: `1px solid var(--b3-color-border)` }}
    >
      {isEditingNodeDef && <NodeDefInspector />}
      {isEditingTree && <TreeInspector />}
      {isEditingNode && <NodeInspector />}
    </Flex>
  );
};

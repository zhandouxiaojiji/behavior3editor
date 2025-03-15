import { EditOutlined, MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
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
import { useDebounceCallback } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";
import { EditNode, EditTree, useWorkspace } from "../contexts/workspace-context";
import {
  isBoolType,
  isEnumType,
  isExprType,
  isFloatType,
  isIntType,
  isJsonType,
  isStringType,
  NodeModel,
  TreeGraphData,
} from "../misc/b3type";
import {
  checkNodeArgValue,
  checkOneof,
  getNodeArgRawType,
  isNodeArgArray,
  isNodeArgOptional,
  isValidVariableName,
  isVariadic,
} from "../misc/b3util";
import { Hotkey, isMacos } from "../misc/keys";
import { mergeClassNames } from "../misc/util";

interface OptionType extends DefaultOptionType {
  value: string;
}

const TreeInspector: FC = () => {
  const workspace = useWorkspace(
    useShallow((state) => ({
      editing: state.editing,
      editingTree: state.editingTree!,
    }))
  );
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // set form values
  useEffect(() => {
    const data = workspace.editingTree.data;
    form.resetFields();
    form.setFieldValue("name", data.name);
    form.setFieldValue("desc", data.desc);
    form.setFieldValue("export", data.export !== false);
    form.setFieldValue("firstid", data.firstid);
  }, [workspace.editingTree]);

  const finish = (values: any) => {
    workspace.editing?.dispatch("updateTree", {
      data: {
        name: values.name,
        desc: values.desc || undefined,
        export: values.export,
        firstid: Number(values.firstid),
      },
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
        <Form form={form} labelCol={{ span: 8 }} onFinish={finish}>
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
          if (v && !options.find((option) => option.value === v)) {
            options.push({ label: `${v}(${desc})`, value: v });
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
  const def = workspace.nodeDefs.get(editingNode.data.name);
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
          <Form.Item name="type" label={t("node.type")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="children" label={t("node.children")}>
            <Input
              style={{ borderColor: editingNode.limit_error ? "red" : undefined }}
              disabled={true}
            />
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
                                {t("node.input.add")}
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
                        { required, message: t("node.fileRequired", { field: desc }) },
                        ({ getFieldValue, setFieldValue, isFieldValidating, validateFields }) => ({
                          validator(_, value) {
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
                          return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
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
                                      message: t("node.fileRequired", { field: arg.desc }),
                                    },
                                    () => ({
                                      validator(_, value) {
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
                                {t("node.args.add")}
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
                        { required, message: t("node.fileRequired", { field: arg.desc }) },
                        ({ getFieldValue, setFieldValue, isFieldValidating, validateFields }) => ({
                          validator(_, value) {
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
                                {t("node.output.add")}
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
                        { required, message: t("node.fileRequired", { field: desc }) },
                        {
                          validator(_, value) {
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

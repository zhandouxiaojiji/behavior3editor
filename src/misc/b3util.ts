import { useWorkspace } from "@/contexts/workspace-context";
import { NodeArg, NodeArgType, NodeModel, TreeGraphData, TreeModel } from "@/misc/b3type";
import * as fs from "fs";
import { message } from "./hooks";
import Path from "./path";
import { zhNodeDef } from "./template";

export const isSubtreeRoot = (data: TreeGraphData) => {
  return data.path && data.id.toString() !== "1";
};

export const isSubtreeUpdated = (data: TreeGraphData) => {
  if (data.path) {
    try {
      const subtreePath = useWorkspace.getState().workdir + "/" + data.path;
      if (fs.statSync(subtreePath).mtimeMs !== data.lastModified) {
        return true;
      }
    } catch (error) {
      return true;
    }
  }
  if (data.children) {
    for (const child of data.children) {
      if (isSubtreeUpdated(child)) {
        return true;
      }
    }
  }
  return false;
};

export const isNodeEqual = (node1: NodeModel, node2: NodeModel) => {
  if (
    node1.name === node2.name &&
    node1.desc === node2.desc &&
    node1.path === node2.path &&
    node1.debug === node2.debug &&
    node1.disabled === node2.disabled
  ) {
    const def = useWorkspace.getState().getNodeDef(node1.name);

    for (const arg of def.args ?? []) {
      if (node1.args?.[arg.name] !== node2.args?.[arg.name]) {
        return false;
      }
    }

    if (def.input?.length) {
      for (let i = 0; i < def.input.length; i++) {
        if (node1.input?.[i] !== node2.input?.[i]) {
          return false;
        }
      }
    }

    if (def.output?.length) {
      for (let i = 0; i < def.output.length; i++) {
        if (node1.output?.[i] !== node2.output?.[i]) {
          return false;
        }
      }
    }

    return true;
  }
  return false;
};

const error = (data: NodeModel, msg: string) => {
  console.error(`check ${data.id}|${data.name}: ${msg}`);
};

export const checkNodeData = (data: NodeModel | null | undefined) => {
  if (!data) {
    return false;
  }
  let hasError = false;
  const conf = useWorkspace.getState().getNodeDef(data.name);
  if (conf.children !== undefined && conf.children != -1) {
    const count = data.children?.length || 0;
    if (conf.children !== count) {
      hasError = true;
      error(data, `expect ${conf.children} children, but got ${count}`);
    }
  }
  if (conf.input) {
    for (let i = 0; i < conf.input.length; i++) {
      if (!data.input) {
        data.input = [];
      }
      if (!data.input[i]) {
        data.input[i] = "";
      }
      if (conf.input[i].indexOf("?") === -1 && !data.input[i]) {
        error(data, `intput field '${conf.input[i]}' is required`);
        hasError = true;
      }
    }
  }
  if (data.input) {
    data.input.length = conf.input?.length || 0;
  }
  if (conf.output) {
    for (let i = 0; i < conf.output.length; i++) {
      if (!data.output) {
        data.output = [];
      }
      if (!data.output[i]) {
        data.output[i] = "";
      }
      if (conf.output[i].indexOf("?") === -1 && !data.output[i]) {
        error(data, `output field '${conf.output[i]}' is required`);
        hasError = true;
      }
    }
  }
  if (data.output) {
    data.output.length = conf.output?.length || 0;
  }
  if (conf.args) {
    for (let i = 0; i < conf.args.length; i++) {
      const arg = conf.args[i] as NodeArg;
      const type = arg.type.replace("?", "") as NodeArgType;
      const value = data.args?.[arg.name];
      if (type === "float") {
        const isNumber = typeof value === "number";
        const isOptional = value === undefined && arg.type === "float?";
        if (!(isNumber || isOptional)) {
          error(data, `'${arg.name}=${value}' is not a number`);
          hasError = true;
        }
      } else if (type === "int") {
        const isInt = typeof value === "number" && value === Math.floor(value);
        const isOptional = value === undefined && arg.type === "int?";
        if (!(isInt || isOptional)) {
          error(data, `'${arg.name}=${value}' is not a int`);
          hasError = true;
        }
      } else if (type === "string") {
        const isString = typeof value === "string" && value;
        const isOptional = (value === undefined || value === "") && arg.type === "string?";
        if (!(isString || isOptional)) {
          error(data, `'${arg.name}=${value}' is not a string`);
          hasError = true;
        }
      } else if (type === "enum") {
        const isEnum = !!arg.options?.find((option) => option.value === value);
        const isOptional = value === undefined && arg.type === "enum?";
        if (!(isEnum || isOptional)) {
          error(data, `'${arg.name}=${value}' is not a one of the option values`);
          hasError = true;
        }
      } else if (type == "code") {
        const isCode = typeof value === "string" && value;
        const isOptional = (value === undefined || value === "") && arg.type === "code?";
        if (!(isCode || isOptional)) {
          error(data, `'${arg.name}=${value}' is not a string`);
          hasError = true;
        }
      } else if (type == "json") {
        const isJson = value !== undefined && value !== null && value !== "";
        const isOptional = arg.type === "json?";
        if (!(isJson || isOptional)) {
          error(data, `'${arg.name}=${value}' is not an invalid object`);
          hasError = true;
        }
      }
      if (arg.oneof !== undefined) {
        const idx = conf.input?.findIndex((v) => v.startsWith(arg.oneof!)) ?? -1;
        const inputValue = data.input?.[idx] ?? "";
        const argValue = data.args?.[arg.name] ?? "";
        if ((inputValue !== "" && argValue !== "") || (inputValue === "" && argValue === "")) {
          error(
            data,
            `only one is allowed for between argument '${arg.name}' and input '${data.input?.[idx]}'`
          );
          return false;
        }
      }
    }
  }

  if (data.children) {
    for (const child of data.children) {
      if (!checkNodeData(child)) {
        hasError = true;
      }
    }
  } else {
    data.children = [];
  }

  return !hasError;
};

export const copyFromNode = (data: TreeGraphData, node: NodeModel) => {
  data.name = node.name;
  data.debug = node.debug;
  data.disabled = node.disabled;
  data.desc = node.desc;
  data.path = node.path;
  data.args = node.args;
  data.input = node.input;
  data.output = node.output;
};

const parsingStack: string[] = [];

export const createNode = (data: TreeGraphData, includeChildren: boolean = true) => {
  const node: NodeModel = {
    id: Number(data.id),
    name: data.name,
    desc: data.desc,
    path: data.path,
    debug: data.debug,
    disabled: data.disabled,
  };
  if (data.input) {
    node.input = [];
    for (const v of data.input) {
      node.input.push(v ?? "");
    }
  }
  if (data.output) {
    node.output = [];
    for (const v of data.output) {
      node.output.push(v ?? "");
    }
  }
  if (data.args) {
    node.args = {};
    for (const k in data.args) {
      const v = data.args[k];
      if (v !== null && v !== undefined) {
        node.args[k] = v;
      }
    }
  }
  if (data.children && !isSubtreeRoot(data) && includeChildren) {
    node.children = [];
    for (const child of data.children) {
      node.children.push(createNode(child));
    }
  }
  return node;
};

const enum StatusFlag {
  SUCCESS = 2,
  FAILURE = 1,
  RUNNING = 0,
  SUCCESS_ZERO = 5,
  FAILURE_ZERO = 4,
}

const toStatusFlag = (data: TreeGraphData) => {
  let status = 0;
  data.def.status?.forEach((s) => {
    switch (s) {
      case "success":
        status |= 1 << StatusFlag.SUCCESS;
        break;
      case "failure":
        status |= 1 << StatusFlag.FAILURE;
        break;
      case "running":
        status |= 1 << StatusFlag.RUNNING;
        break;
    }
  });
  return status;
};

const appendStatusFlag = (status: number, childStatus: number) => {
  const childSuccess = (childStatus >> StatusFlag.SUCCESS) & 1;
  const childFailure = (childStatus >> StatusFlag.FAILURE) & 1;
  if (childSuccess == 0) {
    status |= 1 << StatusFlag.SUCCESS_ZERO;
  }
  if (childFailure == 0) {
    status |= 1 << StatusFlag.FAILURE_ZERO;
  }
  status |= childStatus;
  return status;
};

const buildStatusFlag = (data: TreeGraphData, childStatus: number) => {
  let status = data.status!;
  if (data.def.status?.length) {
    const childSuccess = (childStatus >> StatusFlag.SUCCESS) & 1;
    const childFailure = (childStatus >> StatusFlag.FAILURE) & 1;
    const childRunning = (childStatus >> StatusFlag.RUNNING) & 1;
    const childHasZeroSuccess = (childStatus >> StatusFlag.SUCCESS_ZERO) & 1;
    const childHasZeroFailure = (childStatus >> StatusFlag.FAILURE_ZERO) & 1;
    data.def.status?.forEach((s) => {
      switch (s) {
        case "!success":
          status |= childFailure << StatusFlag.SUCCESS;
          break;
        case "!failure":
          status |= childSuccess << StatusFlag.FAILURE;
          break;
        case "|success":
          status |= childSuccess << StatusFlag.SUCCESS;
          break;
        case "|failure":
          status |= childFailure << StatusFlag.FAILURE;
          break;
        case "|running":
          status |= childRunning << StatusFlag.RUNNING;
          break;
        case "&success":
          if (childHasZeroSuccess) {
            status &= ~(1 << StatusFlag.SUCCESS);
          } else {
            status |= childSuccess << StatusFlag.SUCCESS;
          }
          break;
        case "&failure":
          if (childHasZeroFailure) {
            status &= ~(1 << StatusFlag.FAILURE);
          } else {
            status |= childFailure << StatusFlag.FAILURE;
          }
          break;
      }
    });
    data.status = status;
  } else {
    data.status = status | childStatus;
  }
};

export const refreshTreeDataId = (data: TreeGraphData, id?: number) => {
  if (!id) {
    id = 1;
  }
  const status = toStatusFlag(data);
  data.id = (id++).toString();
  data.status = status;
  if (data.children) {
    let childStatus = 0;
    data.children.forEach((child) => {
      child.parent = data.id;
      id = refreshTreeDataId(child, id);
      if (child.status && !child.disabled) {
        childStatus = appendStatusFlag(childStatus, child.status);
      }
    });
    buildStatusFlag(data, childStatus);
  }
  return id;
};

export const calcTreeDataSize = (data: TreeGraphData) => {
  let height = 50 + 2;
  const updateHeight = (obj: any) => {
    if (Array.isArray(obj) || (obj && Object.keys(obj).length > 0)) {
      const { str, line } = toBreakWord(`参数:${JSON.stringify(obj)}`, 35);
      height += 20 * line;
    }
  };
  if (data.path) {
    height += 20;
  }
  updateHeight(data.args);
  updateHeight(data.input);
  updateHeight(data.output);
  return [220, height];
};

export const checkChildrenLimit = (data: TreeGraphData) => {
  const conf = data.def;
  if (conf.children !== undefined && conf.children != -1) {
    return (data.children?.length || 0) === conf.children;
  }
  return true;
};

export const checkTreeData = (data: TreeGraphData) => {
  const conf = data.def;
  if (conf.input) {
    for (let i = 0; i < conf.input.length; i++) {
      if (conf.input[i].indexOf("?") === -1 && !data.input?.[i]) {
        return false;
      }
    }
  }
  if (conf.output) {
    for (let i = 0; i < conf.output.length; i++) {
      if (conf.output[i].indexOf("?") === -1 && !data.output?.[i]) {
        return false;
      }
    }
  }
  if (!checkChildrenLimit(data)) {
    return false;
  }
  if (conf.args) {
    for (let i = 0; i < conf.args.length; i++) {
      const arg = conf.args[i] as NodeArg;
      const type = arg.type.replace("?", "") as NodeArgType;
      const value = data.args?.[arg.name];
      if (type === "float") {
        const isNumber = typeof value === "number";
        const isOptional = value === undefined && arg.type === "float?";
        if (!(isNumber || isOptional)) {
          return false;
        }
      } else if (type === "int") {
        const isInt = typeof value === "number" && value === Math.floor(value);
        const isOptional = value === undefined && arg.type === "int?";
        if (!(isInt || isOptional)) {
          return false;
        }
      } else if (type === "string") {
        const isString = typeof value === "string" && value;
        const isOptional = (value === undefined || value === "") && arg.type === "string?";
        if (!(isString || isOptional)) {
          return false;
        }
      } else if (type === "enum") {
        const isEnum = !!arg.options?.find((option) => option.value === value);
        const isOptional = value === undefined && arg.type === "enum?";
        if (!(isEnum || isOptional)) {
          return false;
        }
      } else if (type === "code") {
        const isCode = typeof value === "string" && value;
        const isOptional = (value === undefined || value === "") && arg.type === "code?";
        if (!(isCode || isOptional)) {
          return false;
        }
      } else if (type == "json") {
        const isJson = value !== undefined && value !== null && value !== "";
        const isOptional = arg.type === "json?";
        if (!(isJson || isOptional)) {
          return false;
        }
      }
      if (arg.oneof !== undefined) {
        const idx = conf.input?.findIndex((v) => v.startsWith(arg.oneof!)) ?? -1;
        const inputValue = data.input?.[idx] ?? "";
        const argValue = data.args?.[arg.name] ?? "";
        if ((inputValue !== "" && argValue !== "") || (inputValue === "" && argValue === "")) {
          return false;
        }
      }
    }
  }

  return true;
};

export const createTreeData = (node: NodeModel, parent?: string) => {
  const workspace = useWorkspace.getState();
  let treeData: TreeGraphData = {
    id: node.id.toFixed(),
    name: node.name,
    desc: node.desc,
    args: node.args,
    input: node.input,
    output: node.output,
    debug: node.debug,
    disabled: node.disabled,
    def: workspace.getNodeDef(node.name),
    parent: parent,
  };

  treeData.size = calcTreeDataSize(treeData);

  if (!parent) {
    parsingStack.length = 0;
  }

  if (node.children) {
    treeData.children = [];
    node.children.forEach((child) => {
      treeData.children!.push(createTreeData(child, treeData.id));
    });
  } else if (node.path) {
    if (parsingStack.indexOf(node.path) >= 0) {
      treeData.path = node.path;
      treeData.size = calcTreeDataSize(treeData);
      message.error(`循环引用节点：${node.path}`, 4);
      return treeData;
    }
    parsingStack.push(node.path);
    try {
      const subtreePath = workspace.workdir + "/" + node.path;
      const str = fs.readFileSync(subtreePath, "utf8");
      treeData = createTreeData(JSON.parse(str).root, treeData.id);
      treeData.lastModified = fs.statSync(subtreePath).mtimeMs;
      treeData.path = node.path;
      treeData.debug = node.debug;
      treeData.disabled = node.disabled;
      treeData.parent = parent;
      treeData.id = node.id.toFixed();
      treeData.size = calcTreeDataSize(treeData);
    } catch (e) {
      message.error(`解析子树失败：${node.path}`);
      console.log("parse subtree:", e);
    }
    parsingStack.pop();
  }
  calcTreeDataSize(treeData);
  return treeData;
};

export const createBuildData = (path: string) => {
  try {
    const str = fs.readFileSync(path, "utf8");
    const treeModel = JSON.parse(str);
    const data = createTreeData(treeModel.root);
    refreshTreeDataId(data);
    treeModel.root = createFileData(data, true);
    return treeModel as TreeModel;
  } catch (e) {
    console.log("build error:", path, e);
  }
  return null;
};

export const createFileData = (data: TreeGraphData, includeSubtree?: boolean) => {
  const nodeData: NodeModel = {
    id: Number(data.id),
    name: data.name,
    desc: data.desc || undefined,
    args: data.args || undefined,
    input: data.input || undefined,
    output: data.output || undefined,
    debug: data.debug || undefined,
    disabled: data.disabled || undefined,
    path: data.path || undefined,
  };
  const conf = useWorkspace.getState().getNodeDef(data.name);
  if (!conf.input?.length) {
    nodeData.input = undefined;
  }
  if (!conf.output?.length) {
    nodeData.output = undefined;
  }
  if (!conf.args?.length) {
    nodeData.args = undefined;
  }

  if (data.children?.length && (includeSubtree || !isSubtreeRoot(data))) {
    nodeData.children = [];
    data.children.forEach((child) => {
      nodeData.children!.push(createFileData(child, includeSubtree));
    });
  }
  return nodeData;
};

export const createNewTree = (path: string) => {
  const tree: TreeModel = {
    name: Path.basenameWithoutExt(path),
    root: {
      id: 1,
      name: "Sequence",
    },
  };
  return tree;
};

export const isTreeFile = (path: string) => {
  return path.toLocaleLowerCase().endsWith(".json");
};

const isAsciiChar = (c: number) => {
  return (c >= 0x0001 && c <= 0x007e) || (0xff60 <= c && c <= 0xff9f);
};

const isUppercase = (c: number) => {
  return c >= 0x0041 && c <= 0x005a;
};

export const toBreakWord = (str: string, maxlen: number) => {
  const chars: string[] = [];
  let line = 1;
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    len += isAsciiChar(c) ? (isUppercase(c) ? 1.5 : 1) : 2;
    chars.push(String.fromCharCode(c));
    if (len >= maxlen && i < str.length - 1) {
      len = 0;
      line++;
      chars.push("\n");
    }
  }
  return {
    str: chars.join(""),
    line,
  };
};

export const cutWordTo = (str: string, maxlen: number) => {
  let i = 0;
  for (; i < str.length; i++) {
    const c = str.charCodeAt(i);
    maxlen -= isAsciiChar(c) ? (isUppercase(c) ? 1.5 : 1) : 2;
    if (maxlen <= 0) {
      break;
    }
  }
  return str.slice(0, i) + (i < str.length - 1 ? "..." : "");
};

export const createProject = (path: string) => {
  fs.writeFileSync(Path.dirname(path) + "/node-config.b3-setting", zhNodeDef());
  fs.writeFileSync(
    Path.dirname(path) + "/example.json",
    JSON.stringify(
      {
        name: "example",
        root: {
          id: 1,
          name: "Sequence",
          children: [
            {
              id: 2,
              name: "Log",
              args: {
                str: "hello",
              },
            },
            {
              id: 3,
              name: "Wait",
              args: {
                time: 1,
              },
            },
          ],
        },
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path,
    JSON.stringify(
      {
        nodeConf: "node-config.b3-setting",
        metadata: [],
      },
      null,
      2
    )
  );
};

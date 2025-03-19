import * as fs from "fs";
import { NodeDef } from "../behavior3/src/behavior3";
import {
  FileVarDecl,
  ImportDef,
  isBoolType,
  isEnumType,
  isExprType,
  isFloatType,
  isIntType,
  isJsonType,
  isStringType,
  NodeArg,
  NodeModel,
  TreeGraphData,
  TreeModel,
  VarDef,
  VERSION,
} from "./b3type";
import Path from "./path";
import { readJson, readTree } from "./util";

export class NodeDefs extends Map<string, NodeDef> {
  get(key: string): NodeDef {
    return super.get(key) ?? unknownNodeDef;
  }
}

export let nodeDefs: NodeDefs = new NodeDefs();
export let groupDefs: string[] = [];
export let usingGroups: Record<string, boolean> = {};
export let usingVars: Record<string, VarDef> | null = null;
export const files: Record<string, number> = {};

const parsedVarDefs: Record<string, ImportDef> = {};
const parsedExprs: Record<string, string[]> = {};
let workdir: string = "";
let alertError: (msg: string, duration?: number) => void = () => {};

const unknownNodeDef: NodeDef = {
  name: "unknown",
  desc: "",
  type: "Action",
};

export const initWorkdir = (path: string, handler: typeof alertError) => {
  workdir = path;
  alertError = handler;
  const nodeDefData = readJson(`${workdir}/node-config.b3-setting`) as NodeDef[];
  const groups: Set<string> = new Set();
  nodeDefs = new NodeDefs();
  for (const v of nodeDefData) {
    nodeDefs.set(v.name, v);

    const group = v.type.match(/\((\w+)\)/)?.[1];
    if (group) {
      v.group = group;
      groups.add(group);
    }
  }
  groupDefs = Array.from(groups);
};

export const updateUsingGroups = (group: string[]) => {
  usingGroups = {};
  for (const g of group) {
    usingGroups ??= {};
    usingGroups[g] = true;
  }
};

export const updateUsingVars = (vars: VarDef[]) => {
  usingVars = null;
  for (const v of vars) {
    usingVars ??= {};
    usingVars[v.name] = v;
  }
};

export const parseExpr = (expr: string) => {
  if (parsedExprs[expr]) {
    return parsedExprs[expr];
  }
  const result = expr
    .split(/[^a-zA-Z0-9_.]/)
    .map((v) => v.split(".")[0])
    .filter((v) => isValidVariableName(v));
  parsedExprs[expr] = result;
  return result;
};

export const isNewVersion = (version: string) => {
  const [major, minor, patch] = version.split(".").map(Number);
  const [major2, minor2, patch2] = VERSION.split(".").map(Number);
  return (
    major > major2 ||
    (major === major2 && minor > minor2) ||
    (major === major2 && minor === minor2 && patch > patch2)
  );
};

export const isValidVariableName = (name: string) => {
  return /^[a-zA-Z_]/.test(name);
};

export const isSubtreeRoot = (data: TreeGraphData) => {
  return data.path && data.id.toString() !== "1";
};

export const isNodeEqual = (node1: NodeModel, node2: NodeModel) => {
  if (
    node1.name === node2.name &&
    node1.desc === node2.desc &&
    node1.path === node2.path &&
    node1.debug === node2.debug &&
    node1.disabled === node2.disabled
  ) {
    const def = nodeDefs.get(node1.name);

    for (const arg of def.args ?? []) {
      if (node1.args?.[arg.name] !== node2.args?.[arg.name]) {
        return false;
      }
    }

    if (def.input?.length) {
      const len = Math.max(node1.input?.length ?? 0, node2.input?.length ?? 0);
      for (let i = 0; i < len; i++) {
        if (node1.input?.[i] !== node2.input?.[i]) {
          return false;
        }
      }
    }

    if (def.output?.length) {
      const len = Math.max(node1.output?.length ?? 0, node2.output?.length ?? 0);
      for (let i = 0; i < len; i++) {
        if (node1.output?.[i] !== node2.output?.[i]) {
          return false;
        }
      }
    }

    return true;
  }
  return false;
};

const error = (data: NodeModel | TreeGraphData, msg: string) => {
  console.error(`check ${data.id}|${data.name}: ${msg}`);
};

export const getNodeArgRawType = (arg: NodeArg) => {
  return arg.type.match(/^\w+/)![0] as NodeArg["type"];
};

export const isNodeArgArray = (arg: NodeArg) => {
  return arg.type.includes("[]");
};

export const isNodeArgOptional = (arg: NodeArg) => {
  return arg.type.includes("?");
};

export const checkNodeArgValue = (
  data: NodeModel | TreeGraphData,
  arg: NodeArg,
  value: unknown,
  verbose?: boolean
) => {
  let hasError = false;
  const type = getNodeArgRawType(arg);
  if (isFloatType(type)) {
    const isNumber = typeof value === "number";
    const isOptional = value === undefined && isNodeArgOptional(arg);
    if (!(isNumber || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a number`);
      }
      hasError = true;
    }
  } else if (isIntType(type)) {
    const isInt = typeof value === "number" && value === Math.floor(value);
    const isOptional = value === undefined && isNodeArgOptional(arg);
    if (!(isInt || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a int`);
      }
      hasError = true;
    }
  } else if (isStringType(type)) {
    const isString = typeof value === "string" && value;
    const isOptional = (value === undefined || value === "") && isNodeArgOptional(arg);
    if (!(isString || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a string`);
      }
      hasError = true;
    }
  } else if (isEnumType(type)) {
    const isEnum = !!arg.options?.find((option) => option.value === value);
    const isOptional = value === undefined && isNodeArgOptional(arg);
    if (!(isEnum || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a one of the option values`);
      }
      hasError = true;
    }
  } else if (isExprType(type)) {
    const isExpr = typeof value === "string" && value;
    const isOptional = (value === undefined || value === "") && isNodeArgOptional(arg);
    if (!(isExpr || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not an expr string`);
      }
      hasError = true;
    }
  } else if (isJsonType(type)) {
    const isJson = value !== undefined && value !== "";
    const isOptional = isNodeArgOptional(arg);
    if (!(isJson || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${value}' is not an invalid object`);
      }
      hasError = true;
    }
  } else if (isBoolType(type)) {
    const isBool = typeof value === "boolean" || value === undefined;
    if (!isBool) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a boolean`);
      }
      hasError = true;
    }
  } else {
    error(data, `unknown arg type '${arg.type}'`);
  }

  return !hasError;
};

export const checkNodeArg = (
  data: NodeModel | TreeGraphData,
  conf: NodeDef,
  i: number,
  verbose?: boolean
) => {
  let hasError = false;
  const arg = conf.args![i] as NodeArg;
  const value = data.args?.[arg.name];
  if (isNodeArgArray(arg)) {
    if (!Array.isArray(value) || (!isNodeArgOptional(arg) && value.length === 0)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not an array or empty array`);
      }
      hasError = true;
    } else {
      for (let j = 0; j < value.length; j++) {
        if (!checkNodeArgValue(data, arg, value[j], verbose)) {
          hasError = true;
        }
      }
    }
  } else if (!checkNodeArgValue(data, arg, value, verbose)) {
    hasError = true;
  }
  if (arg.oneof !== undefined) {
    const idx = conf.input?.findIndex((v) => v.startsWith(arg.oneof!)) ?? -1;
    if (!checkOneof(data.args?.[arg.name], data.input?.[idx])) {
      if (verbose) {
        error(
          data,
          `only one is allowed for between argument '${arg.name}' and input '${data.input?.[idx]}'`
        );
      }
      hasError = true;
    }
  }

  return !hasError;
};

export const checkOneof = (argValue: unknown, inputValue: unknown) => {
  argValue = argValue === undefined ? "" : argValue;
  inputValue = inputValue ?? "";
  return (argValue !== "" && inputValue === "") || (argValue === "" && inputValue !== "");
};

export const checkNodeData = (data: NodeModel | null | undefined) => {
  if (!data) {
    return false;
  }
  const conf = nodeDefs.get(data.name);
  if (conf.name === unknownNodeDef.name) {
    error(data, `undefined node: ${data.name}`);
    return false;
  }

  let hasError = false;

  if (conf.group) {
    if (!usingGroups[conf.group]) {
      error(data, `node group '${conf.group}' is not enabled`);
      hasError = true;
    }
  }

  if (usingVars) {
    if (data.input) {
      for (const v of data.input) {
        if (v && !usingVars[v]) {
          error(data, `input variable '${v}' is not defined`);
          hasError = true;
        }
      }
    }
    if (data.output) {
      for (const v of data.output) {
        if (v && !usingVars[v]) {
          error(data, `output variable '${v}' is not defined`);
          hasError = true;
        }
      }
    }

    if (data.args && conf.args) {
      for (const arg of conf.args) {
        if (isExprType(arg.type)) {
          for (const v of parseExpr(data.args[arg.name] ?? "")) {
            if (v && !usingVars[v]) {
              error(data, `expr variable '${arg.name}' is not defined`);
              hasError = true;
            }
          }
        }
      }
    }
  }

  if (conf.children !== undefined && conf.children !== -1) {
    const count = data.children?.length || 0;
    if (conf.children !== count) {
      hasError = true;
      error(data, `expect ${conf.children} children, but got ${count}`);
    }
  }

  let hasVaridicInput = false;
  if (conf.input) {
    for (let i = 0; i < conf.input.length; i++) {
      if (!data.input) {
        data.input = [];
      }
      if (!data.input[i]) {
        data.input[i] = "";
      }
      if (data.input[i] && !isValidVariableName(data.input[i])) {
        error(
          data,
          `input field '${data.input[i]}' is not a valid variable name,` +
            `should start with a letter or underscore`
        );
        hasError = true;
      }
      if (!isValidInputOrOutput(conf.input, data.input, i)) {
        error(data, `intput field '${conf.input[i]}' is required`);
        hasError = true;
      }
      if (i === conf.input.length - 1 && conf.input.at(-1)?.endsWith("...")) {
        hasVaridicInput = true;
      }
    }
  }
  if (data.input && !hasVaridicInput) {
    data.input.length = conf.input?.length || 0;
  }

  let hasVaridicOutput = false;
  if (conf.output) {
    for (let i = 0; i < conf.output.length; i++) {
      if (!data.output) {
        data.output = [];
      }
      if (!data.output[i]) {
        data.output[i] = "";
      }
      if (data.output[i] && !isValidVariableName(data.output[i])) {
        error(
          data,
          `output field '${data.output[i]}' is not a valid variable name,` +
            `should start with a letter or underscore`
        );
        hasError = true;
      }
      if (!isValidInputOrOutput(conf.output, data.output, i)) {
        error(data, `output field '${conf.output[i]}' is required`);
        hasError = true;
      }
      if (i === conf.output.length - 1 && conf.output.at(-1)?.endsWith("...")) {
        hasVaridicOutput = true;
      }
    }
  }
  if (data.output && !hasVaridicOutput) {
    data.output.length = conf.output?.length || 0;
  }
  if (conf.args) {
    const args: { [k: string]: unknown } = {};
    for (let i = 0; i < conf.args.length; i++) {
      const key = conf.args[i].name;
      if (data.args && data.args[key] === undefined && conf.args[i].default !== undefined) {
        data.args[key] = conf.args[i].default;
      }

      const value = data.args?.[key];
      if (value !== undefined) {
        args[key] = value;
      }

      if (!checkNodeArg(data, conf, i, true)) {
        hasError = true;
      }
    }
    data.args = args;
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
      if (v !== undefined) {
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
  if (childSuccess === 0) {
    status |= 1 << StatusFlag.SUCCESS_ZERO;
  }
  if (childFailure === 0) {
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

export const checkChildrenLimit = (data: TreeGraphData) => {
  const conf = data.def;
  if (conf.children !== undefined && conf.children !== -1) {
    return (data.children?.length || 0) === conf.children;
  }
  return true;
};

export const isVariadic = (def: string[], i: number) => {
  if (i === -1) {
    i = def.length - 1;
  }
  return def[i].endsWith("...") && i === def.length - 1;
};

const isValidInputOrOutput = (def: string[], data: string[] | undefined, index: number) => {
  return def[index].includes("?") || data?.[index] || isVariadic(def, index);
};

export const checkTreeData = (data: TreeGraphData) => {
  const conf = data.def;
  if (conf.input) {
    for (let i = 0; i < conf.input.length; i++) {
      if (!isValidInputOrOutput(conf.input, data.input, i)) {
        return false;
      }
    }
  }
  if (conf.output) {
    for (let i = 0; i < conf.output.length; i++) {
      if (!isValidInputOrOutput(conf.output, data.output, i)) {
        return false;
      }
    }
  }
  if (!checkChildrenLimit(data)) {
    return false;
  }
  if (conf.args) {
    for (let i = 0; i < conf.args.length; i++) {
      if (!checkNodeArg(data, conf, i, false)) {
        return false;
      }
    }
  }

  return true;
};

export const createTreeData = (
  node: NodeModel,
  parent?: string,
  calcSize?: (d: TreeGraphData) => number[]
) => {
  let treeData: TreeGraphData = {
    id: node.id.toFixed(),
    name: node.name,
    desc: node.desc,
    args: node.args,
    input: node.input,
    output: node.output,
    debug: node.debug,
    disabled: node.disabled,
    def: nodeDefs.get(node.name),
    parent: parent,
  };

  treeData.def.args?.forEach((arg) => {
    treeData.args ||= {};
    if (treeData.args[arg.name] === undefined && arg.default !== undefined) {
      treeData.args[arg.name] = arg.default;
    }
  });

  if (calcSize) {
    treeData.size = calcSize(treeData);
  }

  if (!parent) {
    parsingStack.length = 0;
  }

  if (node.children) {
    treeData.children = [];
    node.children.forEach((child) => {
      treeData.children!.push(createTreeData(child, treeData.id, calcSize));
    });
  } else if (node.path) {
    if (parsingStack.indexOf(node.path) >= 0) {
      treeData.path = node.path;
      if (calcSize) {
        treeData.size = calcSize(treeData);
      }
      alertError(`循环引用节点：${node.path}`, 4);
      return treeData;
    }
    parsingStack.push(node.path);
    try {
      const subtreePath = workdir + "/" + node.path;
      treeData = createTreeData(readTree(subtreePath).root, treeData.id, calcSize);
      treeData.lastModified = fs.statSync(subtreePath).mtimeMs;
      treeData.path = node.path;
      treeData.debug = node.debug;
      treeData.disabled = node.disabled;
      treeData.parent = parent;
      treeData.id = node.id.toFixed();
      if (calcSize) {
        treeData.size = calcSize(treeData);
      }
    } catch (e) {
      alertError(`解析子树失败：${node.path}`);
      console.log("parse subtree:", e);
    }
    parsingStack.pop();
  }

  return treeData;
};

export const createBuildData = (path: string) => {
  try {
    const treeModel: TreeModel = readTree(path);
    const data = createTreeData(treeModel.root);
    refreshTreeDataId(data, treeModel.firstid ?? 1);
    treeModel.name = Path.basenameWithoutExt(path);
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
  const conf = nodeDefs.get(data.name);
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
    version: VERSION,
    name: Path.basenameWithoutExt(path),
    firstid: 1,
    group: [],
    import: [],
    declvar: [],
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

export const loadVarDef = (list: ImportDef[]) => {
  for (const entry of list) {
    if (!files[entry.path]) {
      console.warn(`file not found:${workdir}/${entry.path}`);
      continue;
    }

    let changed = false;
    if (!entry.modified || files[entry.path] > entry.modified) {
      changed = true;
    }

    if (!changed) {
      changed = entry.depends.some((v) => files[v.path] && files[v.path] > v.modified);
    }

    if (!changed) {
      continue;
    }

    entry.vars = [];
    entry.depends = [];
    entry.modified = files[entry.path];

    const vars: Set<VarDef> = new Set();
    const depends: Set<string> = new Set();
    const load = (path: string) => {
      if (parsingStack.includes(path)) {
        return;
      }

      const parsedEntry: ImportDef | undefined = parsedVarDefs[path];
      if (parsedEntry && files[path] === parsedEntry.modified) {
        parsedEntry.depends.forEach((v) => depends.add(v.path));
        parsedEntry.vars.forEach((v) => vars.add(v));
        return;
      }

      parsingStack.push(path);
      try {
        const model: TreeModel = readTree(`${workdir}/${path}`);
        model.declvar.forEach((v) => vars.add(v));
        model.import.forEach((v) => {
          load(v);
          depends.add(v);
        });
        console.log(`load var: ${path}`);
      } catch (e) {
        alertError(`parsing error: ${path}`);
      }
      parsingStack.pop();
    };
    load(entry.path);
    entry.vars = Array.from(vars).sort((a, b) => a.name.localeCompare(b.name));
    entry.depends = Array.from(depends).map((v) => ({ path: v, modified: files[v] }));
    parsedVarDefs[entry.path] = {
      path: entry.path,
      vars: entry.vars.map((v) => ({ name: v.name, desc: v.desc })),
      depends: entry.depends.slice(),
      modified: entry.modified,
    };
  }
  const all: Set<VarDef> = new Set();
  list.forEach((entry) => entry.vars.forEach((v) => all.add(v)));
  return Array.from(all);
};

const findSubtrees = (data: NodeModel) => {
  const list: string[] = [];
  const traverse = (v: NodeModel) => {
    if (v.path) {
      list.push(v.path);
    }
    if (v.children) {
      v.children.forEach((child) => traverse(child));
    }
  };
  traverse(data);
  return list;
};

export const refreshDeclare = (tree: TreeModel, declare: FileVarDecl) => {
  const vars: Set<VarDef> = new Set(declare.declvar.slice());
  declare.subtree = findSubtrees(tree.root).map((v) => ({
    path: v,
    vars: [],
    depends: [],
  }));
  loadVarDef(declare.import).forEach((v) => vars.add(v));
  loadVarDef(declare.subtree).forEach((v) => {
    vars.add(v);
  });
  updateUsingGroups(tree.group);
  updateUsingVars(Array.from(vars));
};

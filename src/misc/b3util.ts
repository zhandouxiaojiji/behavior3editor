import assert from "assert";
import * as fs from "fs";
import { ExpressionEvaluator, NodeDef } from "../behavior3/src/behavior3";
import "./array";
import {
  FileVarDecl,
  hasArgOptions,
  ImportDecl,
  isBoolType,
  isExprType,
  isFloatType,
  isIntType,
  isJsonType,
  isStringType,
  NodeArg,
  NodeData,
  TreeData,
  VarDecl,
  VERSION,
} from "./b3type";
import Path from "./path";
import { readJson, readTree, readWorkspace } from "./util";

export class NodeDefs extends Map<string, NodeDef> {
  get(key: string): NodeDef {
    return super.get(key) ?? unknownNodeDef;
  }
}

type Env = {
  fs: typeof fs;
  path: typeof Path;
  workdir: string;
  nodeDefs: NodeDefs;
};

export interface BatchScript {
  onSetup?(env: Env): void;
  onProcessTree?(tree: TreeData, path: string): TreeData | null;
  onProcessNode?(node: NodeData): NodeData | null;
  onWriteFile?(path: string, tree: TreeData): void;
  onComplete?(status: "success" | "failure"): void;
}

export let calcSize: (d: NodeData) => number[] = () => [0, 0];
export let nodeDefs: NodeDefs = new NodeDefs();
export let groupDefs: string[] = [];
export let usingGroups: Record<string, boolean> | null = null;
export let usingVars: Record<string, VarDecl> | null = null;
export const files: Record<string, number> = {};

const parsedVarDecl: Record<string, ImportDecl> = {};
const parsedExprs: Record<string, string[]> = {};
let checkExpr: boolean = false;
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
    v.group?.forEach((g) => groups.add(g));
  }
  groupDefs = Array.from(groups).sort();
};

export const setSizeCalculator = (calc: (d: NodeData) => number[]) => {
  calcSize = calc;
};

export const updateUsingGroups = (group: string[]) => {
  usingGroups = null;
  for (const g of group) {
    usingGroups ??= {};
    usingGroups[g] = true;
  }
};

export const updateUsingVars = (vars: VarDecl[]) => {
  usingVars = null;
  for (const v of vars) {
    usingVars ??= {};
    usingVars[v.name] = v;
  }
};

export const setCheckExpr = (check: boolean) => {
  checkExpr = check;
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

export const dfs = <T extends { children?: T[] }>(
  node: T,
  visitor: (node: T, depth: number) => unknown,
  depth: number = 0
) => {
  const traverse = (n: T, d: number) => {
    if (visitor(n, d) === false) {
      return false;
    }
    if (n.children) {
      for (const child of n.children) {
        if (traverse(child, d + 1) === false) {
          return false;
        }
      }
    }
  };
  traverse(node, depth);
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
  return /^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(name);
};

export const isSubtreeRoot = (data: NodeData) => {
  return data.path && data.id !== "1";
};

export const isNodeEqual = (node1: NodeData, node2: NodeData) => {
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

const error = (data: NodeData, msg: string) => {
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
  data: NodeData,
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
    hasError = true;
    error(data, `unknown arg type '${arg.type}'`);
  }

  if (hasArgOptions(arg)) {
    const found = !!arg.options?.find((option) => option.value === value);
    const isOptional = value === undefined && isNodeArgOptional(arg);
    if (!(found || isOptional)) {
      if (verbose) {
        error(data, `'${arg.name}=${JSON.stringify(value)}' is not a one of the option values`);
      }
      hasError = true;
    }
  }

  return !hasError;
};

export const checkNodeArg = (data: NodeData, conf: NodeDef, i: number, verbose?: boolean) => {
  let hasError = false;
  const arg = conf.args![i] as NodeArg;
  const value = data.args?.[arg.name];
  if (isNodeArgArray(arg)) {
    if (!Array.isArray(value) || value.length === 0) {
      if (!isNodeArgOptional(arg)) {
        if (verbose) {
          error(data, `'${arg.name}=${JSON.stringify(value)}' is not an array or empty array`);
        }
        hasError = true;
      }
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
    if (!checkOneof(arg, data.args?.[arg.name], data.input?.[idx])) {
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

export const checkOneof = (arg: NodeArg, argValue: unknown, inputValue: unknown) => {
  if (isNodeArgArray(arg)) {
    if (argValue instanceof Array && argValue.length === 0) {
      argValue = undefined;
    }
  }
  argValue = argValue === undefined ? "" : argValue;
  inputValue = inputValue ?? "";
  return (argValue !== "" && inputValue === "") || (argValue === "" && inputValue !== "");
};

export const checkNodeData = (data: NodeData | null | undefined) => {
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
    if (!conf.group.some((g) => usingGroups?.[g])) {
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
  }

  if (data.args && conf.args) {
    for (const arg of conf.args) {
      const value = data.args?.[arg.name] as string | string[] | undefined;
      if (isExprType(arg.type) && value) {
        if (usingVars) {
          const vars: string[] = [];
          if (typeof value === "string") {
            vars.push(...parseExpr(value));
          } else if (Array.isArray(value)) {
            for (const v of value) {
              vars.push(...parseExpr(v));
            }
          }
          for (const v of vars) {
            if (v && !usingVars[v]) {
              error(data, `expr variable '${arg.name}' is not defined`);
              hasError = true;
            }
          }
        }
        if (checkExpr) {
          const exprs: string[] = [];
          if (typeof value === "string") {
            exprs.push(value);
          } else if (Array.isArray(value)) {
            for (const v of value) {
              exprs.push(v);
            }
          }
          for (const expr of exprs) {
            try {
              if (!new ExpressionEvaluator(expr).dryRun()) {
                error(data, `expr '${expr}' is not valid`);
                hasError = true;
              }
            } catch (e) {
              error(data, `expr '${expr}' is not valid`);
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

const parsingStack: string[] = [];

export const createNode = (data: NodeData, includeChildren: boolean = true) => {
  const node: NodeData = {
    id: data.id,
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

const toStatusFlag = (data: NodeData) => {
  let status = 0;
  const def = nodeDefs.get(data.name);
  def.status?.forEach((s) => {
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

const buildStatusFlag = (data: NodeData, childStatus: number) => {
  let status = data.status!;
  const def = nodeDefs.get(data.name);
  if (def.status?.length) {
    const childSuccess = (childStatus >> StatusFlag.SUCCESS) & 1;
    const childFailure = (childStatus >> StatusFlag.FAILURE) & 1;
    const childRunning = (childStatus >> StatusFlag.RUNNING) & 1;
    const childHasZeroSuccess = (childStatus >> StatusFlag.SUCCESS_ZERO) & 1;
    const childHasZeroFailure = (childStatus >> StatusFlag.FAILURE_ZERO) & 1;
    def.status?.forEach((s) => {
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

export const isValidChildren = (data: NodeData) => {
  const def = nodeDefs.get(data.name);
  if (def.children !== undefined && def.children !== -1) {
    return (data.children?.length || 0) === def.children;
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

export const checkTreeData = (data: NodeData) => {
  const def = nodeDefs.get(data.name);
  if (def.input) {
    for (let i = 0; i < def.input.length; i++) {
      if (!isValidInputOrOutput(def.input, data.input, i)) {
        return false;
      }
    }
  }
  if (def.output) {
    for (let i = 0; i < def.output.length; i++) {
      if (!isValidInputOrOutput(def.output, data.output, i)) {
        return false;
      }
    }
  }
  if (!isValidChildren(data)) {
    return false;
  }
  if (def.args) {
    for (let i = 0; i < def.args.length; i++) {
      if (!checkNodeArg(data, def, i, false)) {
        return false;
      }
    }
  }

  return true;
};

export const refreshNodeData = (node: NodeData, id: number) => {
  node.id = (id++).toString();
  node.size = calcSize(node);

  const def = nodeDefs.get(node.name);

  if (def.args) {
    node.args ||= {};
    def.args.forEach((arg) => {
      assert(node.args);
      if (node.args[arg.name] === undefined && arg.default !== undefined) {
        node.args[arg.name] = arg.default;
      }
    });
  }

  if (node.path) {
    if (parsingStack.indexOf(node.path) >= 0) {
      alertError(`循环引用节点：${node.path}`, 4);
      return id;
    }
    parsingStack.push(node.path);
    try {
      const subtreePath = workdir + "/" + node.path;
      const subtree = readTree(subtreePath).root;
      id = refreshNodeData(subtree, --id);
      node.name = subtree.name;
      node.desc = subtree.desc;
      node.args = subtree.args;
      node.input = subtree.input;
      node.output = subtree.output;
      node.children = subtree.children;
      node.mtime = fs.statSync(subtreePath).mtimeMs;
      node.size = calcSize(node);
    } catch (e) {
      alertError(`解析子树失败：${node.path}`);
      console.log("parse subtree:", e);
    }
    parsingStack.pop();
  } else if (node.children?.length) {
    for (let i = 0; i < node.children.length; i++) {
      id = refreshNodeData(node.children[i], id);
    }
  }

  node.status = toStatusFlag(node);
  if (node.children) {
    let childStatus = 0;
    node.children.forEach((child) => {
      if (child.status && !child.disabled) {
        childStatus = appendStatusFlag(childStatus, child.status);
      }
    });
    buildStatusFlag(node, childStatus);
  }

  return id;
};

export const createBuildData = (path: string) => {
  try {
    const treeModel: TreeData = readTree(path);
    refreshNodeData(treeModel.root, 1);
    dfs(treeModel.root, (node) => (node.id = treeModel.prefix + node.id));
    treeModel.name = Path.basenameWithoutExt(path);
    treeModel.root = createFileData(treeModel.root, true);
    return treeModel as TreeData;
  } catch (e) {
    console.log("build error:", path, e);
  }
  return null;
};

export const processBatch = (tree: TreeData | null, path: string, batch: BatchScript) => {
  if (!tree) {
    return null;
  }
  if (batch.onProcessTree) {
    tree = batch.onProcessTree(tree, path);
  }
  if (!tree) {
    return null;
  }
  if (batch.onProcessNode) {
    const processNode = (node: NodeData) => {
      if (node.children) {
        const children: NodeData[] = [];
        node.children?.forEach((child) => {
          const newChild = processNode(child);
          if (newChild) {
            children.push(newChild);
          }
        });
        node.children = children;
      }
      return batch.onProcessNode?.(node);
    };
    tree.root = processNode(tree.root) ?? ({} as NodeData);
  }
  return tree;
};

export const buildProject = async (project: string, buildDir: string) => {
  let hasError = false;
  const settings = readWorkspace(project).settings;
  let buildScript: BatchScript | undefined;
  if (settings.checkExpr) {
    setCheckExpr(true);
  }
  if (settings.buildScript) {
    const scriptPath = workdir + "/" + settings.buildScript;
    try {
      buildScript = await loadModule(scriptPath);
    } catch (e) {
      console.error(`'${scriptPath}' is not a valid build script`);
    }
  }
  if (buildScript) {
    buildScript.onSetup?.({
      fs,
      path: Path,
      workdir,
      nodeDefs,
    });
  }

  for (const path of Path.ls(Path.dirname(project), true)) {
    if (path.endsWith(".json")) {
      const buildpath = buildDir + "/" + path.substring(workdir.length + 1);
      let tree = createBuildData(path);
      if (buildScript) {
        tree = processBatch(tree, path, buildScript);
      }
      if (!tree) {
        continue;
      }
      if (tree.export === false) {
        console.log("skip:", buildpath);
        continue;
      }
      console.log("build:", buildpath);
      const declare: FileVarDecl = {
        import: tree.import.map((v) => ({ path: v, vars: [], depends: [] })),
        vars: tree.vars.map((v) => ({ name: v.name, desc: v.desc })),
        subtree: [],
      };
      refreshVarDecl(tree.root, tree.group, declare);
      if (!checkNodeData(tree?.root)) {
        hasError = true;
      }
      buildScript?.onWriteFile?.(buildpath, tree);
      fs.mkdirSync(Path.dirname(buildpath), { recursive: true });
      fs.writeFileSync(buildpath, JSON.stringify(tree, null, 2));
    }
  }
  buildScript?.onComplete?.(hasError ? "failure" : "success");
  return hasError;
};

export const loadModule = async (path: string) => {
  try {
    if (typeof require !== "undefined" && require.cache) {
      delete require.cache[require.resolve(path)];
    }
    if (process.type === "renderer") {
      return await import(/* @vite-ignore */ `${path}?t=${Date.now()}`);
    } else {
      const mjs = path.endsWith(".mjs") ? path : path.replace(".js", ".mjs");
      fs.copyFileSync(path, mjs);
      const ret = await import(/* @vite-ignore */ `file:///${mjs}?t=${Date.now()}`);
      fs.unlinkSync(mjs);
      return ret;
    }
  } catch (e) {
    console.error(`failed to load module: ${path}`, e);
    return null;
  }
};

export const createFileData = (data: NodeData, includeSubtree?: boolean) => {
  const nodeData: NodeData = {
    id: data.id,
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
  const tree: TreeData = {
    version: VERSION,
    name: Path.basenameWithoutExt(path),
    prefix: "",
    group: [],
    import: [],
    vars: [],
    root: {
      id: "1",
      name: "Sequence",
    },
  };
  return tree;
};

export const isTreeFile = (path: string) => {
  return path.toLocaleLowerCase().endsWith(".json");
};

const loadVarDecl = (list: ImportDecl[], arr: Array<VarDecl>) => {
  for (const entry of list) {
    if (!files[entry.path]) {
      console.warn(`file not found: ${workdir}/${entry.path}`);
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

    const vars: Set<VarDecl> = new Set();
    const depends: Set<string> = new Set();
    const load = (path: string) => {
      if (parsingStack.includes(path)) {
        return;
      }

      const parsedEntry: ImportDecl | undefined = parsedVarDecl[path];
      if (parsedEntry && files[path] === parsedEntry.modified) {
        parsedEntry.depends.forEach((v) => depends.add(v.path));
        parsedEntry.vars.forEach((v) => vars.add(v));
        return;
      }

      parsingStack.push(path);
      try {
        const model: TreeData = readTree(`${workdir}/${path}`);
        model.vars.forEach((v) => vars.add(v));
        model.import.forEach((v) => {
          load(v);
          depends.add(v);
        });
        console.debug(`load var: ${path}`);
      } catch (e) {
        alertError(`parsing error: ${path}`);
      }
      parsingStack.pop();
    };
    load(entry.path);
    entry.vars = Array.from(vars).sort((a, b) => a.name.localeCompare(b.name));
    entry.depends = Array.from(depends).map((v) => ({ path: v, modified: files[v] }));
    parsedVarDecl[entry.path] = {
      path: entry.path,
      vars: entry.vars.map((v) => ({ name: v.name, desc: v.desc })),
      depends: entry.depends.slice(),
      modified: entry.modified,
    };
  }
  list.forEach((entry) => arr.push(...entry.vars));
};

const collectSubtree = (data: NodeData) => {
  const list: string[] = [];
  dfs(data, (node) => {
    if (node.path) {
      list.push(node.path);
    }
  });
  return list;
};

export const refreshVarDecl = (root: NodeData, group: string[], declare: FileVarDecl) => {
  const filter: Record<string, boolean> = {};
  const vars: Array<VarDecl> = new (class extends Array {
    push(...items: VarDecl[]): number {
      for (const v of items) {
        if (filter[v.name]) {
          continue;
        }
        filter[v.name] = true;
        super.push(v);
      }
      return this.length;
    }
  })();
  vars.push(...declare.vars);
  parsingStack.length = 0;
  declare.subtree = collectSubtree(root).map((v) => ({
    path: v,
    vars: [],
    depends: [],
  }));
  loadVarDecl(declare.import, vars);
  loadVarDecl(declare.subtree, vars);

  let changed = false;
  const lastGroup = Array.from(Object.keys(usingGroups ?? {})).sort();
  group.sort();
  if (lastGroup.length !== group.length || lastGroup.some((v, i) => v !== group[i])) {
    changed = true;
    console.debug("refresh group:", lastGroup, group);
    updateUsingGroups(group);
  }

  const lastVars = Array.from(Object.keys(usingVars ?? {})).sort();
  vars.sort((a, b) => a.name.localeCompare(b.name));
  if (lastVars.length !== vars.length || lastVars.some((v, i) => v !== vars[i].name)) {
    changed = true;
    console.debug("refresh vars:", lastVars, vars);
    updateUsingVars(vars);
  }
  return changed;
};

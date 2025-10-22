import { NodeDef } from "../behavior3/src/behavior3";

export const VERSION = "1.8.7";

export const keyWords = ["true", "false", "null", "undefined", "NaN", "Infinity"];

export type NodeType = NodeDef["type"] | "Other" | "Error";
export type NodeArg = Exclude<NodeDef["args"], undefined>[number];

export const isIntType = (type: string) => type.startsWith("int");
export const isFloatType = (type: string) => type.startsWith("float");
export const isStringType = (type: string) => type.startsWith("string");
export const isBoolType = (type: string) => type.startsWith("bool");
export const isExprType = (type: string) => type.startsWith("expr") || type.startsWith("code");
export const isJsonType = (type: string) => type.startsWith("json");
export const hasArgOptions = (arg: NodeArg) => arg.options !== undefined;

export interface NodeData {
  id: string;
  name: string;
  desc?: string;
  args?: { [key: string]: unknown };
  input?: string[];
  output?: string[];
  children?: NodeData[];
  debug?: boolean;
  disabled?: boolean;
  path?: string;

  // nanoid, for override
  $id: string;

  // for runtime
  $mtime?: number;
  $size?: number[];
  $status?: number;
}

export type NodeLayout = "compact" | "normal";

export interface VarDecl {
  name: string;
  desc: string;
}

export interface GroupDecl {
  name: string;
  value: boolean;
}

export interface ImportDecl {
  path: string;
  modified?: number;
  vars: VarDecl[];
  depends: {
    path: string;
    modified: number;
  }[];
}

export interface FileVarDecl {
  import: ImportDecl[];
  subtree: ImportDecl[];
  vars: VarDecl[];
}

export interface TreeData {
  version: string;
  name: string;
  prefix: string;
  desc?: string;
  export?: boolean;
  group: string[];
  import: string[];
  vars: VarDecl[];
  custom: Record<string, string | number | boolean | object>;
  root: NodeData;

  $override: {
    [key: string]: Pick<NodeData, "desc" | "input" | "output" | "args" | "debug" | "disabled">;
  };
}

export const getNodeType = (def: NodeDef): NodeType => {
  const type = def.type.toLocaleLowerCase().toString();
  if (type.startsWith("action")) {
    return "Action";
  } else if (type.startsWith("composite")) {
    return "Composite";
  } else if (type.startsWith("decorator")) {
    return "Decorator";
  } else if (type.startsWith("condition")) {
    return "Condition";
  } else {
    return "Other";
  }
};

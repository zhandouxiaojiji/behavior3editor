import type { TreeGraphData as G6TreeGraphData } from "@antv/g6";
import { NodeDef } from "../behavior3/src/behavior3";

declare module "../behavior3/src/behavior3" {
  interface NodeDef {
    group?: string;
  }
}

export type NodeType = NodeDef["type"] | "Other" | "Error";
export type NodeArg = Exclude<NodeDef["args"], undefined>[number];

export const isIntType = (type: string) => type.startsWith("int");
export const isFloatType = (type: string) => type.startsWith("float");
export const isStringType = (type: string) => type.startsWith("string");
export const isBoolType = (type: string) => type.startsWith("bool");
export const isEnumType = (type: string) => type.startsWith("enum");
export const isExprType = (type: string) => type.startsWith("expr") || type.startsWith("code");
export const isJsonType = (type: string) => type.startsWith("json");

export interface NodeModel {
  id: number;
  name: string;
  desc?: string;
  args?: { [key: string]: any };
  input?: string[];
  output?: string[];
  children?: NodeModel[];
  debug?: boolean;
  disabled?: boolean;
  path?: string;
}

export interface VarDef {
  name: string;
  desc: string;
}

export interface GroupDef {
  name: string;
  value: boolean;
}

export interface ImportDef {
  path: string;
  date?: number;
  vars: VarDef[];
}

export interface TreeModel {
  name: string;
  desc?: string;
  export?: boolean;
  firstid: number;
  group: string[];
  import: string[];
  declvar: VarDef[];
  root: NodeModel;
}

export interface TreeGraphData extends G6TreeGraphData {
  name: string;
  desc?: string;
  args?: { [key: string]: any };
  input?: string[];
  output?: string[];
  children?: TreeGraphData[];
  def: NodeDef;
  debug?: boolean;
  disabled?: boolean;
  parent?: string;
  path?: string;
  lastModified?: number;

  size?: number[];
  highlightInput?: boolean;
  highlightOutput?: boolean;
  highlightArgs?: boolean;
  highlightGray?: boolean;
  status?: number;
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

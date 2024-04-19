import { TreeGraphData as G6TreeGraphData } from "@antv/g6";

export interface NodeArgOption {
  name: string;
  value: string | number;
}

export interface NodeArg {
  name: string;
  type: string;
  desc: string;
  default?: string;
  options?: NodeArgOption[];
}
export interface NodeDef {
  name: string;
  type: string;
  desc?: string;
  args?: NodeArg[];
  input?: string[];
  output?: string[];
  doc?: string;
  color?: string;
  icon?: string;
}

export interface NodeModel {
  id: number;
  name: string;
  desc?: string;
  args?: { [key: string]: any };
  input?: string[];
  output?: string[];
  children?: NodeModel[];
  debug?: boolean;
  path?: string;
}

export interface TreeModel {
  name: string;
  desc?: string;
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
  parent?: string;
  path?: string;
  lastModified?: number;

  size?: number[];
  highlightInput?: boolean;
  highlightOutput?: boolean;
}

export const unknownNodeDef: NodeDef = {
  name: "unknown",
  desc: "新建节点",
  type: "Action",
};

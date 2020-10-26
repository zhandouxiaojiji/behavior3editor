import { TreeGraphData } from "@antv/g6/lib/types";

export interface BehaviorNodeTypeModel {
  name: string;
  type?: string;
  desc?: string;
  args?: string[][3];
  input?: string[];
  output?: string;
  doc?: string;
}

export interface BehaviorNodeModel {
  id: number;
  name: string;
  desc?: string;
  args?: string[][3];
  input?: string[];
  output?: string;
  children?: BehaviorNodeModel[];
}

export interface BehaviorTreeModel {
  name: string;
  root: BehaviorNodeModel;
}

export interface GraphNodeModel extends TreeGraphData {
  name: string;
  desc?: string;
  args?: string[][3];
  input?: string[];
  output?: string;
  children?: GraphNodeModel[];

  size?: number[];
}
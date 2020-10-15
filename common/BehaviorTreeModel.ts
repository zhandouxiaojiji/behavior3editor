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
}

export interface BehaviorTreeModel {
  name: string;
}
import { TreeGraphData } from "@antv/g6/lib/types";

export interface ArgsDefType {
    name: string;
    type: string;
    desc: string;
}
export interface BehaviorNodeTypeModel {
    name: string;
    type?: string;
    desc?: string;
    args?: ArgsDefType[];
    input?: string[];
    output?: string[];
    doc?: string;
}

export interface BehaviorNodeModel {
    id: number;
    name: string;
    desc?: string;
    args?: { [key: string]: any };
    input?: string[];
    output?: string[];
    children?: BehaviorNodeModel[];
    debug?: boolean;
}

export interface BehaviorTreeModel {
    name: string;
    root: BehaviorNodeModel;
}

export interface GraphNodeModel extends TreeGraphData {
    name: string;
    desc?: string;
    args?: { [key: string]: any };
    input?: string[];
    output?: string[];
    children?: GraphNodeModel[];
    conf: BehaviorNodeTypeModel;
    debug?: boolean;

    size?: number[];
}

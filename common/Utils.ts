import { TreeGraphData } from "@antv/g6/lib/types"
import { Tree } from "antd";
import { BehaviorNodeModel } from "./BehaviorTreeModel";
import Settings from "../main-process/Settings";
import { remote } from "electron";

export const cloneNodeData = (nodeData: TreeGraphData) => {
  const newData: TreeGraphData = {
    id: nodeData.id + "new",
    label: nodeData.label,
  }
  return newData;
}

export const refreshNodeId = (nodeData: TreeGraphData, id?: number) => {
  if (!id) {
    id = 1;
  }
  nodeData.id = (id++).toString();
  if (nodeData.children) {
    nodeData.children.forEach(child => {
      id = refreshNodeId(child, id);
    })
  }
  return id;
}

export const createTreeData = (bNode: BehaviorNodeModel) => {
  const treeData: any = {
    id: bNode.id.toString(),
    name: bNode.name,
    desc: bNode.desc,
  }
  if (bNode.children) {
    treeData.children = [];
    bNode.children.forEach(child => {
      treeData.children.push(createTreeData(child));
    })
  }
  return treeData;
}

export const findParent = (node: TreeGraphData, id: string): TreeGraphData | null => {
  if (node.children) {
    for (let child of node.children) {
      if (child.id == id) {
        return node;
      } else {
        let parent = findParent(child, id);
        if (parent) {
          return parent;
        }
      }

    }
  }
  return null;
}

export const findFromAllChildren = (node: TreeGraphData, id: string): TreeGraphData | null => {
  if (node.id == id) {
    return node;
  }
  if (node.children) {
    for (let child of node.children) {
      let found = findFromAllChildren(child, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export const getRemoteSettings = () => {
  return remote.getGlobal("settings") as Settings;
}
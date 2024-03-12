import { message } from "antd";
import * as fs from "fs";
import * as path from "path";
import Settings from "../main-process/Settings";
import { BehaviorNodeModel, BehaviorTreeModel, GraphNodeModel } from "./BehaviorTreeModel";

interface INodeDataLike {
    path?: string;
    id: string | number;
}

export const isSubtree = (nodeData: INodeDataLike) => {
    return nodeData.path && nodeData.id.toString() !== "1";
};

const parsingStack: string[] = [];

export const cloneNodeData = (nodeData: GraphNodeModel) => {
    const newData: BehaviorNodeModel = {
        id: Number(nodeData.id),
        name: nodeData.name,
        desc: nodeData.desc,
        path: nodeData.path,
    };
    if (nodeData.input) {
        newData.input = [];
        for (let v of nodeData.input) {
            newData.input.push(v || "");
        }
    }
    if (nodeData.output) {
        newData.output = [];
        for (let v of nodeData.output) {
            newData.output.push(v || "");
        }
    }
    if (nodeData.args) {
        newData.args = {};
        for (let k in nodeData.args) {
            let v = nodeData.args[k];
            newData.args[k] = v;
        }
    }
    if (nodeData.children && !isSubtree(nodeData)) {
        newData.children = [];
        for (let child of nodeData.children) {
            newData.children.push(cloneNodeData(child));
        }
    }
    return newData;
};

export const refreshNodeId = (nodeData: GraphNodeModel, id?: number) => {
    if (!id) {
        id = 1;
    }
    nodeData.id = (id++).toString();
    if (nodeData.children) {
        nodeData.children.forEach((child) => {
            child.parent = nodeData.id;
            id = refreshNodeId(child, id);
        });
    }
    return id;
};

export const calcTreeNodeSize = (treeNode: GraphNodeModel) => {
    var height = 40 + 2;
    const updateHeight = (obj: any) => {
        if (Array.isArray(obj) || (obj && Object.keys(obj).length > 0)) {
            const { str, line } = toBreakWord(`参数:${JSON.stringify(obj)}`, 35);
            height += 20 * line;
        }
    };
    if (treeNode.path) {
        height += 20;
    }
    updateHeight(treeNode.args);
    updateHeight(treeNode.input);
    updateHeight(treeNode.output);
    return [200, height];
};

export const createTreeData = (bNode: BehaviorNodeModel, settings: Settings, parent?: string) => {
    let treeData: GraphNodeModel = {
        id: bNode.id.toString(),
        name: bNode.name,
        desc: bNode.desc,
        args: bNode.args,
        input: bNode.input,
        output: bNode.output,
        debug: bNode.debug,
        conf: settings.getNodeConf(bNode.name),
        parent: parent,
    };

    treeData.size = calcTreeNodeSize(treeData);

    if (!parent) {
        parsingStack.length = 0;
    }

    if (bNode.children) {
        treeData.children = [];
        bNode.children.forEach((child) => {
            treeData.children.push(createTreeData(child, settings, treeData.id));
        });
    } else if (bNode.path) {
        if (parsingStack.indexOf(bNode.path) >= 0) {
            treeData.path = bNode.path;
            treeData.size = calcTreeNodeSize(treeData);
            message.error(`循环引用节点：${bNode.path}`, 4);
            return treeData;
        }
        parsingStack.push(bNode.path);
        try {
            const subtreePath = settings.workdir + "/" + bNode.path;
            const str = fs.readFileSync(subtreePath, "utf8");
            treeData = createTreeData(JSON.parse(str).root, settings, treeData.id);
            treeData.path = bNode.path;
            treeData.size = calcTreeNodeSize(treeData);
        } catch (error) {
            message.error(`解析子树失败：${bNode.path}`);
            console.log("parse subtree:", error);
        }
        parsingStack.pop();
    }
    calcTreeNodeSize(treeData);
    return treeData;
};

export const createBuildData = (path: string, settings: Settings): BehaviorNodeModel | null => {
    try {
        path = settings.workdir + "/" + path;
        const str = fs.readFileSync(path, "utf8");
        let treeModel = JSON.parse(str);
        const data = createTreeData(treeModel.root, settings);
        refreshNodeId(data);
        treeModel.root = createFileData(data, true);
        return treeModel as BehaviorNodeModel;
    } catch (error) {
        console.log("build error:", path, error);
    }
    return null;
};

export const createFileData = (gNode: GraphNodeModel, includeSubtree?: boolean) => {
    const nodeData: BehaviorNodeModel = {
        id: Number(gNode.id),
        name: gNode.name,
        desc: gNode.desc || undefined,
        args: gNode.args || undefined,
        input: gNode.input || undefined,
        output: gNode.output || undefined,
        debug: gNode.debug,
        path: gNode.path,
    };
    if (gNode.children && (includeSubtree || !isSubtree(gNode))) {
        nodeData.children = [];
        gNode.children.forEach((child) => {
            nodeData.children.push(createFileData(child, includeSubtree));
        });
    }
    return nodeData;
};

export const getRemoteSettings = () => {
    return require("@electron/remote").getGlobal("settings") as Settings;
};

export const fileName2treeName = (filename: string) => {
    return path.basename(filename).slice(0, -5);
};

export const createNewTree = (filename: string) => {
    const tree: BehaviorTreeModel = {
        name: fileName2treeName(filename),
        root: {
            id: 1,
            name: "Sequence",
            desc: "新建行为树",
        },
    };
    return tree;
};

export const toBreakWord = (str: string, len: number, char = "\n") => {
    var strTemp = "";
    var line = 1;
    if (str.length <= len) {
        return { str, line };
    }
    while (str.length > len) {
        strTemp += str.substr(0, len) + char;
        str = str.substr(len, str.length);
        line++;
    }
    strTemp += str;
    return {
        str: strTemp,
        line,
    };
};

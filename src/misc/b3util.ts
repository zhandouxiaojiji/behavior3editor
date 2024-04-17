import { useWorkspace } from "@/contexts/workspace-context";
import { NodeModel, TreeGraphData, TreeModel } from "@/misc/b3type";
import * as fs from "fs";
import { message } from "./hooks";
import Path from "./path";
import i18n from "./i18n";

export const isSubtreeRoot = (data: TreeGraphData) => {
  return data.path && data.id.toString() !== "1";
};

export const isSubtreeUpdated = (data: TreeGraphData) => {
  if (data.path) {
    try {
      const subtreePath = useWorkspace.getState().workdir + "/" + data.path;
      if (fs.statSync(subtreePath).mtimeMs !== data.lastModified) {
        return true;
      }
    } catch (error) {
      return true;
    }
  }
  if (data.children) {
    for (const child of data.children) {
      if (isSubtreeUpdated(child)) {
        return true;
      }
    }
  }
  return false;
};

export const isNodeEqual = (node1: NodeModel, node2: NodeModel) => {
  if (
    node1.name === node2.name &&
    node1.desc === node2.desc &&
    node1.path === node2.path &&
    node1.debug === node2.debug
  ) {
    const def = useWorkspace.getState().getNodeDef(node1.name);

    for (const arg of def.args ?? []) {
      if (node1.args?.[arg.name] !== node2.args?.[arg.name]) {
        return false;
      }
    }

    if (def.input?.length) {
      for (let i = 0; i < def.input.length; i++) {
        if (node1.input?.[i] !== node2.input?.[i]) {
          return false;
        }
      }
    }

    if (def.output?.length) {
      for (let i = 0; i < def.output.length; i++) {
        if (node1.output?.[i] !== node2.output?.[i]) {
          return false;
        }
      }
    }

    return true;
  }
  return false;
};

export const copyFromNode = (data: TreeGraphData, node: NodeModel) => {
  data.name = node.name;
  data.debug = node.debug;
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
      if (v !== null && v !== undefined) {
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

export const refreshTreeDataId = (data: TreeGraphData, id?: number) => {
  if (!id) {
    id = 1;
  }
  data.id = (id++).toString();
  if (data.children) {
    data.children.forEach((child) => {
      child.parent = data.id;
      id = refreshTreeDataId(child, id);
    });
  }
  return id;
};

export const calcTreeDataSize = (data: TreeGraphData) => {
  let height = 40 + 2;
  const updateHeight = (obj: any) => {
    if (Array.isArray(obj) || (obj && Object.keys(obj).length > 0)) {
      const { str, line } = toBreakWord(`参数:${JSON.stringify(obj)}`, 35);
      height += 20 * line;
    }
  };
  if (data.path) {
    height += 20;
  }
  updateHeight(data.args);
  updateHeight(data.input);
  updateHeight(data.output);
  return [200, height];
};

export const createTreeData = (node: NodeModel, parent?: string) => {
  const workspace = useWorkspace.getState();
  let treeData: TreeGraphData = {
    id: node.id.toFixed(),
    name: node.name,
    desc: node.desc,
    args: node.args,
    input: node.input,
    output: node.output,
    debug: node.debug,
    def: workspace.getNodeDef(node.name),
    parent: parent,
  };

  treeData.size = calcTreeDataSize(treeData);

  if (!parent) {
    parsingStack.length = 0;
  }

  if (node.children) {
    treeData.children = [];
    node.children.forEach((child) => {
      treeData.children!.push(createTreeData(child, treeData.id));
    });
  } else if (node.path) {
    if (parsingStack.indexOf(node.path) >= 0) {
      treeData.path = node.path;
      treeData.size = calcTreeDataSize(treeData);
      message.error(`循环引用节点：${node.path}`, 4);
      return treeData;
    }
    parsingStack.push(node.path);
    try {
      const subtreePath = workspace.workdir + "/" + node.path;
      const str = fs.readFileSync(subtreePath, "utf8");
      treeData = createTreeData(JSON.parse(str).root, treeData.id);
      treeData.lastModified = fs.statSync(subtreePath).mtimeMs;
      treeData.path = node.path;
      treeData.debug = node.debug;
      treeData.size = calcTreeDataSize(treeData);
    } catch (error) {
      message.error(`解析子树失败：${node.path}`);
      console.log("parse subtree:", error);
    }
    parsingStack.pop();
  }
  calcTreeDataSize(treeData);
  return treeData;
};

export const createBuildData = (path: string) => {
  try {
    const str = fs.readFileSync(path, "utf8");
    const treeModel = JSON.parse(str);
    const data = createTreeData(treeModel.root);
    refreshTreeDataId(data);
    treeModel.root = createFileData(data, true);
    return treeModel as NodeModel;
  } catch (error) {
    console.log("build error:", path, error);
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
    path: data.path || undefined,
  };
  if (data.children?.length && (includeSubtree || !isSubtreeRoot(data))) {
    nodeData.children = [];
    data.children.forEach((child) => {
      nodeData.children!.push(createFileData(child, includeSubtree));
    });
  }
  return nodeData;
};

export const createNewTree = (filename: string) => {
  const tree: TreeModel = {
    name: Path.basenameWithoutExt(filename),
    root: {
      id: 1,
      name: "Sequence",
    },
  };
  return tree;
};

export const toBreakWord = (str: string, len: number, char = "\n") => {
  let strTemp = "";
  let line = 1;
  if (str.length <= len) {
    return { str, line };
  }
  while (str.length > len) {
    strTemp += str.slice(0, len) + char;
    str = str.slice(len, str.length);
    line++;
  }
  strTemp += str;
  return {
    str: strTemp,
    line,
  };
};

export const createProject = (path: string) => {
  fs.writeFileSync(
    Path.dirname(path) + "/node-config.b3-setting",
    JSON.stringify(
      [
        {
          name: "AlwaysFail",
          type: "Decorator",
          desc: i18n.t("node.alwaysFail.desc"),
          doc: i18n.t("node.alwaysFail.doc"),
        },
        {
          name: "AlwaysSuccess",
          type: "Decorator",
          desc: i18n.t("node.alwaysSuccess.desc"),
          doc: i18n.t("node.alwaysSuccess.doc"),
        },
        {
          name: "Check",
          type: "Condition",
          desc: i18n.t("node.check.desc"),
          args: [
            {
              name: "value",
              type: "code",
              desc: i18n.t("node.check.arg1.desc"),
            },
          ],
          doc: i18n.t("node.check.doc"),
        },
        {
          name: "Clear",
          type: "Action",
          desc: i18n.t("node.clear.desc"),
          output: [i18n.t("node.clear.output1")],
        },
        {
          name: "ForEach",
          type: "Composite",
          desc: i18n.t("node.forEach.desc"),
          input: [i18n.t("node.forEach.input1")],
          output: [i18n.t("node.forEach.output1")],
          doc: i18n.t("node.forEach.doc"),
        },
        {
          name: "GetTime",
          type: "Action",
          desc: i18n.t("node.getTime.desc"),
          output: [i18n.t("node.getTime.output1")],
        },
        {
          name: "IsNull",
          type: "Condition",
          desc: i18n.t("node.isNull.desc"),
          input: [i18n.t("node.isNull.input1")],
        },
        {
          name: "Log",
          type: "Action",
          desc: i18n.t("node.log.desc"),
          args: [
            {
              name: "message",
              type: "string",
              desc: i18n.t("node.log.arg1.desc"),
            },
          ],
        },
        {
          name: "Loop",
          type: "Composite",
          desc: i18n.t("node.loop.desc"),
          args: [
            {
              name: "count",
              type: "int?",
              desc: i18n.t("node.loop.arg1.desc"),
            },
          ],
          input: [i18n.t("node.loop.input1") + "?"],
        },
        {
          name: "Not",
          type: "Decorator",
          desc: i18n.t("node.not.desc"),
          doc: i18n.t("node.not.doc"),
        },
        {
          name: "NotNull",
          type: "Condition",
          desc: i18n.t("node.notNull.desc"),
          input: [i18n.t("node.notNull.input")],
        },
        {
          name: "Once",
          type: "Composite",
          desc: i18n.t("node.once.desc"),
          doc: i18n.t("node.once.doc"),
        },
        {
          name: "Parallel",
          type: "Composite",
          desc: i18n.t("node.parallel.desc"),
          doc: i18n.t("node.parallel.doc"),
        },
        {
          name: "Selector",
          type: "Composite",
          desc: i18n.t("node.selector.desc"),
          doc: i18n.t("node.selector.doc"),
        },
        {
          name: "Sequence",
          type: "Composite",
          desc: i18n.t("node.sequence.desc"),
          doc: i18n.t("node.sequence.doc"),
        },
        {
          name: "Wait",
          type: "Action",
          desc: i18n.t("node.wait.desc"),
          args: [
            {
              name: "time",
              type: "float",
              desc: i18n.t("node.wait.arg1.desc"),
            },
          ],
        },
      ],
      null,
      2
    )
  );
  fs.writeFileSync(
    Path.dirname(path) + "/example.json",
    JSON.stringify(
      {
        name: "example",
        root: {
          id: 1,
          name: "Sequence",
          children: [
            {
              id: 2,
              name: "Log",
              args: {
                str: "hello",
              },
            },
            {
              id: 3,
              name: "Wait",
              args: {
                time: 1,
              },
            },
          ],
        },
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path,
    JSON.stringify(
      {
        nodeConf: "node-config.b3-setting",
        metadata: [],
      },
      null,
      2
    )
  );
};

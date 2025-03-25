/* 批处理脚本 */
/* 
  如果有processTree，则先运行prcessTree，如果有返回，则进行后面的针对每个节点运行processNode
  如果没有定义processTree，则直接针对每个节点运行processNode

  export interface TreeModel {
    version: string;
    name: string;
    desc?: string;
    export?: boolean;
    firstid: number;
    group: string[];
    import: string[];
    declvar: VarDef[];
    root: NodeModel;
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
    disabled?: boolean;
    path?: string;
  }

  interface BatchScript {
    onSetup?(env: Env): void;
    onProcessTree?(tree: TreeModel, path: string): TreeModel | null;
    onProcessNode?(node: NodeModel, tree: TreeModel): NodeModel | null;
    onWriteFile?(path: string, tree: TreeModel): void;
    onComplete?(status: "success" | "failure"): void;
  }
*/
export const onSetup = (env) => {
  console.log("onSetup", env);
  console.log(env.workdir);
  console.log(env.nodeDefs.get("Wait"));
  console.log(env.path.dirname("sample/scripts/build.js"));
  console.log(env.fs.readFileSync("sample/scripts/build.js", "utf8"));
};

export const onProcessTree = (tree) => {
  console.log(`processTree ${tree.name}`);
  return tree;
};

export const onProcessNode = (node, tree) => {
  console.log(`processNode ${tree.name} ${node.name}#${node.id}`);
  return node;
};

export const onComplete = (status) => {
  console.log(`onComplete ${status}`);
};

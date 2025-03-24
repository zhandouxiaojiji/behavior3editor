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
    processTree?(tree: TreeModel, path: string): TreeModel | null;
    processNode?(node: NodeModel, tree: TreeModel): NodeModel | null;
    onWriteFile?(path: string, tree: TreeModel): void;
    onComplete?(status: "success" | "failure"): void;
  }
*/
({
  processTree: (tree) => {
    console.log(`processTree ${tree.name}`);
    if (tree.name == "hero") {
      return tree;
    }
  },
  processNode: (node, tree) => {
    console.log(`processNode ${tree.name}.${node.id}`);
    if (node.name == "GetPos") {
      return null;
    }
    return node;
  },
});

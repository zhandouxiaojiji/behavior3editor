import { Context, Node, NodeDef } from "@/behavior3/src/behavior3";
import { DeepReadonly } from "../behavior3/src/behavior3/context";

class NodeContext extends Context {
  loadTree(path: string): Promise<Node> {
    throw new Error("Method not implemented.");
  }
}

export const zhNodeDef = () => {
  const context = new (class extends Context {
    loadTree(path: string): Promise<Node> {
      throw new Error("Method not implemented.");
    }
  })();
  const defs: DeepReadonly<NodeDef>[] = [];
  for (const k in context.nodeDefs) {
    const descriptor = context.nodeDefs[k];
    defs.push(descriptor);
  }
  defs.sort((a, b) => a.name.localeCompare(b.name));
  let str = JSON.stringify(defs, null, 2);
  str = str.replace(/"doc": "\\n +/g, '"doc": "');
  str = str.replace(/\\n +/g, "\\n");
  return str;
};

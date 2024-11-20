import { Context, NodeDef } from "@/behavior3/src/behavior3";

export const zhNodeDef = () => {
  const context = new Context();
  const defs: NodeDef[] = [];
  for (const v of context.processResolvers.values()) {
    const descriptor = v.descriptor;
    defs.push(descriptor);
  }
  defs.sort((a, b) => a.name.localeCompare(b.name));
  let str = JSON.stringify(defs, null, 2);
  str = str.replace(/"doc": "\\n +/g, '"doc": "');
  str = str.replace(/\\n +/g, "\\n");
  return str;
};

import * as fs from "fs";
import { customAlphabet } from "nanoid";
import { type WorkspaceModel } from "../contexts/workspace-context";
import { VERSION, type TreeData } from "./b3type";
import { dfs } from "./b3util";
import Path from "./path";

export const nanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  10
);

export const readJson = <T>(path: string): T => {
  const str = fs.readFileSync(path, "utf-8");
  return JSON.parse(str);
};

export const writeJson = <T>(path: string, data: T) => {
  const str = JSON.stringify(data, undefined, 2);
  fs.writeFileSync(path, str, "utf-8");
};

export const readWorkspace = (path: string) => {
  const data = readJson(path) as WorkspaceModel;
  data.settings = data.settings ?? {};
  return data;
};

export const readTree = (path: string) => {
  const data = readJson(path) as TreeData;
  data.version = data.version ?? VERSION;
  data.prefix = data.prefix ?? "";
  data.group = data.group || [];
  data.import = data.import || [];
  data.vars = data.vars || [];
  data.root = data.root || {};

  // compatible with old version
  dfs(data.root, (node) => {
    node.id = node.id.toString();
    if (!node.$id) {
      node.$id = nanoid();
    }
  });

  return data;
};

export const writeTree = (path: string, data: TreeData) => {
  writeJson<TreeData>(path, {
    version: VERSION,
    name: Path.basenameWithoutExt(path),
    desc: data.desc,
    prefix: data.prefix,
    export: data.export,
    group: data.group,
    import: data.import,
    vars: data.vars,
    root: data.root,
    $override: data.$override,
  });
};

export function mergeClassNames(...cls: (string | boolean)[]): string {
  return cls.filter((v) => !!v).join(" ");
}

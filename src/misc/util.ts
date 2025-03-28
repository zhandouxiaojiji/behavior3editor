import * as fs from "fs";
import { type WorkspaceModel } from "../contexts/workspace-context";
import { VERSION, type TreeModel } from "./b3type";

export const readJson = <T>(path: string): T => {
  const str = fs.readFileSync(path, "utf-8");
  return JSON.parse(str);
};

export const readWorkspace = (path: string) => {
  const data = readJson(path) as WorkspaceModel;
  data.settings = data.settings ?? {};
  return data;
};

export const readTree = (path: string) => {
  const data = readJson(path) as TreeModel;
  data.version = data.version ?? VERSION;
  data.firstid = data.firstid ?? 1;
  data.group = data.group || [];
  data.import = data.import || [];
  data.declvar = data.declvar || [];
  data.root = data.root || {};
  return data;
};

export const writeTree = (path: string, data: TreeModel) => {
  writeJson(path, {
    version: VERSION,
    name: data.name,
    desc: data.desc,
    firstid: data.firstid,
    export: data.export,
    group: data.group,
    import: data.import,
    declvar: data.declvar,
    root: data.root,
  });
};

export const writeJson = (path: string, data: unknown) => {
  const str = JSON.stringify(data, undefined, 2);
  fs.writeFileSync(path, str, "utf-8");
};

export function mergeClassNames(...cls: (string | boolean)[]): string {
  return cls.filter((v) => !!v).join(" ");
}

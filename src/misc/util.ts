import * as fs from "fs";
import { VERSION, type TreeModel } from "./b3type";

export const readJson = (path: string) => {
  const str = fs.readFileSync(path, "utf-8");
  return JSON.parse(str);
};

export const readTree = (path: string) => {
  const str = fs.readFileSync(path, "utf-8");
  const data = JSON.parse(str) as TreeModel;
  data.version = data.version ?? VERSION;
  data.firstid = data.firstid ?? 1;
  data.group = data.group || [];
  data.import = data.import || [];
  data.declvar = data.declvar || [];
  return data;
};

export const writeJson = (path: string, data: any) => {
  const str = JSON.stringify(data, undefined, 2);
  fs.writeFileSync(path, str, "utf-8");
};

export function mergeClassNames(...cls: (string | boolean)[]): string {
  return cls.filter((v) => !!v).join(" ");
}

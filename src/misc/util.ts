import * as fs from "fs";
import type { TreeModel } from "./b3type";

export const readJson = (path: string) => {
  const str = fs.readFileSync(path, "utf-8");
  return JSON.parse(str);
};

export const readTree = (path: string) => {
  const str = fs.readFileSync(path, "utf-8");
  return JSON.parse(str) as TreeModel;
};

export const writeJson = (path: string, data: any) => {
  const str = JSON.stringify(data, undefined, 2);
  fs.writeFileSync(path, str, "utf-8");
};

export function mergeClassNames(...cls: (string | boolean)[]): string {
  return cls.filter((v) => !!v).join(" ");
}

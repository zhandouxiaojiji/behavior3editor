import * as fs from "fs";

export const readJson = (path: string) => {
  const str = fs.readFileSync(path, "utf-8");
  return JSON.parse(str);
};

export const writeJson = (path: string, data: any) => {
  const str = JSON.stringify(data, undefined, 2);
  fs.writeFileSync(path, str, "utf-8");
};

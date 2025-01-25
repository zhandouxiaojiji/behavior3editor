import * as fs from "fs";
import path from "path";

const Path = path;

declare module "path" {
  interface PlatformPath {
    basenameWithoutExt(path: string): string;
    posixPath(path: string): string;
    ls(path: string, recursive?: boolean): string[];
  }
}

path.basenameWithoutExt = (str: string) => {
  return Path.basename(str, Path.extname(str));
};

path.posixPath = (str: string) => {
  return path.normalize(str).replace(/\\/g, "/");
};

const readdir = (dir: string, recursive: boolean, callback: (file: string) => void) => {
  fs.readdirSync(dir).forEach((file) => {
    file = Path.posixPath(dir + "/" + file);
    callback(file);
    if (recursive && fs.statSync(file).isDirectory()) {
      readdir(file, recursive, callback);
    }
  });
};

path.ls = (dir: string, recursive?: boolean) => {
  const paths: string[] = [];
  readdir(dir, recursive ?? false, (file) => paths.push(file));
  return paths.sort();
};

export default Path;

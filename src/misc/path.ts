import path from "path";

const Path = path;

declare module "path" {
  interface PlatformPath {
    basenameWithoutExt(path: string): string;
    posixPath(path: string): string;
  }
}

path.basenameWithoutExt = (str: string) => {
  return Path.basename(str, Path.extname(str));
};

path.posixPath = (str: string) => {
  return path.normalize(str).replace(/\\/g, "/");
};

export default Path;

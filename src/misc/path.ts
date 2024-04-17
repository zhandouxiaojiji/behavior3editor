import path from "path";

const Path = path;

declare module "path" {
  interface PlatformPath {
    basenameWithoutExt(path: string): string;
  }
}

// eslint-disable-next-line @typescript-eslint/no-shadow
path.basenameWithoutExt = (path: string) => {
  return Path.basename(path, Path.extname(path));
};

export default Path;

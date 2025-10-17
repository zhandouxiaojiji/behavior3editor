import * as fs from "node:fs";
import { basename, dirname, extname } from "node:path";

export type Tag = {
  /** data name */
  ["!name"]?: string;
  /** type tag */
  ["!type"]?: string;
  /** special stringify function */
  ["!stringify"]?: (v: TValue, ctx: StringifyContext) => void;
  /** ignore fields when stringify */
  ["!ignore"]?: { [k: string]: boolean };
};

export type TValue = boolean | number | string | null | undefined | TObject | TArray;
export type TObject = { [k: string | number]: TValue } & Tag;
export type TArray = TValue[] & Tag;

export class StringBuffer {
  readonly data: string[] = [];

  private _indent: number;
  private _indentCount: number = 0;

  constructor(indent: number) {
    this._indent = indent;
  }

  get indentCount() {
    return this._indentCount;
  }

  indent() {
    this._indentCount += this._indent;
  }

  unindent() {
    this._indentCount -= this._indent;
  }

  padding() {
    if (this._indent > 0) {
      this.data.push(" ".repeat(this._indentCount));
    }
  }

  linefeed() {
    if (this._indent > 0) {
      this.data.push("\n");
    }
  }

  writeLine(value: string) {
    this.padding();
    this.data.push(value);
    this.linefeed();
  }

  writeLines(value: string) {
    for (const line of value.split("\n")) {
      this.writeLine(line);
    }
  }

  writeString(value: string) {
    this.data.push(value);
  }

  toString() {
    return this.data.join("");
  }
}

export const isNumericKey = (key: string) => {
  if (typeof key !== "string") return false;

  // integer or bigint
  if (/^-?\d+$/.test(key)) {
    try {
      return String(BigInt(key)) === key;
    } catch {
      return false;
    }
  }

  // float
  const num = Number(key);
  return !isNaN(num) && String(num) === key;
};

export const escape = (value: string) => {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t")
    .replaceAll("\r", "\\r")
    .replaceAll("\b", "\\b")
    .replaceAll("\f", "\\f");
};

export const outdent = (value: string) => {
  value = value.replace(/^\n/, "");
  value = value.replace(/\n *$/, "");
  const space = value.match(/^ +/gm)?.[0];
  return space ? value.replace(new RegExp(`^${space}`, "gm"), "") : value;
};

export const format = (str: string, vars: Record<string, string>) => {
  const lines: string[] = [];
  for (const line of str.split(/\n|\r\n/)) {
    if (line.match(/^\s*%{\w+}\s*$/)) {
      const [_, space, key] = line.match(/^(\s*)%{(\w+)}$/)!;
      if (vars[key] !== undefined && vars[key] !== null) {
        for (const l of vars[key].split(/\n|\r\n/)) {
          lines.push(space + l);
        }
      } else {
        throw new Error(`variable '${key}' not found`);
      }
    } else {
      lines.push(
        line.replaceAll(/%{(\w+)}/g, (_, key) => {
          if (vars[key] !== undefined && vars[key] !== null) {
            return vars[key];
          }
          throw new Error(`variable '${key}' not found`);
        })
      );
    }
  }
  return lines.join("\n");
};

export const keys = (
  o: object,
  filter?: (v: TValue) => boolean,
  ignore?: { [k: string]: boolean }
) => {
  const value = o as TObject;
  const ks = Object.keys(value).filter(
    (k) => !k.startsWith("!") && (!ignore || !ignore[k]) && (!filter || filter(value[k]))
  );

  const numKeys: string[] = [];
  const strKeys: string[] = [];
  for (const k of ks) {
    const num = Number(k);
    if (!isNaN(num) && isFinite(num)) {
      numKeys.push(k);
    } else {
      strKeys.push(k);
    }
  }
  numKeys.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  strKeys.sort((a, b) => a.localeCompare(b));
  return [...numKeys, ...strKeys];
};

export const values = <T>(
  o: TObject,
  filter?: (v: TValue) => boolean,
  ignore?: { [k: string]: boolean }
): T[] => {
  return keys(o, filter, ignore).map((k) => o[k] as T);
};

export const toPascalCase = (str: string): string => {
  return str
    .replace(/^_+/, "")
    .replace(/_([a-zA-Z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^[a-zA-Z]/, (match) => match.toUpperCase());
};

export const readFile = (path: string) => {
  if (fs.existsSync(path)) {
    return fs.readFileSync(path, "utf-8");
  }
  return null;
};

export const writeFile = (path: string, data: string) => {
  const dir = dirname(path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(path) && readFile(path) === data) {
    console.log(`up-to-date: ${path}`);
  } else {
    console.log(`write: ${path}`);
    fs.writeFileSync(path, data, { encoding: "utf-8" });
  }
};

export const writeJson = (path: string, data: TValue, options?: JsonStringifyOption) => {
  options = options ?? {};
  options.indent = options.indent ?? 2;
  options.precision = options.precision ?? 10;
  writeFile(path, stringifyJson(data, options));
};

export const filename = (path: string, suffix: boolean = false) => {
  return basename(path, !suffix ? extname(path) : undefined);
};

export type StringifyContext = {
  readonly format: "json" | "lua" | "ts" | string;
  readonly indent: number;
  readonly precision?: number;
  readonly buffer: StringBuffer;
  readonly writeValue: (value: TValue) => void;
  readonly writeArray: (value: TArray) => void;
  readonly writeObject: (value: TObject) => void;
};

const numberToString = (value: number, precision?: number) => {
  if (value === (value | 0)) {
    return value.toFixed(0);
  } else {
    return value.toFixed(precision).replace(/\.?0+$/, "");
  }
};

//-----------------------------------------------------------------------------
// Json
//-----------------------------------------------------------------------------
export type JsonStringifyOption = {
  indent?: number;
  precision?: number;
};

export const stringifyJson = (data: unknown, option?: JsonStringifyOption) => {
  const stacks: string[] = [];
  option = option ?? {};
  option.indent = Math.max(option.indent ?? 4, 0);
  option.precision = option.precision ?? 10;
  const buffer = new StringBuffer(option.indent);
  const ctx: StringifyContext = {
    format: "json",
    indent: option.indent,
    precision: option.precision,
    buffer,
    writeValue: writeJsonValue,
    writeArray: writeJsonArray,
    writeObject: writeJsonObject,
  };

  function writeJsonValue(value: TValue) {
    if (typeof value === "number") {
      buffer.writeString(numberToString(value, ctx.precision));
    } else if (typeof value === "boolean") {
      buffer.writeString(value.toString());
    } else if (value === null || value === undefined) {
      buffer.writeString("null");
    } else if (typeof value === "string") {
      buffer.writeString('"');
      buffer.writeString(escape(value));
      buffer.writeString('"');
    } else if (Array.isArray(value)) {
      writeJsonArray(value);
    } else {
      if (typeof value !== "object" || value === null || value === undefined) {
        writeJsonValue(value);
      } else if (Array.isArray(value)) {
        writeJsonArray(value);
      } else {
        writeJsonObject(value as TObject);
      }
    }
  }

  function writeJsonObject(value: TObject) {
    if (stacks.length > 256) {
      throw new Error(`json stringify stack overflow: ${stacks.join("->")}`);
    }

    if (value["!stringify"]) {
      value["!stringify"](value, ctx);
      return;
    }

    const ks = keys(value, undefined, value["!ignore"]);
    const space = ctx.indent > 0 ? " " : "";
    buffer.writeString("{");
    buffer.linefeed();
    buffer.indent();
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      const v = value[k];
      stacks.push(k);
      buffer.padding();
      buffer.writeString(`"${k}":${space}`);
      writeJsonValue(v);
      if (i < ks.length - 1) {
        buffer.writeString(",");
      }
      buffer.linefeed();
      stacks.pop();
    }
    buffer.unindent();
    buffer.padding();
    buffer.writeString("}");
  }

  function writeJsonArray(value: TArray) {
    if (value["!stringify"]) {
      value["!stringify"](value, ctx);
      return;
    }

    buffer.writeString("[");
    buffer.linefeed();
    buffer.indent();
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      buffer.padding();
      writeJsonValue(v);
      if (i < value.length - 1) {
        buffer.writeString(",");
      }
      buffer.linefeed();
    }
    buffer.unindent();
    buffer.padding();
    buffer.writeString("]");
  }

  writeJsonValue(data as TValue);

  return buffer.toString();
};

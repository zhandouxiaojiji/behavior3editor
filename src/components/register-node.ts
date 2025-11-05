import { Image as GImage, Path as GPath, Rect as GRect, Text as GText } from "@antv/g";
import { DisplayObject, Group } from "@antv/g-lite";
import {
  Badge,
  CommonEvent,
  ExtensionCategory,
  NodeData as G6NodeData,
  Rect,
  RectStyleProps,
  register,
  UpsertHooks,
} from "@antv/g6";
import { NodeStyle } from "@antv/g6/lib/spec/element/node";
import assert from "node:assert";
import { Constructor, ExpressionEvaluator, NodeDef } from "../behavior3/src/behavior3";
import { useSetting } from "../contexts/setting-context";
import { useWorkspace } from "../contexts/workspace-context";
import { getNodeType, isExprType, NodeData, NodeLayout } from "../misc/b3type";
import * as b3util from "../misc/b3util";
import i18n from "../misc/i18n";
import { isMacos } from "../misc/keys";

let ctx: CanvasRenderingContext2D | null = null;
let defaultFontSize = "";
const textWidthMap = new Map<string, number>();
const textLines: Record<string, string[]> = {};

const calcTextWith = (text: string, fontSize?: string) => {
  fontSize = fontSize ?? defaultFontSize;
  let b3Workspace: HTMLDivElement | null;
  let css: CSSStyleDeclaration | null;
  if (!fontSize) {
    b3Workspace = document.querySelector(".b3-workspace");
    if (b3Workspace) {
      css = getComputedStyle(b3Workspace);
      defaultFontSize = css.fontSize || "13px";
      fontSize = defaultFontSize;
    }
  }
  const key = `${text}-${fontSize}`;
  let width = textWidthMap.get(key);
  if (!width) {
    b3Workspace ||= document.querySelector(".b3-workspace");
    if (b3Workspace) {
      css ||= getComputedStyle(b3Workspace);
      ctx = ctx || document.createElement("canvas").getContext("2d")!;
      ctx.font = `${fontSize} ${css.fontFamily}`;
      ctx.wordSpacing = "0px";
      ctx.letterSpacing = "-0.5px";
      const metrics = ctx.measureText(text);
      width = metrics.width;
      // width = width - (isMacos ? 1.6 : 0.8);
      width *= isMacos ? 0.88 : 0.98;
      textWidthMap.set(key, width);
    }
  }
  return width ?? 13;
};

const calcTextLines = (str: string, maxWidth: number, fontSize?: string) => {
  const key = `${str}-${maxWidth}-${fontSize}`;
  let lines = textLines[key];
  if (!lines) {
    lines = [];
    textLines[key] = lines;
    while (str.length > 0) {
      let left = 0;
      let right = str.length;
      let mid = 0;
      let width = 0;

      while (left < right) {
        mid = Math.floor((left + right + 1) / 2);
        const substr = str.substring(0, mid);
        width = calcTextWith(substr, fontSize);

        if (width <= maxWidth) {
          left = mid;
        } else {
          right = mid - 1;
        }
      }

      if (left > 0) {
        lines.push(str.substring(0, left));
        str = str.substring(left);
      } else {
        // Handle case where even single character exceeds maxWidth
        lines.push(str.substring(0, 1));
        str = str.substring(1);
      }
    }
  }
  return lines;
};

const cutWordTo = (str: string, maxWidth: number, fontSize?: string) => {
  const lines = calcTextLines(str, maxWidth, fontSize);
  if (lines.length > 1) {
    return lines[0].slice(0, -1) + "...";
  }
  return lines[0];
};

const toBreakWord = (str: string, maxWidth: number, fontSize?: string) => {
  const lines = calcTextLines(str, maxWidth, fontSize);
  return {
    str: lines.join("\n"),
    line: lines.length,
  };
};

const foundUndefined = (value?: string[]) => {
  if (!value || !b3util.usingVars) {
    return false;
  }
  return value.some((v) => v && b3util.usingVars?.[v] === undefined);
};

const foundUndefinedInArgs = (def: NodeDef, data: NodeData) => {
  if (!def.args || !data.args || !b3util.usingVars) {
    return false;
  }
  for (const arg of def.args) {
    if (!isExprType(arg.type)) {
      continue;
    }
    const expr = data.args[arg.name] as string | string[] | undefined;
    if (!expr) {
      continue;
    }
    if (typeof expr === "string") {
      if (foundUndefined(b3util.parseExpr(expr))) {
        return true;
      }
    } else if (Array.isArray(expr)) {
      for (const str of expr) {
        if (foundUndefined(b3util.parseExpr(str))) {
          return true;
        }
      }
    }
  }
  return false;
};

const hasErrorInArgExpr = (def: NodeDef, data: NodeData) => {
  const checkExpr = useWorkspace.getState().settings.checkExpr;
  if (!checkExpr || !def.args || !data.args) {
    return false;
  }
  for (const arg of def.args) {
    if (!isExprType(arg.type)) {
      continue;
    }
    const expr = data.args[arg.name] as string | string[] | undefined;
    if (!expr) {
      continue;
    }
    try {
      if (typeof expr === "string") {
        if (!new ExpressionEvaluator(expr).dryRun()) {
          return true;
        }
      } else if (Array.isArray(expr)) {
        for (const str of expr) {
          if (!new ExpressionEvaluator(str).dryRun()) {
            return true;
          }
        }
      }
    } catch (e) {
      return true;
    }
  }
  return false;
};

b3util.setSizeCalculator((data: NodeData) => {
  const width = useSetting.getState().data.layout === "compact" ? 220 : 260;
  let height = 50 + 2;
  const updateHeight = (obj: unknown) => {
    if ((Array.isArray(obj) && obj.length) || (obj && Object.keys(obj).length > 0)) {
      const { line } = toBreakWord(`${i18n.t("regnode.args")}${JSON.stringify(obj)}`, 200);
      height += 20 * line;
    }
  };
  if (data.path) {
    height += 20;
  }
  updateHeight(data.args);
  data.input?.find((v) => !!v) && updateHeight(data.input);
  data.output?.find((v) => !!v) && updateHeight(data.output);
  return [width, height];
});

const NODE_COLORS = {
  ["Composite"]: "#34d800",
  ["Decorator"]: "#ff6700",
  ["Condition"]: "#e4148b",
  ["Action"]: "#1668dc",
  ["Other"]: "#707070",
  ["Error"]: "#ff0000",
};

export type TreeNodeState =
  | "dragdown"
  | "dragright"
  | "dragsrc"
  | "dragup"
  | "highlightargs"
  | "highlightgray"
  | "highlightinput"
  | "highlightoutput"
  | "selected";

type ShapeName =
  | "args-bg"
  | "args-text"
  | "collapse"
  | "debug"
  | "desc-text"
  | "disabled"
  | "drag-down"
  | "drag-right"
  | "drag-src"
  | "drag-up"
  | "icon"
  | "id-text"
  | "input-bg"
  | "input-text"
  | "key-shape"
  | "name-bg"
  | "name-line"
  | "name-text"
  | "output-bg"
  | "output-text"
  | "path-text"
  | "status"
  | "subtree";

export const TreeNodeStyle: { [s in TreeNodeState]?: { [n in ShapeName]?: NodeStyle } } = {
  dragsrc: {
    "drag-src": { visibility: "visible" },
  },
  dragup: {
    "drag-up": { visibility: "visible" },
  },
  dragdown: {
    "drag-down": { visibility: "visible" },
  },
  dragright: {
    "drag-right": { visibility: "visible" },
  },
  highlightargs: {
    "args-bg": { visibility: "visible" },
    "args-text": { fill: "white" },
  },
  highlightinput: {
    "input-bg": { visibility: "visible" },
    "input-text": { fill: "white" },
  },
  highlightoutput: {
    "output-bg": { visibility: "visible" },
    "output-text": { fill: "white" },
  },
  highlightgray: {
    "args-text": { fill: "#666" },
    "desc-text": { fill: "#666" },
    "id-text": { fill: "#666" },
    "input-text": { fill: "#666" },
    "key-shape": { fill: "#0d1117", stroke: "#30363d" },
    "name-bg": { fill: "#30363d" },
    "name-text": { fill: "#666" },
    "output-text": { fill: "#666" },
    "path-text": { fill: "#666" },
  },
};

class TreeNode extends Rect {
  private _width = 0;
  private _height = 0;
  private _radius = 0;
  private _nodeLayout: NodeLayout = "compact";
  private _nodeDef!: NodeDef;
  private _data!: NodeData;
  private _prefix = "";
  private _classify = "";
  private _contentWidth = 220;
  private _contentX = 0;
  private _contentY = 0;
  private _states: TreeNodeState[] = [];

  protected override getKeyStyle(attributes: Required<RectStyleProps>) {
    const style = super.getKeyStyle(attributes);
    if (style) {
      style.x = 0;
      style.y = 0;
    }
    return style;
  }

  protected override getHaloStyle(attributes: Required<RectStyleProps>) {
    const style = super.getHaloStyle(attributes);
    if (style) {
      style.x = 0;
      style.y = 0;
    }
    return style;
  }

  private drawBackground(attributes: Required<RectStyleProps>, container: Group) {
    attributes.size = [this._width, this._height];
    attributes.lineWidth = 2;
    this.applyStyle("key-shape", attributes);
    this.drawKeyShape(attributes, container);
    this.drawHaloShape(attributes, container);
  }

  private drawNameBackground(attributes: Required<RectStyleProps>, container: Group) {
    this.upsert(
      "name-bg",
      GRect,
      {
        width: this._nodeLayout === "compact" ? this._width : 40,
        height: this._nodeLayout === "compact" ? 25 : this._height,
        fill: attributes.stroke,
        radius:
          this._nodeLayout === "compact"
            ? [this._radius, this._radius, 0, 0]
            : [this._radius, 0, 0, this._radius],
      },
      container
    );

    this.upsert(
      "name-line",
      GPath,
      {
        d: [
          ["M", 46, 23],
          ["L", this._width - 40, 23],
        ],
        stroke: "#666",
        lineWidth: 1,
        visibility: this._nodeLayout === "normal" ? "visible" : "hidden",
      },
      container
    );
  }

  private drawIdText(attributes: Required<RectStyleProps>, container: Group) {
    this.upsert(
      "id-text",
      GText,
      {
        fill: "white",
        fontSize: 20,
        lineHeight: 20,
        lineWidth: 2,
        stroke: "black",
        text: this._prefix + this.id,
        textAlign: "right",
        textBaseline: "top",
        x: -3,
        y: this._height / 2 - 8,
      },
      container
    );
  }

  private drawTypeIcon(attributes: Required<RectStyleProps>, container: Group) {
    const img = this._nodeDef.icon
      ? `file:///${useWorkspace.getState().workdir}/${this._nodeDef.icon}`
      : `./icons/${this._classify}.svg`;
    this.upsert(
      "icon",
      GImage,
      {
        x: 5,
        y: this._nodeLayout === "compact" ? 3 : this._height / 2 - 16,
        height: this._nodeLayout === "compact" ? 18 : 30,
        width: this._nodeLayout === "compact" ? 18 : 30,
        src: img,
      },
      container
    );
  }

  private drawStatusIcon(attributes: Required<RectStyleProps>, container: Group) {
    const status = ((this._data.$status ?? 0) & 0b111).toString(2).padStart(3, "0");
    this.upsert(
      "status",
      GImage,
      {
        x: this._width - 18,
        y: 3,
        height: this._nodeLayout === "compact" ? 18 : 20,
        width: this._nodeLayout === "compact" ? 18 : 20,
        src: `./icons/status${status}.svg`,
      },
      container
    );
  }

  private drawNameText(attributes: Required<RectStyleProps>, container: Group) {
    this.upsert(
      "name-text",
      GText,
      {
        fill: "black",
        fontSize: this._nodeLayout === "compact" ? 13 : 14,
        fontWeight: "bolder",
        text: this._data.name,
        textBaseline: "top",
        x: this._nodeLayout === "compact" ? 26 : 46,
        y: isMacos ? 3 : 2,
      },
      container
    );
  }

  private drawDebugIcon(attributes: Required<RectStyleProps>, container: Group) {
    this.upsert(
      "debug",
      GImage,
      {
        x: this._width - 30,
        y: 4,
        height: 16,
        width: 16,
        src: `./icons/Debug.svg`,
        visibility: this._data.debug ? "visible" : "hidden",
      },
      container
    );
  }

  private drawDisabledIcon(attributes: Required<RectStyleProps>, container: Group) {
    this.upsert(
      "disabled",
      GImage,
      {
        x: this._width - 30 - (this._data.debug ? 18 : 0),
        y: 4,
        height: 16,
        width: 16,
        src: `./icons/Disabled.svg`,
        visibility: this._data.disabled ? "visible" : "hidden",
      },
      container
    );
  }

  private drawDescText(attributes: Required<RectStyleProps>, container: Group) {
    let desc = (this._data.desc || this._nodeDef.desc || "") as string;
    desc = i18n.t("regnode.mark") + desc;
    desc = cutWordTo(desc, this._contentWidth - 15);
    this.upsert(
      "desc-text",
      GText,
      {
        fill: "black",
        fontSize: 12,
        fontWeight: "bolder",
        lineHeight: 20,
        text: `${desc}`,
        textBaseline: "top",
        x: this._contentX,
        y: this._contentY,
      },
      container
    );
  }

  private drawArgsText(attributes: Required<RectStyleProps>, container: Group) {
    const args = this._data.args;
    const { str, line } =
      args && Object.keys(args).length > 0
        ? toBreakWord(`${i18n.t("regnode.args")}${JSON.stringify(args)}`, 200)
        : { str: "", line: 0 };
    this.upsert(
      "args-bg",
      GRect,
      {
        x: this._contentX - 2,
        y: this._contentY + 21,
        width: this._contentWidth - 6,
        height: 18,
        fill: "#0d1117",
        radius: this._radius,
        visibility: "hidden",
      },
      container
    );
    this.upsert(
      "args-text",
      GText,
      {
        fill: "black",
        fontSize: 12,
        fontWeight: "normal",
        lineHeight: 20,
        text: str,
        textBaseline: "top",
        x: this._contentX,
        y: this._contentY + 20,
        visibility: str ? "visible" : "hidden",
      },
      container
    );
    this._contentY += 20 * line;
  }

  private drawInputText(attributes: Required<RectStyleProps>, container: Group) {
    const input = this._data.input?.find((v) => !!v) ? this._data.input : [];
    const { str, line } =
      input.length > 0
        ? toBreakWord(`${i18n.t("regnode.input")}${JSON.stringify(input)}`, 200)
        : { str: "", line: 0 };
    this.upsert(
      "input-bg",
      GRect,
      {
        fill: "#0d1117",
        height: 18,
        radius: this._radius,
        visibility: "hidden",
        width: this._contentWidth - 6,
        x: this._contentX - 2,
        y: this._contentY + 21,
      },
      container
    );
    this.upsert(
      "input-text",
      GText,
      {
        fill: "black",
        fontSize: 12,
        fontWeight: "normal",
        lineHeight: 20,
        text: str,
        textBaseline: "top",
        x: this._contentX,
        y: this._contentY + 20,
        visibility: str ? "visible" : "hidden",
      },
      container
    );
    this._contentY += 20 * line;
  }

  private drawOutputText(attributes: Required<RectStyleProps>, container: Group) {
    const output = this._data.output?.find((v) => !!v) ? this._data.output : [];
    const { str, line } =
      output.length > 0
        ? toBreakWord(`${i18n.t("regnode.output")}${JSON.stringify(output)}`, 200)
        : { str: "", line: 0 };
    this.upsert(
      "output-bg",
      GRect,
      {
        fill: "#0d1117",
        height: 18,
        radius: this._radius,
        visibility: "hidden",
        width: this._contentWidth - 6,
        x: this._contentX - 2,
        y: this._contentY + 21,
      },
      container
    );
    this.upsert(
      "output-text",
      GText,
      {
        fill: "black",
        fontSize: 12,
        fontWeight: "normal",
        lineHeight: 20,
        text: str,
        textBaseline: "top",
        x: this._contentX,
        y: this._contentY + 20,
        visibility: str ? "visible" : "hidden",
      },
      container
    );
    this._contentY += 20 * line;
  }

  private drawSubtreeShape(attributes: Required<RectStyleProps>, container: Group) {
    const isSubtree = this._data.path && this.id !== "1";
    this.upsert(
      "subtree",
      GRect,
      {
        x: -10,
        y: -10,
        width: this._width + 20,
        height: this._height + 20,
        stroke: "#a5b1be",
        lineWidth: 2.5,
        lineDash: [6, 6],
        radius: this._radius,
        visibility: isSubtree ? "visible" : "hidden",
      },
      container
    );
    let path = (i18n.t("regnode.subtree") + this._data.path) as string;
    path = cutWordTo(path, this._contentWidth - 15);
    this.upsert(
      "path-text",
      GText,
      {
        fill: "black",
        fontSize: 12,
        lineHeight: 20,
        text: `${path}`,
        textBaseline: "top",
        x: this._contentX,
        y: this._contentY + 20,
        visibility: isSubtree ? "visible" : "hidden",
      },
      container
    );
    this._contentY += isSubtree ? 20 : 0;
  }

  private drawDragShape(attributes: Required<RectStyleProps>, container: Group) {
    this.upsert(
      "drag-src",
      GRect,
      {
        width: this._width,
        height: this._height,
        lineWidth: 0,
        fillOpacity: 0.8,
        fill: "orange",
        radius: this._radius,
        visibility: "hidden",
      },
      container
    );

    this.upsert(
      "drag-up",
      GRect,
      {
        width: this._width,
        height: this._height / 2,
        lineWidth: 2,
        stroke: "#ff0000",
        strokeOpacity: 0.8,
        fill: "#ff0000",
        fillOpacity: 0.8,
        radius: [this._radius, this._radius, 0, 0],
        visibility: "hidden",
      },
      container
    );

    this.upsert(
      "drag-down",
      GRect,
      {
        y: this._height / 2,
        width: this._width,
        height: this._height / 2,
        lineWidth: 2,
        stroke: "#ff0000",
        strokeOpacity: 0.8,
        fill: "#ff0000",
        fillOpacity: 0.8,
        radius: [0, 0, this._radius, this._radius],
        visibility: "hidden",
      },
      container
    );

    this.upsert(
      "drag-right",
      GRect,
      {
        x: this._width / 2,
        width: this._width / 2,
        height: this._height,
        lineWidth: 2,
        stroke: "#ff0000",
        strokeOpacity: 0.8,
        fill: "#ff0000",
        fillOpacity: 0.8,
        radius: [0, this._radius, this._radius, 0],
        visibility: "hidden",
      },
      container
    );
  }

  private drawPortShape(attributes: Required<RectStyleProps>, container: Group) {
    const GREY_COLOR = "#666";
    const size = 14;
    const btn = this.upsert(
      "collapse",
      Badge,
      {
        backgroundFill: "#fff",
        backgroundHeight: size,
        backgroundLineWidth: 1,
        backgroundRadius: size / 2,
        backgroundStroke: GREY_COLOR,
        backgroundWidth: size,
        cursor: "pointer",
        fill: GREY_COLOR,
        fontSize: 16,
        text: attributes.collapsed ? "+" : "-",
        textAlign: "center",
        textBaseline: "middle",
        x: this._width,
        y: this._height / 2,
        visibility: this._data.children?.length ? "visible" : "hidden",
      },
      container
    );
    if (btn && !Reflect.has(btn, "__bind__")) {
      Reflect.set(btn, "__bind__", true);
      btn.addEventListener(CommonEvent.CLICK, () => {
        const { collapsed } = this.attributes;
        const graph = this.context.graph;
        if (collapsed) {
          graph.expandElement(this.id);
        } else {
          graph.collapseElement(this.id);
        }
      });
    }
  }

  render(attributes?: Required<RectStyleProps> | undefined, container?: Group): void {
    const node = this.context.model.getNodeLikeDatum(this.id) as G6NodeData;
    const data = node.data as unknown as NodeData;
    const nodeDef = b3util.nodeDefs.get(data.name);
    let classify = getNodeType(nodeDef);
    let color = nodeDef.color || NODE_COLORS[classify] || NODE_COLORS["Other"];

    if (
      !b3util.nodeDefs.has(data.name) ||
      (data.path && !data.$mtime) ||
      (nodeDef.group && !nodeDef.group.some((g) => b3util.usingGroups?.[g])) ||
      !b3util.isValidNodeData(data) ||
      foundUndefined(data.input) ||
      foundUndefined(data.output) ||
      foundUndefinedInArgs(nodeDef, data) ||
      hasErrorInArgExpr(nodeDef, data)
    ) {
      classify = "Error";
      color = NODE_COLORS[classify];
    }

    assert(data.$size);
    const [width, height] = data.$size;

    this._prefix = (node.prefix as string) ?? "";
    this._width = width;
    this._height = height;
    this._radius = 4;
    this._nodeDef = nodeDef;
    this._data = data;
    this._classify = classify;
    this._nodeLayout = useSetting.getState().data.layout;
    this._contentWidth = 220;
    this._contentX = this._nodeLayout === "compact" ? 6 : 46;
    this._contentY = 28;

    this._states = this.context.graph.getElementState(this.id) as TreeNodeState[];
    this.resetStyle();

    assert(attributes && container);
    attributes.fill = "white";
    attributes.stroke = color;

    // console.log(this.id, this.states);

    this.drawBackground(attributes, container);
    this.drawNameBackground(attributes, container);
    this.drawNameText(attributes, container);
    this.drawTypeIcon(attributes, container);
    this.drawStatusIcon(attributes, container);
    this.drawDebugIcon(attributes, container);
    this.drawDisabledIcon(attributes, container);
    this.drawDescText(attributes, container);
    this.drawArgsText(attributes, container);
    this.drawInputText(attributes, container);
    this.drawOutputText(attributes, container);
    this.drawSubtreeShape(attributes, container);
    this.drawDragShape(attributes, container);
    this.drawPortShape(attributes, container);
    this.drawIdText(attributes, container);
  }

  protected upsert<T extends DisplayObject>(
    name: ShapeName,
    Ctor: Constructor<T>,
    style: T["attributes"] | false,
    container: DisplayObject,
    hooks?: UpsertHooks
  ): T | undefined {
    this.applyStyle(name, style);
    const obj = super.upsert(name, Ctor, style, container, hooks);
    // if (obj && obj.className !== "key") {
    // obj.interactive = false;
    // }
    return obj;
  }

  private applyStyle(name: ShapeName, style: DisplayObject["attributes"] | false) {
    if (style) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shapeStyle = (this.attributes as any)[name] ?? {};
      for (const key in shapeStyle) {
        style[key] = shapeStyle[key];
      }
    }
  }

  private resetStyle() {
    const style = this.context.graph.getOptions().node!.state!;
    const keys: Set<string> = new Set();
    Object.keys(style).forEach((s) => {
      for (const key in style[s]) {
        keys.add(key);
      }
    });
    this._states.forEach((s) => {
      for (const key in style[s]) {
        keys.delete(key);
      }
    });
    for (const key of keys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.attributes as any)[key] = undefined;
    }
  }
}

register(ExtensionCategory.NODE, "TreeNode", TreeNode);

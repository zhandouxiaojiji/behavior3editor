import G6 from "@antv/g6";
import { NodeDef } from "../behavior3/src/behavior3";
import { useWorkspace } from "../contexts/workspace-context";
import { TreeGraphData, getNodeType, isExprType } from "../misc/b3type";
import { checkTreeData, nodeDefs, parseExpr, usingGroups, usingVars } from "../misc/b3util";
import i18n from "../misc/i18n";
import { isMacos } from "../misc/keys";

let ctx: CanvasRenderingContext2D | null = null;
let defaultFontSize = "";
const textWidthMap = new Map<string, number>();
const textLines: Record<string, string[]> = {};

let layoutWidth = 220;
let layoutStyle: "compact" | "normal" = "compact";

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
      width *= isMacos ? 0.88 : 0.95;
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
  if (!value || !usingVars) {
    return false;
  }
  return value.some((v) => v && usingVars?.[v] === undefined);
};

const foundUndefinedInArgs = (def: NodeDef, data: TreeGraphData) => {
  if (!def.args || !data.args || !usingVars) {
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
      if (foundUndefined(parseExpr(expr))) {
        return true;
      }
    } else if (Array.isArray(expr)) {
      for (const str of expr) {
        if (foundUndefined(parseExpr(str))) {
          return true;
        }
      }
    }
  }
  return false;
};

export const calcTreeDataSize = (data: TreeGraphData) => {
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
  updateHeight(data.input);
  updateHeight(data.output);
  return [layoutWidth, height];
};

export const setLayoutStyle = (style: "compact" | "normal") => {
  layoutStyle = style;
  if (style === "compact") {
    layoutWidth = 220;
  } else {
    layoutWidth = 260;
  }
};

const NODE_COLORS = {
  ["Composite"]: "#34d800",
  ["Decorator"]: "#ff6700",
  ["Condition"]: "#e4148b",
  ["Action"]: "#1668dc",
  ["Other"]: "#707070",
  ["Error"]: "#ff0000",
};

G6.registerNode(
  "TreeNode",
  {
    options: {
      type: "rect",
      anchorPoints: [
        [0, 0.5],
        [1, 0.5],
      ],
      stateStyles: {
        selected: {
          "main-box-selected": {
            fillOpacity: 0.2,
          },
        },
        hover: {
          "main-box-selected": {
            fillOpacity: 0.1,
          },
        },
        dragSrc: {
          fill: "gray",
        },
        dragRight: {
          "drag-right": {
            fillOpacity: 0.8,
            strokeOpacity: 0.8,
          },
        },
        dragUp: {
          "drag-up": {
            fillOpacity: 0.8,
            strokeOpacity: 0.8,
          },
        },
        dragDown: {
          "drag-down": {
            fillOpacity: 0.8,
            strokeOpacity: 0.8,
          },
        },
      },
    },
    draw(cfg, group) {
      const data = cfg as TreeGraphData;
      const nodeDef = nodeDefs.get(data.name);
      let classify = getNodeType(nodeDef);
      let color = nodeDef.color || NODE_COLORS[classify] || NODE_COLORS["Other"];

      if (
        !nodeDefs.has(data.name) ||
        (data.path && !data.children?.length) ||
        (nodeDef.group && !nodeDef.group.some((g) => usingGroups[g])) ||
        !checkTreeData(data) ||
        foundUndefined(data.input) ||
        foundUndefined(data.output) ||
        foundUndefinedInArgs(nodeDef, data)
      ) {
        classify = "Error";
        color = NODE_COLORS[classify];
      }
      const [width, height] = data.size;
      const radius = 4;

      let bgColor = "white";
      let textColor = "black";

      if (data.highlightGray) {
        bgColor = "#0d1117";
        color = "#30363d";
        textColor = "#666";
      }

      type ShapeCfg = Parameters<typeof group.addShape>[1];
      const addShape = (type: string, shapeCfg: ShapeCfg, clickEnabled: boolean = false) => {
        shapeCfg.draggable = clickEnabled;
        shapeCfg.capture = clickEnabled;
        return group.addShape(type, shapeCfg);
      };

      addShape("rect", {
        attrs: {
          x: -15,
          y: -15,
          width: width + 30,
          height: height + 30,
          fill: "#fff",
          fillOpacity: 0,
          radius: radius + 4,
        },
        name: "main-box-selected",
        draggable: true,
      });

      const shape = addShape(
        "rect",
        {
          attrs: {
            x: 0,
            y: 0,
            width: width,
            height: height,
            stroke: color,
            lineWidth: 2,
            fill: bgColor,
            radius: radius,
          },
          name: "main-box",
          draggable: true,
        },
        true
      );

      if (layoutStyle === "normal") {
        // name line
        addShape("path", {
          attrs: {
            path: [
              ["M", 46, 23],
              ["L", width - 40, 23],
            ],
            stroke: "#666",
            lineWidth: 1,
          },
        });
      }

      // is subtree
      if (data.path && data.id !== "1") {
        addShape("rect", {
          attrs: {
            x: -10,
            y: -10,
            width: width + 20,
            height: height + 20,
            stroke: "#a5b1be",
            lineWidth: 2.5,
            lineDash: [6, 6],
            radius: [radius, radius, radius, radius],
          },
          name: "subtree",
          draggable: true,
        });
      }

      // name bg
      addShape("rect", {
        attrs: {
          x: 0,
          y: 0,
          width: layoutStyle === "compact" ? width : 40,
          height: layoutStyle === "compact" ? 25 : height,
          fill: color,
          radius: layoutStyle === "compact" ? [radius, radius, 0, 0] : [radius, 0, 0, radius],
        },
        name: "name-bg",
        draggable: true,
      });

      // id text
      addShape("text", {
        attrs: {
          textBaseline: "top",
          x: -3,
          y: height / 2 - 8,
          fontSize: 20,
          lineHeight: 20,
          text: data.id,
          textAlign: "right",
          fill: "white",
          stroke: textColor,
          lineWidth: 2,
        },
        name: "id-text",
      });

      // icon
      const img = nodeDef.icon
        ? `file:///${useWorkspace.getState().workdir}/${nodeDef.icon}`
        : `./icons/${classify}.svg`;
      addShape("image", {
        attrs: {
          x: 5,
          y: layoutStyle === "compact" ? 3 : height / 2 - 16,
          height: layoutStyle === "compact" ? 18 : 30,
          width: layoutStyle === "compact" ? 18 : 30,
          img,
        },
        name: "node-icon",
      });

      // status
      const status = ((data.status ?? 0) & 0b111).toString(2).padStart(3, "0");
      addShape("image", {
        attrs: {
          x: width - 18,
          y: 3,
          height: layoutStyle === "compact" ? 18 : 20,
          width: layoutStyle === "compact" ? 18 : 20,
          img: `./icons/status${status}.svg`,
        },
        name: "status-icon",
      });

      // name text
      addShape("text", {
        attrs: {
          textBaseline: "top",
          x: layoutStyle === "compact" ? 26 : 46,
          y: 5,
          fontWeight: "bolder",
          text: data.name,
          fill: textColor,
          fontSize: layoutStyle === "compact" ? 13 : 14,
        },
        name: "name-text",
      });

      // debug
      if (data.debug) {
        addShape("image", {
          attrs: {
            x: width - 30,
            y: 4,
            height: 16,
            width: 16,
            img: `./icons/Debug.svg`,
          },
          name: "node-debug-icon",
        });
      }

      if (data.disabled) {
        addShape("image", {
          attrs: {
            x: width - 30 - (data.debug ? 18 : 0),
            y: 4,
            height: 16,
            width: 16,
            img: `./icons/Disabled.svg`,
          },
          name: "node-disabled-icon",
        });
      }

      const contentWidth = 220;
      const contentX = layoutStyle === "compact" ? 6 : 46;
      let contentY = 32;
      // desc text
      let desc = (data.desc || nodeDef.desc) as string;
      if (desc || desc === "") {
        desc = i18n.t("regnode.mark") + desc;
        desc = cutWordTo(desc, contentWidth - 15);
        addShape("text", {
          attrs: {
            textBaseline: "top",
            x: contentX,
            y: contentY,
            lineHeight: 20,
            fontWeight: "bolder",
            text: `${desc}`,
            fill: textColor,
          },
          name: "desc-text",
        });
      }

      const args = data.args;
      if (args && Object.keys(args).length > 0) {
        const { str, line } = toBreakWord(`${i18n.t("regnode.args")}${JSON.stringify(args)}`, 200);
        if (data.highlightArgs) {
          addShape("rect", {
            attrs: {
              x: contentX - 2,
              y: contentY + 17,
              width: contentWidth - 6,
              height: 18,
              fill: "#0d1117",
              radius: [radius, radius, radius, radius],
            },
            name: "args-text-bg",
          });
        }
        addShape("text", {
          attrs: {
            textBaseline: "top",
            x: contentX,
            y: contentY + 20,
            w: width,
            lineHeight: 20,
            text: str,
            fill: data.highlightArgs ? "white" : textColor,
            fontWeight: data.highlightArgs ? "bolder" : undefined,
          },
          name: "args-text",
        });
        contentY += 20 * line;
      }

      const input = data.input ?? [];
      if (input.length > 0) {
        const { str, line } = toBreakWord(
          `${i18n.t("regnode.input")}${JSON.stringify(input)}`,
          200
        );
        if (data.highlightInput) {
          addShape("rect", {
            attrs: {
              x: contentX - 2,
              y: contentY + 17,
              width: contentWidth - 6,
              height: 18,
              fill: "#0d1117",
              radius: [radius, radius, radius, radius],
            },
            name: "input-text-bg",
          });
        }
        addShape(
          "text",
          {
            attrs: {
              textBaseline: "top",
              x: contentX,
              y: contentY + 20,
              lineHeight: 20,
              text: str,
              fill: data.highlightInput ? "white" : textColor,
              fontWeight: data.highlightInput ? "bolder" : undefined,
            },
            name: "input-text",
          },
          true
        );
        contentY += 20 * line;
      }

      const output = data.output ?? [];
      if (output.length > 0) {
        const { str, line } = toBreakWord(
          `${i18n.t("regnode.output")}${JSON.stringify(output)}`,
          200
        );
        if (data.highlightOutput) {
          addShape("rect", {
            attrs: {
              x: contentX - 2,
              y: contentY + 17,
              width: contentWidth - 6,
              height: 18,
              fill: "#0d1117",
              radius: [radius, radius, radius, radius],
            },
            name: "output-text-bg",
          });
        }
        addShape(
          "text",
          {
            attrs: {
              textBaseline: "top",
              x: contentX,
              y: contentY + 20,
              lineHeight: 20,
              text: str,
              fill: data.highlightOutput ? "white" : textColor,
              fontWeight: data.highlightOutput ? "bolder" : undefined,
            },
            name: "output-text",
          },
          true
        );
        contentY += 20 * line;
      }

      if (data.path) {
        let path = (i18n.t("regnode.subtree") + data.path) as string;
        path = cutWordTo(path, contentWidth - 15);
        addShape("text", {
          attrs: {
            textBaseline: "top",
            x: contentX,
            y: contentY + 20,
            lineHeight: 20,
            text: `${path}`,
            fill: textColor,
          },
          name: "subtree-text",
        });
        contentY += 20;
      }

      addShape("rect", {
        name: "drag-up",
        attrs: {
          x: 0,
          y: 0,
          width: width,
          height: height / 2,
          lineWidth: 2,
          stroke: "#ff0000",
          strokeOpacity: 0,
          fill: "#ff0000",
          fillOpacity: 0,
          radius: [radius, radius, 0, 0],
        },
        draggable: true,
      });

      addShape("rect", {
        name: "drag-down",
        attrs: {
          x: 0,
          y: height / 2,
          width: width,
          height: height / 2,
          lineWidth: 2,
          stroke: "#ff0000",
          strokeOpacity: 0,
          fill: "#ff0000",
          fillOpacity: 0,
          radius: [0, 0, radius, radius],
        },
        draggable: true,
      });

      addShape("rect", {
        name: "drag-right",
        attrs: {
          x: width / 2,
          y: 0,
          width: width / 2,
          height: height,
          lineWidth: 2,
          stroke: "#ff0000",
          strokeOpacity: 0,
          fill: "#ff0000",
          fillOpacity: 0,
          radius: [0, radius, radius, 0],
        },
        draggable: true,
      });

      if (data.children?.length) {
        addShape("marker", {
          attrs: {
            x: width,
            y: height / 2,
            r: 6,
            symbol: G6.Marker.collapse,
            stroke: "#666",
            lineWidth: 1,
            fill: "#fff",
          },
          name: "collapse-icon",
        });
      }

      // restore stroke color and lineWidth
      // after lose focus, the main box stroke and color is not the node color
      addShape("path", {
        attrs: {
          path: [
            ["M", 0, 0],
            ["L", 0, 0],
          ],
          stroke: color,
          lineWidth: 2,
        },
      });

      return shape;
    },
  },
  "single-node"
);

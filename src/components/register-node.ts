import G6 from "@antv/g6";
import { NodeDef } from "../behavior3/src/behavior3";
import { useWorkspace } from "../contexts/workspace-context";
import { TreeGraphData, getNodeType, isExprType } from "../misc/b3type";
import { checkTreeData, nodeDefs, parseExpr, usingGroups, usingVars } from "../misc/b3util";
import i18n from "../misc/i18n";

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
      // width *= isMacos ? 0.88 : 0.95;
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
  return [260, height];
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
      const size = data.size ? data.size : [200, 40];
      const w = size[0];
      const h = size[1];
      const r = 4;

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
        // shapeCfg.attrs.fontFamily = "Menlo, Monaco, 'Courier New', monospace";
        return group.addShape(type, shapeCfg);
      };

      addShape("rect", {
        attrs: {
          x: -15,
          y: -15,
          width: w + 30,
          height: h + 30,
          fill: "#fff",
          fillOpacity: 0,
          radius: r + 4,
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
            width: w,
            height: h,
            stroke: color,
            lineWidth: 2,
            fill: bgColor,
            radius: r,
          },
          name: "main-box",
          draggable: true,
        },
        true
      );

      // name line
      addShape("path", {
        attrs: {
          path: [
            ["M", 46, 23],
            ["L", w - 40, 23],
          ],
          stroke: "#666",
          lineWidth: 1,
        },
      });

      // is subtree
      if (data.path && data.id !== "1") {
        addShape("rect", {
          attrs: {
            x: -10,
            y: -10,
            width: w + 20,
            height: h + 20,
            stroke: "#a5b1be",
            lineWidth: 2.5,
            lineDash: [6, 6],
            radius: [r, r, r, r],
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
          width: 40,
          height: h,
          fill: color,
          radius: [r, 0, 0, r],
        },
        name: "name-bg",
        draggable: true,
      });

      // id text
      addShape("text", {
        attrs: {
          textBaseline: "top",
          x: -3,
          y: h / 2 - 8,
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
          y: h / 2 - 16,
          height: 30,
          width: 30,
          img,
        },
        name: "node-icon",
      });

      // status
      const status = ((data.status ?? 0) & 0b111).toString(2).padStart(3, "0");
      addShape("image", {
        attrs: {
          x: w - 18,
          y: 3,
          height: 20,
          width: 20,
          img: `./icons/status${status}.svg`,
        },
        name: "status-icon",
      });

      // name text
      addShape("text", {
        attrs: {
          textBaseline: "top",
          x: 46,
          y: 5,
          fontWeight: 900,
          text: data.name,
          fill: textColor,
          fontSize: 14,
        },
        name: "name-text",
      });

      // debug
      if (data.debug) {
        addShape("image", {
          attrs: {
            x: w - 30,
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
            x: w - 30 - (data.debug ? 18 : 0),
            y: 4,
            height: 16,
            width: 16,
            img: `./icons/Disabled.svg`,
          },
          name: "node-disabled-icon",
        });
      }

      const x = 46;
      let y = 32;
      // desc text
      let desc = (data.desc || nodeDef.desc) as string;
      if (desc || desc === "") {
        desc = i18n.t("regnode.mark") + desc;
        desc = cutWordTo(desc, w - 40 - 15);
        addShape("text", {
          attrs: {
            textBaseline: "top",
            x,
            y,
            lineHeight: 20,
            fontWeight: 800,
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
              x: x - 2,
              y: y + 17,
              width: w - 40 - 6,
              height: 18,
              fill: "#0d1117",
              radius: [r, r, r, r],
            },
            name: "args-text-bg",
          });
        }
        addShape("text", {
          attrs: {
            textBaseline: "top",
            x,
            y: y + 20,
            w,
            lineHeight: 20,
            text: str,
            fill: data.highlightArgs ? "white" : textColor,
            fontWeight: data.highlightArgs ? "bolder" : undefined,
          },
          name: "args-text",
        });
        y += 20 * line;
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
              x: x - 2,
              y: y + 17,
              width: w - 40 - 6,
              height: 18,
              fill: "#0d1117",
              radius: [r, r, r, r],
            },
            name: "input-text-bg",
          });
        }
        addShape(
          "text",
          {
            attrs: {
              textBaseline: "top",
              x,
              y: y + 20,
              lineHeight: 20,
              text: str,
              fill: data.highlightInput ? "white" : textColor,
              fontWeight: data.highlightInput ? "bolder" : undefined,
            },
            name: "input-text",
          },
          true
        );
        y += 20 * line;
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
              x: x - 2,
              y: y + 17,
              width: w - 40 - 6,
              height: 18,
              fill: "#0d1117",
              radius: [r, r, r, r],
            },
            name: "output-text-bg",
          });
        }
        addShape(
          "text",
          {
            attrs: {
              textBaseline: "top",
              x,
              y: y + 20,
              lineHeight: 20,
              text: str,
              fill: data.highlightOutput ? "white" : textColor,
              fontWeight: data.highlightOutput ? "bolder" : undefined,
            },
            name: "output-text",
          },
          true
        );
        y += 20 * line;
      }

      if (data.path) {
        let path = (i18n.t("regnode.subtree") + data.path) as string;
        path = cutWordTo(path, w - 40 - 15);
        addShape("text", {
          attrs: {
            textBaseline: "top",
            x,
            y: y + 20,
            lineHeight: 20,
            text: `${path}`,
            fill: textColor,
          },
          name: "subtree-text",
        });
        y += 20;
      }

      addShape("rect", {
        name: "drag-up",
        attrs: {
          x: 0,
          y: 0,
          width: w,
          height: h / 2,
          lineWidth: 2,
          stroke: "#ff0000",
          strokeOpacity: 0,
          fill: "#ff0000",
          fillOpacity: 0,
          radius: [r, r, 0, 0],
        },
        draggable: true,
      });

      addShape("rect", {
        name: "drag-down",
        attrs: {
          x: 0,
          y: h / 2,
          width: w,
          height: h / 2,
          lineWidth: 2,
          stroke: "#ff0000",
          strokeOpacity: 0,
          fill: "#ff0000",
          fillOpacity: 0,
          radius: [0, 0, r, r],
        },
        draggable: true,
      });

      addShape("rect", {
        name: "drag-right",
        attrs: {
          x: w / 2,
          y: 0,
          width: w / 2,
          height: h,
          lineWidth: 2,
          stroke: "#ff0000",
          strokeOpacity: 0,
          fill: "#ff0000",
          fillOpacity: 0,
          radius: [0, r, r, 0],
        },
        draggable: true,
      });

      if (data.children?.length) {
        addShape("marker", {
          attrs: {
            x: w,
            y: h / 2,
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

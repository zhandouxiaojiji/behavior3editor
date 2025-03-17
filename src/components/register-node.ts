import G6 from "@antv/g6";
import { useWorkspace } from "../contexts/workspace-context";
import { TreeGraphData, getNodeType, isExprType } from "../misc/b3type";
import { checkTreeData, nodeDefs, parseExpr, usingGroups, usingVars } from "../misc/b3util";
import i18n from "../misc/i18n";
import { isMacos } from "../misc/keys";

let ctx: CanvasRenderingContext2D | null = null;
let defaultFontSize = "";
const textWidthMap = new Map<string, number>();

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
      const metrics = ctx.measureText(text);
      width = metrics.width;
      width = width - (isMacos ? 1.6 : 0.8);
      textWidthMap.set(key, width);
    }
  }
  return width ?? 13;
};

const cutWordTo = (str: string, maxWidth: number, fontSize?: string) => {
  let i = 0;
  for (; i < str.length; i++) {
    maxWidth -= calcTextWith(str.charAt(i), fontSize);
    if (maxWidth < 0) {
      i--;
      break;
    }
  }
  return str.slice(0, i) + (i < str.length - 1 ? "..." : "");
};

const toBreakWord = (str: string, maxWidth: number, fontSize?: string) => {
  const chars: string[] = [];
  let line = str.length > 0 ? 1 : 0;
  let width = maxWidth;
  for (let i = 0; i < str.length; i++) {
    width -= calcTextWith(str.charAt(i), fontSize);
    if (width > 0) {
      chars.push(str.charAt(i));
    } else {
      width = maxWidth;
      line++;
      chars.push("\n");
      i--;
    }
  }
  return {
    str: chars.join(""),
    line,
  };
};

export const calcTreeDataSize = (data: TreeGraphData) => {
  let height = 50 + 2;
  const updateHeight = (obj: any) => {
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
  return [220, height];
};

const NODE_COLORS: any = {
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
        !checkTreeData(data) ||
        (nodeDef.group && usingGroups && !usingGroups[nodeDef.group]) ||
        (usingVars && data.input?.some((v) => !usingVars![v])) ||
        (usingVars && data.output?.some((v) => !usingVars![v])) ||
        (usingVars &&
          nodeDef.args?.some(
            (v) =>
              isExprType(v.type) &&
              parseExpr(data.args?.[v.name] ?? "").some((vv) => !usingVars![vv])
          ))
      ) {
        classify = "Error";
        color = NODE_COLORS[classify];
      }
      const size = data.size ? data.size : [150, 40];
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
          width: w,
          height: 25,
          fill: color,
          radius: [r, r, 0, 0],
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
          y: 3,
          height: 18,
          width: 18,
          img,
        },
        name: "node-icon",
      });

      // status
      const status = ((data.status ?? 0) & 0b111).toString(2).padStart(3, "0");
      addShape("image", {
        attrs: {
          x: 204,
          y: 3,
          height: 18,
          width: 18,
          img: `./icons/status${status}.svg`,
        },
        name: "status-icon",
      });

      // name text
      addShape("text", {
        attrs: {
          textBaseline: "top",
          x: 26,
          y: 5,
          fontWeight: 800,
          text: data.name,
          fill: textColor,
          fontSize: 13,
        },
        name: "name-text",
      });

      // debug
      if (data.debug) {
        addShape("image", {
          attrs: {
            x: 192,
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
            x: 200 - (data.debug ? 25 : 8),
            y: 4,
            height: 16,
            width: 16,
            img: `./icons/Disabled.svg`,
          },
          name: "node-disabled-icon",
        });
      }

      const x = 6;
      let y = 32;
      // desc text
      let desc = (data.desc || nodeDef.desc) as string;
      if (desc) {
        desc = i18n.t("regnode.mark") + desc;
        desc = cutWordTo(desc, w - 15);
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

      const args: any = data.args;
      if (nodeDef.args && args && Object.keys(args).length > 0) {
        const { str, line } = toBreakWord(`${i18n.t("regnode.args")}${JSON.stringify(args)}`, 200);
        if (data.highlightArgs) {
          addShape("rect", {
            attrs: {
              x: x - 2,
              y: y + 17,
              width: w - 6,
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
      if (nodeDef.input && input.length > 0) {
        const { str, line } = toBreakWord(
          `${i18n.t("regnode.input")}${JSON.stringify(input)}`,
          200
        );
        if (data.highlightInput) {
          addShape("rect", {
            attrs: {
              x: x - 2,
              y: y + 17,
              width: w - 6,
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
      if (nodeDef.output && output.length > 0) {
        const { str, line } = toBreakWord(
          `${i18n.t("regnode.output")}${JSON.stringify(output)}`,
          200
        );
        if (data.highlightOutput) {
          addShape("rect", {
            attrs: {
              x: x - 2,
              y: y + 17,
              width: w - 6,
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
        path = cutWordTo(path, w - 15);
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

      return shape;
    },
  },
  "single-node"
);

import { useWorkspace } from "@/contexts/workspace-context";
import { TreeGraphData, getNodeType } from "@/misc/b3type";
import { checkTreeData, cutWordTo, toBreakWord } from "@/misc/b3util";
import i18n from "@/misc/i18n";
import { isMacos } from "@/misc/keys";
import Path from "@/misc/path";
import G6 from "@antv/g6";

const NODE_COLORS: any = {
  ["Composite"]: "rgb(91,237,32)",
  ["Decorator"]: "rgb(218,167,16)",
  ["Condition"]: "rgb(228,20,139)",
  ["Action"]: "rgb(91,143,249)",
  ["Other"]: "rgb(112,112,112)",
  ["Error"]: "rgb(255,0,0)",
};

const SELECTED_LINE_WIDTH = 4;

G6.registerNode(
  "TreeNode",
  {
    options: {
      type: "rect",
      anchorPoints: [
        [0, 0.5],
        [1, 0.5],
      ],
      labelCfg: {
        style: {
          fill: "blue",
          fontSize: 10,
        },
      },
      style: {
        fill: "white",
      },
      stateStyles: {
        selected: {
          "main-box": {
            stroke: "yellow",
            lineWidth: SELECTED_LINE_WIDTH,
          },
          "name-bg-selected": {
            fill: "yellow",
          },
        },
        hover: {
          stroke: "white",
          lineWidth: 3,
        },
        dragSrc: {
          fill: "gray",
        },
        dragRight: {
          "drag-right": {
            fillOpacity: 1,
            strokeOpacity: 1,
          },
        },
        dragUp: {
          "drag-up": {
            fillOpacity: 1,
            strokeOpacity: 1,
          },
        },
        dragDown: {
          "drag-down": {
            fillOpacity: 1,
            strokeOpacity: 1,
          },
        },
      },
    },
    draw(cfg, group) {
      const workspace = useWorkspace.getState();
      const nodeDef = workspace.getNodeDef(cfg.name as string);
      let classify = getNodeType(nodeDef);
      let color = nodeDef.color || NODE_COLORS[classify] || NODE_COLORS["Other"];
      if (
        !workspace.hasNodeDef(cfg.name as string) ||
        (cfg.path && (!cfg.children || (cfg.children as []).length == 0)) ||
        !checkTreeData(cfg as TreeGraphData)
      ) {
        classify = "Error";
        color = NODE_COLORS[classify];
      }
      const size = cfg.size ? (cfg.size as number[]) : [150, 40];
      const w = size[0];
      const h = size[1];
      const r = 4;

      let bgColor = "white";
      let textColor = "black";

      if (cfg.highlightGray) {
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
      if (cfg.path && cfg.id !== "1") {
        addShape("rect", {
          attrs: {
            x: -10,
            y: -10,
            width: w + 20,
            height: h + 20,
            stroke: "white",
            lineWidth: 2.5,
            lineDash: [5, 5],
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
          height: 20,
          fill: color,
          radius: [r, r, 0, 0],
        },
        name: "name-bg-selected",
        draggable: true,
      });
      addShape("rect", {
        attrs: {
          x: SELECTED_LINE_WIDTH / 2,
          y: SELECTED_LINE_WIDTH / 2,
          width: w - 4,
          height: 20 - SELECTED_LINE_WIDTH / 2,
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
          text: cfg.id,
          textAlign: "right",
          fill: "white",
          stroke: textColor,
          lineWidth: 2,
        },
        name: "id-text",
      });

      // icon
      const img = nodeDef.icon
        ? process.env.VITE_DEV_SERVER_URL && isMacos
          ? `${Path.basename(workspace.workdir)}/${nodeDef.icon}`
          : `${workspace.workdir}/${nodeDef.icon}`
        : `./icons/${classify}.svg`;
      addShape("image", {
        attrs: {
          x: 5,
          y: 2,
          height: 14,
          width: 14,
          img,
        },
        name: "node-icon",
      });

      // debug
      if (cfg.debug) {
        addShape("image", {
          attrs: {
            x: 182,
            y: 2,
            height: 14,
            width: 14,
            img: `./icons/Debug.svg`,
          },
          name: "node-icon",
        });
      }

      // name text
      addShape("text", {
        attrs: {
          textBaseline: "top",
          x: 22,
          y: 3,
          fontWeight: 800,
          lineHeight: 20,
          text: cfg.name,
          fill: textColor,
        },
        name: "name-text",
      });

      const x = 6;
      let y = 24;
      // desc text
      let desc = (cfg.desc || nodeDef.desc) as string;
      if (desc) {
        desc = i18n.t("regnode.mark") + desc;
        desc = cutWordTo(desc, 31);
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

      const args: any = cfg.args;
      if (nodeDef.args && args && Object.keys(args).length > 0) {
        const { str, line } = toBreakWord(`${i18n.t("regnode.args")}${JSON.stringify(args)}`, 34);
        addShape("text", {
          attrs: {
            textBaseline: "top",
            x,
            y: y + 20,
            w,
            lineHeight: 20,
            text: str,
            fill: textColor,
          },
          name: "args-text",
        });
        y += 20 * line;
      }

      const input: [] = cfg.input ? (cfg.input as []) : [];
      if (nodeDef.input && input.length > 0) {
        const { str, line } = toBreakWord(`${i18n.t("regnode.input")}${JSON.stringify(input)}`, 35);
        if (cfg.highlightInput) {
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
              fill: cfg.highlightInput ? "white" : textColor,
              fontWeight: cfg.highlightInput ? "bolder" : undefined,
            },
            name: "input-text",
          },
          true
        );
        y += 20 * line;
      }

      const output: [] = cfg.output ? (cfg.output as []) : [];
      if (nodeDef.output && output.length > 0) {
        const { str, line } = toBreakWord(
          `${i18n.t("regnode.output")}${JSON.stringify(output)}`,
          35
        );
        if (cfg.highlightOutput) {
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
              fill: cfg.highlightOutput ? "white" : textColor,
              fontWeight: cfg.highlightOutput ? "bolder" : undefined,
            },
            name: "output-text",
          },
          true
        );
        y += 20 * line;
      }

      if (cfg.path) {
        let path = (i18n.t("regnode.subtree") + cfg.path) as string;
        path = cutWordTo(path, 33);
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
          stroke: "#1668dc",
          strokeOpacity: 0,
          fill: "#1668dc",
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
          stroke: "#1668dc",
          strokeOpacity: 0,
          fill: "#1668dc",
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
          stroke: "#1668dc",
          strokeOpacity: 0,
          fill: "#1668dc",
          fillOpacity: 0,
          radius: [0, r, r, 0],
        },
        draggable: true,
      });

      if (Array.isArray(cfg.children) && cfg.children.length > 0) {
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

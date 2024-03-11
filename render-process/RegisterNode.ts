import G6 from "@antv/g6";
import { toBreakWord } from "../common/Utils";
import Settings from "../main-process/Settings";
import { BehaviorNodeTypeModel } from "../common/BehaviorTreeModel";

const NODE_COLORS: any = {
    ["Composite"]: "rgb(91,237,32)",
    ["Decorator"]: "rgb(218,167,16)",
    ["Condition"]: "rgb(228,20,139)",
    ["Action"]: "rgb(91,143,249)",
    ["Other"]: "rgb(112,112,112)",
    ["Error"]: "rgb(255,0,0)",
};

const SELECTED_LINE_WIDTH = 4;

export default function (settings: Settings) {
    const collapseStyle: any = {
        "collapse-icon": {
            // symbol: G6.Marker.expand,
            fill: "blue",
        },
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
                            fillOpacity: 0.7,
                        },
                    },
                    dragUp: {
                        "drag-up": {
                            fillOpacity: 0.7,
                        },
                    },
                    dragDown: {
                        "drag-down": {
                            fillOpacity: 0.7,
                        },
                    },
                },
            },
            draw(cfg, group) {
                const nodeConf = settings.getNodeConf(cfg.name as string);
                let classify = nodeConf.type || "Other";
                if (
                    !settings.hasNodeConf(cfg.name as string) ||
                    (cfg.path && (!cfg.children || (cfg.children as []).length == 0))
                ) {
                    classify = "Error";
                }
                const color = NODE_COLORS[classify] || "Other";
                var size = cfg.size ? (cfg.size as number[]) : [150, 40];
                const w = size[0];
                const h = size[1];
                const r = 4;
                const shape = group.addShape("rect", {
                    attrs: {
                        x: 0,
                        y: 0,
                        width: w,
                        height: h,
                        stroke: color,
                        lineWidth: 2,
                        fill: "white",
                        radius: r,
                    },
                    name: "main-box",
                    draggable: true,
                });

                // is subtree
                if (cfg.path && cfg.id !== "1") {
                    group.addShape("rect", {
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
                group.addShape("rect", {
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
                group.addShape("rect", {
                    attrs: {
                        x: SELECTED_LINE_WIDTH / 2,
                        y: SELECTED_LINE_WIDTH / 2,
                        width: w - 5,
                        height: 20 - SELECTED_LINE_WIDTH / 2,
                        fill: color,
                        radius: [r, r, 0, 0],
                    },
                    name: "name-bg",
                    draggable: true,
                });

                // id text
                group.addShape("text", {
                    attrs: {
                        textBaseline: "top",
                        x: -3,
                        y: h / 2 - 8,
                        fontSize: 20,
                        lineHeight: 20,
                        text: cfg.id,
                        textAlign: "right",
                        fill: "white",
                        stroke: "black",
                        lineWidth: 2,
                    },
                    name: "id-text",
                });

                // icon
                var img = `./static/icons/${classify}.svg`;
                group.addShape("image", {
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
                    group.addShape("image", {
                        attrs: {
                            x: 182,
                            y: 2,
                            height: 14,
                            width: 14,
                            img: `./static/icons/Debug.svg`,
                        },
                        name: "node-icon",
                    });
                }

                // name text
                group.addShape("text", {
                    attrs: {
                        textBaseline: "top",
                        x: 22,
                        y: 3,
                        fontWeight: 800,
                        lineHeight: 20,
                        text: cfg.name,
                        fill: "black",
                    },
                    name: "name-text",
                });

                var x = 5;
                var y = 24;
                // desc text
                const desc = cfg.desc || nodeConf.desc;
                if (desc) {
                    group.addShape("text", {
                        attrs: {
                            textBaseline: "top",
                            x,
                            y,
                            lineHeight: 20,
                            fontWeight: 800,
                            text: `备注：${desc}`,
                            fill: "black",
                        },
                        name: "desc-text",
                    });
                }

                const args: any = cfg.args;
                if (nodeConf.args && args && Object.keys(args).length > 0) {
                    const { str, line } = toBreakWord(`参数：${JSON.stringify(args)}`, 34);
                    group.addShape("text", {
                        attrs: {
                            textBaseline: "top",
                            x,
                            y: y + 20,
                            w,
                            lineHeight: 20,
                            text: str,
                            fill: "black",
                        },
                        name: "args-text",
                    });
                    y += 20 * line;
                }

                const input: [] = cfg.input ? (cfg.input as []) : [];
                if (nodeConf.input && input.length > 0) {
                    const { str, line } = toBreakWord(`输入：${JSON.stringify(input)}`, 35);
                    group.addShape("text", {
                        attrs: {
                            textBaseline: "top",
                            x,
                            y: y + 20,
                            lineHeight: 20,
                            text: str,
                            fill: "black",
                        },
                        name: "input-text",
                    });
                    y += 20 * line;
                }

                const output: [] = cfg.output ? (cfg.output as []) : [];
                if (nodeConf.output && output.length > 0) {
                    const { str, line } = toBreakWord(`输出：${JSON.stringify(output)}`, 35);
                    group.addShape("text", {
                        attrs: {
                            textBaseline: "top",
                            x,
                            y: y + 20,
                            lineHeight: 20,
                            text: str,
                            fill: "black",
                        },
                        name: "output-text",
                    });
                    y += 20 * line;
                }

                if (cfg.path) {
                    group.addShape("text", {
                        attrs: {
                            textBaseline: "top",
                            x,
                            y: y + 20,
                            lineHeight: 20,
                            text: `子树：${cfg.path}`,
                            fill: "black",
                        },
                        name: "subtree-text",
                    });
                    y += 20;
                }

                if (Array.isArray(cfg.children) && cfg.children.length > 0) {
                    group.addShape("marker", {
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

                group.addShape("rect", {
                    name: "drag-up",
                    attrs: {
                        x: 0,
                        y: 0,
                        width: w,
                        height: h / 2,
                        fill: "blue",
                        fillOpacity: 0,
                        radius: [r, r, 0, 0],
                    },
                    draggable: true,
                });

                group.addShape("rect", {
                    name: "drag-down",
                    attrs: {
                        x: 0,
                        y: h / 2,
                        width: w,
                        height: h / 2,
                        fill: "blue",
                        fillOpacity: 0,
                        radius: [0, 0, r, r],
                    },
                    draggable: true,
                });

                group.addShape("rect", {
                    name: "drag-right",
                    attrs: {
                        x: w / 2,
                        y: 0,
                        width: w / 2,
                        height: h,
                        fill: "blue",
                        fillOpacity: 0,
                        radius: [0, r, r, 0],
                    },
                    draggable: true,
                });
                return shape;
            },
        },
        "single-node"
    );
}

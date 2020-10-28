import G6 from '@antv/g6';
import Settings from '../main-process/Settings';

const NODE_COLORS: any = {
  ['Composite']: 'rgb(91,237,32)',
  ['Decorator']: 'rgb(218,167,16)',
  ['Condition']: 'rgb(228,20,139)',
  ['Action']: 'rgb(91,143,249)',
  ['Other']: 'rgb(112,112,112)',
}


export default function (settings: Settings) {
  const collapseStyle: any = {
    'collapse-icon': {
      // symbol: G6.Marker.expand,
      fill: 'blue',
    }
  };
  G6.registerNode(
    'TreeNode',
    {
      options: {
        type: 'rect',
        labelCfg: {
          style: {
            fill: 'blue',
            fontSize: 10
          }
        },
        style: {
          fill: "white",
        },
        stateStyles: {
          selected: {
            'main-box': {
              stroke: 'black',
              lineWidth: 3,
            },
          },
          hover: {
            stroke: 'white',
            lineWidth: 3,
          },
          dragSrc: {
            fill: 'gray',
          },
          dragRight: {
            'drag-right': {
              fillOpacity: 0.6,
            }
          },
          dragUp: {
            'drag-up': {
              fillOpacity: 0.6,
            }
          },
          dragDown: {
            'drag-down': {
              fillOpacity: 0.6,
            }
          }
        },
      },
      draw(cfg, group) {
        const nodeConf = settings.getNodeConf(cfg.name as string);
        const classify = nodeConf.type || 'Other';
        const color = NODE_COLORS[classify] || 'Other';
        var size = cfg.size ? cfg.size as number[] : [150, 40];
        const w = size[0];
        const h = size[1];
        const x0 = -w / 2;
        const y0 = -h / 2;
        const r = 2;
        const shape = group.addShape('rect', {
          attrs: {
            x: x0,
            y: y0,
            width: w,
            height: h,
            stroke: color,
            lineWidth: 2,
            fill: 'white',
            radius: r,
          },
          name: 'main-box',
          draggable: true,
        });

        // name bg
        group.addShape('rect', {
          attrs: {
            x: x0 + 1.5,
            y: y0 + 1.5,
            width: w - 3,
            height: 16,
            fill: color,
            // radius: r,
          },
          name: 'name-bg',
          draggable: true,
        });

        // id text
        group.addShape('text', {
          attrs: {
            textBaseline: 'top',
            x: x0 - 3,
            y: -8,
            fontSize: 20,
            lineHeight: 20,
            text: cfg.id,
            textAlign: 'right',
            fill: 'white',
            stroke: 'black',
            lineWidth: 2,
          },
          name: 'id-text',
        });

        // icon
        var img = `./static/icons/${classify}.svg`;
        group.addShape('image', {
          attrs: {
            x: x0 + 3,
            y: y0 + 2,
            height: 14,
            width: 14,
            img,
          },
          name: 'node-icon',
        });

        // name text
        group.addShape('text', {
          attrs: {
            textBaseline: 'top',
            x: x0 + 18,
            y: y0 + 4,
            fontWeight: 800,
            lineHeight: 20,
            text: cfg.name,
            fill: 'black',
          },
          name: 'name-text',
        });

        var x = x0 + 2;
        var y = y0 + 23;
        // desc text
        const desc = cfg.desc || nodeConf.desc;
        if (desc) {
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x,
              y,
              lineHeight: 20,
              fontWeight: 800,
              text: `备注:${desc}`,
              fill: 'black',
            },
            name: 'desc-text',
          });
        }

        const args: any = cfg.args;
        if (args && Object.keys(args).length > 0) {
          y += 20;
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x,
              y,
              lineHeight: 20,
              text: `参数:${JSON.stringify(args)}`,
              fill: 'black',
            },
            name: 'args-text',
          });
        }

        const input: [] = cfg.input ? cfg.input as [] : [];
        if (input.length > 0) {
          y += 20;
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x,
              y,
              lineHeight: 20,
              text: `输入:${JSON.stringify(input)}`,
              fill: 'black',
            },
            name: 'input-text',
          });
        }

        const output: [] = cfg.output ? cfg.output as [] : [];
        if (output.length > 0) {
          y += 20;
          group.addShape('text', {
            attrs: {
              textBaseline: 'top',
              x,
              y,
              lineHeight: 20,
              text: `输出:${JSON.stringify(output)}`,
              fill: 'black',
            },
            name: 'output-text',
          });
        }

        if (Array.isArray(cfg.children) && cfg.children.length > 0) {
          group.addShape('marker', {
            attrs: {
              x: w / 2,
              y: 0,
              r: 6,
              symbol: G6.Marker.collapse,
              stroke: '#666',
              lineWidth: 1,
              fill: '#fff',
            },
            name: 'collapse-icon',
          });
        }


        group.addShape('rect', {
          name: 'drag-up',
          attrs: {
            x: -w / 2,
            y: -h / 2,
            width: w,
            height: h / 2,
            fill: 'blue',
            fillOpacity: 0,
          },
          draggable: true,
          // visible: false,
        });

        group.addShape('rect', {
          name: 'drag-down',
          attrs: {
            x: -w / 2,
            y: 0,
            width: w,
            height: h / 2,
            fill: 'blue',
            fillOpacity: 0,
          },
          draggable: true,
          // visible: false,
        });

        group.addShape('rect', {
          name: 'drag-right',
          attrs: {
            x: w * 0.1,
            y: -h / 2,
            width: w * 0.4,
            height: h,
            fill: 'blue',
            fillOpacity: 0,
          },
          draggable: true,
          // visible: false,
        });
        return shape;
      }
    },
    'single-node',
  );
}
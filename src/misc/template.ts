type Status = "success" | "failure" | "running";

type Constructor<T = unknown> = new (...args: unknown[]) => T;

interface TreeEnv {}
interface Node {}

interface NodeDef {
  name: string;
  type: "Action" | "Decorator" | "Condition" | "Composite";
  desc: string;
  icon?: string;
  color?: string;
  input?: string[];
  args?: {
    name: string;
    type:
      | "boolean"
      | "boolean?"
      | "int"
      | "int?"
      | "float"
      | "float?"
      | "enum"
      | "enum?"
      | "string"
      | "string?"
      | "code"
      | "code?";
    desc: string;
    options?: { name: string; value: unknown }[];
  }[];
  output?: string[];
  doc?: string;
}

abstract class Process {
  init(node: Node): void {}

  run(node: Node, env: TreeEnv): Status {
    return "success";
  }

  abstract get descriptor(): NodeDef;
}

namespace zh {
  export namespace action {
    export class Clear extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Clear",
          type: "Action",
          desc: "清除变量",
          output: ["清除的变量名"],
        };
      }
    }

    export class Log extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Log",
          type: "Action",
          desc: "打印日志",
          args: [{ name: "message", type: "string", desc: "日志" }],
        };
      }
    }

    export class Now extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Now",
          type: "Action",
          desc: "获取当前时间",
          output: ["当前时间"],
        };
      }
    }

    export class Wait extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Wait",
          type: "Action",
          desc: "等待",
          input: ["等待时间?"],
          args: [
            { name: "time", type: "float", desc: "等待时间" },
            { name: "random", type: "float?", desc: "随机范围" },
          ],
        };
      }
    }
  }

  export namespace composite {
    export class Foreach extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "ForEach",
          type: "Composite",
          desc: "遍历数组",
          input: ["数组"],
          output: ["变量"],
          doc: `
            + 每次执行子节点前会设置当前遍历到的变量
            + 会执行所有子节点
            + 永远返回「成功」/「运行中」`,
        };
      }
    }

    export class Loop extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Loop",
          type: "Composite",
          desc: "循环执行",
          input: ["循环次数?"],
          args: [{ name: "count", type: "int", desc: "循环次数" }],
        };
      }
    }

    export class Parallel extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Parallel",
          type: "Composite",
          desc: "并行执行",
          doc: `执行所有子节点并返回「成功」/「运行中」`,
        };
      }
    }

    export class Selector extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Selector",
          type: "Composite",
          desc: "选择执行",
          doc: `
            + 一直往下执行，有子节点返回「成功」则返回「成功」
            + 若全部节点返回「失败」则返回「失败」
            + 子节点是或 (OR) 的关系`,
        };
      }
    }

    export class Sequence extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Sequence",
          type: "Composite",
          desc: "顺序执行",
          doc: `
            + 一直往下执行，只有当所有子节点都返回「成功」, 才返回「成功」
            + 子节点是与（AND）的关系`,
        };
      }
    }
  }

  export namespace condition {
    export class Check extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Check",
          type: "Condition",
          desc: "检查True或False",
          args: [{ name: "value", type: "code", desc: "值" }],
          doc: `
            + 做简单数值公式判定，返回「成功」或「失败」`,
        };
      }
    }
    export class IsNull extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "IsNull",
          type: "Condition",
          desc: "判断变量是否不存在",
          input: ["判断的变量"],
        };
      }
    }

    export class NotNull extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "NotNull",
          type: "Condition",
          desc: "判断变量是否存在",
          input: ["判断的变量"],
        };
      }
    }
  }

  export namespace decorator {
    export class AlwaysFail extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "AlwaysFail",
          type: "Decorator",
          desc: "始终返回失败",
          doc: `
            + 只能有一个子节点，多个仅执行第一个
            + 不管子节点是否成功都返回「失败」`,
        };
      }
    }
    export class AlwaysSuccess extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "AlwaysSuccess",
          type: "Decorator",
          desc: "始终返回成功",
          doc: `
            + 只能有一个子节点，多个仅执行第一个
            + 不管子节点是否成功都返回「成功」`,
        };
      }
    }

    export class Inverter extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Inverter",
          type: "Decorator",
          desc: "反转子节点运行结果",
          doc: `
            + 只能有一个子节点，多个仅执行第一个
            + 当子节点返回「成功」时返回「失败」
            + 当子节点返回「失败」时返回「成功」
            + 其余返回「运行中」`,
        };
      }
    }

    export class Once extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Once",
          type: "Decorator",
          desc: "只执行一次",
          doc: `
            + 只能有一个子节点，多个仅执行第一个
            + 被打断后该节点后的子节点依旧不会执行
            + 该节点执行后永远返回「成功」`,
        };
      }
    }
    export class RepeatUntilFailure extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "RepeatUntilFailure",
          type: "Decorator",
          desc: "一直尝试直到子节点返回失败",
          input: ["最大循环次数?"],
          args: [{ name: "maxLoop", type: "int?", desc: "最大循环次数" }],
          doc: `
            + 只能有一个子节点，多个仅执行第一个
            + 只有当子节点返回「失败」时，才返回「成功」，其它情况返回「运行中」状态
            + 如果设定了尝试次数，超过指定次数则返回「失败」`,
        };
      }
    }

    export class RepeatUntilSuccess extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "RepeatUntilSuccess",
          type: "Decorator",
          desc: "一直尝试直到子节点返回成功",
          input: ["最大循环次数?"],
          args: [{ name: "maxLoop", type: "int?", desc: "最大循环次数" }],
          doc: `
            + 只能有一个子节点，多个仅执行第一个
            + 只有当子节点返回「成功」时，才返回「成功」，其它情况返回「运行中」状态
            + 如果设定了尝试次数，超过指定次数则返回「失败」`,
        };
      }
    }

    export class Timeout extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Timeout",
          type: "Decorator",
          desc: "超时",
          args: [{ name: "time", type: "float", desc: "超时时间" }],
          doc: `
              + 只能有一个子节点，多个仅执行第一个
              + 当子节点执行超时或返回「失败」时，返回「失败」
              + 其余情况返回子节点的执行状态
              `,
        };
      }
    }

    const enum TreeEvent {
      INTERRUPTED = "interrupted",
      BEFORE_RUN = "beforeRun",
      AFTER_RUN = "afterRun",
      AFTER_RUN_SUCCESS = "afterRunSuccess",
      AFTER_RUN_FAILURE = "afterRunFailure",
    }

    export class Listen extends Process {
      override get descriptor(): NodeDef {
        return {
          name: "Listen",
          type: "Decorator",
          desc: "侦听行为树事件",
          args: [
            {
              name: "builtin",
              type: "enum",
              desc: "事件",
              options: [
                {
                  name: "行为树被中断",
                  value: TreeEvent.INTERRUPTED,
                },
                {
                  name: "行为树开始执行前",
                  value: TreeEvent.BEFORE_RUN,
                },
                {
                  name: "行为树执行完成后",
                  value: TreeEvent.AFTER_RUN,
                },
                {
                  name: "行为树执行成功后",
                  value: TreeEvent.AFTER_RUN_SUCCESS,
                },
                {
                  name: "行为树执行失败后",
                  value: TreeEvent.AFTER_RUN_FAILURE,
                },
              ],
            },
            {
              name: "event",
              type: "string?",
              desc: "自定义事件",
            },
          ],
          doc: `
            + 当事件触发时，执行第一个子节点，多个仅执行第一个
            + 如果子节点返回 「运行中」，会中断执行并清理执行栈`,
        };
      }
    }
  }
}

const toString = (nodes: Constructor<Process>[]) => {
  const defs: NodeDef[] = [];
  for (const cls of nodes) {
    defs.push(new cls().descriptor);
  }
  defs.sort((a, b) => a.name.localeCompare(b.name));
  let str = JSON.stringify(defs, null, 2);
  str = str.replace(/"doc": "\\n +/g, '"doc": "');
  str = str.replace(/\\n +/g, "\\n");
  return str;
};

export const zhNodeDef = () => {
  return toString([
    zh.action.Clear,
    zh.action.Log,
    zh.action.Now,
    zh.action.Wait,
    zh.composite.Foreach,
    zh.composite.Loop,
    zh.composite.Parallel,
    zh.composite.Selector,
    zh.composite.Sequence,
    zh.condition.Check,
    zh.condition.IsNull,
    zh.condition.NotNull,
    zh.decorator.AlwaysFail,
    zh.decorator.AlwaysSuccess,
    zh.decorator.Inverter,
    zh.decorator.Once,
    zh.decorator.RepeatUntilFailure,
    zh.decorator.RepeatUntilSuccess,
    zh.decorator.Timeout,
    zh.decorator.Listen,
  ]);
};

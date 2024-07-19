export const zhNodeDef = () => {
  return JSON.stringify(
    [
      {
        name: "AlwaysFail",
        type: "Decorator",
        children: 1,
        status: ["failure", "|running"],
        desc: "始终返回失败",
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 不管子节点是否成功都返回`failure`\n",
      },
      {
        name: "AlwaysSuccess",
        type: "Decorator",
        children: 1,
        status: ["success", "|running"],
        desc: "始终返回成功",
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 不管子节点是否成功都返回`success`\n",
      },
      {
        name: "Assert",
        type: "Decorator",
        children: 1,
        status: ["success"],
        desc: "断言",
        args: [
          {
            name: "message",
            type: "string",
            desc: "消息",
          },
        ],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 当子节点返回`failure`时，抛出异常\n+ 其余情况返回子节点的执行状态\n",
      },
      {
        name: "Calculate",
        type: "Action",
        children: 0,
        status: ["success"],
        desc: "简单的数值公式计算",
        args: [
          {
            name: "value",
            type: "code",
            desc: "计算公式",
          },
        ],
        output: ["计算结果"],
        doc: "+ 做简单的数值公式计算，返回结果到输出\n",
      },
      {
        name: "Check",
        type: "Condition",
        children: 0,
        status: ["success", "failure"],
        desc: "检查True或False",
        args: [
          {
            name: "value",
            type: "code",
            desc: "值",
          },
        ],
        doc: "+ 做简单数值公式判定，返回`success`或`failure`\n",
      },
      {
        name: "Clear",
        type: "Action",
        children: 0,
        status: ["success"],
        desc: "清除变量",
        output: ["清除的变量名"],
      },
      {
        name: "Concat",
        type: "Action",
        children: 0,
        status: ["success", "failure"],
        desc: "将两个输入合并为一个数组，并返回新数组",
        input: ["数组1", "数组2"],
        output: ["新数组"],
        doc: "+ 如果输入不是数组，则返回`failure`\n",
      },
      {
        name: "Delay",
        type: "Decorator",
        children: 1,
        status: ["success"],
        desc: "延时执行子节点",
        input: ["延时时间?"],
        args: [
          {
            name: "delay",
            type: "float",
            desc: "延时时间",
          },
        ],
        doc: "+ 当延时触发时，执行第一个子节点，多个仅执行第一个\n+ 如果子节点返回 `running`，会中断执行并清理执行栈",
      },
      {
        name: "Filter",
        type: "Action",
        children: 1,
        status: ["success", "failure", "|running"],
        desc: "返回满足条件的元素",
        input: ["输入数组"],
        output: ["变量", "新数组"],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 遍历输入数组，将当前元素写入`变量`，满足条件的元素放入新数组\n+ 只有当新数组不为空时，才返回`success`\n",
      },
      {
        name: "ForEach",
        type: "Action",
        children: 1,
        status: ["success", "|running", "|failure"],
        desc: "遍历数组",
        input: ["数组"],
        output: ["变量"],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 遍历输入数组，将当前元素写入`变量`\n+ 当子节点返回`failure`时，退出遍历并返回`failure`状态\n+ 执行完所有子节点后，返回`success`",
      },
      {
        name: "IfElse",
        type: "Composite",
        children: 3,
        status: ["success", "failure", "|running"],
        desc: "条件执行，if-else",
        doc: "+ 必须有三个子节点\n+ 第一个子节点为条件节点\n+ 第二个子节点为条件为`success`时执行的节点\n+ 第三个子节点为条件为`failure`时执行的节点,\n",
      },
      {
        name: "Includes",
        type: "Condition",
        children: 0,
        status: ["success", "failure"],
        desc: "判断元素是否在数组中",
        input: ["数组", "元素"],
        doc: "+ 若输入的元素不合法，返回`failure`\n+ 只有数组包含元素时返回`success`，否则返回`failure`\n",
      },
      {
        name: "Index",
        type: "Action",
        children: 0,
        status: ["success", "failure"],
        desc: "索引输入的数组或对象",
        args: [
          {
            name: "idx",
            type: "string",
            desc: "索引",
          },
        ],
        input: ["输入目标", "索引?"],
        output: ["输出目标"],
        doc: "+ 合法元素不包括 `undefined` 和 `null`\n+ 只有索引到有合法元素时候才会返回`success`，否则返回`failure`\n",
      },
      {
        name: "Invert",
        type: "Decorator",
        children: 1,
        status: ["!success", "!failure", "|running"],
        desc: "反转子节点运行结果",
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 当子节点返回`success`时返回`failure`\n+ 当子节点返回`failure`时返回`success`\n",
      },
      {
        name: "IsNull",
        type: "Condition",
        children: 0,
        status: ["success", "failure"],
        desc: "判断变量是否不存在",
        input: ["判断的变量"],
      },
      {
        name: "IsStatus",
        type: "Condition",
        children: 1,
        status: ["success", "failure"],
        desc: "检查子节点状态",
        args: [
          {
            name: "status",
            type: "enum",
            desc: "检查子节点的执行状态",
            options: [
              {
                name: "成功",
                value: "success",
              },
              {
                name: "失败",
                value: "failure",
              },
              {
                name: "运行中",
                value: "running",
              },
            ],
          },
        ],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 只有当子节点的执行状态与指定状态相同时才返回`success`，其余返回失败\n+ 若子节点返回`running`状态，将中断子节点并清理子节点的执行栈",
      },
      {
        name: "Let",
        type: "Action",
        children: 0,
        status: ["success"],
        desc: "定义新的变量名",
        input: ["变量名"],
        output: ["新变量名"],
      },
      {
        name: "Listen",
        type: "Decorator",
        children: 1,
        status: ["success"],
        desc: "侦听事件",
        input: ["目标对象?"],
        output: ["事件参数?", "事件目标?"],
        args: [
          {
            name: "event",
            type: "enum",
            desc: "事件",
            options: [
              {
                name: "行为树被中断",
                value: "treeInterrupted",
              },
              {
                name: "行为树开始执行前",
                value: "beforeRunTree",
              },
              {
                name: "行为树执行完成后",
                value: "afterRunTree",
              },
              {
                name: "行为树执行成功后",
                value: "afterRunTreeSuccess",
              },
              {
                name: "行为树执行失败后",
                value: "afterRunTreeFailure",
              },
              {
                name: "testOff",
                value: "testOff",
              },
              {
                name: "hello",
                value: "hello",
              },
            ],
          },
        ],
        doc: "+ 当事件触发时，执行第一个子节点，多个仅执行第一个\n+ 如果子节点返回 `running`，会中断执行并清理执行栈",
      },
      {
        name: "Log",
        type: "Action",
        children: 0,
        status: ["success"],
        desc: "打印日志",
        args: [
          {
            name: "message",
            type: "string",
            desc: "日志",
          },
          {
            name: "level",
            type: "enum",
            desc: "日志级别",
            default: "info",
            options: [
              {
                name: "INFO",
                value: "info",
              },
              {
                name: "DEBUG",
                value: "debug",
              },
              {
                name: "WARN",
                value: "warn",
              },
              {
                name: "ERROR",
                value: "error",
              },
            ],
          },
        ],
      },
      {
        name: "NotNull",
        type: "Condition",
        children: 0,
        status: ["success", "failure"],
        desc: "判断变量是否存在",
        input: ["判断的变量"],
      },
      {
        name: "Now",
        type: "Action",
        children: 0,
        status: ["success"],
        desc: "获取当前时间",
        output: ["当前时间"],
      },
      {
        name: "Once",
        type: "Decorator",
        children: 1,
        status: ["success", "failure", "|running"],
        desc: "只执行一次",
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 第一次执行完全部子节点时返回`success`，之后永远返回`failure`",
      },
      {
        name: "Parallel",
        type: "Composite",
        status: ["success", "|running"],
        children: -1,
        desc: "并行执行",
        doc: "+ 并行执行所有子节点\n+ 当有子节点返回`running`时，返回`running`状态\n+ 执行完所有子节点后，返回`success`",
      },
      {
        name: "Push",
        type: "Action",
        children: 0,
        status: ["success", "failure"],
        desc: "向数组中添加元素",
        input: ["数组", "元素"],
        doc: "+ 当变量`数组`不是数组类型时返回`failure`\n+ 其余返回`success`\n",
      },
      {
        name: "Random",
        type: "Action",
        children: 0,
        status: ["success"],
        desc: "返回一个随机数",
        input: ["最小值?", "最大值?"],
        args: [
          {
            name: "min",
            type: "float",
            desc: "最小值",
          },
          {
            name: "max",
            type: "float",
            desc: "最大值",
          },
          {
            name: "floor",
            type: "boolean?",
            desc: "是否向下取整",
          },
        ],
        output: ["随机数"],
      },
      {
        name: "RandomIndex",
        type: "Action",
        children: 0,
        status: ["success", "failure"],
        desc: "随机返回输入的其中一个!",
        input: ["输入目标"],
        output: ["随机目标"],
        doc: "+ 合法元素不包括 `undefined` 和 `null`\n+ 在输入数组中，随机返回其中一个\n+ 当输入数组为空时，或者没有合法元素，返回`failure`\n",
      },
      {
        name: "Repeat",
        type: "Decorator",
        children: 1,
        status: ["success", "|running", "|failure"],
        desc: "循环执行",
        input: ["循环次数?"],
        args: [
          {
            name: "count",
            type: "int",
            desc: "循环次数",
          },
        ],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 当子节点返回`failure`时，退出遍历并返回`failure`状态\n+ 执行完所有子节点后，返回`success`\n",
      },
      {
        name: "RepeatUntilFailure",
        type: "Decorator",
        children: 1,
        status: ["!success", "!failure", "|running"],
        desc: "一直尝试直到子节点返回失败",
        input: ["最大循环次数?"],
        args: [
          {
            name: "maxLoop",
            type: "int?",
            desc: "最大循环次数",
          },
        ],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 只有当子节点返回`failure`时，才返回`success`，其它情况返回`running`状态\n+ 如果设定了尝试次数，超过指定次数则返回`failure`",
      },
      {
        name: "RepeatUntilSuccess",
        type: "Decorator",
        children: 1,
        status: ["|success", "|failure", "|running"],
        desc: "一直尝试直到子节点返回成功",
        input: ["最大循环次数?"],
        args: [
          {
            name: "maxLoop",
            type: "int?",
            desc: "最大循环次数",
          },
        ],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 只有当子节点返回`success`时，才返回`success`，其它情况返回`running`状态\n+ 如果设定了尝试次数，超过指定次数则返回`failure`",
      },
      {
        name: "Selector",
        type: "Composite",
        children: -1,
        desc: "选择执行",
        status: ["|success", "&failure", "|running"],
        doc: "+ 一直往下执行，直到有子节点返回`success`则返回`success`\n+ 若全部节点返回`failure`则返回`failure`",
      },
      {
        name: "Sequence",
        type: "Composite",
        children: -1,
        status: ["&success", "|failure", "|running"],
        desc: "顺序执行",
        doc: "+ 一直往下执行，只有当所有子节点都返回`success`, 才返回`success`\n+ 若子节点返回`failure`，则直接返回`failure`状态\n+ 其余情况返回`running`状态\n",
      },
      {
        name: "Timeout",
        type: "Decorator",
        children: 1,
        status: ["|success", "|running", "failure"],
        desc: "超时",
        args: [
          {
            name: "time",
            type: "float",
            desc: "超时时间",
          },
        ],
        doc: "+ 只能有一个子节点，多个仅执行第一个\n+ 当子节点执行超时或返回`failure`时，返回`failure`\n+ 其余情况返回子节点的执行状态\n",
      },
      {
        name: "Wait",
        type: "Action",
        children: 0,
        status: ["success", "running"],
        desc: "等待",
        input: ["等待时间?"],
        args: [
          {
            name: "time",
            type: "float",
            desc: "等待时间",
          },
          {
            name: "random",
            type: "float?",
            desc: "随机范围",
          },
        ],
      },
    ],
    null,
    2
  );
};

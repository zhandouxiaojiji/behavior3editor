# 行为树编辑器
这是一个直观、可视化、通用的行为树编辑器，行为树的保存格式为json，可以让策划自行去实现AI，技能，buff等复杂的游戏逻辑，从而减少不必要的沟通成本和提升开发效率。

![](readme/preview.gif)


## 示例项目
+ 工作区: sample/workspace.b3-workspace
+ 节点定义: sample/node-config.b3-setting
+ 行为树目录: sample/workdir
+ 批处理脚本: sample/scripts

## 节点定义
```typescript
interface NodeArgOption {
  name: string;
  value: string | number;
}
interface NodeArg {
  name: string, // 字段名
  // string | string? | boolean | boolean?| int | int? | float | float? | code | code? | enum | enum?
  type: string, // 字段类型
  desc: string, // 字段中文描述
  default?: string; // 默认值
  options?: NodeArgOption[]; // 枚举类型
}
interface NodeDef {
  name: string;         //节点名称
  type?: string;        //节点分类(Composite,Decorator,Condition,Action)
  desc?: string;        //节点说明
  args?: ArgsDefType[]; //参数列表
  input?: string[];     //输入变量名 exp: ["target", "enemy?"]
  output?: string[];    //输出变量名 exp: ["target", "enemy?"]
  doc?: string;         //文档说明(markdown格式)
  color?: string;       //节点颜色 exp: "#ff00ff"
  icon?: string;        //节点图标 exp: icons/cmp.svg
}
```
节点定义配置在项目创建的时候会自动生成一个配置，参照[sample/node-config.b3-setting](sample/node-config.b3-setting)，这是个json的配置文件。编辑器不提供节点定义的编辑，强烈建议节点定义文件由代码生成 (参照示例项目[behavior3lua](https://github.com/zhandouxiaojiji/behavior3lua))。

## 编译与构建
```shell
npm install # 安装依赖
npm start # 运行测试
npm run build # 编译可执行文件
```

## 技术栈
+ react + ts
+ electron
+ antd
+ g6

## 示例行为树框架
+ lua版本 [behavior3lua](https://github.com/zhandouxiaojiji/behavior3lua)
+ js/ts版本 [behavior3-ts](https://github.com/zhongfq/behavior3-ts)。


## About
本项目将长期维护，欢迎各位大佬加群交流(Q群:644761605)

import * as fs from 'fs';
import { BehaviorNodeTypeModel } from '../common/BehaviorTreeModel';

export interface BehaviorNodeClassify {
  classify: string;
  desc?: string;
}

export interface SettingsModel {
  recentWorkspaces?: string[];
  recentFiles?: string[];
  nodeConfigPath?: string; // 节点配置路径
  nodeClassify?: BehaviorNodeClassify[];
}

const settingPath = 'settings.json';
const sampleNodeConfig = 'sample-node-config.json';
const sampleNodeClassify: BehaviorNodeClassify[] = [
  { classify: "Composite", desc: "复合节点" },
  { classify: "Decorator", desc: "修饰节点" },
  { classify: "Condition", desc: "条件节点" },
  { classify: "Action", desc: "行为节点" },
]

const unknowNodeType: BehaviorNodeTypeModel = {
  name: 'unknow',
  desc: '新建节点',
  type: 'Action',
}

export default class Settings {
  private settings: SettingsModel;
  private name2conf: { [name: string]: BehaviorNodeTypeModel } = {};
  constructor() {
    this.load();
  }

  get nodeConfigPath() {
    return this.settings.nodeConfigPath;
  }
  get recentWorkspaces() {
    return this.settings.recentWorkspaces;
  }
  get recentFiles() {
    return this.settings.recentFiles;
  }
  get nodeConfig() {
    const str = fs.readFileSync(this.nodeConfigPath, 'utf8');
    const types: BehaviorNodeTypeModel[] = JSON.parse(str);
    this.name2conf = {};
    types.forEach(t => {
      this.name2conf[t.name] = t;
    })
    return types;
  }
  get nodeClassify() {
    return this.settings.nodeClassify;
  }

  set(config: SettingsModel) {
    this.settings = {
      ...this.settings,
      ...config
    };
    this.save();
  }

  load() {
    if (fs.existsSync(settingPath)) {
      const str = fs.readFileSync(settingPath, 'utf8');
      this.settings = JSON.parse(str);
    } else {
      this.settings = {
        recentWorkspaces: [],
        recentFiles: [],
        nodeConfigPath: sampleNodeConfig,
        nodeClassify: sampleNodeClassify,
      };
      this.save();
    }
  }

  save() {
    fs.writeFileSync(settingPath, JSON.stringify(this.settings, null, 2));
  }

  getNodeConf(name: string) {
    return this.name2conf[name] || unknowNodeType;
  }
}
import * as fs from 'fs';

export interface BehaviorNodeType {
  type: string;
  desc?: string;
}

export interface SettingsModel {
  recentWorkspaces?: string[];
  recentFiles?: string[];
  nodeConfigPath?: string; // 节点配置路径
  nodeTypes?: BehaviorNodeType[];
}

const settingPath = 'settings.json';
const sampleNodeConfig = 'sample-node-config.json';
const sampleNodeTypes: BehaviorNodeType[] = [
  { type: "Composite", desc: "复合节点" },
  { type: "Decorator", desc: "修饰节点" },
  { type: "Condition", desc: "条件节点" },
  { type: "Action", desc: "行为节点" },
]

export default class Settings {
  private settings: SettingsModel;
  constructor() {
    if (fs.existsSync(settingPath)) {
      const str = fs.readFileSync(settingPath, 'utf8');
      this.settings = JSON.parse(str);
    } else {
      this.settings = {
        recentWorkspaces: [],
        recentFiles: [],
        nodeConfigPath: sampleNodeConfig,
        nodeTypes: sampleNodeTypes,
      };
      this.save();
    }
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
    return JSON.parse(str);
  }
  get nodeTypes() {
    return this.settings.nodeTypes;
  }

  set(config: SettingsModel) {
    this.settings = {
      ...this.settings,
      ...config
    };
    this.save();
  }

  save() {
    fs.writeFileSync(settingPath, JSON.stringify(this.settings, null, 2));
  }
}
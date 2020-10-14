import * as fs from 'fs';

const settingPath = 'settings.json';
const sampleNodeConfig = 'sample-node-config.json'

export interface SettingsModel {
  recentWorkspaces?: string[];
  recentFiles?: string[];
  nodeConfigPath?: string; // 节点配置路径
}

export default class Settings {
  private settings: SettingsModel;
  constructor() {
    if(fs.existsSync(settingPath)) {
      const str = fs.readFileSync(settingPath, 'utf8');
      this.settings = JSON.parse(str);
    } else {
      this.settings = {
        recentWorkspaces: [],
        recentFiles: [],
        nodeConfigPath: sampleNodeConfig,
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
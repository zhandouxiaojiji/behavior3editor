import * as fs from 'fs';

const settingPath = 'settings.json';

export interface SettingsModel {
  recentWorkspaces: string[];
  recentFiles: string[];
  nodeConfigPath: string; // 节点配置路径
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
        nodeConfigPath: ''
      };
      this.save();
    }
  }

  set(config: any) {
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
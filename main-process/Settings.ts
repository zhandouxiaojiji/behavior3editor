import * as fs from "fs";
import { BehaviorNodeTypeModel } from "../common/BehaviorTreeModel";
import Workspace from "./Workspace";

export interface BehaviorNodeClassify {
    classify: string;
    desc?: string;
}

export interface SettingsModel {
    recentWorkspaces?: string[];
    recentFiles?: string[];
    nodeClassify?: BehaviorNodeClassify[];
}

const settingPath = "settings.json";
const sampleNodeClassify: BehaviorNodeClassify[] = [
    { classify: "Composite", desc: "复合节点" },
    { classify: "Decorator", desc: "修饰节点" },
    { classify: "Condition", desc: "条件节点" },
    { classify: "Action", desc: "行为节点" },
];

export default class Settings {
    private settings: SettingsModel;
    curWorkspace?: Workspace;

    constructor() {
        this.load();
    }

    get nodeConfPath() {
        return this.curWorkspace.getNodeConfPath();
    }
    get recentWorkspaces() {
        return this.settings.recentWorkspaces;
    }
    get recentFiles() {
        return this.settings.recentFiles;
    }
    get nodeConfig() {
        return this.curWorkspace.nodeConf;
    }
    get nodeClassify() {
        return this.settings.nodeClassify;
    }

    set(config: SettingsModel) {
        this.settings = {
            ...this.settings,
            ...config,
        };
        this.save();
    }

    load() {
        if (fs.existsSync(settingPath)) {
            const str = fs.readFileSync(settingPath, "utf8");
            this.settings = JSON.parse(str);
        } else {
            this.settings = {
                recentWorkspaces: ["sample/workspace.json"],
                recentFiles: [],
                nodeClassify: sampleNodeClassify,
            };
            this.save();
        }
        this.curWorkspace = new Workspace(this.settings.recentWorkspaces[0]);
        this.curWorkspace.load();
    }

    save() {
        fs.writeFileSync(settingPath, JSON.stringify(this.settings, null, 2));
    }

    getNodeConf(name: string) {
        return this.curWorkspace.getNodeConf(name);
    }

    pushRecentWorkspace(path: string) {
        if (this.settings.recentWorkspaces.indexOf(path) < 0) {
            this.settings.recentWorkspaces.unshift(path);
            console.log("push", path);
        } else {
            console.log("already in path", this.settings.recentWorkspaces, path);
        }
        this.save();
    }
}

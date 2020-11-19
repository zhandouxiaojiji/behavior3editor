import * as fs from "fs";
import Workspace from "./Workspace";

export interface BehaviorNodeClassify {
    classify: string;
    desc?: string;
}

export interface SettingsModel {
    recentWorkspaces?: string[];
    recentFiles?: string[];
    serverName?: string;
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
    private model: SettingsModel;
    curWorkspace?: Workspace;

    constructor() {
        this.load();
    }

    get nodeConfPath() {
        return this.curWorkspace.getNodeConfPath();
    }
    get recentWorkspaces() {
        return this.model.recentWorkspaces;
    }
    get recentFiles() {
        return this.model.recentFiles;
    }
    get nodeConfig() {
        return this.curWorkspace.nodeConf;
    }
    get nodeClassify() {
        return this.model.nodeClassify;
    }
    get serverModel() {
        const servers = this.curWorkspace.getServers()
        if (!servers) {
            return;
        }
        for (let server of servers) {
            if (server.name == this.model.serverName) {
                return server;
            }
        }
        return servers[0];
    }
    get serverName() {
        const servers = this.curWorkspace.getServers()
        if (!servers) {
            return "";
        }
        for (let server of servers) {
            if (server.name == this.model.serverName) {
                return this.model.serverName;
            }
        }
        if(servers[0]) {
            return servers[0].name;
        } else {
            return ''
        }
    }
    set serverName(name: string) {
        this.model.serverName = name;
    }

    set(config: SettingsModel) {
        this.model = {
            ...this.model,
            ...config,
        };
        this.save();
    }

    load() {
        if (fs.existsSync(settingPath)) {
            const str = fs.readFileSync(settingPath, "utf8");
            this.model = JSON.parse(str);
        } else {
            this.model = {
                recentWorkspaces: ["sample/workspace.json"],
                recentFiles: [],
                nodeClassify: sampleNodeClassify,
            };
            this.save();
        }
        this.curWorkspace = new Workspace(this.model.recentWorkspaces[0]);
        this.curWorkspace.load();
    }

    save() {
        fs.writeFileSync(settingPath, JSON.stringify(this.model, null, 2));
    }

    getNodeConf(name: string) {
        return this.curWorkspace.getNodeConf(name);
    }

    pushRecentWorkspace(path: string) {
        if (this.model.recentWorkspaces.indexOf(path) < 0) {
            this.model.recentWorkspaces.unshift(path);
            this.save();
        }
    }
}

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
    treesDesc?: { [name: string]: string };
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
    private dirty: boolean = false;
    curWorkspace?: Workspace;

    constructor() {
        this.load();

        setInterval(() => {
            if (this.dirty) {
                fs.writeFileSync(settingPath, JSON.stringify(this.model, null, 2));
                this.dirty = false;
            }
        }, 1000)
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
        if (servers[0]) {
            return servers[0].name;
        } else {
            return ''
        }
    }
    set serverName(name: string) {
        this.model.serverName = name;
        this.save();
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
            if (!this.model.treesDesc) {
                this.model.treesDesc = {};
                this.save();
            }
        } else {
            this.model = {
                recentWorkspaces: ["sample/workspace.json"],
                recentFiles: [],
                nodeClassify: sampleNodeClassify,
                treesDesc: {},
            };
            this.save();
        }
        this.curWorkspace = new Workspace(this.model.recentWorkspaces[0]);
        this.curWorkspace.load();
    }

    save() {
        this.dirty = true;
    }

    getNodeConf(name: string) {
        return this.curWorkspace.getNodeConf(name);
    }

    pushRecentWorkspace(path: string) {
        var list = this.model.recentWorkspaces;
        if (list.indexOf(path) >= 0) {
            list = list.filter((value) => value !== path);
        }
        list.unshift(path);
        while (list.length > 10) {
            list.pop();
        }
        this.model.recentWorkspaces = list;
        this.save();
    }

    getTreeDesc(name: string) {
        const key = this.curWorkspace.getFilepath() + ' ' + name;
        var desc = this.model.treesDesc[key];
        if (!desc) {
            const str = fs.readFileSync(name, "utf8");
            const tree = JSON.parse(str);
            desc = tree.desc ? tree.desc : '';
            this.model.treesDesc[key] = desc;
            this.save();
        }
        return desc;
    }

    setTreeDesc(name: string, desc?: string) {
        const key = this.curWorkspace.getFilepath() + ' ' + name;
        this.model.treesDesc[key] = desc;
    }
}

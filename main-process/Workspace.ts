import * as fs from "fs";
import { BehaviorNodeTypeModel } from "../common/BehaviorTreeModel";
import * as glob from "glob";
import * as path from "path";

export interface WorkspaceModel {
    isRelative?: boolean;
    nodeConfPath: string;
    workdir: string;
}

const unknowNodeType: BehaviorNodeTypeModel = {
    name: "unknow",
    desc: "新建节点",
    type: "Action",
};

export default class Workspace {
    private filepath: string;
    private nodeConfPath: string;
    private workdir: string;

    private name2conf: { [name: string]: BehaviorNodeTypeModel } = {};
    private types: BehaviorNodeTypeModel[] = [];

    constructor(filepath: string) {
        this.filepath = filepath;
    }

    load() {
        if (!this.filepath) {
            return;
        }
        try {
            const str = fs.readFileSync(this.filepath, "utf8");
            const model = JSON.parse(str) as WorkspaceModel;
            if (model.isRelative) {
                const root = path.dirname(this.filepath);
                this.nodeConfPath = path.join(root,model.nodeConfPath);
                this.workdir = path.join(root,model.workdir);
            } else {
                this.nodeConfPath = model.nodeConfPath;
                this.workdir = model.workdir;
            }

            this.initNodeConf();
        } catch (error) {
            console.log(error);
        }
    }

    private initNodeConf() {
        if (!this.nodeConfPath) {
            return;
        }

        const types: BehaviorNodeTypeModel[] = JSON.parse(
            fs.readFileSync(this.nodeConfPath, "utf8")
        );
        this.name2conf = {};
        types.forEach((t) => {
            this.name2conf[t.name] = t;
        });
        this.types = types;
    }

    getNodeConfPath() {
        return this.nodeConfPath;
    }
    setNodeConfPath(path: string) {
        this.nodeConfPath = path;
        this.initNodeConf();
    }
    getWorkdir(): string {
        return this.workdir;
    }
    setWorkdir(workdir: string) {
        this.workdir = workdir;
    }

    writeAllTrees(outFilePath: string, cb?: (err: string) => void) {
        if (!fs.existsSync(this.getWorkdir())) {
            cb && cb("请先打开工作区");
            return;
        }
        glob.glob(path.join(this.getWorkdir(), "**/*.json"), function (err, files) {
            if (err) {
                console.error(err);
                cb && cb(err.message);
                return;
            }

            let result = new Array();
            files.forEach((file) => {
                const data = fs.readFileSync(file, "utf8");
                result.push(JSON.parse(data));
            });

            fs.writeFileSync(outFilePath, JSON.stringify(result, null, 2));
            cb && cb(null);
        });
    }

    save(filepath?: string) {
        if (filepath) {
            this.filepath = filepath;
        }
        if (!this.filepath) {
            return;
        }
        fs.writeFileSync(
            this.filepath,
            JSON.stringify(
                {
                    nodeConfPath: this.nodeConfPath,
                    workdir: this.workdir,
                },
                null,
                2
            )
        );
    }

    get nodeConf() {
        return this.types;
    }

    getFilepath() {
        return this.filepath;
    }

    setFilepath(filepath: string) {
        this.filepath = filepath;
    }

    getNodeConf(name: string) {
        return this.name2conf[name] || unknowNodeType;
    }
}

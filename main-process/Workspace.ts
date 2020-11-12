import * as fs from 'fs';
import * as path from 'path';
import { BehaviorNodeTypeModel } from '../common/BehaviorTreeModel';

export interface WorkspaceModel {
  isRelative?: boolean;
  nodeConfPath: string;
  workdir: string;
}

const unknowNodeType: BehaviorNodeTypeModel = {
  name: 'unknow',
  desc: '新建节点',
  type: 'Action',
}

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
      const str = fs.readFileSync(this.filepath, 'utf8');
      const model = JSON.parse(str) as WorkspaceModel;
      if (model.isRelative) {
        const root = path.dirname(this.filepath);
        this.nodeConfPath = root + '/' + model.nodeConfPath;
        this.workdir = root + '/' + model.workdir;
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

    const types: BehaviorNodeTypeModel[] = JSON.parse(fs.readFileSync(this.nodeConfPath, 'utf8'));
    this.name2conf = {};
    types.forEach(t => {
      this.name2conf[t.name] = t;
    })
    this.types = types;
  }

  getNodeConfPath() {
    return this.nodeConfPath;
  }
  setNodeConfPath(path: string) {
    this.nodeConfPath = path;
    this.initNodeConf();
  }
  getWorkdir() {
    return this.workdir;
  }
  setWorkdir(workdir: string) {
    this.workdir = workdir;
  }

  save(filepath?: string) {
    if (filepath) {
      this.filepath = filepath;
    }
    if (!this.filepath) {
      return;
    }
    fs.writeFileSync(this.filepath, JSON.stringify({
      nodeConfPath: this.nodeConfPath,
      workdir: this.workdir,
    }, null, 2))
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
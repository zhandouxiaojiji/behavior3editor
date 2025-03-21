import { Matrix, TreeGraph } from "@antv/g6";
import { BrowserWindow, dialog } from "@electron/remote";
import { ipcRenderer } from "electron";
import * as fs from "fs";
import React from "react";
import { create } from "zustand";
import { NodeDef } from "../behavior3/src/behavior3";
import {
  FileVarDecl,
  ImportDef,
  NodeModel,
  TreeGraphData,
  TreeModel,
  VarDef,
} from "../misc/b3type";
import * as b3util from "../misc/b3util";
import { message } from "../misc/hooks";
import i18n from "../misc/i18n";
import Path from "../misc/path";
import { zhNodeDef } from "../misc/template";
import { readJson, readTree, writeJson } from "../misc/util";
import { useSetting } from "./setting-context";

let buildDir: string | undefined;

interface BatchScript {
  processTree?(tree: TreeModel, path: string): TreeModel;

  processNode?(node: NodeModel, tree: TreeModel): NodeModel;
}

export type EditEvent =
  | "save"
  | "copy"
  | "paste"
  | "replace"
  | "delete"
  | "insert"
  | "jumpNode"
  | "undo"
  | "redo"
  | "refresh"
  | "rename"
  | "reload"
  | "updateTree"
  | "updateNode"
  | "searchNode"
  | "editSubtree"
  | "saveAsSubtree"
  | "clickVar";

export class EditorStore {
  path: string;
  data: TreeModel;

  root: TreeGraphData;
  declare: FileVarDecl;

  autoId: number = 1;
  dragSrcId?: string;
  dragDstId?: string;
  unsave: boolean = false;
  modifiedTime: number = Date.now();
  alertReload: boolean = false;
  searchingText?: string;

  historyStack: string[] = [];
  historyIndex: number = 0;
  selectedId?: string | null;

  size = { width: 0, height: 0 };
  graphMatrix?: Matrix;
  graph!: TreeGraph;

  editNode: EditNode | number | null = null;

  dispatch!: (event: EditEvent, data?: unknown) => void;

  constructor(path: string) {
    this.path = path;
    this.data = readTree(path);
    this.data.name = Path.basenameWithoutExt(path);
    this.root = b3util.createTreeData(this.data.root);
    this.modifiedTime = fs.statSync(path).mtimeMs;
    this.declare = {
      import: this.data.import.map((v) => ({ path: v, vars: [], depends: [] })),
      subtree: [],
      declvar: this.data.declvar.map((v) => ({ ...v })),
    };
    this.autoId = b3util.refreshTreeDataId(this.root, this.data.firstid);
    this.historyStack.push(
      JSON.stringify(
        {
          ...this.data,
          root: b3util.createNode(this.root),
        },
        null,
        2
      )
    );
    this.historyIndex = 0;
  }
}

export type FileTreeType = {
  path: string;
  title: string;
  icon?: React.ReactNode;
  desc?: string;
  isLeaf?: boolean;
  children?: FileTreeType[];
  editing?: boolean;
  style?: React.CSSProperties;
};

export type EditNode = {
  data: NodeModel;
  editable: boolean;
  limitError?: boolean;
};

export type EditNodeDef = {
  data: NodeDef;
};

export type EditTree = {
  name: string;
  desc?: string;
  export?: boolean;
  firstid?: number;
  group: string[];
  import: ImportDef[];
  declvar: VarDef[];
  subtree: ImportDef[];
  root: TreeGraphData;
};

export type FileMeta = {
  path: string;
  desc?: string;
  exists?: boolean;
};

interface WorkspaceModel {
  files?: { path: string; desc: string }[];
}

export type WorkspaceStore = {
  init: (project: string) => void;
  createProject: () => void;
  openProject: (project?: string) => void;
  batchProject: () => void;
  buildProject: () => void;

  workdir: string;
  path: string;

  loadWorkspace: () => void;
  saveWorkspace: () => void;
  updateFileMeta: (editor: EditorStore) => void;

  allFiles: Map<string, FileMeta>;
  fileTree?: FileTreeType;
  editors: EditorStore[];
  editing?: EditorStore;

  modifiedTime: number;

  isShowingSearch: boolean;
  onShowingSearch: (isShowingSearch: boolean) => void;

  open: (path: string, selectedNode?: number) => void;
  edit: (path: string, selectedNode?: number) => void;
  close: (path: string) => void;
  find: (path: string) => EditorStore | undefined;
  relative: (path: string) => string;
  refresh: (path: string) => void;

  save: () => void;
  saveAs: () => void;
  saveAll: () => void;

  watch(): void;
  loadTrees: () => void;

  loadNodeDefs: () => void;
  nodeDefs: b3util.NodeDefs;
  groupDefs: string[];

  // edit node
  editingNode?: EditNode | null;
  onEditingNode: (node: EditNode) => void;

  // edit node def
  editingNodeDef?: EditNodeDef | null;
  onEditingNodeDef: (node: EditNodeDef) => void;

  // edit tree
  editingTree?: EditTree | null;
  onEditingTree: (editor: EditorStore) => void;
};

const loadFileTree = (workdir: string, filename: string) => {
  const fullpath = Path.posixPath(`${workdir}/${filename}`);

  if (!fs.existsSync(fullpath) || filename.endsWith(".DS_Store")) {
    return;
  }

  const stat = fs.statSync(fullpath);

  const data: FileTreeType = {
    path: fullpath.replaceAll(Path.sep, "/"),
    title: Path.basename(filename),
  };

  if (stat.isDirectory()) {
    data.children = [];
    const files = fs.readdirSync(data.path);
    files.forEach((v) => {
      const child = loadFileTree(workdir, `${filename}/${v}`);
      if (child) {
        data.children?.push(child);
      }
    });
    data.children.sort((a, b) => {
      if ((a.children && b.children) || (!a.children && !b.children)) {
        return a.title.localeCompare(b.title);
      } else {
        return a.children ? -1 : 1;
      }
    });
  } else {
    data.isLeaf = true;
  }
  return data;
};

const saveFile = (editor?: EditorStore) => {
  if (editor?.unsave) {
    editor.dispatch("save");
  }
};

export const useWorkspace = create<WorkspaceStore>((set, get) => ({
  allFiles: new Map(),
  fileTree: undefined,
  editors: [],
  modifiedEditors: [],
  workdir: "",
  path: "",

  init: (path) => {
    const workspace = get();
    if (!workspace.workdir) {
      try {
        workspace.workdir = Path.dirname(path).replaceAll(Path.sep, "/");
        workspace.path = path;
        workspace.loadWorkspace();
        workspace.loadTrees();
        workspace.loadNodeDefs();
        workspace.watch();
        useSetting.getState().appendRecent(path);
      } catch (error) {
        console.error(error);
        if (!fs.existsSync(path)) {
          useSetting.getState().removeRecent(path);
        }
        message.error(`load workspace error: ${path}`);
      }
    }
  },

  createProject: () => {
    const path = dialog.showSaveDialogSync({
      properties: ["showOverwriteConfirmation", "createDirectory"],
      filters: [{ name: "Behavior3 Workspace", extensions: ["b3-workspace"] }],
    });
    if (path) {
      const workspace = get();
      fs.writeFileSync(Path.dirname(path) + "/node-config.b3-setting", zhNodeDef());
      fs.writeFileSync(
        Path.dirname(path) + "/example.json",
        JSON.stringify(
          {
            name: "example",
            root: {
              id: 1,
              name: "Sequence",
              children: [
                {
                  id: 2,
                  name: "Log",
                  args: {
                    str: "hello",
                  },
                },
                {
                  id: 3,
                  name: "Wait",
                  args: {
                    time: 1,
                  },
                },
              ],
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path,
        JSON.stringify(
          {
            nodeConf: "node-config.b3-setting",
            metadata: [],
          },
          null,
          2
        )
      );
      workspace.init(path);
    }
  },

  openProject: (project?: string) => {
    if (project) {
      ipcRenderer.invoke("open-win", project);
    } else {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        const path = dialog.showOpenDialogSync(win, {
          filters: [{ name: "workspace", extensions: ["b3-workspace"] }],
        });
        if (path?.length) {
          ipcRenderer.invoke("open-win", path[0]);
        }
      }
    }
  },

  buildProject: () => {
    const workspace = get();
    if (workspace.path) {
      if (!buildDir) {
        buildDir = dialog.showOpenDialogSync({
          properties: ["openDirectory", "createDirectory"],
          defaultPath: useSetting.getState().data.buildDir,
        })?.[0];
      }
    }
    if (buildDir) {
      for (const editor of workspace.editors) {
        editor.dispatch("save");
      }
      try {
        let hasError = false;
        workspace.allFiles.forEach((file) => {
          const buildpath = buildDir + "/" + workspace.relative(file.path);
          const treeModel = b3util.createBuildData(file.path);
          if (!treeModel) {
            return;
          }
          if (treeModel.export === false) {
            console.log("skip:", buildpath);
            return;
          }
          console.log("build:", buildpath);
          const declare: FileVarDecl = {
            import: treeModel.import.map((v) => ({ path: v, vars: [], depends: [] })),
            declvar: treeModel.declvar.map((v) => ({ name: v.name, desc: v.desc })),
            subtree: [],
          };
          b3util.refreshDeclare(treeModel.root, treeModel.group, declare);
          if (!b3util.checkNodeData(treeModel?.root)) {
            hasError = true;
          }
          fs.mkdirSync(Path.dirname(buildpath), { recursive: true });
          fs.writeFileSync(buildpath, JSON.stringify(treeModel, null, 2));
        });
        if (hasError) {
          message.error(i18n.t("buildFailed"));
        } else {
          message.success(i18n.t("buildCompleted"));
        }
        useSetting.getState().setBuildDir(buildDir);
      } catch (error) {
        console.error(error);
        message.error(i18n.t("buildFailed"));
      }
    }
  },

  batchProject: () => {
    const workspace = get();
    const scriptPath = dialog.showOpenDialogSync({
      properties: ["openFile"],
      defaultPath: workspace.workdir,
      filters: [{ name: "Javascript", extensions: ["js"] }],
    })?.[0];
    if (scriptPath) {
      let hasError = false;
      try {
        console.log("run script", scriptPath);
        const str = fs.readFileSync(scriptPath, "utf8");
        const batch = eval(str) as BatchScript;
        workspace.allFiles.forEach((file) => {
          let tree: TreeModel | undefined = readTree(file.path);
          if (batch.processTree && tree) {
            tree = batch.processTree(tree, file.path);
          }
          if (tree && batch.processNode) {
            const processNode = (node: NodeModel) => {
              if (node.children) {
                const children: NodeModel[] = [];
                node.children?.forEach((child) => {
                  const newChild = processNode(child);
                  if (newChild) {
                    children.push(newChild);
                  }
                });
                node.children = children;
              }
              return batch.processNode?.(node, tree!);
            };
            tree.root = processNode(tree.root) ?? ({} as NodeModel);
          }
          if (tree) {
            fs.writeFileSync(file.path, JSON.stringify(tree, null, 2));
          }
        });
      } catch (error) {
        hasError = true;
        console.error(error);
      }
      if (hasError) {
        message.error(i18n.t("batchFailed"));
      } else {
        message.success(i18n.t("batchCompleted"));
      }
    }
  },

  loadWorkspace: () => {
    const workspace = get();
    const data = readJson(workspace.path) as WorkspaceModel;
    data.files?.forEach((file) => {
      workspace.allFiles.set(file.path, { path: file.path, desc: file.desc, exists: false });
    });
  },

  saveWorkspace: () => {
    const workspace = get();
    const data: WorkspaceModel = {
      files: [],
    };
    workspace.allFiles.forEach((file) => {
      data.files?.push({
        path: workspace.relative(file.path),
        desc: file.desc ?? "",
      });
    });
    data.files?.sort((a, b) => a.path.localeCompare(b.path));
    writeJson(workspace.path, data);
  },

  updateFileMeta: (editor) => {
    const workspace = get();
    const path = workspace.relative(editor.path);
    const file = workspace.allFiles.get(path);
    if (file && file.desc !== editor.data.desc) {
      file.desc = editor.data.desc;
      set({ allFiles: new Map(workspace.allFiles) });
      workspace.saveWorkspace();
    }
  },

  modifiedTime: 0,

  isShowingSearch: false,
  onShowingSearch: (isShowingSearch) => {
    set({ isShowingSearch });
  },

  open: (path, selectedNode) => {
    path = Path.posixPath(path);
    const workspace = get();
    let editor = workspace.editors.find((v) => v.path === path);
    if (!editor) {
      try {
        editor = new EditorStore(path);
        workspace.editors.push(editor);
        set({ editors: workspace.editors });
        workspace.updateFileMeta(editor);
        workspace.edit(editor.path, selectedNode);

        if (b3util.isNewVersion(editor.data.version)) {
          message.warning(i18n.t("alertNewVersion", { version: editor.data.version }));
        }
      } catch (error) {
        console.error(error);
        message.error(`invalid file: ${path}`);
      }
    } else if (workspace.editing !== editor) {
      workspace.edit(editor.path, selectedNode);
    }
  },

  edit: (path, selectedNode) => {
    const workspace = get();
    const editor = workspace.editors.find((v) => v.path === path);
    if (editor && selectedNode) {
      editor.editNode = selectedNode;
    }
    set({ editing: editor, editingNode: null, editingTree: null });
    if (editor) {
      workspace.refresh(editor.path);
      if (!editor.editNode) {
        workspace.onEditingTree(editor);
      } else if (typeof editor.editNode === "object") {
        workspace.onEditingNode(editor.editNode);
      }
    } else {
      set({ editingNode: null, editingTree: null });
    }
  },

  close: (path) => {
    const workspace = get();
    const idx = workspace.editors.findIndex((v) => v.path === path);
    const editors = workspace.editors.filter((v) => v.path !== path);
    let editting = workspace.editing;
    if (editors.length && path === editting?.path) {
      editting = editors[idx === editors.length ? idx - 1 : idx];
      workspace.onEditingTree(editting);
    }
    if (editors.length === 0) {
      editting = undefined;
      set({ editingNode: undefined, editingTree: undefined });
    }
    set({ editing: editting, editors: editors });
  },

  find: (path) => {
    const workspace = get();
    return workspace.editors.find((v) => v.path === path);
  },

  relative: (path: string) => {
    const workspace = get();
    return Path.relative(workspace.workdir, path).replaceAll(Path.sep, "/");
  },

  refresh: (path: string) => {
    const workspace = get();
    const editor = workspace.editors.find((v) => v.path === path);
    if (!editor) {
      return;
    }
    b3util.refreshDeclare(editor.root, editor.data.group, editor.declare);
  },

  save: () => {
    const workspace = get();
    saveFile(workspace.editing);
  },

  saveAs: () => {},

  saveAll: () => {
    const workspace = get();
    for (const editor of workspace.editors) {
      saveFile(editor);
    }
  },

  watch: () => {
    try {
      const workspace = get();
      let hasEvent = false;
      fs.watch(workspace.workdir, { recursive: true }, (event, filename) => {
        if (event === "rename") {
          if (!hasEvent) {
            setTimeout(() => {
              workspace.loadTrees();
              hasEvent = false;
            }, 200);
            hasEvent = true;
          }
        }
        if (event === "change" && filename) {
          if (filename === "node-config.b3-setting") {
            workspace.loadNodeDefs();
          } else {
            const fullpath = Path.posixPath(`${workspace.workdir}/${filename}`);
            const editor = workspace.find(fullpath);
            const modified = fs.statSync(fullpath).mtimeMs;
            b3util.files[Path.posixPath(filename)] = modified;
            if (editor && editor.modifiedTime + 500 < modified) {
              if (editor.unsave) {
                editor.alertReload = true;
                set({ modifiedTime: Date.now() });
              } else {
                editor.dispatch("reload");
              }
            }
          }
        }
      });
    } catch (e) {
      console.error(e);
    }
  },

  loadTrees: () => {
    const workspace = get();
    const data = loadFileTree(workspace.workdir, ".")!;
    data.title = Path.basename(workspace.workdir).toUpperCase();
    data.style = {
      fontWeight: "bold",
      fontSize: "13px",
    };
    set({ fileTree: data });

    const allFiles = workspace.allFiles;
    let updated = false;
    allFiles.forEach((file) => (file.exists = false));
    const collect = (fileNode?: FileTreeType) => {
      if (fileNode?.isLeaf && b3util.isTreeFile(fileNode.path)) {
        const path = workspace.relative(fileNode.path);
        let fileMeta = allFiles.get(path);
        if (!fileMeta) {
          fileMeta = { path: fileNode.path };
          allFiles.set(path, fileMeta);
        } else {
          fileMeta.path = fileNode.path;
        }
        fileMeta.exists = true;
        if (fileMeta.desc === undefined) {
          const file = readJson(fileNode.path) as TreeModel;
          fileMeta.desc = file.desc ?? "";
          updated = true;
        }
      }
      fileNode?.children?.forEach((child) => collect(child));
    };
    collect(data);
    allFiles.forEach((file, key) => {
      if (!file.exists) {
        allFiles.delete(key);
        delete b3util.files[key];
        updated = true;
      }
      const modified = fs.statSync(file.path).mtimeMs;
      b3util.files[key] = modified;
    });
    set({ allFiles });
    if (updated) {
      workspace.saveWorkspace();
    }
  },

  nodeDefs: new b3util.NodeDefs(),
  groupDefs: [],
  loadNodeDefs: () => {
    const workspace = get();
    b3util.initWorkdir(workspace.workdir, message.error.bind(message));
    set({ nodeDefs: b3util.nodeDefs, groupDefs: b3util.groupDefs });
    workspace.editing?.dispatch("refresh");
  },

  // node edit
  onEditingNode: (node) => {
    const workspace = get();
    if (workspace.editing) {
      workspace.editing.editNode = node;
    }
    set({ editingNode: node, editingNodeDef: null, editingTree: null });
  },

  onEditingNodeDef: (nodeDef) => {
    const workspace = get();
    if (workspace.editing) {
      workspace.editing.editNode = null;
    }
    set({ editingNodeDef: nodeDef, editingNode: null, editingTree: null });
  },

  // tree edit
  onEditingTree: (editor) => {
    const workspace = get();
    if (workspace.editing) {
      workspace.editing.editNode = null;
    }
    workspace.refresh(editor.path);
    set({
      editingTree: {
        ...editor.data,
        root: editor.root,
        import: editor.declare.import,
        declvar: editor.declare.declvar,
        subtree: editor.declare.subtree,
      },
      editingNodeDef: null,
      editingNode: null,
    });
  },
}));

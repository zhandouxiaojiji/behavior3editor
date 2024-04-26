import { NodeDef, NodeModel, TreeGraphData, TreeModel, unknownNodeDef } from "@/misc/b3type";
import * as b3util from "@/misc/b3util";
import { message } from "@/misc/hooks";
import i18n from "@/misc/i18n";
import { readJson } from "@/misc/json";
import Path from "@/misc/path";
import { Matrix, TreeGraph } from "@antv/g6";
import { BrowserWindow, dialog } from "@electron/remote";
import * as fs from "fs";
import React from "react";
import { create } from "zustand";
import { useSetting } from "./setting-context";
import { ipcRenderer } from "electron";

let buildDir: string | undefined;

interface BatchScript {
  processTree?(tree: TreeModel): TreeModel;
  processNode?(node: NodeModel, tree: TreeModel): NodeModel;
}

export type EditEvent =
  | "save"
  | "copy"
  | "paste"
  | "replace"
  | "delete"
  | "insert"
  | "undo"
  | "redo"
  | "reload"
  | "rename"
  | "updateTree"
  | "updateNode"
  | "searchNode"
  | "editSubtree"
  | "saveAsSubtree";

export class EditorStore {
  path: string;
  data: TreeGraphData;
  desc: string;
  name: string;

  autoId: number = 1;
  dragSrcId?: string;
  dragDstId?: string;
  unsave: boolean = false;
  historyStack: NodeModel[] = [];
  historyIndex: number = 0;
  selectedId?: string | null;

  size = { width: 0, height: 0 };
  graphMatrix?: Matrix;
  graph!: TreeGraph;

  dispatch!: (event: EditEvent, data?: unknown) => void;

  constructor(path: string) {
    this.path = path;

    const file = readJson(path);
    this.data = b3util.createTreeData(file.root);
    this.desc = file.desc;
    this.name = file.name || path.slice(0, -5);
    this.autoId = b3util.refreshTreeDataId(this.data);
    this.historyStack.push(b3util.createNode(this.data));
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
};

export type EditNodeDef = {
  data: NodeDef;
};

export type EditTree = {
  data: TreeModel;
};

export type WorkspaceStore = {
  init: (project: string) => void;
  createProject: () => void;
  openProject: (project?: string) => void;
  batchProject: () => void;
  buildProject: () => void;

  workdir: string;
  path: string;

  allFiles: string[];
  fileTree?: FileTreeType;
  editors: EditorStore[];
  editing?: EditorStore;

  isShowingSearch: boolean;
  onShowingSearch: (isShowingSearch: boolean) => void;

  open: (path: string) => void;
  edit: (path: string) => void;
  close: (path: string) => void;
  find: (path: string) => EditorStore | undefined;

  save: () => void;
  saveAs: () => void;
  saveAll: () => void;

  watch(): void;
  loadTrees: () => void;
  loadNodeDefs: () => void;

  // edit node
  editingNode?: EditNode | null;
  onEditingNode: (node: EditNode) => void;

  // edit node def
  editingNodeDef?: EditNodeDef | null;
  onEditingNodeDef: (node: EditNodeDef) => void;

  // edit tree
  editingTree?: EditTree | null;
  onEditingTree: (tree: EditTree | null) => void;

  // node setting
  nodeDefs: Map<string, NodeDef>;
  getNodeDef: (name: string) => NodeDef;
  hasNodeDef: (name: string) => boolean;
};

const loadFileTree = (workdir: string, filename: string) => {
  const fullpath = fs.realpathSync(`${workdir}/${filename}`);
  if (!fs.existsSync(fullpath)) {
    return;
  }

  const stat = fs.statSync(fullpath);
  if (!(stat.isDirectory() || fullpath.endsWith(".json"))) {
    return;
  }

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
  allFiles: [],
  fileTree: undefined,
  editors: [],
  workdir: "",
  path: "",

  init: (path) => {
    const workspace = get();
    if (!workspace.workdir) {
      try {
        workspace.workdir = Path.dirname(path).replaceAll(Path.sep, "/");
        workspace.path = path;
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
      b3util.createProject(path);
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
    if (workspace.path)
      if (!buildDir) {
        buildDir = dialog.showOpenDialogSync({
          properties: ["openDirectory", "createDirectory"],
        })?.[0];
      }
    if (buildDir) {
      for (const editor of workspace.editors) {
        editor.dispatch("save");
      }
      try {
        let hasError = false;
        for (const path of workspace.allFiles) {
          const buildpath = buildDir + "/" + Path.relative(workspace.workdir, path);
          console.log("build:", buildpath);
          const treeModel = b3util.createBuildData(path);
          if (!b3util.checkNodeData(treeModel?.root)) {
            hasError = true;
          }
          fs.mkdirSync(Path.dirname(buildpath), { recursive: true });
          fs.writeFileSync(buildpath, JSON.stringify(treeModel, null, 2));
        }
        if (hasError) {
          message.error(i18n.t("buildFailed"));
        } else {
          message.success(i18n.t("buildCompleted"));
        }
      } catch (error) {
        console.error(error);
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
      try {
        console.log("run script", scriptPath);
        const str = fs.readFileSync(scriptPath, "utf8");
        const batch = eval(str) as BatchScript;
        workspace.allFiles.forEach((path) => {
          const treeStr = fs.readFileSync(path, "utf8");
          let tree: TreeModel | undefined = JSON.parse(treeStr);
          if (batch.processTree && tree) {
            tree = batch.processTree(tree);
          }
          if (tree && batch.processNode) {
            const processNode = (node: NodeModel) => {
              batch.processNode?.(node, tree!);
              node.children?.forEach((child) => processNode(child));
            };
            processNode(tree.root);
          }
          if (tree) {
            fs.writeFileSync(path, JSON.stringify(tree));
          }
        });
      } catch (error) {
        console.error(error);
      }
    }
  },

  isShowingSearch: false,
  onShowingSearch: (isShowingSearch) => {
    set({ isShowingSearch });
  },

  open: (path) => {
    const workspace = get();
    let editor = workspace.editors.find((v) => v.path === path);
    if (!editor) {
      try {
        editor = new EditorStore(path);
        workspace.editors.push(editor);
        set({ editors: workspace.editors });
        workspace.edit(editor.path);
      } catch (error) {
        console.error(error);
        message.error(`invalid file: ${path}`);
      }
    } else if (workspace.editing !== editor) {
      workspace.edit(editor.path);
    }
  },

  edit: (path) => {
    const workspace = get();
    const editor = workspace.editors.find((v) => v.path === path);
    set({ editing: editor, editingNode: null });
    if (editor) {
      set({
        editingTree: {
          data: {
            name: editor.name,
            desc: editor.desc,
            root: null!,
          },
        },
      });
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
      set({
        editingTree: {
          data: {
            name: editting.name,
            desc: editting.desc,
            root: null!,
          },
        },
      });
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
        if (event === "change" && filename === "node-config.b3-setting") {
          workspace.loadNodeDefs();
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

    const allFiles: string[] = [];
    const collect = (fileNode?: FileTreeType) => {
      if (fileNode?.isLeaf) {
        allFiles.push(fileNode.path);
      }
      fileNode?.children?.forEach((child) => collect(child));
    };
    collect(data);
    set({ allFiles });
  },

  loadNodeDefs: () => {
    const workspace = get();
    const nodeDefData = readJson(`${workspace.workdir}/node-config.b3-setting`) as NodeDef[];
    const nodeDefs: Map<string, NodeDef> = new Map();
    for (const v of nodeDefData) {
      nodeDefs.set(v.name, v);
    }
    set({ nodeDefs });
    workspace.editing?.dispatch("reload");
  },

  // node edit
  onEditingNode: (node) => {
    set({ editingNode: node, editingNodeDef: null });
  },

  onEditingNodeDef: (nodeDef) => {
    set({ editingNodeDef: nodeDef });
  },

  // tree edit
  onEditingTree: (tree) => {
    set({ editingTree: tree, editingNodeDef: null });
  },

  // node def
  nodeDefs: new Map(),
  getNodeDef: (name) => {
    const workspace = get();
    unknownNodeDef.desc = i18n.t("node.unknown.desc");
    return workspace.nodeDefs.get(name) || unknownNodeDef;
  },
  hasNodeDef: (name) => {
    const workspace = get();
    return workspace.nodeDefs.has(name);
  },
}));

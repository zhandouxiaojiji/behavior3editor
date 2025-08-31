import { BrowserWindow, dialog } from "@electron/remote";
import { ipcRenderer } from "electron";
import * as fs from "fs";
import React from "react";
import { create } from "zustand";
import { NodeDef } from "../behavior3/src/behavior3";
import { FileVarDecl, ImportDecl, NodeData, TreeData, VarDecl } from "../misc/b3type";
import * as b3util from "../misc/b3util";
import { message } from "../misc/hooks";
import i18n from "../misc/i18n";
import Path from "../misc/path";
import { zhNodeDef } from "../misc/template";
import { readJson, readTree, readWorkspace, writeJson, writeTree } from "../misc/util";
import { useSetting } from "./setting-context";

let buildDir: string | undefined;

export type EditEvent =
  | "close"
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
  data: TreeData;

  declare: FileVarDecl;

  changed: boolean = false;
  mtime: number;
  alertReload: boolean = false;
  focusId?: string | null;

  dispatch?: (event: EditEvent, data?: unknown) => void;

  constructor(path: string) {
    this.path = path;
    this.data = readTree(path);
    this.data.name = Path.basenameWithoutExt(path);
    this.mtime = fs.statSync(path).mtimeMs;
    this.declare = {
      import: this.data.import.map((v) => ({ path: v, vars: [], depends: [] })),
      subtree: [],
      vars: this.data.vars.map((v) => ({ ...v })),
    };
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
  data: NodeData;
  error?: boolean;
  prefix: string;
  disabled: boolean;
  subtreeEditable?: boolean;
};

export type EditNodeDef = {
  data: NodeDef;
  path?: string;
};

export type EditTree = {
  name: string;
  desc?: string;
  export?: boolean;
  prefix?: string;
  group: string[];
  import: ImportDecl[];
  vars: VarDecl[];
  subtree: ImportDecl[];
  root: NodeData;
};

export type FileMeta = {
  path: string;
  desc?: string;
  exists?: boolean;
};

export interface WorkspaceModel {
  files?: { path: string; desc: string }[];
  settings: {
    checkExpr?: boolean;
    buildScript?: string;
  };
}

export type WorkspaceStore = {
  init: (project: string) => void;
  createProject: () => void;
  openProject: (project?: string) => void;
  batchProject: () => void;
  buildProject: () => void;

  settings: WorkspaceModel["settings"];
  workdir: string;
  path: string;

  // settings
  setCheckExpr: (checkExpr: boolean) => void;
  setupBuildScript: () => void;

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

  open: (path: string, focusId?: string) => void;
  edit: (path: string, focusId?: string) => void;
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
  usingGroups: typeof b3util.usingGroups;
  usingVars: typeof b3util.usingVars;

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
  if (editor?.changed) {
    editor.dispatch?.("save");
  }
};

export const useWorkspace = create<WorkspaceStore>((set, get) => ({
  allFiles: new Map(),
  fileTree: undefined,
  editors: [],
  modifiedEditors: [],
  workdir: "",
  path: "",
  settings: {},

  init: (path) => {
    const workspace = get();
    const setting = useSetting.getState();
    const files = setting.getEditors(path);
    if (!workspace.workdir) {
      try {
        workspace.workdir = Path.dirname(path).replaceAll(Path.sep, "/");
        workspace.path = path;
        workspace.loadWorkspace();
        workspace.loadTrees();
        workspace.loadNodeDefs();
        workspace.watch();
        setting.appendRecent(path);
        if (files.length) {
          for (const entry of files) {
            try {
              if (fs.existsSync(entry.path)) {
                entry.path = Path.posixPath(entry.path);
                const editor = new EditorStore(entry.path);
                workspace.editors.push(editor);
                if (entry.active) {
                  workspace.open(editor.path);
                }
              } else {
                setting.closeEditor(workspace.path, entry.path);
              }
            } catch (error) {
              console.error(error);
              message.error(`invalid file: ${path}`);
            }
          }
        }
      } catch (error) {
        console.error(error);
        if (!fs.existsSync(path)) {
          useSetting.getState().removeRecent(path);
        }
        message.error(`load workspace error: ${path}`);
      }
    }
  },

  // setting
  setCheckExpr: (checkExpr: boolean) => {
    const { settings, saveWorkspace } = get();
    set({
      settings: {
        ...settings,
        checkExpr,
      },
    });
    b3util.setCheckExpr(checkExpr);
    saveWorkspace();
    get().editing?.dispatch?.("refresh");
  },

  setupBuildScript: () => {
    const workspace = get();
    let buildScript = dialog.showOpenDialogSync({
      properties: ["openFile"],
      defaultPath: workspace.workdir.replaceAll("/", Path.sep),
      filters: [{ name: "Javascript", extensions: ["js"] }],
    })?.[0];
    if (buildScript) {
      buildScript = Path.posixPath(buildScript);
      const { settings, saveWorkspace, relative } = get();
      set({
        settings: {
          ...settings,
          buildScript: relative(buildScript),
        },
      });
      saveWorkspace();
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

  buildProject: async () => {
    const workspace = get();
    const setting = useSetting.getState();
    if (workspace.path) {
      if (!buildDir) {
        buildDir = dialog.showOpenDialogSync({
          properties: ["openDirectory", "createDirectory"],
          defaultPath: setting.getBuildDir(workspace.path),
        })?.[0];
      }
    }
    if (buildDir) {
      for (const editor of workspace.editors) {
        editor.dispatch?.("save");
      }
      const debug = console.debug;
      console.debug = () => {};
      try {
        const hasError = await b3util.buildProject(workspace.path, buildDir);
        if (hasError) {
          message.error(i18n.t("buildFailed"));
        } else {
          message.success(i18n.t("buildCompleted"));
        }
        setting.setBuildDir(workspace.path, buildDir);
      } catch (error) {
        console.error(error);
        message.error(i18n.t("buildFailed"));
      }
      if (workspace.editing) {
        workspace.refresh(workspace.editing.path);
      }
      console.debug = debug;
    }
  },

  batchProject: async () => {
    const workspace = get();
    const scriptPath = dialog.showOpenDialogSync({
      properties: ["openFile"],
      defaultPath: workspace.workdir.replaceAll("/", Path.sep),
      filters: [{ name: "Javascript", extensions: ["js"] }],
    })?.[0];
    if (scriptPath) {
      let hasError = false;
      try {
        console.log("run script", scriptPath);
        const batch = await b3util.loadModule(scriptPath);
        batch.onSetup?.({
          fs,
          path: Path,
          workdir: workspace.workdir,
          nodeDefs: get().nodeDefs,
        });
        workspace.allFiles.forEach((file) => {
          let tree: TreeData | null = readTree(file.path);
          const errors: string[] = [];
          tree = b3util.processBatch(tree, file.path, batch, errors);
          if (errors.length) {
            errors.forEach((error) => message.error(error));
            hasError = true;
          }
          if (tree) {
            batch.onWriteFile?.(file.path, tree);
            writeTree(file.path, tree);
          }
        });
        batch.onComplete?.("success");
      } catch (error) {
        hasError = true;
        console.error(error);
      }
      if (workspace.editing) {
        workspace.refresh(workspace.editing.path);
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
    const data = readWorkspace(workspace.path);
    set({ settings: data.settings });
    b3util.setCheckExpr(data.settings?.checkExpr ?? true);
    data.files?.forEach((file) => {
      workspace.allFiles.set(file.path, { path: file.path, desc: file.desc, exists: false });
    });
    process.chdir(Path.dirname(workspace.path));
  },

  saveWorkspace: () => {
    const workspace = get();
    const data: WorkspaceModel = {
      files: [],
      settings: workspace.settings,
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

  open: (path, focusId) => {
    path = Path.posixPath(path);
    const workspace = get();
    let editor = workspace.editors.find((v) => v.path === path);
    if (!editor) {
      try {
        editor = new EditorStore(path);
        workspace.editors.push(editor);
        set({ editors: workspace.editors });
        workspace.updateFileMeta(editor);
        workspace.edit(editor.path, focusId);

        if (b3util.isNewVersion(editor.data.version)) {
          message.warning(i18n.t("alertNewVersion", { version: editor.data.version }));
        }
      } catch (error) {
        console.error(error);
        message.error(`invalid file: ${path}`);
      }
    } else if (workspace.editing !== editor) {
      workspace.edit(editor.path, focusId);
    }
  },

  edit: (path, focusId) => {
    const workspace = get();
    const editor = workspace.editors.find((v) => v.path === path);
    if (editor) {
      editor.focusId = focusId;
    }
    set({ editing: editor, editingNode: null, editingTree: null });
    if (editor) {
      workspace.onEditingTree(editor);
    }
  },

  close: (path) => {
    const workspace = get();
    const setting = useSetting.getState();
    const idx = workspace.editors.findIndex((v) => v.path === path);
    const editors = workspace.editors.filter((v) => v.path !== path);
    const editor = workspace.editors.find((v) => v.path === path);
    let editting = workspace.editing;
    editor?.dispatch?.("close");
    if (editors.length && path === editting?.path) {
      editting = editors[idx === editors.length ? idx - 1 : idx];
      workspace.onEditingTree(editting);
    }
    if (editors.length === 0) {
      editting = undefined;
      set({ editingNode: undefined, editingTree: undefined });
    }
    set({ editing: editting, editors: editors });
    setting.closeEditor(workspace.path, path);
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
      return false;
    }
    b3util.refreshVarDecl(editor.data.root, editor.data.group, editor.declare);
    set({
      usingGroups: b3util.usingGroups,
      usingVars: b3util.usingVars,
    });
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
        if (filename && (event === "change" || workspace.allFiles.has(filename))) {
          if (filename === "node-config.b3-setting") {
            workspace.loadNodeDefs();
          } else {
            const fullpath = Path.posixPath(`${workspace.workdir}/${filename}`);
            const editor = workspace.find(fullpath);
            const modified = fs.statSync(fullpath).mtimeMs;
            b3util.files[Path.posixPath(filename)] = modified;
            if (editor && editor.mtime + 500 < modified) {
              if (editor.changed) {
                editor.alertReload = true;
                set({ modifiedTime: Date.now() });
              } else {
                editor.dispatch?.("reload");
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
          console.log("add file meta:", path);
        } else {
          fileMeta.path = fileNode.path;
        }
        fileMeta.exists = fs.existsSync(fileNode.path);
        if (fileMeta.desc === undefined) {
          const file = readJson(fileNode.path) as TreeData;
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
        updated = true;
        console.log("delete file meta:", key);
        delete b3util.files[key];
      } else {
        b3util.files[key] = fs.statSync(file.path).mtimeMs;
      }
    });
    set({ allFiles });
    if (updated) {
      workspace.saveWorkspace();
    }
  },

  nodeDefs: new b3util.NodeDefs(),
  groupDefs: [],
  usingGroups: null,
  usingVars: null,
  loadNodeDefs: () => {
    const workspace = get();
    b3util.initWorkdir(workspace.workdir, message.error.bind(message));
    set({ nodeDefs: b3util.nodeDefs, groupDefs: b3util.groupDefs });
    workspace.editing?.dispatch?.("refresh");
  },

  // node edit
  onEditingNode: (node) => {
    set({ editingNode: node, editingNodeDef: null, editingTree: null });
  },

  onEditingNodeDef: (nodeDef) => {
    set({ editingNodeDef: nodeDef, editingNode: null, editingTree: null });
  },

  // tree edit
  onEditingTree: (editor) => {
    const workspace = get();
    const setting = useSetting.getState();
    workspace.refresh(editor.path);
    setting.openEditor(workspace.path, editor.path);
    set({
      editingTree: {
        ...editor.data,
        root: editor.data.root,
        import: editor.declare.import,
        subtree: editor.declare.subtree,
        vars: editor.declare.vars,
      },
      editingNodeDef: null,
      editingNode: null,
    });
  },
}));

import { app } from "@electron/remote";
import * as fs from "fs";
import { create } from "zustand";
import { NodeLayout } from "../misc/b3type";
import { readJson, writeJson } from "../misc/util";
import { useWorkspace } from "./workspace-context";

const settingPath = app.getPath("userData") + "/settings.json";

export type OpenEditor = {
  path: string;
  active: boolean;
};

export type ProjectSetting = {
  path: string;
  buildDir: string;
  editors: OpenEditor[];
};

export type SettingModel = {
  recent: string[];
  layout: NodeLayout;
  projects: ProjectSetting[];
};

export type SettingStore = {
  data: SettingModel;

  load: () => void;
  save: () => void;
  appendRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  setLayout: (layout: "compact" | "normal") => void;
  setBuildDir: (project: string, dir: string) => void;
  getBuildDir: (project: string) => string;
  openEditor: (project: string, path: string) => void;
  closeEditor: (project: string, path: string) => void;
  getEditors: (project: string) => OpenEditor[];
};

export const useSetting = create<SettingStore>((set, get) => ({
  data: {
    recent: [],
    buildDir: "",
    layout: "compact",
    projects: [],
  },
  load: () => {
    try {
      if (fs.existsSync(settingPath)) {
        const settings = readJson(settingPath) as SettingModel;
        settings.layout = settings.layout || "compact";
        settings.projects = settings.projects || [];
        set({ data: settings });
      }
    } catch (error) {
      console.error(error);
    }
  },

  save: () => {
    writeJson(settingPath, get().data);
  },

  appendRecent: (path: string) => {
    const { data, save } = get();
    const recent = data.recent.filter((v) => v !== path);
    recent.unshift(path);
    set({ data: { ...data, recent } });
    save();
  },

  removeRecent: (path: string) => {
    const { data, save } = get();
    const recent = data.recent.filter((v) => v !== path);
    set({ data: { ...data, recent } });
    save();
  },

  setLayout: (layout: "compact" | "normal") => {
    const { data, save } = get();
    set({ data: { ...data, layout } });
    save();
    useWorkspace.getState().editing?.dispatch?.("refresh");
  },

  setBuildDir: (projectPath: string, dir: string) => {
    const { data, save } = get();
    let project = data.projects.find((v) => v.path === projectPath);
    if (!project) {
      project = {
        path: projectPath,
        buildDir: "",
        editors: [],
      };
    }
    project.buildDir = dir;
    set({ data: { ...data, projects: data.projects } });
    save();
  },

  getBuildDir: (project: string) => {
    const { data } = get();
    return data.projects.find((v) => v.path === project)?.buildDir ?? "";
  },

  openEditor: (projectPath: string, filePath: string) => {
    const { data, save } = get();
    let project = data.projects.find((v) => v.path === projectPath);
    if (!project) {
      project = {
        path: projectPath,
        buildDir: "",
        editors: [],
      };
      data.projects.push(project);
    }
    const editor = project.editors.find((v) => v.path === filePath);
    project.editors.forEach((v) => (v.active = false));
    if (editor) {
      editor.active = true;
    } else {
      project.editors.push({ path: filePath, active: true });
    }
    set({ data: { ...data, projects: data.projects } });
    save();
  },

  closeEditor: (project: string, path: string) => {
    const { data, save } = get();
    const projectSetting = data.projects.find((v) => v.path === project);
    if (projectSetting) {
      projectSetting.editors = projectSetting.editors.filter((v) => v.path !== path);
    }
    set({ data: { ...data, projects: data.projects } });
    save();
  },

  getEditors: (project: string) => {
    const { data } = get();
    return data.projects.find((v) => v.path === project)?.editors ?? [];
  },
}));

import { app } from "@electron/remote";
import * as fs from "fs";
import { create } from "zustand";
import { setLayoutStyle } from "../components/register-node";
import { readJson, writeJson } from "../misc/util";
import { useWorkspace } from "./workspace-context";

const settingPath = app.getPath("userData") + "/settings.json";

export type SettingModel = {
  recent: string[];
  buildDir: string;
  layout?: "compact" | "normal";
};

export type SettingStore = {
  data: SettingModel;

  load: () => void;
  save: () => void;
  appendRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  setBuildDir: (dir: string) => void;
  setLayout: (layout: "compact" | "normal") => void;
};

export const useSetting = create<SettingStore>((set, get) => ({
  data: {
    recent: [],
    buildDir: "",
    layout: "compact",
  },
  load: () => {
    try {
      if (fs.existsSync(settingPath)) {
        const settings = readJson(settingPath) as SettingModel;
        settings.layout = settings.layout || "compact";
        set({ data: settings });
        setLayoutStyle(settings.layout);
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
  setBuildDir: (dir: string) => {
    const { data, save } = get();
    set({ data: { ...data, buildDir: dir } });
    save();
  },
  setLayout: (layout: "compact" | "normal") => {
    const { data, save } = get();
    set({ data: { ...data, layout } });
    save();
    setLayoutStyle(layout);
    useWorkspace.getState().editing?.dispatch("refresh");
  },
}));

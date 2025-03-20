import { app } from "@electron/remote";
import * as fs from "fs";
import { create } from "zustand";
import { readJson, writeJson } from "../misc/util";

const settingPath = app.getPath("userData") + "/settings.json";

export type SettingModel = {
  recent: string[];
  buildDir: string;
};

export type SettingStore = {
  data: SettingModel;

  load: () => void;
  save: () => void;
  appendRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  setBuildDir: (dir: string) => void;
};

export const useSetting = create<SettingStore>((set, get) => ({
  data: {
    recent: [],
    buildDir: "",
  },
  load: () => {
    try {
      if (fs.existsSync(settingPath)) {
        const settings = readJson(settingPath) as SettingModel;
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
  setBuildDir: (dir: string) => {
    const { data, save } = get();
    set({ data: { ...data, buildDir: dir } });
    save();
  },
}));

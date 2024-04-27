import { readJson, writeJson } from "@/misc/util";
import { app } from "@electron/remote";
import { create } from "zustand";
import * as fs from "fs";

const settingPath = app.getPath("userData") + "/settings.json";

export type SettingModel = {
  recent: string[];
};

export type SettingStore = {
  recent: string[];
  load: () => void;
  save: () => void;
  appendRecent: (path: string) => void;
  removeRecent: (path: string) => void;
};

export const useSetting = create<SettingStore>((set, get) => ({
  recent: [],
  load: () => {
    try {
      if (fs.existsSync(settingPath)) {
        const settings = readJson(settingPath) as SettingModel;
        if (!(settings.recent instanceof Array)) {
          settings.recent = [];
        }

        set({ recent: settings.recent });
      }
    } catch (error) {
      console.error(error);
    }
  },
  save: () => {
    const settings = get();
    writeJson(settingPath, {
      recent: settings.recent,
    } as SettingModel);
  },
  appendRecent: (path: string) => {
    const recent = get().recent.filter((v) => v !== path);
    recent.unshift(path);
    set({ recent });
    get().save();
  },
  removeRecent: (path: string) => {
    const recent = get().recent.filter((v) => v !== path);
    set({ recent });
    get().save();
  },
}));

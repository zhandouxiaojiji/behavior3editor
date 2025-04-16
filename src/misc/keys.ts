import { BrowserWindow } from "@electron/remote";
import _useKeyPress, { KeyFilter, KeyType, Options, Target } from "ahooks/lib/useKeyPress";
import { Key } from "ts-key-enum";

export const isMacos = process.platform === "darwin";

let forceTarget: HTMLElement | undefined;

const hotkey = (key: string) => {
  if (key.indexOf("ctrl") >= 0 && isMacos) {
    key = key.replace("ctrl", Key.Meta);
  }
  return key.toLowerCase();
};

export const useKeyPress = (
  keyFilter: KeyFilter,
  target: Target,
  eventHandler: (event: KeyboardEvent, key: KeyType) => void,
  option?: Options
) => {
  option = option || {};
  option.target = target;
  option.exactMatch = true;
  return _useKeyPress(keyFilter, (e, key) => !e.repeat && eventHandler(e, key), option);
};

export const Hotkey = {
  Backspace: Key.Backspace,
  Build: hotkey("ctrl.b"),
  CloseEditor: hotkey("ctrl.w"),
  Copy: hotkey("ctrl.c"),
  Cut: hotkey("ctrl.x"),
  Delete: Key.Delete,
  Duplicate: hotkey("ctrl.d"),
  Enter: Key.Enter,
  Escape: Key.Escape,
  F2: Key.F2,
  Insert: Key.Insert,
  JumpNode: hotkey("ctrl.g"),
  MacDelete: isMacos ? hotkey("ctrl.backspace") : "",
  Paste: hotkey("ctrl.v"),
  Redo: isMacos ? hotkey("shift.ctrl.z") : hotkey("ctrl.y"),
  Replace: hotkey("shift.ctrl.v"),
  Save: hotkey("ctrl.s"),
  SearchTree: hotkey("ctrl.p"),
  SearchNode: hotkey("ctrl.f"),
  SelectAll: hotkey("ctrl.a"),
  Undo: hotkey("ctrl.z"),
};

export const setInputFocus = (target: HTMLElement) => {
  forceTarget = target;
};

export const sendInputEvent = (key: string) => {
  const webContents = BrowserWindow.getFocusedWindow()?.webContents;
  if (webContents) {
    let keyCode: string | undefined;
    const modifiers: Electron.InputEvent["modifiers"] = [];
    key.split(".").forEach((v) => {
      if (v.indexOf("ctrl") >= 0) {
        modifiers.push("ctrl");
      } else if (v.indexOf("shift") >= 0) {
        modifiers.push("shift");
      } else if (v.indexOf("alt") >= 0) {
        modifiers.push("alt");
      } else if (v.indexOf("meta") >= 0) {
        modifiers.push("meta");
      } else {
        keyCode = v;
      }
    });
    if (!keyCode) {
      return;
    }
    forceTarget?.focus();
    modifiers.forEach((mod) => {
      webContents.sendInputEvent({
        type: "keyDown",
        keyCode: mod,
      });
    });
    webContents.sendInputEvent({ type: "keyDown", keyCode: keyCode, modifiers: modifiers });
    webContents.sendInputEvent({ type: "keyUp", keyCode: keyCode, modifiers: modifiers });
    modifiers.forEach((mod) => {
      webContents.sendInputEvent({
        type: "keyUp",
        keyCode: mod,
      });
    });
  }
};

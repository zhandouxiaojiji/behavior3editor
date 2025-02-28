import { FC } from "react";
import { useSetting } from "../contexts/setting-context";
import { message, setGlobalHooks } from "../misc/hooks";

export const Setup: FC = () => {
  if (!message) {
    useSetting().load();
  }
  setGlobalHooks();
  return <div></div>;
};

import { useSetting } from "@/contexts/setting-context";
import { message, setGlobalHooks } from "@/misc/hooks";
import { FC } from "react";

export const Setup: FC = () => {
  if (!message) {
    useSetting().load();
  }
  setGlobalHooks();
  return <div></div>;
};

import { App } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import type { ModalStaticFunctions } from "antd/es/modal/confirm";
import type { NotificationInstance } from "antd/es/notification/interface";

let message: MessageInstance;
let notification: NotificationInstance;
let modal: Omit<ModalStaticFunctions, "warn">;

const setGlobalHooks = () => {
  const staticFunction = App.useApp();
  message = staticFunction.message;
  modal = staticFunction.modal;
  notification = staticFunction.notification;
};

export { message, modal, notification, setGlobalHooks };

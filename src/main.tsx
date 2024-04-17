import { App, ConfigProvider } from "antd";
import React from "react";
import ReactDOM from "react-dom/client";
import { Setup } from "./components/setup";
import { Workspace } from "./components/workspace";
import "./misc/i18n";
import { themeConfig } from "./misc/theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider theme={themeConfig}>
      <App>
        <Setup />
        <Workspace />
      </App>
    </ConfigProvider>
  </React.StrictMode>
);

postMessage({ payload: "removeLoading" }, "*");

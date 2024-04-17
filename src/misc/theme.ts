import { ThemeConfig, theme } from "antd";
import "../index.scss";

export const themeConfig: ThemeConfig = {
  cssVar: true,
  algorithm: theme.darkAlgorithm,
  token: {
    colorBgBase: "#0d1117",
    colorBgContainer: "#0d1117",
    colorBgElevated: "#161b22",
    colorBorderSecondary: "#30363d",
    borderRadius: 4,
  },
  components: {
    Tree: {
      // directoryNodeSelectedBg: "#010409",
      borderRadius: 0,
      colorBgContainer: "#010409",
    },
    Tabs: {
      horizontalMargin: "0",
    },
    Layout: {
      headerBg: "#0d1117",
      siderBg: "#010409",
    },
    Dropdown: {
      motionDurationMid: "0.1s",
    },
  },
};

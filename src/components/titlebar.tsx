import { useWorkspace } from "@/contexts/workspace-context";
import { Hotkey } from "@/misc/keys";
import Path from "@/misc/path";
import { SearchOutlined } from "@ant-design/icons";
import { Button, Flex, LayoutProps, Select } from "antd";
import React, { FC, useMemo } from "react";
import { Menu } from "./menu";

interface OptionType {
  label: string | React.ReactNode;
  value: string;
  path: string;
}

export const TitleBar: FC<LayoutProps> = () => {
  const workspace = {
    allFiles: useWorkspace((state) => state.allFiles),
    fileTree: useWorkspace((state) => state.fileTree),
    isShowingSearch: useWorkspace((state) => state.isShowingSearch),
    onShowingSearch: useWorkspace((state) => state.onShowingSearch),
    open: useWorkspace((state) => state.open),
    name: useWorkspace((state) => state.path),
  };
  const searchOptions = useMemo(() => {
    const options: OptionType[] = [];
    workspace.allFiles.forEach((path) => {
      const value = Path.relative(workspace.fileTree!.path, path);
      options.push({
        label: (
          <div>
            {Path.basename(value)}
            <span> </span>
            <span style={{ color: "gray", fontSize: "12px" }}>{Path.dirname(value)}</span>
          </div>
        ),
        value: value,
        path: path,
      });
    });
    return options;
  }, [workspace.allFiles, workspace.fileTree]);
  return (
    <Flex className="b3-titlebar" style={{ width: "100%", height: 35, alignItems: "center" }}>
      <div
        className="b3-drag-region"
        style={{
          display: "block",
          height: "35px",
          width: "100%",
          left: 0,
          top: 0,
          position: "absolute",
        }}
      />
      <div style={{ width: "100%" }}>{process.platform !== "darwin" && <Menu />}</div>
      <Flex style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
        <Button
          className="b3-no-drag-region"
          onClick={() => {
            workspace.onShowingSearch(true);
          }}
          style={{
            width: "400px",
            height: "25px",
            border: "1px solid #30363d",
            borderRadius: "6px",
            padding: "0px",
            cursor: "pointer",
            color: "#7d8590",
            boxShadow: "none",
          }}
          icon={<SearchOutlined style={{ color: "#7d8590" }} />}
        >
          {Path.basename(workspace.name)}
        </Button>
        {workspace.isShowingSearch && (
          <Select
            showSearch
            autoFocus
            defaultOpen
            dropdownStyle={{
              top: "5px",
              paddingTop: "40px",
              zIndex: 998,
              display: "inline-block",
            }}
            onKeyDown={(e) => {
              if (e.code === Hotkey.Escape) {
                workspace.onShowingSearch(false);
              }
            }}
            suffixIcon={<SearchOutlined />}
            className="b3-search b3-no-drag-region"
            style={{ width: "400px", top: "5px", position: "absolute", zIndex: 999 }}
            placeholder=""
            optionFilterProp="value"
            onBlur={() => workspace.onShowingSearch(false)}
            onChange={(_, option) => {
              if (!(option instanceof Array)) {
                workspace.onShowingSearch(false);
                workspace.open(option.path);
              }
            }}
            filterOption={(input, option) => (option?.value ?? "").includes(input)}
            filterSort={(optionA, optionB) =>
              (optionA?.value ?? "")
                .toLowerCase()
                .localeCompare((optionB?.value ?? "").toLowerCase())
            }
            options={searchOptions}
          />
        )}
      </Flex>
      <div style={{ width: "100%" }}>{process.platform === "darwin" && <Menu />}</div>
    </Flex>
  );
};

import React from "react";
import PropTypes from "prop-types";
import { FolderOutlined,FolderOpenOutlined,FileTextOutlined,SearchOutlined,CloseOutlined,LoadingOutlined} from '@ant-design/icons';

import { Node,NodeDict } from "./Tree/TreeNode";

const FileIcon = (node:Node) => {
  if (node.type === "file") {
    return (
        <FileTextOutlined />
    );
  }
  return node.isOpen ?(<FolderOpenOutlined />):(<FolderOutlined />)
};

const SearchIcon = () => {
  return <SearchOutlined />;
};


const CloseIcon = () => {
  return <CloseOutlined />;
};

const LoadingIcon = ()=>{
    return <LoadingOutlined />
}

export default {
  file: FileIcon,
  search: SearchIcon,
  close: CloseIcon,
  loading: LoadingIcon
};

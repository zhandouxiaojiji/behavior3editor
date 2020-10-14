import * as React from "react";
import * as ReactDOM from "react-dom";
import Editor from "./Editor";
import 'antd/dist/antd.dark.css';
import './index.css';

ReactDOM.render(
  <Editor />,
  document.getElementById('root') as HTMLElement
);
import * as React from "react";
import * as ReactDOM from "react-dom";
import Hello from "./components/Hello";
import Editor from "./Editor";
import 'antd/dist/antd.dark.css';
import './index.css';

ReactDOM.render(
  <Editor />,
  // <div className="test">hello!!!!!</div>,
  document.getElementById('root') as HTMLElement
);
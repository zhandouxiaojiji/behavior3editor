import * as React from "react";
import * as ReactDOM from "react-dom";
import Hello from "./components/Hello";
import Editor from "./Editor";
import './index.css';
import 'antd/dist/antd.css';

ReactDOM.render(
  <Editor />,
  // <div className="test">hello!!!!!</div>,
  document.getElementById('root') as HTMLElement
);
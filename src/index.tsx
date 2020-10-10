import * as React from "react";
import * as ReactDOM from "react-dom";
import Hello from "./components/Hello";
import './index.css';

ReactDOM.render(
  <Hello />,
  // <div className="test">hello!!!!!</div>,
  document.getElementById('root') as HTMLElement
);
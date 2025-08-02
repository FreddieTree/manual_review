import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// 样式导入顺序：Tailwind 基础 -> 自定义打底（可选）
// 如果你已把 Tailwind 指令放在 index.css，这里保留即可
import "./index.css";
// 若采纳我之前提供的 Apple 打底样式：
// import "@/styles/base.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* 如果部署在子路径，给 BrowserRouter 传 basename */}
    <BrowserRouter /* basename={import.meta.env.BASE_URL || '/'} */>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
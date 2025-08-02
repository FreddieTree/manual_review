// src/api/index.js
// 汇总出口（barrel）。不再在这里创建 axios 实例，统一从 client.js 和各模块导出。

import {
    client,
    request,   // 由 client.js 内的 call 兼容导出
    makeCancel,
} from "./client";

export * from "./auth";
export * from "./meta";
export * from "./pricing";
export * from "./reviewers";
export * from "./tasks";

// 便于显式导入基础能力
export { client, request, makeCancel };

// 兼容旧写法：import api from "@/api"
import * as auth from "./auth";
import * as meta from "./meta";
import * as pricing from "./pricing";
import * as reviewers from "./reviewers";
import * as tasks from "./tasks";

export default {
    client,
    request,
    makeCancel,
    ...auth,
    ...meta,
    ...pricing,
    ...reviewers,
    ...tasks,
};
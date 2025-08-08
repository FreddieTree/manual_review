// src/api/index.js
export * from "./auth";
export * from "./meta";
export * from "./reviewers";
export * from "./tasks";
export * from "./admin";

export { client, get, post, put, del, request, makeCancel } from "./client";

// 也可以为使用 default import 保留一个平铺对象（可选）
import * as auth from "./auth";
import * as meta from "./meta";
import * as reviewers from "./reviewers";
import * as tasks from "./tasks";
import * as admin from "./admin";
import * as clientModule from "./client";

const defaultExport = {
    ...clientModule,
    ...auth,
    ...meta,
    ...reviewers,
    ...tasks,
    ...admin,
};

export default defaultExport;
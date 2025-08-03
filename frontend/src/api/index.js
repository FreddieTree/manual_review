// src/api/index.js
import {
    client,
    request,
    makeCancel,
} from "./client";

export * from "./auth";
export * from "./meta";
export * from "./pricing";
export * from "./reviewers";
export * from "./tasks";
export * from "./admin";

export { client, request, makeCancel };

import * as auth from "./auth";
import * as meta from "./meta";
import * as pricing from "./pricing";
import * as reviewers from "./reviewers";
import * as tasks from "./tasks";
import * as admin from "./admin";

export default {
    client,
    request,
    makeCancel,
    ...auth,
    ...meta,
    ...pricing,
    ...reviewers,
    ...tasks,
    ...admin,
};
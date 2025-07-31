// src/api.js
import axios from "axios";

// 后端API端口和URL集中管理（支持未来环境变量、反向代理等）
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5050/api",
    withCredentials: true, // 支持Session Cookie
    timeout: 12000,
});

// 全局请求/响应拦截器（自动处理错误提示、token、重定向等）
api.interceptors.response.use(
    res => res,
    err => {
        // 可以做全局弹窗或自动退出登录
        if (err.response?.status === 401) {
            window.location.href = "/";
        }
        return Promise.reject(
            err.response?.data?.message || err.message || "Network error"
        );
    }
);

/**
 * 登录审核员
 * @param {Object} data - {name, email}
 */
export async function loginReviewer(data) {
    const res = await api.post("/login", data);
    return res.data;
}

/**
 * 获取当前分配到的abstract
 */
export async function getAssignedAbstract() {
    const res = await api.get("/assigned_abstract");
    return res.data;
}

/**
 * 提交审核结果
 * @param {Object} data - 断言/新增断言表单
 */
export async function submitReview(data) {
    const res = await api.post("/submit_review", data);
    return res.data;
}

/**
 * 管理员端获取统计
 */
export async function getAdminStats() {
    const res = await api.get("/admin_stats");
    return res.data;
}

/**
 * 退出登录
 */
export async function logout() {
    const res = await api.post("/logout");
    return res.data;
}
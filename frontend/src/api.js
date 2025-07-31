// src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5050/api",
  withCredentials: true,
  timeout: 12000,
});

// 全局错误和自动跳转处理
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      window.location.href = "/";
    }
    // 也可以全局toast错误
    return Promise.reject(err.response?.data?.message || err.message || "Network error");
  }
);

/** Reviewer登录 */
export const loginReviewer = data => api.post("/login", data).then(r => r.data);
/** 获取当前分配abstract */
export const getAssignedAbstract = () => api.get("/assigned_abstract").then(r => r.data);
/** 提交review表单 */
export const submitReview = data => api.post("/submit_review", data).then(r => r.data);
/** 管理员统计数据 */
export const getAdminStats = () => api.get("/admin_stats").then(r => r.data);
/** 登出 */
export const logout = () => api.post("/logout").then(r => r.data);

export default api; // 如需自定义request可以直接用
import axios from "axios";

// 适配你的 Flask 端口
const api = axios.create({
    baseURL: "http://localhost:5050/api", // 假设API全部 /api 路由
    withCredentials: true,
});

export async function loginReviewer(data) {
    const res = await api.post("/login", data);
    return res.data;
}

export async function getAssignedAbstract() {
    const res = await api.get("/assigned_abstract");
    return res.data;
}

export async function submitReview(data) {
    const res = await api.post("/submit_review", data);
    return res.data;
}

export async function getAdminStats() {
    const res = await api.get("/admin_stats");
    return res.data;
}
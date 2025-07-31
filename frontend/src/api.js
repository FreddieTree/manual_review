import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5050/api",
  withCredentials: true,
});

export const loginReviewer = (data) => api.post("/login", data).then(res => res.data);
export const getAssignedAbstract = () => api.get("/assigned_abstract").then(res => res.data);
export const submitReview = (data) => api.post("/submit_review", data).then(res => res.data);
export const getAdminStats = () => api.get("/admin_stats").then(res => res.data);
export const logout = () => api.post("/logout");
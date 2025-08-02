import client from "./client";
export const getReviewers = () => client.get("/reviewers");
export const addReviewer = (data) => client.post("/reviewers", data);
export const updateReviewer = (email, data) => client.put(`/reviewers/${encodeURIComponent(email)}`, data);
export const deleteReviewer = (email) => client.delete(`/reviewers/${encodeURIComponent(email)}`);

import client from "./client";
export const getAssignedAbstract = () => client.get("/assigned_abstract");
export const submitReview = (data) => client.post("/submit_review", data);
export const releaseAssignment = (pmid) => client.post("/release_assignment", { pmid });

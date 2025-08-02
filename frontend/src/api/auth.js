import client from "./client";
export const loginReviewer = (data) => client.post("/login", data);
export const logout = () => client.post("/logout");
export const whoami = () => client.get("/whoami");

import client from "./client";
export const getVocab = () => client.get("/meta/vocab");
export const getHealth = () => client.get("/meta/health");

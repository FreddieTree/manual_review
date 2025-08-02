import client from "./client";
export const getPricing = (abstractId) => client.get(`/review/pricing`, { params: { abstract: abstractId }});

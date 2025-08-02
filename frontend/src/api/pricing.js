import { get } from "./client";

export const getPricing = (abstractId, { signal } = {}) => {
    const params = abstractId ? { abstract: abstractId } : undefined;
    return get("/review/pricing", { params, signal }, { unwrap: "data" });
};
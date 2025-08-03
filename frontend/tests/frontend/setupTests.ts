import "@testing-library/jest-dom/vitest";
import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./msw/server";
import { resetDb } from "./msw/handlers";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
    server.resetHandlers();
    resetDb();
});
afterAll(() => server.close());
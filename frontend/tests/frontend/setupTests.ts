// tests/frontend/setupTests.ts
import "@testing-library/jest-dom/vitest";
import { beforeAll, afterEach, afterAll, beforeEach, vi } from "vitest";
import { server } from "./msw/server";
import { resetDb } from "./msw/handlers";

// 启动 / 复位 / 关闭 MSW
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 每个用例前重置内存数据库
beforeEach(() => resetDb());

// 无条件覆盖 matchMedia（避免某些 jsdom 版本不完全实现）
if (typeof window !== "undefined") {
    // @ts-expect-error test env
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addListener: vi.fn(),         // 兼容旧 API
        removeListener: vi.fn(),
        addEventListener: vi.fn(),    // 兼容新 API
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));

    // 某些组件可能用到
    // @ts-expect-error test env
    window.scrollTo = window.scrollTo || vi.fn();
}
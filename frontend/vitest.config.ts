// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(process.cwd(), "src"),
        },
        dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./tests/frontend/setupTests.ts"],
        include: ["tests/frontend/**/*.{test,spec}.{js,ts,jsx,tsx}"],
        css: true,
        restoreMocks: true,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            exclude: ["**/node_modules/**", "**/tests/**"],
        },
    },
});
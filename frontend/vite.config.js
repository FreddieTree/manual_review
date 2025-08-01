import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// 默认后端（开发时可以通过 .env 覆盖 VITE_API_BASE）
const DEFAULT_API_TARGET = "http://localhost:5050";

export default defineConfig(({ mode }) => {
  const rawApiBase = process.env.VITE_API_BASE || "";
  const apiTarget = rawApiBase ? rawApiBase.replace(/\/$/, "") : DEFAULT_API_TARGET;

  return {
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    plugins: [
      react({
        fastRefresh: true,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    css: {
      postcss: path.resolve(__dirname, "postcss.config.mjs"),
    },
    server: {
      port: 5173,
      strictPort: false,
      open: false,
      fs: {
        allow: ["."],
      },
      // **关键**：开发时将 /api 代理到后端 Flask，避免 404 被 Vite 吞掉
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // 如果后端没有前缀可以 rewrite；本例保留 /api 前缀
          // rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
    build: {
      target: "es2020",
      sourcemap: mode === "development",
      chunkSizeWarningLimit: 1200,
    },
    envPrefix: "VITE_",
  };
});
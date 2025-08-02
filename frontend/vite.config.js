// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * 默认后端（开发时可以通过 .env.* 覆盖 VITE_API_BASE）
 * 生产环境建议在部署层直接由同域反代 /api，无需配置代理
 */
const DEFAULT_API_TARGET = "http://localhost:5050";

export default defineConfig(({ mode }) => {
  // 只加载以 VITE_ 开头的变量
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // 优先 .env.* 的 VITE_API_BASE；其次进程环境；否则默认
  const rawApiBase = (env.VITE_API_BASE || process.env.VITE_API_BASE || "").trim();
  const apiTarget = (rawApiBase || DEFAULT_API_TARGET).replace(/\/+$/, "");

  const isDev = mode === "development";

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
        "@": path.resolve(process.cwd(), "./src"),
      },
    },
    css: {
      postcss: path.resolve(process.cwd(), "postcss.config.mjs"),
    },
    server: {
      port: 5173,
      strictPort: false,
      open: false,
      fs: { allow: ["."] },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: "",
          cookiePathRewrite: "/",
          // 如后端没有 /api，可启用：
          // rewrite: (p) => p.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              proxyReq.setHeader("X-Forwarded-Host", req.headers.host || "");
              proxyReq.setHeader("X-Forwarded-Proto", "http");
              proxyReq.setHeader("X-Forwarded-For", req.socket?.remoteAddress || "");
            });
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "clsx",
        "lodash",
        "lodash-es",
        "@heroicons/react",
        "axios",
      ],
    },
    esbuild: {
      pure: isDev ? [] : ["console.debug"],
    },
    build: {
      target: "es2020",
      sourcemap: isDev,
      chunkSizeWarningLimit: 1200,
      reportCompressedSize: true,
      cssMinify: !isDev,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
          },
        },
      },
      // 使用 esbuild 默认压缩
    },
    // ⚠️ 不要在这里写 test 配置，全部移到 vitest.config.ts
    envPrefix: "VITE_",
  };
});
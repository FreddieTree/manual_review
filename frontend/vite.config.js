// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * 说明 / 优化点：
 * - 清晰地处理 env，保留 VITE_ 前缀并回退到默认 API。
 * - 去掉错误的 unary +。
 * - 增加 HTTP 代理的 forward headers 兼容性。
 * - 适当的依赖预构建（确保都是字符串）。
 * - Dedupe 关键 React 相关包避免多份副本。
 * - 构建阶段优化：目标、chunk 分割、压缩和 source map 控制。
 */

const DEFAULT_API_TARGET = "http://localhost:5050";

export default defineConfig(({ mode }) => {
  // 加载 .env 文件里的 VITE_* 前缀变量
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // 允许命令行或 env 文件覆盖
  const rawApiBase = (env.VITE_API_BASE || process.env.VITE_API_BASE || "").trim();
  const apiTarget = (rawApiBase || DEFAULT_API_TARGET).replace(/\/+$/, "");
  const isDev = mode === "development";

  return {
    define: {
      // 让运行时代码能看见 NODE_ENV（某些库会读取）
      "process.env.NODE_ENV": JSON.stringify(mode),
    },

    plugins: [
      react({
        // React Refresh 的 modern 版本已经内置，fastRefresh 仍然兼容
        fastRefresh: true,
      }),
    ],

    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "./src"),
      },
      dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    },

    css: {
      // 显式指定 PostCSS 配置文件（可选）
      postcss: path.resolve(process.cwd(), "postcss.config.mjs"),
    },

    server: {
      port: 5173,
      strictPort: false,
      open: false,
      fs: {
        // 限制可访问文件系统根，避免安全问题
        allow: ["."],
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: "", // 按需保留
          cookiePathRewrite: "/",
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              // 透传原始头增强后端识别
              proxyReq.setHeader("X-Forwarded-Host", req.headers.host || "");
              proxyReq.setHeader("X-Forwarded-Proto", req.headers["x-forwarded-proto"] || "http");
              proxyReq.setHeader("X-Forwarded-For", req.socket?.remoteAddress || "");
            });
          },
        },
      },
    },

    optimizeDeps: {
      // 预构建常用依赖（全部必须是字符串）
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "clsx",
        "lodash",
        "lodash-es",
        "@heroicons/react",
        "axios",
      ],
      // 可以排除极少变动的大包避免预构建重复
      // exclude: [], 
    },

    esbuild: {
      // 在生产中剔除 debug 调用
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
            // 把 React 相关拆出来，避免每次更新其他代码都重下
            react: ["react", "react-dom"],
          },
        },
      },
    },

    envPrefix: "VITE_",
  };
});
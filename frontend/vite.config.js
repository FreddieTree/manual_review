// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const DEFAULT_API_TARGET = "http://localhost:5050";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
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
      dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
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
        +        "react-router-dom",
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
    },
    envPrefix: "VITE_",
  };
});
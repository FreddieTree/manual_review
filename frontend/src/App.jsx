// src/App.jsx
import React, { Suspense, useEffect, useMemo } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import clsx from "clsx";
import Loader from "./components/ui/Loader";
import ErrorBoundary from "./components/ErrorBoundary";
import useScrollRestoration from "./hooks/useScrollRestoration";

// === Lazy pages ===
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const ReviewPage = React.lazy(() => import("./pages/ReviewPage"));
const AdminPage = React.lazy(() => import("./pages/AdminPage"));
const ReviewersPage = React.lazy(() => import("./pages/ReviewersPage"));
const ArbitrationPage = React.lazy(() => import("./pages/ArbitrationPage"));
const NoTasksPage = React.lazy(() => import("./pages/NoTasksPage"));
const NotFoundPage = React.lazy(() => import("./pages/NotFoundPage"));

// === Route table ===
const ROUTES = [
  { path: "/", element: <LoginPage />, title: "Login" },
  { path: "/review", element: <ReviewPage />, title: "Review" },
  { path: "/admin", element: <AdminPage />, title: "Admin" },
  { path: "/admin/reviewers", element: <ReviewersPage />, title: "Reviewers" },
  { path: "/admin/arbitration", element: <ArbitrationPage />, title: "Arbitration" },
  { path: "/no_more_tasks", element: <NoTasksPage />, title: "No More Tasks" },
  { path: "*", element: <NotFoundPage />, title: "Not Found" },
];

const TITLE_BASE = (import.meta.env.VITE_TITLE_BASE || "Manual Review").trim();

function usePageTitle(pathname) {
  useEffect(() => {
    const route = ROUTES.find((r) => {
      if (r.path === "*") return false;
      if (r.path === "/") return pathname === "/";
      return pathname === r.path || pathname.startsWith(r.path + "/");
    });
    const title = route ? route.title : "Not Found";
    document.title = `${title} · ${TITLE_BASE}`;
  }, [pathname]);
}

/**
 * 轻量预取：光标悬停时调用即可
 * - 兼容 requestIdleCallback，空闲时再拉取
 */
export function prefetchImport(importFn) {
  if (typeof importFn !== "function") return;
  const run = () => {
    try { importFn(); } catch { /* ignore */ }
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1000 });
  } else {
    setTimeout(run, 0);
  }
}

export default function App() {
  const { pathname } = useLocation();

  useScrollRestoration();
  usePageTitle(pathname);

  // 监听 auth:required（401/403 时由 api/client.js 触发）
  useEffect(() => {
    function onAuthRequired(e) {
      // 未来如果你做登录弹窗，在这里 e.preventDefault() 并展示弹窗即可
      // e.detail.from 是触发时的来源路径，可用于登录后回跳
    }
    window.addEventListener("auth:required", onAuthRequired);
    return () => window.removeEventListener("auth:required", onAuthRequired);
  }, []);

  // 稳定的 Suspense fallback 元素
  const fallbackEl = useMemo(
    () => (
      <div
        className="w-full flex justify-center py-16 md:py-20"
        aria-busy="true"
        aria-label="Loading content"
      >
        <Loader size="lg" />
      </div>
    ),
    []
  );

  return (
    <div
      className={clsx(
        "min-h-screen font-sans",
        // 柔和的 Apple 风格背景分层
        "bg-gradient-to-br from-sky-50 via-blue-50 to-slate-100",
        "text-text"
      )}
    >
      {/* Skip link for a11y */}
      <a
        href="#main"
        className={clsx(
          "sr-only focus:not-sr-only focus:absolute focus:z-50",
          "focus:top-4 focus:left-4 focus:px-4 focus:py-2",
          "focus:bg-surface focus:text-text focus:rounded-xl focus:shadow-card"
        )}
      >
        Skip to content
      </a>

      <main
        id="main"
        className={clsx(
          "flex-1 flex flex-col",
          "py-8 md:py-10 px-4 md:px-8",
          // 减少动画偏好支持（如果你在子组件用到了过渡/动画）
          "motion-reduce:transition-none"
        )}
        aria-live="polite"
      >
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
          <Routes key={pathname}>
            {ROUTES.map((r) => (
              <Route
                key={r.path}
                path={r.path}
                element={
                  <ErrorBoundary
                    fallback={
                      <div className="w-full py-16 md:py-20 flex flex-col items-center gap-3">
                        <div className="text-base md:text-lg font-semibold text-slate-800">
                          Something went wrong loading this page.
                        </div>
                        <p className="text-sm text-slate-600">
                          Try refreshing the page, or come back later.
                        </p>
                      </div>
                    }
                  >
                    <Suspense fallback={fallbackEl}>{r.element}</Suspense>
                  </ErrorBoundary>
                }
              />
            ))}
            {/* Convenience redirect */}
            <Route path="/home" element={<Navigate to="/review" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
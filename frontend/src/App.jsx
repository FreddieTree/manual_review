// src/App.jsx
import React, { Suspense, useEffect, useMemo, useCallback } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Loader from "./components/ui/Loader";
import ErrorBoundary from "./components/ErrorBoundary";
import useScrollRestoration from "./hooks/useScrollRestoration";
import clsx from "clsx";

// Lazy-loaded pages
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const ReviewPage = React.lazy(() => import("./pages/ReviewPage"));
const AdminPage = React.lazy(() => import("./pages/AdminPage"));
const ReviewersPage = React.lazy(() => import("./pages/ReviewersPage"));
const ArbitrationPage = React.lazy(() => import("./pages/ArbitrationPage"));
const NoTasksPage = React.lazy(() => import("./pages/NoTasksPage"));
const NotFoundPage = React.lazy(() => import("./pages/NotFoundPage"));

// Route metadata to drive title and possible guards
const ROUTES = [
  { path: "/", element: <LoginPage />, title: "Login" },
  { path: "/review", element: <ReviewPage />, title: "Review" },
  { path: "/admin", element: <AdminPage />, title: "Admin" },
  { path: "/admin/reviewers", element: <ReviewersPage />, title: "Reviewers" },
  { path: "/admin/arbitration", element: <ArbitrationPage />, title: "Arbitration" },
  { path: "/no_more_tasks", element: <NoTasksPage />, title: "No More Tasks" },
  { path: "*", element: <NotFoundPage />, title: "Not Found" },
];

const DEFAULT_TITLE_BASE = "Manual Review";

function usePageTitle(pathname) {
  useEffect(() => {
    const route = ROUTES.find((r) => {
      if (r.path === "*") return false;
      // exact match or prefix for nested
      if (r.path === "/") return pathname === "/";
      return pathname === r.path || pathname.startsWith(r.path + "/");
    });
    const title = route ? route.title : "Not Found";
    document.title = `${title} · ${DEFAULT_TITLE_BASE}`;
  }, [pathname]);
}

/**
 * Prefetch a route component when user hovers on a link.
 * (Assumes consumers add onMouseEnter handlers that call this with the import function)
 */
export function prefetchImport(importFn) {
  if (typeof importFn === "function") {
    importFn();
  }
}

export default function App() {
  const location = useLocation();
  const { pathname } = location;

  useScrollRestoration(); // restore per-route scroll

  usePageTitle(pathname);

  // Optional: global auth check could go here, e.g., fetch session once and
  // provide context / redirect logic (omitted to stay flexible)

  // Suspense fallback component (centralized)
  const PageFallback = useCallback(
    () => (
      <div className="w-full flex justify-center py-20" aria-busy="true" aria-label="Loading content">
        <Loader size="lg" />
      </div>
    ),
    []
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-sky-50 via-blue-50 to-slate-100 transition-colors">
      <main
        className={clsx(
          "flex-1 flex flex-col",
          "py-10 px-4 md:px-8",
          "transition-all"
        )}
        aria-live="polite"
      >
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
          <Routes location={location} key={pathname}>
            {ROUTES.map((r) => (
              <Route
                key={r.path}
                path={r.path}
                element={
                  <ErrorBoundary
                    // per-route fallback avoids entire app crash
                    fallback={
                      <div className="w-full py-16 flex flex-col items-center gap-4">
                        <div className="text-lg font-semibold text-gray-800">
                          Something went wrong loading this page.
                        </div>
                        <div className="text-sm text-gray-600">
                          Try refreshing, or come back later.
                        </div>
                      </div>
                    }
                  >
                    <Suspense fallback={<PageFallback />}>
                      {r.element}
                    </Suspense>
                  </ErrorBoundary>
                }
              />
            ))}
            {/* Redirect convenience */}
            <Route path="/home" element={<Navigate to="/review" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
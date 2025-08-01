// src/pages/AdminPage.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { getAdminStats } from "../api";
import clsx from "clsx";

/**
 * Custom hook to fetch admin stats with optional polling and retry logic.
 */
function useAdminStats({ pollInterval = 0 } = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch admin stats:", e);
      setError(
        e?.message ||
        e?.response?.data?.message ||
        "Unable to load dashboard statistics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    if (pollInterval > 0) {
      const iv = setInterval(fetch, pollInterval);
      return () => clearInterval(iv);
    }
  }, [fetch, pollInterval]);

  return { stats, loading, error, refresh: fetch };
}

// Simple stat card component
function StatCard({ label, value, icon, color = "blue", extra, children }) {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-800 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
    red: "bg-red-50 text-red-800 border-red-100",
    indigo: "bg-indigo-50 text-indigo-800 border-indigo-100",
  }[color];

  return (
    <div
      className={clsx(
        "rounded-2xl p-6 shadow flex flex-col items-start border",
        colorStyles,
        "transition"
      )}
      aria-label={label}
    >
      <div className="flex items-center gap-3 w-full">
        <div className="text-3xl select-none">{icon}</div>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-extrabold tabular-nums">
              {value != null ? value : <span className="opacity-40">—</span>}
            </div>
            {extra && (
              <div className="text-xs text-gray-600 flex-shrink-0">{extra}</div>
            )}
          </div>
        </div>
      </div>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

// small badge
function Badge({ children, color = "indigo" }) {
  const bg = {
    indigo: "bg-indigo-100 text-indigo-800",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-800",
  }[color];
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold",
        bg
      )}
    >
      {children}
    </span>
  );
}

export default function AdminPage() {
  const { stats, loading, error, refresh } = useAdminStats({ pollInterval: 0 });
  const hasConflicts = useMemo(
    () => stats?.conflicts && stats.conflicts > 0,
    [stats]
  );

  // Derived display values with fallbacks
  const reviewedRatio =
    stats?.reviewed_ratio != null
      ? `${stats.reviewed_ratio.toFixed(1)}%`
      : "—";
  const reviewedCount = stats?.reviewed_count ?? 0;
  const totalAbstracts = stats?.total_abstracts ?? 0;
  const totalReviewers = stats?.total_reviewers ?? 0;
  const arbitrationCount = stats?.arbitration_count ?? 0;
  const activeReviewers = stats?.active_reviewers ?? 0;

  return (
    <div className="max-w-6xl mx-auto w-full mt-12 px-4">
      <div className="bg-white shadow-2xl rounded-3xl border border-gray-100 p-8 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold text-indigo-900 flex items-center gap-2">
              Admin Dashboard
              <span className="ml-1 px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-semibold tracking-wide">
                Beta
              </span>
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Overview of platform health, reviewer activity, and pending tasks.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh stats"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-60"
            >
              Refresh
              {loading && (
                <span
                  aria-hidden="true"
                  className="ml-1 animate-spin"
                  style={{ fontSize: "1rem" }}
                >
                  ⏳
                </span>
              )}
            </button>
            {hasConflicts && (
              <Link
                to="/admin/arbitration"
                className="inline-flex items-center gap-2 text-red-700 bg-red-50 px-4 py-2 rounded-md text-sm font-semibold hover:underline transition"
              >
                Resolve Conflicts ({stats.conflicts})
              </Link>
            )}
          </div>
        </div>

        {/* Error / Empty / Stats */}
        {error && (
          <div
            role="alert"
            className="rounded-md bg-red-50 border border-red-200 p-4 flex items-center gap-3"
          >
            <div className="text-red-700 flex-1">
              <strong>Failed to load dashboard:</strong> {error}
            </div>
            <button
              onClick={refresh}
              className="text-indigo-600 underline text-sm"
              aria-label="Retry loading stats"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Abstracts"
            value={totalAbstracts}
            icon="📄"
            color="blue"
            extra={
              stats?.abstracts_today
                ? <>+{stats.abstracts_today} today</>
                : undefined
            }
          />
          <StatCard
            label="Total Reviewers"
            value={totalReviewers}
            icon="👩‍🔬"
            color="emerald"
            extra={
              stats?.new_reviewers
                ? <>+{stats.new_reviewers} joined</>
                : undefined
            }
          />
          <StatCard
            label="Conflicts"
            value={stats?.conflicts}
            icon="⚡"
            color="red"
            extra={
              hasConflicts ? (
                <Link
                  to="/admin/arbitration"
                  className="text-sm underline hover:text-red-600"
                >
                  Resolve now
                </Link>
              ) : (
                <span className="text-xs text-gray-500">None pending</span>
              )
            }
          />
          <StatCard
            label="Fully Reviewed"
            value={reviewedCount}
            icon="✅"
            color="indigo"
            extra={
              stats?.reviewed_ratio
                ? `${reviewedRatio} done`
                : "Progress unknown"
            }
          />
        </div>

        {/* Platform summary + quick links */}
        <section className="flex flex-col lg:flex-row gap-8 bg-gray-50 border rounded-xl p-6">
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📊</div>
              <div>
                <h3 className="text-lg font-bold text-indigo-800">
                  Platform Status &amp; Roadmap
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Live metrics and actions you can take immediately.
                </p>
              </div>
            </div>
            <ul className="list-disc ml-6 space-y-1 text-gray-700">
              <li>
                <span className="font-semibold">{activeReviewers}</span> active
                reviewers
              </li>
              <li>
                Arbitration queue:{" "}
                <span className="font-semibold">{arbitrationCount}</span>
              </li>
              <li>
                Latest export:{" "}
                <span className="font-semibold">
                  {stats?.last_export || "—"}
                </span>
              </li>
              <li>Leaderboard, reviewer activity feed, and audit logs coming soon.</li>
            </ul>
            <div className="text-xs text-gray-500 mt-2">
              Need more control? Use the admin panel to unlock tasks, export
              consensus data, or manage reviewer permissions.
            </div>
          </div>
          <div className="flex flex-col shrink-0 gap-3 w-full sm:w-auto">
            <h4 className="text-md font-semibold text-indigo-900">Quick Actions</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                to="/admin/reviewers"
                className="flex items-center justify-between gap-2 px-4 py-3 bg-white border rounded-lg shadow hover:shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <div className="text-sm font-medium">Manage Reviewers</div>
                </div>
                <div className="text-xs text-gray-500">CRUD</div>
              </Link>
              <Link
                to="/admin/arbitration"
                className="flex items-center justify-between gap-2 px-4 py-3 bg-white border rounded-lg shadow hover:shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚖️</span>
                  <div className="text-sm font-medium">Arbitration Queue</div>
                </div>
                <div className="text-xs text-gray-500">
                  {arbitrationCount} pending
                </div>
              </Link>
              <Link
                to="/admin/export"
                className="flex items-center justify-between gap-2 px-4 py-3 bg-white border rounded-lg shadow hover:shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">📤</span>
                  <div className="text-sm font-medium">Export Data</div>
                </div>
                <div className="text-xs text-gray-500">Consensus</div>
              </Link>
              <Link
                to="/admin/locks"
                className="flex items-center justify-between gap-2 px-4 py-3 bg-white border rounded-lg shadow hover:shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔐</span>
                  <div className="text-sm font-medium">View Locks</div>
                </div>
                <div className="text-xs text-gray-500">In-flight</div>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
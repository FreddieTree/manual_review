import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  memo,
} from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { getAdminStats, exportConsensus, uploadAbstracts, getImportProgress } from "../api/admin"; // 明确路径
import TopBar from "../components/TopBar";
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";

/* ------------------------- helpers / hooks ------------------------- */
function useAdminStats({ pollInterval = 0 } = {}) {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(null);
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);

  const fetchStats = useCallback(async () => {
    const id = ++reqIdRef.current;
    abortRef.current?.abort?.();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");

    try {
      const data = await getAdminStats({ signal: abortRef.current.signal });
      if (reqIdRef.current !== id) return;
      setStats(data || {});
      setLastUpdated(new Date());
    } catch (e) {
      if (reqIdRef.current !== id) return;
      console.error("Failed to fetch admin stats:", e);
      setError(
        e?.message ||
        e?.response?.data?.message ||
        "Unable to load dashboard statistics."
      );
      setStats(null);
    } finally {
      if (reqIdRef.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (pollInterval > 0) {
      const iv = setInterval(fetchStats, pollInterval);
      return () => clearInterval(iv);
    }
    return () => abortRef.current?.abort?.();
  }, [fetchStats, pollInterval]);

  return { stats, loading, error, refresh: fetchStats, lastUpdated };
}

/* ------------------------- UI components ------------------------- */
const StatCard = ({ label, value, loading, extra, Icon }) => {
  return (
    <div className="flex flex-col justify-between gap-2">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="text-2xl flex-shrink-0" aria-hidden="true">
            <Icon />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {loading ? (
                <span className="inline-block h-8 w-20 rounded bg-gray-200 dark:bg-slate-700 animate-pulse" />
              ) : value != null ? (
                value
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
            {extra && !loading && (
              <div className="text-sm text-gray-500">{extra}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* --------------------------- Main Page --------------------------- */

function AdminPageImpl(_, ref) {
  const { stats, loading, error, refresh, lastUpdated } = useAdminStats({
    pollInterval: 0,
  });

  const [exporting, setExporting] = React.useState(false);
  const [exportMsg, setExportMsg] = React.useState("");
  const [uploadMsg, setUploadMsg] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState(null);
  const jobRef = useRef(null);

  const reviewedRatio =
    typeof stats?.reviewed_ratio === "number"
      ? Math.min(100, Math.max(0, stats.reviewed_ratio)).toFixed(1)
      : null;
  const reviewedCount = stats?.reviewed_count ?? null;
  const totalAbstracts = stats?.total_abstracts ?? null;
  const totalReviewers = stats?.total_reviewers ?? null;
  const arbitrationCount = stats?.arbitration_count ?? 0;
  const activeReviewers = stats?.active_reviewers ?? 0;
  const hasConflicts = (stats?.conflicts ?? 0) > 0;

  return (
    <div
      ref={ref}
      data-testid="AdminPage"
      className={clsx(
        "min-h-screen",
        "bg-gradient-to-b from-slate-50 via-white to-slate-100",
        "dark:from-slate-900 dark:via-slate-950 dark:to-slate-900"
      )}
    >
      {/* Unified TopBar for admin */}
      <TopBar isAdminView />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header / actions */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex-1">
            {/* kept in TopBar: title/description */}
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Overview of platform health, reviewer activity, and actionable
              items.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh stats"
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition",
                "bg-indigo-600 hover:bg-indigo-700 text-white",
                loading && "opacity-60 cursor-not-allowed"
              )}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {hasConflicts ? (
              <a
                href="/admin/arbitration"
                className="inline-flex items-center gap-2 rounded-full bg-red-100 text-red-700 px-4 py-2 text-sm font-semibold"
              >
                Resolve Conflicts ({stats.conflicts})
              </a>
            ) : (
              <div className="rounded-full bg-emerald-100 text-emerald-800 px-4 py-2 text-sm font-semibold">
                No conflicts
              </div>
            )}
            <button
              onClick={async () => {
                setExporting(true);
                setExportMsg("");
                try {
                  const body = await exportConsensus({});
                  const ok = body && body.success !== false;
                  const path = body?.path || body?.data?.path;
                  const count = body?.exported_count || body?.data?.exported_count;
                  setExportMsg(ok ? `Exported${count ? ` ${count}` : ""}${path ? ` → ${path}` : ""}` : (body?.message || "Export failed"));
                } catch (e) {
                  setExportMsg(e?.message || "Export failed");
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition",
                "bg-emerald-600 hover:bg-emerald-700 text-white",
                exporting && "opacity-60 cursor-not-allowed"
              )}
            >
              {exporting ? "Exporting…" : "Export Consensus"}
            </button>
            {exportMsg && (
              <div className="text-xs text-gray-600">{exportMsg}</div>
            )}
          </div>
        </div>

        {/* error banner */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">
            <div className="flex items-center justify-between gap-4">
              <div className="text-red-800 dark:text-red-200">
                <strong>Could not load stats:</strong> {error}
              </div>
              <button
                onClick={refresh}
                className="text-indigo-600 underline text-sm"
              >
                Retry
              </button>
            </div>
          </Card>
        )}

        {/* Stats overview */}
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Total Abstracts"
              value={totalAbstracts}
              loading={loading}
              extra={
                !loading && stats?.abstracts_today
                  ? `+${stats.abstracts_today} today`
                  : null
              }
              Icon={() => <span>📄</span>}
            />
            <StatCard
              label="Total Reviewers"
              value={totalReviewers}
              loading={loading}
              extra={
                !loading && stats?.new_reviewers
                  ? `+${stats.new_reviewers} joined`
                  : null
              }
              Icon={() => <span>👩‍🔬</span>}
            />
            <StatCard
              label="Conflicts"
              value={stats?.conflicts ?? 0}
              loading={loading}
              extra={
                !loading && hasConflicts ? (
                  <a
                    href="/admin/arbitration"
                    className="text-sm underline text-red-600"
                  >
                    Resolve now
                  </a>
                ) : (
                  !loading && <span className="text-sm text-gray-500">None</span>
                )
              }
              Icon={() => <span>⚡</span>}
            />
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Fully Reviewed
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {loading ? (
                    <span className="inline-block h-8 w-20 rounded bg-gray-200 dark:bg-slate-700 animate-pulse" />
                  ) : reviewedCount != null ? (
                    reviewedCount
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
                {!loading && reviewedRatio != null && (
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${reviewedRatio}%` }}
                        aria-label={`Reviewed ${reviewedRatio}%`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Summary + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="col-span-2 flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📊</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Platform Overview
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Live metrics and actionable insights at a glance.
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
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
              <li>Leaderboard, activity feed, audit logs coming soon.</li>
            </ul>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last updated:{" "}
              <span className="font-semibold">
                {lastUpdated
                  ? lastUpdated.toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                  : "—"}
              </span>
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-semibold text-slate-900 dark:text-white">
                Quick Actions
              </h3>
              <div className="text-xs text-gray-500">Manage</div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <a
                href="/admin/reviewers"
                className="flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-slate-800 border rounded-lg shadow hover:shadow-lg transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <div className="text-sm font-medium">Manage Reviewers</div>
                </div>
                <div className="text-xs text-gray-500">CRUD</div>
              </a>
              <a
                href="/admin/arbitration"
                className="flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-slate-800 border rounded-lg shadow hover:shadow-lg transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚖️</span>
                  <div className="text-sm font-medium">Arbitration Queue</div>
                </div>
                <div className="text-xs text-gray-500">
                  {arbitrationCount} pending
                </div>
              </a>
              <div className="flex flex-col gap-2 px-4 py-3 bg-white dark:bg-slate-800 border rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📥</span>
                    <div className="text-sm font-medium">Upload Abstracts</div>
                  </div>
                  <div className="text-xs text-gray-500">{uploadMsg}</div>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const file = e.currentTarget.elements?.file?.files?.[0];
                    setUploading(true);
                    setUploadMsg("");
                    try {
                      const fd = new FormData();
                      if (file) fd.append("file", file);
                      const data = await uploadAbstracts(fd);
                      const jobId = data?.job_id;
                      jobRef.current = jobId;
                      setUploadMsg(jobId ? `Queued: ${jobId}` : "Uploaded");
                      if (jobId) {
                        const t = setInterval(async () => {
                          try {
                            const prog = await getImportProgress(jobId, {});
                            const payload = prog?.data || prog?.progress || prog;
                            setJobStatus(payload);
                            if (payload?.done) clearInterval(t);
                          } catch {}
                        }, 1500);
                      }
                    } catch (err) {
                      setUploadMsg(err?.message || "Upload failed");
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input name="file" type="file" accept=".jsonl" disabled={uploading} />
                  <button type="submit" disabled={uploading} className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </form>
                {jobStatus && (
                  <div className="text-xs text-gray-600">{JSON.stringify(jobStatus)}</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------- PropTypes for dev -------------------- */
if (process.env.NODE_ENV !== "production") {
  StatCard.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    loading: PropTypes.bool,
    extra: PropTypes.node,
    Icon: PropTypes.elementType,
  };
}

export default memo(forwardRef(AdminPageImpl));
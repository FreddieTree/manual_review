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
import { getAdminStats, exportConsensus, uploadAbstracts, getImportProgress, exportSnapshot, getAnalytics } from "../api/admin"; // 明确路径
import ConfirmModal from "../components/ConfirmModal";
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
  const [exportOpen, setExportOpen] = React.useState(false);
  const [snapshotOpen, setSnapshotOpen] = React.useState(false);
  const [snapshotBusy, setSnapshotBusy] = React.useState(false);
  const [snapshotMsg, setSnapshotMsg] = React.useState("");
  const [uploadMsg, setUploadMsg] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState(null);
  const jobRef = useRef(null);

  // Reviewer scope from TopBar dropdown (via global event)
  const [selectedReviewer, setSelectedReviewer] = React.useState(null);
  useEffect(() => {
    // Lock page scroll
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");
    const handler = (e) => setSelectedReviewer(e.detail || null);
    window.addEventListener("admin:reviewerSelected", handler);
    return () => {
      window.removeEventListener("admin:reviewerSelected", handler);
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, []);

  // Analytics (platform or reviewer-scoped)
  const [analytics, setAnalytics] = React.useState(null);
  const [analyticsLoading, setAnalyticsLoading] = React.useState(true);
  const [analyticsError, setAnalyticsError] = React.useState("");
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const params = selectedReviewer ? { reviewer: selectedReviewer?.email || selectedReviewer } : {};
      const data = await getAnalytics(params, {});
      setAnalytics(data || {});
    } catch (e) {
      setAnalyticsError(e?.message || "Failed to load analytics");
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedReviewer]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

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
        "h-screen overflow-hidden",
        "bg-gradient-to-b from-slate-50 via-white to-slate-100",
        "dark:from-slate-900 dark:via-slate-950 dark:to-slate-900"
      )}
    >
      {/* Unified TopBar for admin */}
      <TopBar isAdminView />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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
              onClick={() => setExportOpen(true)}
              disabled={exporting}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition",
                "bg-emerald-600 hover:bg-emerald-700 text-white",
                exporting && "opacity-60 cursor-not-allowed"
              )}
            >
              {exporting ? "Exporting…" : "Export Consensus"}
            </button>
              <button
                onClick={() => { setSnapshotOpen(true); setSnapshotMsg(""); }}
                disabled={snapshotBusy}
                className={clsx(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition",
                  "bg-slate-700 hover:bg-slate-800 text-white",
                  snapshotBusy && "opacity-60 cursor-not-allowed"
                )}
              >
                {snapshotBusy ? "Snapshot…" : "Export Snapshot"}
              </button>
              {snapshotMsg && (
                <div className="text-xs text-gray-600">{snapshotMsg}</div>
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

        {/* Merged analytics + key stats */}

        {/* Summary + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="col-span-2 flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📊</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedReviewer ? `Reviewer Analytics — ${selectedReviewer.name}` : "Platform Analytics"}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {selectedReviewer ? "Detailed stats for the selected reviewer." : "Live metrics and actionable insights at a glance."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
              {/* Compact key metrics row */}
              <Card className="p-4">
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">Total Abstracts</div>
                <div className="text-2xl font-extrabold">{totalAbstracts ?? "—"}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">Total Reviewers</div>
                <div className="text-2xl font-extrabold">{totalReviewers ?? "—"}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">Conflicts</div>
                <div className="text-2xl font-extrabold">{stats?.conflicts ?? 0}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">Fully Reviewed</div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-extrabold">{reviewedCount ?? 0}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${reviewedRatio || 0}%` }} />
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm font-semibold mb-2">Totals</div>
                {analyticsLoading ? (
                  <div className="h-16 bg-gray-100 rounded animate-pulse" />
                ) : analytics ? (
                  <ul className="text-sm space-y-1">
                    <li>Abstracts: <span className="font-semibold">{analytics?.totals?.abstracts ?? "—"}</span></li>
                    <li>Sentences: <span className="font-semibold">{analytics?.totals?.sentences ?? "—"}</span></li>
                    <li>Assertions: <span className="font-semibold">{analytics?.totals?.assertions ?? "—"}</span></li>
                  </ul>
                ) : (
                  <div className="text-sm text-red-600">{analyticsError || "Failed to load"}</div>
                )}
              </Card>
              <Card className="p-4">
                <div className="text-sm font-semibold mb-2">Assertion Status</div>
                {analyticsLoading ? (
                  <div className="h-16 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <ul className="text-sm grid grid-cols-2 gap-1">
                    {Object.entries(analytics?.status_counts || {}).map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{v}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-4 sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Activity</div>
                  <button className="text-xs underline" onClick={loadAnalytics}>Refresh</button>
                </div>
                {analyticsLoading ? (
                  <div className="h-20 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Abstracts touched</div>
                      <div className="font-semibold">{analytics?.activity?.abstracts_touched ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sentences touched</div>
                      <div className="font-semibold">{analytics?.activity?.sentences_touched ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Actions</div>
                      <div className="font-mono text-xs break-words">{JSON.stringify(analytics?.activity?.actions || {})}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Last activity</div>
                      <div className="font-semibold">{analytics?.activity?.last_activity ? new Date(analytics.activity.last_activity * 1000).toLocaleString() : "—"}</div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
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
      {/* Confirm: export consensus */}
      <ConfirmModal
        open={exportOpen}
        title="Export final consensus"
        description="This will generate a JSONL of final consensus decisions and download it to your computer. Proceed?"
        confirmText="Export"
        intent="primary"
        isLoading={exporting}
        onCancel={() => setExportOpen(false)}
        onConfirm={async () => {
          setExporting(true);
          try {
            await exportConsensus();
          } finally {
            setExporting(false);
            setExportOpen(false);
          }
        }}
      />

      {/* Confirm: export snapshot */}
      <ConfirmModal
        open={snapshotOpen}
        title="Confirm snapshot export"
        description="This will export a timestamped snapshot of final consensus for traceability. Proceed?"
        confirmText="Export"
        intent="primary"
        isLoading={snapshotBusy}
        onCancel={() => setSnapshotOpen(false)}
        onConfirm={async () => {
          setSnapshotBusy(true);
          try {
            await exportSnapshot();
          } catch (e) {
            // no-op; rely on download or network error tooltip
          } finally {
            setSnapshotBusy(false);
            setSnapshotOpen(false);
          }
        }}
      />
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
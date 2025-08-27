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
import Button from "../components/ui/Button";

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
  const fileInputRef = useRef(null);

  const handleFileSelected = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [getImportProgress, uploadAbstracts]);

  // Reviewer scope from TopBar dropdown (via global event)
  const [selectedReviewer, setSelectedReviewer] = React.useState(null);
  useEffect(() => {
    const handler = (e) => setSelectedReviewer(e.detail || null);
    window.addEventListener("admin:reviewerSelected", handler);
    return () => window.removeEventListener("admin:reviewerSelected", handler);
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

  const isScoped = !!selectedReviewer;
  const tint = React.useMemo(() => {
    const palette = [
      { bg: "bg-indigo-50/80 dark:bg-indigo-900/40", border: "border-indigo-300 dark:border-indigo-700" },
      { bg: "bg-emerald-50/80 dark:bg-emerald-900/40", border: "border-emerald-300 dark:border-emerald-700" },
      { bg: "bg-amber-50/80 dark:bg-amber-900/40", border: "border-amber-300 dark:border-amber-700" },
      { bg: "bg-sky-50/80 dark:bg-sky-900/40", border: "border-sky-300 dark:border-sky-700" },
      { bg: "bg-violet-50/80 dark:bg-violet-900/40", border: "border-violet-300 dark:border-violet-700" },
      { bg: "bg-rose-50/80 dark:bg-rose-900/40", border: "border-rose-300 dark:border-rose-700" },
      { bg: "bg-teal-50/80 dark:bg-teal-900/40", border: "border-teal-300 dark:border-teal-700" },
      { bg: "bg-fuchsia-50/80 dark:bg-fuchsia-900/40", border: "border-fuchsia-300 dark:border-fuchsia-700" },
      { bg: "bg-cyan-50/80 dark:bg-cyan-900/40", border: "border-cyan-300 dark:border-cyan-700" },
      { bg: "bg-lime-50/80 dark:bg-lime-900/40", border: "border-lime-300 dark:border-lime-700" },
    ];
    const id = (selectedReviewer?.email || selectedReviewer?.name || "").toString();
    if (!id) return palette[0];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const idx = h % palette.length;
    return palette[idx];
  }, [selectedReviewer]);

  // Base totals from stats (declare early for downstream use)
  const totalAbstracts = stats?.total_abstracts ?? null;
  const totalReviewers = stats?.total_reviewers ?? null;
  const arbitrationCount = stats?.arbitration_count ?? 0;
  const activeReviewers = stats?.active_reviewers ?? 0;
  const hasConflicts = (stats?.conflicts ?? 0) > 0;

  // When a reviewer is selected, show their reviewed count if available from analytics
  const reviewerReviewedCount = selectedReviewer ? (analytics?.per_abstract?.length || 0) : null;
  const reviewedRatio =
    typeof stats?.reviewed_ratio === "number"
      ? Math.min(100, Math.max(0, stats.reviewed_ratio)).toFixed(1)
      : null;
  const reviewedCount = selectedReviewer ? reviewerReviewedCount : (stats?.reviewed_count ?? null);
  const sentencesTotal = analytics?.totals?.sentences ?? null;
  const assertionsTotal = analytics?.totals?.assertions ?? null;
  const avgSentencesPerAbstract = useMemo(() => {
    if (!totalAbstracts || !sentencesTotal) return null;
    return (sentencesTotal / totalAbstracts).toFixed(1);
  }, [totalAbstracts, sentencesTotal]);
  const avgAssertionsPerAbstract = useMemo(() => {
    if (!totalAbstracts || !assertionsTotal) return null;
    return (assertionsTotal / totalAbstracts).toFixed(1);
  }, [totalAbstracts, assertionsTotal]);
  const avgAssertionsPerSentence = useMemo(() => {
    if (!sentencesTotal || !assertionsTotal) return null;
    return (assertionsTotal / sentencesTotal).toFixed(2);
  }, [sentencesTotal, assertionsTotal]);
  

  return (
    <div
      ref={ref}
      data-testid="AdminPage"
      className={clsx(
        "min-h-screen",
        "bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900"
      )}
    >
      {/* Unified TopBar for admin (sticky, Apple style) */}
      <div className="sticky top-0 z-[200]">
        <div className="mx-auto max-w-[1280px] px-4">
          <TopBar
            isAdminView
            withMargin={false}
            maxWidth="1240px"
            adminActions={(
              <>
                <button
                  onClick={async () => { await Promise.all([refresh(), loadAnalytics()]); }}
                  disabled={loading || analyticsLoading}
                  className={clsx("inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border",
                    "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700",
                    (loading || analyticsLoading) && "opacity-60 cursor-not-allowed")}
                >
                  Refresh
                </button>
                <button
                  onClick={() => setExportOpen(true)}
                  disabled={exporting}
                  className={clsx("inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border",
                    "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700",
                    exporting && "opacity-60 cursor-not-allowed")}
                >
                  {exporting ? "Exporting…" : "Export Consensus"}
                </button>
                <button
                  onClick={() => { setSnapshotOpen(true); setSnapshotMsg(""); }}
                  disabled={snapshotBusy}
                  className={clsx("inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border",
                    "bg-slate-700 hover:bg-slate-800 text-white border-slate-800",
                    snapshotBusy && "opacity-60 cursor-not-allowed")}
                >
                  {snapshotBusy ? "Snapshot…" : "Export Snapshot"}
                </button>
                <a
                  href="/admin/reviewers"
                  className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-full shadow hover:shadow-lg transition text-xs font-semibold"
                >
                  <span className="text-xl">👥</span>
                  <span className="text-sm font-medium">Manage Reviewers</span>
                </a>
                <a
                  href="/admin/arbitration"
                  className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-full shadow hover:shadow-lg transition text-xs font-semibold"
                >
                  <span className="text-xl">⚖️</span>
                  <span>Arbitration Queue</span>
                  <span className="text-[10px] text-gray-500">{arbitrationCount} pending</span>
                </a>
                <div className="inline-flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                    aria-label="Import JSONL"
                  >
                    <span aria-hidden>📥</span>
                    Import JSONL
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jsonl"
                    className="sr-only"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                    disabled={uploading}
                  />
                  {uploadMsg && (
                    <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate max-w-[160px]" title={uploadMsg}>
                      {uploadMsg}
                    </span>
                  )}
                </div>
              </>
            )}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex-1">
            {/* kept in TopBar: title/description */}
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Overview of platform health, reviewer activity, and actionable
              items.
            </p>
          </div>
        </div>

        {/* error banner */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">
            <div className="flex items-center justify-between gap-4">
              <div className="text-red-800 dark:text-red-200">
                <strong>Could not load stats:</strong> {error}
              </div>
              <div className="text-xs text-gray-600">Use Refresh in Quick Actions</div>
            </div>
          </Card>
        )}

        {/* Merged analytics + key stats */}

        {/* Summary + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
          <Card className={clsx(
            "col-span-1 flex flex-col gap-6 relative bg-white dark:bg-slate-900"
          )}>
            <div className="flex items-start gap-3">
              <div className={clsx(
                "text-2xl",
                isScoped ? "text-indigo-700 drop-shadow-sm" : "text-slate-700"
              )}>📊</div>
              <div className="flex-1">
                <h2 className={clsx("text-xl font-bold", isScoped ? "text-indigo-900 dark:text-indigo-200" : "text-slate-900 dark:text-white") }>
                  {selectedReviewer ? `Reviewer Analytics — ${selectedReviewer.name}` : "Platform Analytics"}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {selectedReviewer ? "Detailed stats for the selected reviewer." : "Live metrics and actionable insights at a glance."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
              {/* Compact key metrics row */}
              <Card className="p-4">
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">Total Abstracts</div>
                <div className="text-2xl font-extrabold">{totalAbstracts ?? "—"}</div>
                {avgSentencesPerAbstract != null && (
                  <div className="text-xs text-gray-500 mt-1">Avg sentences/abstract: <span className="font-semibold">{avgSentencesPerAbstract}</span></div>
                )}
              </Card>
              <Card className="p-4">
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">Total Reviewers</div>
                <div className="text-2xl font-extrabold">{totalReviewers ?? "—"}</div>
                <div className="text-xs text-gray-500 mt-1">Active (recent): <span className="font-semibold">{activeReviewers ?? 0}</span></div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">Conflicts</div>
                <div className="text-2xl font-extrabold">{stats?.conflicts ?? 0}</div>
              </Card>
              <Card className={clsx("p-4", isScoped && `${tint.bg} ${tint.border}`) }>
                <div className="text-xs font-medium uppercase text-gray-500 mb-1">{selectedReviewer ? "Reviewed by Selected" : "Fully Reviewed"}</div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-extrabold">{reviewedCount ?? 0}</div>
                  {!selectedReviewer && (
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${reviewedRatio || 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm font-semibold mb-2">Dataset Insights</div>
                {analyticsLoading ? (
                  <div className="h-16 bg-gray-100 rounded animate-pulse" />
                ) : analytics ? (
                  <ul className="text-sm space-y-1">
                    <li>Sentences (total): <span className="font-semibold">{sentencesTotal ?? "—"}</span></li>
                    <li>Assertions (total): <span className="font-semibold">{assertionsTotal ?? "—"}</span></li>
                    <li>Avg sentences / abstract: <span className="font-semibold">{avgSentencesPerAbstract ?? "—"}</span></li>
                    <li>Avg assertions / abstract: <span className="font-semibold">{avgAssertionsPerAbstract ?? "—"}</span></li>
                    <li>Avg assertions / sentence: <span className="font-semibold">{avgAssertionsPerSentence ?? "—"}</span></li>
                  </ul>
                ) : (
                  <div className="text-sm text-red-600">{analyticsError || "Failed to load"}</div>
                )}
              </Card>
              <Card className={clsx("p-4", isScoped && `${tint.bg} ${tint.border}`) }>
                <div className="text-sm font-semibold mb-2">Abstract Status</div>
                {analyticsLoading ? (
                  <div className="h-16 bg-gray-100 rounded animate-pulse" />
                ) : (
                  (() => {
                    const sc = analytics?.status_counts || {};
                    const sa = analytics?.status_abstract_counts || {};
                    const order = ["arbitrated", "consensus", "conflict", "pending"];
                    return (
                      <ul className="text-sm grid grid-cols-2 gap-1">
                        {order.map((k) => (
                          <li key={k} className="flex justify-between">
                            <span className="capitalize">{k}</span>
                            <span className="font-semibold tabular-nums">
                              {sc[k] ?? 0} <span className="text-gray-400">({sa[k] ?? 0} abstracts)</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()
                )}
              </Card>
              <Card className={clsx("p-4 md:col-span-2", isScoped && `${tint.bg} ${tint.border}`) }>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Activity</div>
                </div>
                {analyticsLoading ? (
                  <div className="h-20 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <div className="flex flex-col gap-4 text-sm">
                    {/* High-level activity tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

                    {/* Reviewer-scoped per-abstract detail table */}
                    {selectedReviewer && (
                      <div className="w-full">
                        <table className="w-full text-sm">
                      <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                              <th className="py-2 pr-3">PMID</th>
                              <th className="py-2 pr-3">Order</th>
                          <th className="py-2 pr-3">First reviewer</th>
                              <th className="py-2 pr-3">First decisions</th>
                          <th className="py-2 pr-3">Second reviewer</th>
                              <th className="py-2 pr-3">Second decisions</th>
                              <th className="py-2 pr-3">Selected decisions</th>
                              <th className="py-2 pr-3">Last activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(analytics?.per_abstract || []).map((row) => (
                              <tr key={row.pmid} className="border-t">
                                <td className="py-2 pr-3 font-mono">
                                  <a href={`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{row.pmid}</a>
                                </td>
                                <td className="py-2 pr-3">{row.reviewer_order ?? "—"}</td>
                                <td className="py-2 pr-3">{row.first_reviewer_name || row.first_reviewer || "—"}</td>
                                <td className="py-2 pr-3">{row.first_reviewer_decisions ? `C${row.first_reviewer_decisions.accept}/R${row.first_reviewer_decisions.reject}/U${row.first_reviewer_decisions.uncertain}/A${row.first_reviewer_decisions.add || 0}` : "—"}</td>
                                <td className="py-2 pr-3">{row.second_reviewer_name || row.second_reviewer || "—"}</td>
                                <td className="py-2 pr-3">{row.second_reviewer_decisions ? `C${row.second_reviewer_decisions.accept}/R${row.second_reviewer_decisions.reject}/U${row.second_reviewer_decisions.uncertain}/A${row.second_reviewer_decisions.add || 0}` : "—"}</td>
                                <td className="py-2 pr-3 font-semibold">{row.selected_decisions ? `C${row.selected_decisions.accept}/R${row.selected_decisions.reject}/U${row.selected_decisions.uncertain}/A${row.selected_decisions.add || 0}` : "—"}</td>
                                <td className="py-2 pr-3">{row.last_activity ? new Date(row.last_activity * 1000).toLocaleString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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

          <div className="flex flex-col gap-4 max-w-[320px]">
            {jobStatus && (
              <Card className="text-xs text-gray-600">{JSON.stringify(jobStatus)}</Card>
            )}
          </div>
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
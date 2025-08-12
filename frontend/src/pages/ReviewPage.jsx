import React, { useEffect, useState, useCallback, useMemo, useRef, forwardRef, memo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

import { getAssignedAbstract, submitReview, heartbeat, releaseAssignment } from "../api";
import { logout as apiLogout } from "../api/auth";
import { getAbstractOverview } from "../api/tasks";
import AbstractMetaCard from "../components/AbstractMetaCard";
import TopBar from "../components/TopBar";
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";
import ConfirmModal from "../components/ConfirmModal";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import { isPerfectMatch, deriveOverallDecision } from "../utils";
import { getVocab } from "../api/meta";

const STATUS = {
  LOADING: "loading",
  ERROR: "error",
  READY: "ready",
  SUBMITTING: "submitting",
};

/**
 * ReviewPage - optimized, robust, A11y-friendly.
 */
function ReviewPageImpl(_, ref) {
  const [abstract, setAbstract] = useState(null);
  const [reviewStatesMap, setReviewStatesMap] = useState({});
  const [showAddFor, setShowAddFor] = useState({}); // sentence_index -> boolean
  const [predicateWhitelist, setPredicateWhitelist] = useState(null);
  const [entityTypeWhitelist, setEntityTypeWhitelist] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState(STATUS.LOADING);
  const [submitting, setSubmitting] = useState(false);
  const [violations, setViolations] = useState([]);
  const [overview, setOverview] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // Confirm modals
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const isMountedRef = useRef(false);
  const reqIdRef = useRef(0);
  const ignoreBeforeUnloadRef = useRef(false);

  // 未保存修改
  const hasUnsavedChanges = useMemo(() => {
    if (!abstract) return false;
    const allStates = Object.values(reviewStatesMap).flat();
    const modified = allStates.some(
      (s) =>
        s.isModified ||
        s.decision !== "accept" ||
        (s.comment && s.comment.trim())
    );
    const hasNew = (abstract.sentence_results || []).some((s) =>
      (s.assertions || []).some((a) => a.is_new)
    );
    return modified || hasNew;
  }, [reviewStatesMap, abstract]);

  // 加载 / 刷新 abstract
  const loadAbstract = useCallback(async () => {
    const id = ++reqIdRef.current;
    setStatusType(STATUS.LOADING);
    setStatusMsg("Fetching assigned abstract…");

    try {
      const resp = await getAssignedAbstract();
      if (reqIdRef.current !== id) return; // 过期请求

      // 兼容 Response 或 直接对象
      let parsed = resp;
      try {
        if (resp && typeof resp.json === "function") parsed = await resp.json();
      } catch (_) { }

      // 支持 { abstract: {...} } 或 直接扁平 {...}
      const raw = parsed?.abstract ?? parsed;
      if (!raw) {
        // Handle no more tasks contract
        if (parsed?.no_more_tasks || parsed?.data?.no_more_tasks) {
          window.location.assign("/no_more_tasks");
          return;
        }
        throw new Error("No assigned abstract.");
      }
      const a = { ...raw };

      if (!Array.isArray(a.sentence_results)) a.sentence_results = [];
      a.sentence_results = a.sentence_results.map((s, idx) => ({
        sentence_index: s.sentence_index ?? idx + 1, // 1-based 显示
        sentence: s.sentence ?? "",
        assertions: Array.isArray(s.assertions) ? s.assertions : [],
        ...s,
      }));

      setAbstract(a);
      // Fetch overview (reviewer order and peer stats)
      try {
        const ov = await getAbstractOverview(a.pmid, {});
        setOverview(ov);
      } catch {}

      // 初始化/保留 reviewState
      setReviewStatesMap((prev) => {
        const next = {};
        a.sentence_results.forEach((s) => {
          const prevArr = Array.isArray(prev[s.sentence_index])
            ? prev[s.sentence_index]
            : [];
          next[s.sentence_index] = (s.assertions || []).map((ass, i) => {
            const existed = prevArr[i];
            return (
              existed || {
                decision: "uncertain",
                comment: ass.comment || "",
                isModified: false,
              }
            );
          });
        });
        return next;
      });

      setStatusType(STATUS.READY);
      setStatusMsg("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("loadAbstract error:", err);
      if (reqIdRef.current !== id) return;
      setStatusType(STATUS.ERROR);
      const message =
        typeof err === "string"
          ? err
          : err?.message || "Failed to load abstract.";
      setStatusMsg(message);
    }
  }, []);

  // 初次加载
  useEffect(() => {
    isMountedRef.current = true;
    loadAbstract();
    // fetch vocab once
    (async () => {
      try {
        const vocab = await getVocab({});
        // Expect shape from backend: { predicates: [{id,label,description}], entity_types: [{id,label,description}] }
        const predsRaw = Array.isArray(vocab?.predicates) ? vocab.predicates : [];
        const typesRaw = Array.isArray(vocab?.entity_types) ? vocab.entity_types : [];
        const preds = predsRaw.map((p) => ({ id: typeof p === "string" ? p : p?.id, description: typeof p === "object" ? p?.description : "" })).filter((x) => x.id);
        const types = typesRaw.map((t) => ({ id: typeof t === "string" ? t : t?.id, description: typeof t === "object" ? t?.description : "" })).filter((x) => x.id);
        setPredicateWhitelist(preds);
        setEntityTypeWhitelist(types);
      } catch {}
    })();
    // keep lock alive while on page
    let iv = null;
    const startBeat = () => {
      if (iv) return;
      iv = setInterval(() => {
        heartbeat().catch(() => {});
      }, 25000);
    };
    const stopBeat = () => {
      if (iv) {
        clearInterval(iv);
        iv = null;
      }
    };
    startBeat();
    const onVis = () => {
      if (document.hidden) stopBeat(); else startBeat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      isMountedRef.current = false;
      reqIdRef.current += 1; // 使未完成请求失效
      document.removeEventListener("visibilitychange", onVis);
      stopBeat();
      // best-effort explicit release on unload
      try {
        const url = (import.meta.env.VITE_API_BASE || "") + "/api/abandon";
        navigator.sendBeacon?.(url, new Blob(["{}"], { type: "application/json" }));
      } catch {}
    };
  }, [loadAbstract]);

  // 未保存离开提示
  useEffect(() => {
    const handler = (e) => {
      if (ignoreBeforeUnloadRef.current) return; // allow programmatic navigations (e.g., logout)
      if (hasUnsavedChanges && !submitting) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges, submitting]);

  // Draft restore once per abstract (1h TTL)
  useEffect(() => {
    if (!abstract?.pmid) return;
    const key = `draft:${abstract.pmid}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const { ts, sentence_results, review_states } = JSON.parse(raw);
        if (Date.now() - ts < 60 * 60 * 1000) {
          if (Array.isArray(sentence_results)) {
            setAbstract((prev) => (prev ? { ...prev, sentence_results } : prev));
          }
          if (review_states && typeof review_states === "object") {
            setReviewStatesMap(review_states);
          }
          setDraftSavedAt(new Date(ts));
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch {}
  }, [abstract?.pmid]);

  // Draft auto-save interval (no state resets here)
  useEffect(() => {
    if (!abstract?.pmid) return () => {};
    const key = `draft:${abstract.pmid}`;
    const iv = setInterval(() => {
      try {
        const snapshot = {
          ts: Date.now(),
          sentence_results: abstract?.sentence_results || [],
          review_states: reviewStatesMap,
        };
        localStorage.setItem(key, JSON.stringify(snapshot));
        setDraftSavedAt(new Date(snapshot.ts));
      } catch {}
    }, 15000);
    return () => clearInterval(iv);
  }, [abstract?.pmid, abstract?.sentence_results, reviewStatesMap]);

  /* ------------------------------- Mutators ------------------------------- */

  const handleAddAssertion = useCallback((sentenceIdx, assertion) => {
    try {
      setAbstract((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sentence_results: prev.sentence_results.map((s) =>
            s.sentence_index === sentenceIdx
              ? { ...s, assertions: [...(s.assertions || []), { ...assertion, is_new: true }] }
              : s
          ),
        };
      });
      // Do not create a review state for new assertions; they are automatically tagged as 'add'
      setShowAddFor((m) => ({ ...m, [sentenceIdx]: false }));
    } catch (e) {
      console.warn("Add assertion failed:", e);
    }
  }, []);

  const handleModifyAssertion = useCallback(
    (sentenceIdx, assertionIdx, updatedAssertion) => {
      setAbstract((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sentence_results: prev.sentence_results.map((s) => {
            if (s.sentence_index !== sentenceIdx) return s;
            const newAssertions = [...(s.assertions || [])];
            newAssertions[assertionIdx] = {
              ...newAssertions[assertionIdx],
              ...updatedAssertion,
            };
            return { ...s, assertions: newAssertions };
          }),
        };
      });
      setReviewStatesMap((prev) => {
        const arr = Array.isArray(prev[sentenceIdx]) ? [...prev[sentenceIdx]] : [];
        const prevState =
          arr[assertionIdx] || { decision: "accept", comment: "", isModified: false };
        arr[assertionIdx] = {
          ...prevState,
          decision: prevState.decision === "accept" ? "modify" : prevState.decision,
          isModified: true,
        };
        return { ...prev, [sentenceIdx]: arr };
      });
    },
    []
  );

  const handleDeleteAssertion = useCallback((sentenceIdx, assertionIdx) => {
    setAbstract((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sentence_results: prev.sentence_results.map((s) => {
          if (s.sentence_index !== sentenceIdx) return s;
          const newAssertions = [...(s.assertions || [])];
          newAssertions.splice(assertionIdx, 1);
          return { ...s, assertions: newAssertions };
        }),
      };
    });
    setReviewStatesMap((prev) => {
      const arr = Array.isArray(prev[sentenceIdx]) ? [...prev[sentenceIdx]] : [];
      arr.splice(assertionIdx, 1);
      return { ...prev, [sentenceIdx]: arr };
    });
  }, []);

  const handleReviewStateChange = useCallback(
    (sentenceIdx, assertionIdx, { decision, comment, isModified }) => {
      setReviewStatesMap((prev) => {
        const arr = Array.isArray(prev[sentenceIdx]) ? [...prev[sentenceIdx]] : [];
        arr[assertionIdx] = {
          ...(arr[assertionIdx] || {
            decision: "accept",
            comment: "",
            isModified: false,
          }),
          decision,
          comment,
          isModified: !!isModified || decision === "modify",
        };
        return { ...prev, [sentenceIdx]: arr };
      });
    },
    []
  );

  /* -------------------------- Derived: overall decision -------------------------- */

  const allAssertionStates = useMemo(() => {
    if (!abstract) return [];
    return Object.values(reviewStatesMap)
      .flat()
      .map((rs) => ({ review: rs.decision, isModified: !!rs.isModified }));
  }, [reviewStatesMap, abstract]);

  const addedAssertions = useMemo(() => {
    if (!abstract) return [];
    const out = [];
    (abstract.sentence_results || []).forEach((s) => {
      (s.assertions || []).forEach((a) => {
        if (a && a.is_new) out.push(a);
      });
    });
    return out;
  }, [abstract]);

  const overallDecision = useMemo(() => {
    return deriveOverallDecision({
      existingReviews: allAssertionStates,
      addedAssertions,
    });
  }, [allAssertionStates, addedAssertions]);

  const hasUncertainWithoutNote = useMemo(() => {
    return Object.values(reviewStatesMap)
      .flat()
      .some((rs) => (rs?.decision || "accept") === "uncertain" && !String(rs?.comment || "").trim());
  }, [reviewStatesMap]);

  /* -------------------------------- Submission -------------------------------- */

  const doSubmit = useCallback(async () => {
    if (!abstract || submitting) return;
    setSubmitting(true);
    setStatusType(STATUS.SUBMITTING);
    setStatusMsg("Submitting review…");
    setViolations([]);

    try {
      // Convert review states to backend's expected shape (uses 'review' instead of 'decision')
      const convertedStates = Object.fromEntries(
        Object.entries(reviewStatesMap || {}).map(([k, arr]) => [
          k,
          (arr || []).map((s) => ({
            review: s?.decision || "accept",
            comment: s?.comment || "",
          })),
        ])
      );

      const payload = {
        pmid: abstract.pmid,
        sentence_results: abstract.sentence_results,
        // Submit only per-assertion reviews; no abstract-level decision
        review_states: convertedStates,
      };

      const resp = await submitReview(payload);
      setStatusType(STATUS.READY);
      setStatusMsg("✅ Review submitted! Fetching next…");

      setTimeout(() => {
        if (!isMountedRef.current) return;
        setSubmitting(false);
        loadAbstract();
      }, 800);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Submit error:", err);
      setStatusType(STATUS.ERROR);
      const backendViolations = err?.response?.data?.data?.violations || err?.payload?.data?.violations || [];
      if (Array.isArray(backendViolations) && backendViolations.length) {
        setViolations(backendViolations);
        // Render a brief banner summary and rely on inline messages as well
        setStatusMsg("Submission has validation errors. Please resolve highlighted items.");
      } else {
        const msg = typeof err === "string" ? err : err?.message || "Failed to submit review. Please retry.";
        setStatusMsg(`❌ ${msg}`);
      }
      setSubmitting(false);
    }
  }, [abstract, overallDecision, reviewStatesMap, submitting, loadAbstract]);

  const handleSubmit = useCallback(() => {
    // Always show confirm; if blocking errors exist they will be shown inline after server response
    setConfirmSubmitOpen(true);
  }, []);

  const LOGIN_PATH = (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";

  const handleExit = useCallback(async () => {
    try {
      // prevent browser beforeunload dialog
      ignoreBeforeUnloadRef.current = true;
      // best-effort release/clear server session
      await releaseAssignment().catch(() => {});
      await apiLogout().catch(() => {});
    } finally {
      // clear cached user so next login is clean
      try { localStorage.removeItem("manual_review_current_user"); } catch {}
      // replace to avoid going back to protected page
      window.location.replace(LOGIN_PATH);
    }
  }, [LOGIN_PATH]);

  /* --------------------------------- Rendering -------------------------------- */

  // Index violations by sentence/assertion for inline display (must be before any early return)
  const violationMap = useMemo(() => {
    const out = {};
    for (const v of violations || []) {
      const si = v?.sentence_index;
      const ai = v?.assertion_index;
      if (si == null) continue;
      if (!out[si]) out[si] = {};
      const key = ai == null ? -1 : ai;
      if (!out[si][key]) out[si][key] = [];
      out[si][key].push(v);
    }
    return out;
  }, [violations]);

  const isLoading = statusType === STATUS.LOADING;

  if (isLoading) {
    return (
      <div
        ref={ref}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 px-4"
      >
        <Card className="max-w-md w-full text-center space-y-3 p-8">
          <Section title="Loading abstract…">
            <p className="text-gray-600">{statusMsg || "Please wait while we prepare your review."}</p>
          </Section>
        </Card>
      </div>
    );
  }

  if (!abstract) {
    return (
      <div ref={ref} className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full text-center p-8">
          <Section title="No abstract assigned">
            <p className="text-gray-600 mb-4">
              It looks like you don't have an active assignment. You can reload or return to login.
            </p>
            <div className="flex justify-center gap-3">
              <Button size="sm" onClick={loadAbstract}>
                Retry
              </Button>
              <Button as="a" href="/login" size="sm" variant="outline">
                Go to Login
              </Button>
            </div>
          </Section>
        </Card>
      </div>
    );
  }

  const sentenceResults = Array.isArray(abstract.sentence_results)
    ? abstract.sentence_results
    : [];

  return (
    <div
      ref={ref}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 py-6 px-4 flex flex-col items-center"
    >
      {/* TopBar */}
      <div className="w-full max-w-[1440px] mb-6" data-testid="TopBar">
        <TopBar abstract={abstract} onExit={handleExit} maxWidth="1400px" />
      </div>

        <div className="w-full max-w-[1440px] flex flex-col gap-8">
          {/* Abstract metadata */}
          <Card data-testid="AbstractMetaCard" className="p-0">
            <Section title="Abstract">
              <div className="px-6 pb-6 pt-2">
                <AbstractMetaCard {...abstract} highlight={[]} />
              </div>
            </Section>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-8 items-start">
            {/* Left content: assertions per sentence */}
            <div className="flex flex-col gap-6">
              {Array.isArray(violations) && violations.length > 0 && (
                <Card className="border border-rose-200 bg-rose-50/70">
                  <div className="text-rose-800 font-semibold mb-2">Submission errors</div>
                  <ol className="list-decimal ml-5 space-y-1 text-sm text-rose-800">
                    {Object.entries(violationMap).map(([si, perAss]) => (
                      <li key={si}>
                        <span className="font-semibold">Sentence S{si}</span>
                        <ul className="list-disc ml-4">
                          {Object.entries(perAss).map(([ai, arr]) => (
                            <li key={ai}>
                              {Number(ai) >= 0 ? (
                                <a href={`#sent-${si}-ass-${ai}`} className="underline">
                                  Assertion {Number(ai) + 1}
                                </a>
                              ) : (
                                <span>Add form</span>
                              )}
                              <ul className="ml-4">
                                {(arr || []).map((v, idx) => (
                                  <li key={idx}>
                                    <span className="uppercase text-[10px] tracking-wide mr-2 bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                                      {v.code || "error"}
                                    </span>
                                    {v.message || "Validation error"}
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
              {sentenceResults.length === 0 && (
                <Card className="text-center py-12">
                  <p className="text-gray-500">No sentences available for this abstract.</p>
                </Card>
              )}
              {sentenceResults.map((s, i) => {
                const sentenceIdx = s.sentence_index || i + 1;
                const assertions = Array.isArray(s.assertions) ? s.assertions : [];
                const reviews = reviewStatesMap[sentenceIdx] || [];
                return (
                  <section key={sentenceIdx} className="flex flex-col gap-3 scroll-mt-16">
                    <SentenceHeaderCard index={sentenceIdx} text={s.sentence} />
                    <AssertionsListCard
                      sentenceIdx={sentenceIdx}
                      sentenceText={s.sentence}
                      assertions={assertions}
                      reviews={reviews}
                      violations={violationMap[sentenceIdx]}
                      predicateWhitelist={predicateWhitelist}
                      entityTypeWhitelist={entityTypeWhitelist}
                      onReviewChange={handleReviewStateChange}
                      onDelete={handleDeleteAssertion}
                    />
                    <Card className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-semibold">Add / Suggest New Assertion</div>
                        <Button size="sm" variant="primary" onClick={() => setShowAddFor((m) => ({ ...m, [sentenceIdx]: !m[sentenceIdx] }))}>
                          {showAddFor[sentenceIdx] ? "Hide" : "Add Assertion"}
                        </Button>
                      </div>
                      {showAddFor[sentenceIdx] && (
                        <AddAssertionInline
                          sentence={s.sentence}
                          predicateWhitelist={predicateWhitelist}
                          entityTypeWhitelist={entityTypeWhitelist}
                          onAdd={(ass) => handleAddAssertion(sentenceIdx, ass)}
                        />
                      )}
                    </Card>
                  </section>
                );
              })}
            </div>

            {/* Right: sticky summary panel with its own vertical scroll */}
            <div className="self-start sticky top-8">
              <Card className="w-full max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
                <div className="flex flex-col gap-4">
                  <Section title="Summary">
                    <SummaryPanel
                      sentenceResults={sentenceResults}
                      reviewStatesMap={reviewStatesMap}
                      overview={overview}
                    />
                  </Section>
                  {statusMsg && violations.length === 0 && (
                    <div className="text-sm text-gray-600" aria-live="polite">{statusMsg}</div>
                  )}
                  {/* Inline violations are rendered under each assertion; no global list here */}
          <div className="pt-2">
            <Button className="w-full" onClick={handleSubmit} loading={submitting} aria-label="Submit review">
                      Submit Review
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

      {/* Confirm: submit when not ACCEPT */}
      <ConfirmModal
        role="alertdialog"
        open={confirmSubmitOpen}
        title="Submit review"
        description={`Overall decision is "${overallDecision.toUpperCase()}". Are you sure you want to submit?`}
        confirmText="Submit"
        intent="primary"
        onConfirm={() => {
          setConfirmSubmitOpen(false);
          doSubmit();
        }}
        onCancel={() => setConfirmSubmitOpen(false)}
      />

      {/* Exit is handled solely by TopBar's confirm now */}
    </div>
  );
}

/* ----------------------------- Dev-only propTypes ----------------------------- */

const ReviewPage = memo(forwardRef(ReviewPageImpl));
if (process.env.NODE_ENV !== "production") {
  ReviewPage.propTypes = {};
}

export default ReviewPage;

/* ----------------------------- Inline components ----------------------------- */

function AddAssertionInline({ sentence, onAdd, predicateWhitelist, entityTypeWhitelist }) {
  const [form, setForm] = useState({ subject: "", subject_type: "", predicate: "", object: "", object_type: "", negation: false, comment: "" });

  const errors = useMemo(() => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Subject is required.";
    if (!form.object.trim()) e.object = "Object is required.";
    if (!form.predicate.trim()) e.predicate = "Predicate is required.";
    if (!form.subject_type) e.subject_type = "Subject type is required.";
    if (!form.object_type) e.object_type = "Object type is required.";
    if (form.subject && !isPerfectMatch(sentence, form.subject)) e.subject_match = "Subject must exactly appear in the sentence.";
    if (form.object && !isPerfectMatch(sentence, form.object)) e.object_match = "Object must exactly appear in the sentence.";
    return e;
  }, [form, sentence]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const disableAdd = !isValid;

  return (
    <div className="mt-3 p-3 rounded border border-gray-200 flex flex-col gap-3">
      {/* Row 1: Subject + Subject Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] font-semibold mb-1">Subject</div>
          <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Exact phrase" size="sm" />
          {errors.subject && <div className="text-[11px] text-red-600 mt-1">{errors.subject}</div>}
          {!errors.subject && errors.subject_match && <div className="text-[11px] text-orange-600 mt-1">{errors.subject_match}</div>}
        </div>
        <div>
          <div className="text-[11px] font-semibold mb-1">Subject Type</div>
          <Select
            listbox
            options={[...(entityTypeWhitelist || [])]
              .map((t) => ({ value: t.id ?? t, label: `${t.id ?? t}${t.description ? ` — ${t.description}` : ""}` }))
              .sort((a, b) => String(a.label).localeCompare(String(b.label)))}
            value={form.subject_type}
            onChange={(e) => setForm((f) => ({ ...f, subject_type: e.target.value }))}
            size="sm"
            placeholder="Select type"
            selectedDisplay={form.subject_type}
          />
          {errors.subject_type && <div className="text-[11px] text-red-600 mt-1">{errors.subject_type}</div>}
        </div>
      </div>

      {/* Row 2: Negation + Predicate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] font-semibold mb-1">Negation</div>
          <label className="flex items-center gap-3 select-none cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              aria-label="Toggle negation"
              checked={form.negation}
              onChange={(e) => setForm((f) => ({ ...f, negation: e.target.checked }))}
            />
            <div
              className="relative w-12 h-6 rounded-full bg-gray-200 transition-colors
                         peer-checked:bg-indigo-600
                         after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow after:transition-transform
                         peer-checked:after:translate-x-6"
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {form.negation ? <span className="font-mono">negated</span> : "positive"}
            </span>
          </label>
        </div>
        <div>
          <div className="text-[11px] font-semibold mb-1">Predicate</div>
          <Select
            listbox
            options={[...(predicateWhitelist || [])]
              .map((p) => ({ value: p.id ?? p, label: `${p.id ?? p}${p.description ? ` — ${p.description}` : ""}` }))
              .sort((a, b) => String(a.label).localeCompare(String(b.label)))}
            value={form.predicate}
            onChange={(e) => setForm((f) => ({ ...f, predicate: e.target.value }))}
            size="sm"
            placeholder="Select predicate"
            selectedDisplay={form.predicate}
          />
          {errors.predicate && <div className="text-[11px] text-red-600 mt-1">{errors.predicate}</div>}
        </div>
      </div>

      {/* Row 3: Object + Object Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] font-semibold mb-1">Object</div>
          <Input value={form.object} onChange={(e) => setForm((f) => ({ ...f, object: e.target.value }))} placeholder="Exact phrase" size="sm" />
          {errors.object && <div className="text-[11px] text-red-600 mt-1">{errors.object}</div>}
          {!errors.object && errors.object_match && <div className="text-[11px] text-orange-600 mt-1">{errors.object_match}</div>}
        </div>
        <div>
          <div className="text-[11px] font-semibold mb-1">Object Type</div>
          <Select
            listbox
            options={[...(entityTypeWhitelist || [])]
              .map((t) => ({ value: t.id ?? t, label: `${t.id ?? t}${t.description ? ` — ${t.description}` : ""}` }))
              .sort((a, b) => String(a.label).localeCompare(String(b.label)))}
            value={form.object_type}
            onChange={(e) => setForm((f) => ({ ...f, object_type: e.target.value }))}
            size="sm"
            placeholder="Select type"
            selectedDisplay={form.object_type}
          />
          {errors.object_type && <div className="text-[11px] text-red-600 mt-1">{errors.object_type}</div>}
        </div>
      </div>

      {/* Comment + Submit */}
      <div>
        <div className="text-[11px] font-semibold mb-1">Comment</div>
        <Input value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} placeholder="Optional" size="sm" />
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="primary" disabled={disableAdd} onClick={() => !disableAdd && onAdd?.(form)}>Add Assertion</Button>
      </div>
    </div>
  );
}

function SummaryPanel({ sentenceResults, reviewStatesMap, overview }) {
  const totalAssertions = useMemo(() => sentenceResults.reduce((acc, s) => acc + (s.assertions?.length || 0), 0), [sentenceResults]);
  const totals = useMemo(() => {
    let accept = 0, reject = 0, uncertain = 0, add = 0;
    for (const s of sentenceResults) {
      const idx = s.sentence_index;
      const states = reviewStatesMap[idx] || [];
      states.forEach((r) => {
        if (r.decision === "accept") accept++;
        else if (r.decision === "reject") reject++;
        else if (r.decision === "uncertain") uncertain++;
      });
      add += (s.assertions || []).filter((a) => a && a.is_new).length;
    }
    return { accept, reject, uncertain, add };
  }, [sentenceResults, reviewStatesMap]);

  return (
    <div className="text-sm space-y-3">
      {/* Reviewer order */}
      <div className="flex items-center justify-between">
        <div className="font-medium">Reviewer status</div>
        {overview?.reviewer_order === 2 ? (
          <Badge variant="subtle" color="indigo">Second reviewer</Badge>
        ) : (
          <Badge variant="subtle" color="gray">First reviewer</Badge>
        )}
      </div>

      {/* Peer brief stats when second */}
      {overview?.reviewer_order === 2 && (
        <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
          <div className="text-[12px] text-gray-600 mb-2">Peer ({overview?.peer?.email || "unknown"}) actions</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="subtle" color="primary">Add: {overview?.peer_counts?.add ?? 0}</Badge>
            <Badge variant="subtle" color="success">Accept: {overview?.peer_counts?.accept ?? 0}</Badge>
            <Badge variant="subtle" color="danger">Reject: {overview?.peer_counts?.reject ?? 0}</Badge>
            <Badge variant="subtle" color="warning">Uncertain: {overview?.peer_counts?.uncertain ?? 0}</Badge>
          </div>
        </div>
      )}

      {/* Current session dynamic tally */}
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="text-[12px] text-gray-600 mb-2">Your current tally</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="subtle" color="gray">Total assertions: {totalAssertions}</Badge>
          <Badge variant="subtle" color="primary">Add: {totals.add}</Badge>
          <Badge variant="subtle" color="success">Accept: {totals.accept}</Badge>
          <Badge variant="subtle" color="danger">Reject: {totals.reject}</Badge>
          <Badge variant="subtle" color="warning">Uncertain: {totals.uncertain}</Badge>
        </div>
      </div>

      {/* Per-sentence overview */}
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="text-[12px] text-gray-600 mb-2">Per sentence</div>
        <ol className="space-y-2">
          {sentenceResults.map((s) => {
            const idx = s.sentence_index;
            const has = (s.assertions?.length || 0) > 0;
            const states = reviewStatesMap[idx] || [];
            const counts = states.reduce((acc, r) => {
              acc[r.decision || "uncertain"] = (acc[r.decision || "uncertain"] || 0) + 1;
              return acc;
            }, {});
            counts.add = ((s.assertions || []).filter((a) => a && a.is_new).length) + (counts.add || 0);
            return (
              <li key={idx} className="flex items-center justify-between gap-3 h-8">
                <div className="text-gray-700 whitespace-nowrap pr-2" title={s.sentence}>S{idx}: {has ? "assertions" : "no assertions"}</div>
                {has ? (
                  <div className="flex gap-1 whitespace-nowrap ml-auto">
                    <Badge size="sm" variant="subtle" color="primary" className="px-1.5 py-0.5 text-[10px]">Add{counts.add || 0}</Badge>
                    <Badge size="sm" variant="subtle" color="success" className="px-1.5 py-0.5 text-[10px]">A{counts.accept || 0}</Badge>
                    <Badge size="sm" variant="subtle" color="danger" className="px-1.5 py-0.5 text-[10px]">R{counts.reject || 0}</Badge>
                    <Badge size="sm" variant="subtle" color="warning" className="px-1.5 py-0.5 text-[10px]">U{counts.uncertain || 0}</Badge>
                  </div>
                ) : (
                  <Badge size="sm" variant="subtle" color="gray">Empty</Badge>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="text-gray-500">Review every assertion; submission is enabled only when validation passes.</div>
    </div>
  );
}

/* Pinned sentence header that sticks while its section is in view */
function SentenceHeaderCard({ index, text }) {
  return (
    <div className="sticky top-8 z-30">
      <Card className="p-0">
        <div className="px-4 py-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 rounded-t-xl flex items-center gap-3 shadow-sm">
          <Badge variant="subtle" color="gray">S{index}</Badge>
          <div className="text-[15px] text-gray-900 dark:text-gray-50">{text}</div>
        </div>
      </Card>
    </div>
  );
}

function AssertionsListCard({ sentenceIdx, sentenceText, assertions, reviews, violations, predicateWhitelist, entityTypeWhitelist, onReviewChange, onDelete }) {
  const predSet = useMemo(() => new Set((predicateWhitelist || []).map((p) => String(p?.id ?? p).trim().toUpperCase())), [predicateWhitelist]);
  const typeSet = useMemo(() => new Set((entityTypeWhitelist || []).map((t) => String(t?.id ?? t).trim().toLowerCase())), [entityTypeWhitelist]);

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4">
        {assertions.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No existing assertions.</div>
        ) : (
          assertions.map((a, ai) => {
            const review = reviews[ai] || { decision: "uncertain", comment: "", isModified: false };
            const normPred = String(a.predicate || "").trim().toUpperCase();
            const normSubType = String(a.subject_type || "").trim().toLowerCase();
            const normObjType = String(a.object_type || "").trim().toLowerCase();
            const predicateValid = predSet.size ? predSet.has(normPred) : true;
            const subjectTypeValid = typeSet.size ? typeSet.has(normSubType) : true;
            const objectTypeValid = typeSet.size ? typeSet.has(normObjType) : true;
            const subjectMatch = isPerfectMatch(sentenceText, a.subject, { mode: "contains" });
            const objectMatch = isPerfectMatch(sentenceText, a.object, { mode: "contains" });

            const isNew = !!a.is_new;
            const fieldViolations = (violations && (violations[ai] || violations[-1] || []) ) || [];

            return (
              <div key={ai} id={`sent-${sentenceIdx}-ass-${ai}`} className="p-3 rounded border border-gray-200 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs font-semibold">Subject</div>
                    <div className={clsx("mt-1 px-2 py-1 rounded-full inline-block", subjectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700")}>{a.subject}</div>
                    <div className={clsx("text-[10px] mt-1", subjectTypeValid ? "text-gray-500" : "text-red-600")}>({a.subject_type || "?"})</div>
                    {fieldViolations.filter(v => v.field === "subject").map((v, idx) => (
                      <div key={idx} className="text-[11px] text-red-600 mt-1">{v.message || v.code}</div>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Predicate</div>
                    <div className={clsx("mt-1 px-2 py-1 rounded-full inline-block", predicateValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700")}>{a.negation ? `neg_${a.predicate}` : a.predicate}</div>
                    {!predicateValid && <div className="text-[10px] text-red-600 mt-1">Predicate not whitelisted</div>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Object</div>
                    <div className={clsx("mt-1 px-2 py-1 rounded-full inline-block", objectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700")}>{a.object}</div>
                    <div className={clsx("text-[10px] mt-1", objectTypeValid ? "text-gray-500" : "text-red-600")}>({a.object_type || "?"})</div>
                    {fieldViolations.filter(v => v.field === "object").map((v, idx) => (
                      <div key={idx} className="text-[11px] text-red-600 mt-1">{v.message || v.code}</div>
                    ))}
                  </div>
                </div>

                {isNew ? (
                  <div className="flex items-center justify-between">
                    <Badge variant="subtle" color="primary" size="sm">Added</Badge>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-gray-500">This assertion will be recorded as an add.</div>
                      <Button size="sm" variant="destructive" onClick={() => onDelete?.(sentenceIdx, ai)}>Delete</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <div>
                      <div className="text-[11px] font-semibold mb-1">Decision</div>
                      <Select
                        value={review.decision}
                        onChange={(e) => onReviewChange(sentenceIdx, ai, { decision: e.target.value })}
                        size="sm"
                      >
                        <option value="accept">Accept</option>
                        <option value="reject">Reject</option>
                        <option value="uncertain">Uncertain</option>
                      </Select>
                      {/* Server-returned generic issues for this assertion (e.g., uncertain_reason_required) */}
                      {(() => {
                        const generic = (fieldViolations || []).filter((v) => !v.field || (v.field !== "subject" && v.field !== "object"));
                        if (!generic.length) return null;
                        return (
                          <ul className="mt-1 text-[11px] text-red-600 space-y-1">
                            {generic.map((g, i) => (
                              <li key={i}>{g.message || g.code}</li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-[11px] font-semibold mb-1">Reviewer note</div>
                      <Input
                        placeholder="Optional note"
                        value={review.comment}
                        onChange={(e) => onReviewChange(sentenceIdx, ai, { comment: e.target.value })}
                        size="sm"
                      />
                      {review.decision === "uncertain" && !review.comment?.trim() && (
                        <div className="text-[11px] text-red-600 mt-1">Reason required for 'uncertain'.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
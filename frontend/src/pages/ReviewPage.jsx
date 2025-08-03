import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  memo,
} from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

import { getAssignedAbstract, submitReview } from "../api";
import AbstractMetaCard from "../components/AbstractMetaCard";
import AssertionEditor from "../components/AssertionEditor";
import AssertionSummaryPanel from "../components/AssertionSummaryPanel";
import DecisionBadge from "../components/DecisionBadge";
import TopBar from "../components/TopBar";
import ConfirmModal from "../components/ConfirmModal";
import { deriveOverallDecision } from "../utils";

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
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState(STATUS.LOADING);
  const [submitting, setSubmitting] = useState(false);

  // Confirm modals
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  const isMountedRef = useRef(false);
  const reqIdRef = useRef(0);

  // 是否有未保存修改
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
      // 同时兼容 { abstract: {...} } 和直接扁平 {...}
      const raw = resp?.abstract ?? resp;
      if (!raw) throw new Error("No assigned abstract.");
      const a = { ...raw };


      if (!Array.isArray(a.sentence_results)) a.sentence_results = [];
      a.sentence_results = a.sentence_results.map((s, idx) => ({
        sentence_index: s.sentence_index ?? idx + 1, // 1-based 显示
        sentence: s.sentence ?? "",
        assertions: Array.isArray(s.assertions) ? s.assertions : [],
        ...s,
      }));

      setAbstract(a);

      // 初始化/保留 reviewState —— 统一 decision 字段
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
                decision: "accept",
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
      // 非法/过期会话等，回登录
      if (
        String(message).toLowerCase().includes("unauthorized") ||
        err?.status === 401 ||
        err?.status === 403
      ) {
      }
    }
  }, []);

  // 初次加载
  useEffect(() => {
    isMountedRef.current = true;
    loadAbstract();
    return () => {
      isMountedRef.current = false;
      reqIdRef.current += 1; // 使未完成请求失效
    };
  }, [loadAbstract]);

  // 未保存离开提示
  useEffect(() => {
    const handler = (e) => {
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

  /* ------------------------------- Mutators ------------------------------- */

  const handleAddAssertion = useCallback((sentenceIdx, assertion) => {
    setAbstract((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sentence_results: prev.sentence_results.map((s) =>
          s.sentence_index === sentenceIdx
            ? { ...s, assertions: [...(s.assertions || []), assertion] }
            : s
        ),
      };
    });
    setReviewStatesMap((prev) => {
      const arr = Array.isArray(prev[sentenceIdx]) ? [...prev[sentenceIdx]] : [];
      return {
        ...prev,
        [sentenceIdx]: [
          ...arr,
          {
            decision: "accept",
            comment: assertion.comment || "",
            isModified: true,
          },
        ],
      };
    });
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


  // 新增：收集 is_new 的断言，交由 deriveOverallDecision 参考
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

  /* -------------------------------- Submission -------------------------------- */

  const doSubmit = useCallback(async () => {
    if (!abstract || submitting) return;
    setSubmitting(true);
    setStatusType(STATUS.SUBMITTING);
    setStatusMsg("Submitting review…");

    try {
      const payload = {
        pmid: abstract.pmid,
        sentence_results: abstract.sentence_results,
        overall_decision: overallDecision,
        review_summary: {
          sentence_count: abstract.sentence_count,
          decision: overallDecision,
        },
        review_states: reviewStatesMap,
      };

      await submitReview(payload);
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
      const msg =
        typeof err === "string"
          ? err
          : err?.message || "Failed to submit review. Please retry.";
      setStatusMsg(`❌ ${msg}`);
      setSubmitting(false);
    }
  }, [abstract, overallDecision, reviewStatesMap, submitting, loadAbstract]);

  const handleSubmit = useCallback(() => {
    if (overallDecision !== "accept") {
      setConfirmSubmitOpen(true);
      return;
    }
    doSubmit();
  }, [overallDecision, doSubmit]);

  const handleExit = useCallback(() => {
    if (hasUnsavedChanges && !submitting) {
      setConfirmExitOpen(true);
      return;
    }
  }, [hasUnsavedChanges, submitting]);

  /* --------------------------------- Rendering -------------------------------- */

  const isLoading = statusType === STATUS.LOADING;

  if (isLoading) {
    return (
      <div
        ref={ref}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 px-4"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-2xl font-semibold">Loading abstract…</div>
          <div className="text-gray-600">
            {statusMsg || "Please wait while we prepare your review."}
          </div>
        </div>
      </div>
    );
  }

  if (!abstract) {
    return (
      <div
        ref={ref}
        className="min-h-screen flex items-center justify-center px-4"
      >
        <div className="bg-white shadow rounded-2xl p-8 max-w-lg text-center">
          <div className="text-xl font-bold mb-2">No abstract assigned</div>
          <div className="text-gray-600 mb-4">
            It looks like you don't have an active assignment. You can reload or
            return to login.
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={loadAbstract}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:brightness-105 transition"
            >
              Retry
            </button>
            <button
              className="px-4 py-2 border rounded-md"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sentenceResults = Array.isArray(abstract.sentence_results)
    ? abstract.sentence_results
    : [];

  return (
    <div
      ref={ref}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-6 px-4 flex flex-col items-center"
    >
      {/* TopBar */}
      <div className="w-full max-w-[1100px] mb-6" data-testid="TopBar">
        <TopBar abstract={abstract} onExit={handleExit} />
      </div>

      <div className="w-full max-w-[1100px] flex flex-col gap-8">
        {/* Abstract metadata */}
        <div data-testid="AbstractMetaCard">
          <AbstractMetaCard {...abstract} highlight={[]} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          {/* Left content */}
          <div className="flex flex-col gap-6">
            {sentenceResults.length === 0 && (
              <div className="text-center py-12 text-gray-500 rounded-lg bg-white/60">
                No sentences available for this abstract.
              </div>
            )}
            {sentenceResults.map((s, i) => (
              <AssertionEditor
                key={s.sentence_index ?? i}
                idx={i}
                sentence={s.sentence}
                assertions={s.assertions || []}
                reviewState={reviewStatesMap[s.sentence_index] || []}
                onAddAssertion={handleAddAssertion}
                onModifyAssertion={handleModifyAssertion}
                onDeleteAssertion={handleDeleteAssertion}
                onReviewChange={handleReviewStateChange}
              />
            ))}
          </div>

          {/* Summary panel sticky */}
          <div className="sticky top-32">
            <AssertionSummaryPanel
              sentenceResults={sentenceResults}
              reviewStatesMap={reviewStatesMap}
              overallDecision={overallDecision}
            />
          </div>
        </div>

        {/* Footer / submit */}
        <div className="flex flex-wrap justify-between items-center gap-4 mt-2">
          <div className="text-sm text-gray-600 flex-1" aria-live="polite">
            {statusMsg}
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="hidden md:flex flex-col text-right">
              <div className="text-[10px] text-gray-500">Overall decision</div>
              <DecisionBadge decision={overallDecision} />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              aria-label="Submit review"
              className={clsx(
                "relative flex items-center gap-2 px-7 py-3 rounded-full font-semibold transition shadow-lg",
                submitting
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-teal-400 text-white hover:scale-[1.02]"
              )}
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
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

      {/* Confirm: exit with unsaved changes */}
      <ConfirmModal
        open={confirmExitOpen}
        title="Exit review"
        description="You have unsaved changes. Exit anyway?"
        confirmText="Exit"
        intent="danger"
        onConfirm={() => {
          setConfirmExitOpen(false);
        }}
        onCancel={() => setConfirmExitOpen(false)}
      />
    </div>
  );
}

/* ----------------------------- Dev-only propTypes ----------------------------- */

if (process.env.NODE_ENV !== "production") {
  ReviewPageImpl.propTypes = {};
}

export default memo(forwardRef(ReviewPageImpl));
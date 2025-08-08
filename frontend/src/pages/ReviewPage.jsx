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

import { getAssignedAbstract, submitReview, heartbeat, releaseAssignment } from "../api";
import AbstractMetaCard from "../components/AbstractMetaCard";
import AssertionEditor from "../components/AssertionEditor";
import AssertionSummaryPanel from "../components/AssertionSummaryPanel";
import DecisionBadge from "../components/DecisionBadge";
import TopBar from "../components/TopBar";
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";
import ConfirmModal from "../components/ConfirmModal";
import Button from "../components/ui/Button";
import { deriveOverallDecision } from "../utils";
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
  const [predicateWhitelist, setPredicateWhitelist] = useState(null);
  const [entityTypeWhitelist, setEntityTypeWhitelist] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState(STATUS.LOADING);
  const [submitting, setSubmitting] = useState(false);

  // Confirm modals
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  const isMountedRef = useRef(false);
  const reqIdRef = useRef(0);

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
        // Expect shape: { predicates: string[], entity_types: string[] } or similar
        const preds = Array.isArray(vocab?.predicates) ? vocab.predicates : Array.isArray(vocab) ? vocab : [];
        const types = Array.isArray(vocab?.entity_types) ? vocab.entity_types : [];
        setPredicateWhitelist(preds);
        setEntityTypeWhitelist(types);
      } catch {}
    })();
    // keep lock alive while on page
    const iv = setInterval(() => {
      heartbeat().catch(() => {});
    }, 25000);
    return () => {
      isMountedRef.current = false;
      reqIdRef.current += 1; // 使未完成请求失效
      clearInterval(iv);
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
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-6 px-4 flex flex-col items-center"
    >
      {/* TopBar */}
      <div className="w-full max-w-[1100px] mb-6" data-testid="TopBar">
        <TopBar abstract={abstract} onExit={handleExit} />
      </div>

      <div className="w-full max-w-[1100px] flex flex-col gap-8">
        {/* Abstract metadata */}
        <Card data-testid="AbstractMetaCard" className="p-0">
          <Section title="Abstract">
            <div className="px-6 pb-6 pt-2">
              <AbstractMetaCard {...abstract} highlight={[]} />
            </div>
          </Section>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          {/* Left content */}
          <div className="flex flex-col gap-6">
            {sentenceResults.length === 0 && (
              <Card className="text-center py-12">
                <p className="text-gray-500">No sentences available for this abstract.</p>
              </Card>
            )}
            {sentenceResults.map((s, i) => (
              <AssertionEditor
                key={s.sentence_index ?? i}
                idx={i}
                sentence={s.sentence}
                assertions={s.assertions || []}
                reviewState={reviewStatesMap[s.sentence_index] || []}
                predicateWhitelist={predicateWhitelist}
                entityTypeWhitelist={entityTypeWhitelist}
                onAddAssertion={handleAddAssertion}
                onModifyAssertion={handleModifyAssertion}
                onDeleteAssertion={handleDeleteAssertion}
                onReviewChange={handleReviewStateChange}
              />
            ))}
          </div>

          {/* Summary panel sticky */}
          <div className="sticky top-32">
            <Card>
              <Section title="Summary">
                <AssertionSummaryPanel
                  sentenceResults={sentenceResults}
                  reviewStatesMap={reviewStatesMap}
                  overallDecision={overallDecision}
                />
              </Section>
            </Card>
          </div>
        </div>

        {/* Footer / submit */}
        <Card className="mt-2">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="text-sm text-gray-600 flex-1" aria-live="polite">
              {statusMsg}
            </div>
            <div className="flex gap-4 items-center flex-wrap">
              <div className="hidden md:flex flex-col text-right">
                <div className="text-[10px] text-gray-500">Overall decision</div>
                <DecisionBadge decision={overallDecision} />
              </div>
              <Button onClick={handleSubmit} loading={submitting} aria-label="Submit review">
                Submit Review
              </Button>
            </div>
          </div>
        </Card>
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
        confirmText="Exit and release"
        intent="danger"
        onConfirm={() => {
          setConfirmExitOpen(false);
          // release current assignment explicitly
          releaseAssignment().catch(() => {});
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
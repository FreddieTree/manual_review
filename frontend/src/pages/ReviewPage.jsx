// src/pages/ReviewPage.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  getAssignedAbstract,
  submitReview,
} from "../api";
import AbstractMetaCard from "../components/AbstractMetaCard";
import AssertionEditor from "../components/AssertionEditor";
import AssertionSummaryPanel from "../components/AssertionSummaryPanel";
import PricingDisplay from "../components/PricingDisplay";
import DecisionBadge from "../components/DecisionBadge";
import TopBar from "../components/TopBar";
import { deriveOverallDecision } from "../utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../hooks/useUser";
import clsx from "clsx";

const STATUS = {
  LOADING: "loading",
  ERROR: "error",
  READY: "ready",
  SUBMITTING: "submitting",
};

/**
 * ReviewPage - optimized, Apple-inspired UI/UX.
 */
export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: userLoading, logout: userLogout } = useUser();

  const [abstract, setAbstract] = useState(null);
  const [reviewStatesMap, setReviewStatesMap] = useState({});
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState(STATUS.LOADING);
  const [submitting, setSubmitting] = useState(false);
  const isMountedRef = useRef(false);

  // Track if there is unsaved local modification to warn before unload
  const hasUnsavedChanges = useMemo(() => {
    if (!abstract) return false;
    const allStates = Object.values(reviewStatesMap).flat();
    const modified = allStates.some(s => s.isModified || s.review !== "accept" || (s.comment && s.comment.trim()));
    return modified || (abstract.sentence_results || []).some(s => (s.assertions || []).some(a => a.is_new));
  }, [reviewStatesMap, abstract]);

  // Load or refresh abstract
  const loadAbstract = useCallback(async () => {
    setStatusType(STATUS.LOADING);
    setStatusMsg("Fetching assigned abstract...");
    try {
      const resp = await getAssignedAbstract();
      if (!resp || !resp.abstract) {
        throw new Error("No assigned abstract returned.");
      }
      const a = resp.abstract;

      // Defensive normalization
      if (!Array.isArray(a.sentence_results)) a.sentence_results = [];
      a.sentence_results = a.sentence_results.map((s, idx) => ({
        sentence_index: s.sentence_index ?? idx,
        sentence: s.sentence ?? "",
        assertions: Array.isArray(s.assertions) ? s.assertions : [],
        ...s,
      }));

      setAbstract(a);

      // Initialize review state map (preserve existing if possible)
      setReviewStatesMap(prev => {
        const newMap = {};
        a.sentence_results.forEach((s) => {
          newMap[s.sentence_index] = (s.assertions || []).map((ass, i) => {
            const existing = prev?.[s.sentence_index]?.[i];
            return existing || {
              review: "accept",
              comment: ass.comment || "",
              isModified: false,
            };
          });
        });
        return newMap;
      });

      setStatusType(STATUS.READY);
      setStatusMsg("");
    } catch (err) {
      console.error("loadAbstract error:", err);
      setStatusType(STATUS.ERROR);
      const message =
        typeof err === "string"
          ? err
          : err?.message || "Failed to load abstract.";
      setStatusMsg(message);
      // Redirect on auth loss
      if (
        String(message).toLowerCase().includes("unauthorized") ||
        err?.status === 401 ||
        err?.status === 403
      ) {
        setTimeout(() => navigate("/"), 1000);
      }
    }
  }, [navigate]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    loadAbstract();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadAbstract]);

  // Warn on page unload/navigation if unsaved
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChanges && !submitting) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges, submitting]);

  // Mutators
  const handleAddAssertion = useCallback((sentenceIdx, assertion) => {
    setAbstract(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sentence_results: prev.sentence_results.map(s =>
          s.sentence_index === sentenceIdx
            ? { ...s, assertions: [...(s.assertions || []), assertion] }
            : s
        ),
      };
    });
    setReviewStatesMap(prev => {
      const sentenceStates = prev[sentenceIdx] ? [...prev[sentenceIdx]] : [];
      return {
        ...prev,
        [sentenceIdx]: [
          ...sentenceStates,
          {
            review: "accept",
            comment: assertion.comment || "",
            isModified: true,
          },
        ],
      };
    });
  }, []);

  const handleModifyAssertion = useCallback((sentenceIdx, assertionIdx, updatedAssertion) => {
    setAbstract(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sentence_results: prev.sentence_results.map(s => {
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
    setReviewStatesMap(prev => {
      const sentenceStates = prev[sentenceIdx] ? [...prev[sentenceIdx]] : [];
      const prevState = sentenceStates[assertionIdx] || {
        review: "accept",
        comment: "",
        isModified: false,
      };
      sentenceStates[assertionIdx] = {
        ...prevState,
        review: prevState.review === "accept" ? "modify" : prevState.review,
        isModified: true,
      };
      return { ...prev, [sentenceIdx]: sentenceStates };
    });
  }, []);

  const handleDeleteAssertion = useCallback((sentenceIdx, assertionIdx) => {
    setAbstract(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sentence_results: prev.sentence_results.map(s => {
          if (s.sentence_index !== sentenceIdx) return s;
          const newAssertions = [...(s.assertions || [])];
          newAssertions.splice(assertionIdx, 1);
          return { ...s, assertions: newAssertions };
        }),
      };
    });
    setReviewStatesMap(prev => {
      const sentenceStates = prev[sentenceIdx] ? [...prev[sentenceIdx]] : [];
      sentenceStates.splice(assertionIdx, 1);
      return { ...prev, [sentenceIdx]: sentenceStates };
    });
  }, []);

  const handleReviewStateChange = useCallback((sentenceIdx, assertionIdx, { review, comment }) => {
    setReviewStatesMap(prev => {
      const sentenceStates = prev[sentenceIdx] ? [...prev[sentenceIdx]] : [];
      sentenceStates[assertionIdx] = {
        ...(sentenceStates[assertionIdx] || { review: "accept", comment: "", isModified: false }),
        review,
        comment,
      };
      return { ...prev, [sentenceIdx]: sentenceStates };
    });
  }, []);

  // Decision derivation
  const allAssertionStates = useMemo(() => {
    if (!abstract) return [];
    return Object.values(reviewStatesMap)
      .flat()
      .map(rs => ({ review: rs.review, isModified: rs.isModified }));
  }, [reviewStatesMap, abstract]);

  const overallDecision = useMemo(() => {
    return deriveOverallDecision({
      existingReviews: allAssertionStates,
      addedAssertions: [], // placeholder
    });
  }, [allAssertionStates]);

  // Submission
  const handleSubmit = useCallback(async () => {
    if (!abstract || submitting) return;
    if (overallDecision !== "accept") {
      const proceed = window.confirm(
        `Overall decision is "${overallDecision.toUpperCase()}". Are you sure you want to submit?`
      );
      if (!proceed) return;
    }
    setSubmitting(true);
    setStatusType(STATUS.SUBMITTING);
    setStatusMsg("Submitting review...");

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
      setStatusMsg("✅ Review submitted! Fetching next...");
      // Clear unsaved indicator then reload
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setSubmitting(false);
        loadAbstract();
      }, 800);
    } catch (err) {
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

  const handleExit = useCallback(() => {
    if (hasUnsavedChanges && !submitting) {
      if (!window.confirm("You have unsaved changes. Exit anyway?")) return;
    }
    userLogout().finally(() => navigate("/"));
  }, [hasUnsavedChanges, submitting, userLogout, navigate]);

  // Derived guards
  const isUserUnavailable = userLoading || !user;
  const isLoading = statusType === STATUS.LOADING;
  const isError = statusType === STATUS.ERROR;

  // Render: loading / auth failure / no assignment
  if (isLoading || isUserUnavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-2xl font-semibold">
            {isLoading ? "Loading abstract…" : "Loading user…"}
          </div>
          <div className="text-gray-600">{statusMsg || "Please wait while we prepare your review."}</div>
          {isError && (
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={loadAbstract}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow hover:brightness-105 transition"
              >
                Retry
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-4 py-2 border rounded-md"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!abstract) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white shadow rounded-2xl p-8 max-w-lg text-center">
          <div className="text-xl font-bold mb-2">No abstract assigned</div>
          <div className="text-gray-600 mb-4">
            It looks like you don't have an active assignment. You can reload or logout.
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={loadAbstract}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:brightness-105 transition"
            >
              Retry
            </button>
            <button
              onClick={handleExit}
              className="px-4 py-2 border rounded-md"
            >
              Logout / Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sentenceResults = Array.isArray(abstract.sentence_results) ? abstract.sentence_results : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-6 px-4 flex flex-col items-center">
      {/* Unified TopBar */}
      <div className="w-full max-w-[1100px] mb-6">
        <TopBar
          overallDecision={overallDecision}
          abstract={abstract}
          onExit={handleExit}
        />
      </div>

      <div className="w-full max-w-[1100px] flex flex-col gap-8">
        {/* Abstract metadata */}
        <AbstractMetaCard {...abstract} highlight={[]} />

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
                reviewState={reviewStatesMap[s.sentence_index] || {}}
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
    </div>
  );
}
// src/pages/ReviewPage.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getAssignedAbstract,
  submitReview,
} from "../api";
import AbstractMetaCard from "../components/AbstractMetaCard";
import AssertionEditor from "../components/AssertionEditor";
import AssertionSummaryPanel from "../components/AssertionSummaryPanel";
import PricingDisplay from "../components/PricingDisplay";
import DecisionBadge from "../components/DecisionBadge";
import { deriveOverallDecision } from "../utils";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";

const STATUS_TYPES = {
  LOADING: "loading",
  ERROR: "error",
  READY: "ready",
  EMPTY: "empty",
  SUBMITTING: "submitting",
};

/**
 * ReviewPage
 * Reviewer interface: fetch assigned abstract, allow modifications, submit.
 */
export default function ReviewPage() {
  const [abstract, setAbstract] = useState(null);
  const [reviewStatesMap, setReviewStatesMap] = useState({});
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState(STATUS_TYPES.LOADING);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, loading: userLoading, logout: userLogout } = useUser();

  // Derived busy state
  const isUserUnavailable = userLoading || !user;
  const isAbstractMissing = !abstract;
  const loading = statusType === STATUS_TYPES.LOADING;

  // Load / reload abstract
  const loadAbstract = useCallback(async () => {
    setStatusType(STATUS_TYPES.LOADING);
    setStatusMsg("Fetching assigned abstract...");
    try {
      const resp = await getAssignedAbstract();
      if (!resp || !resp.abstract) {
        throw new Error("No assigned abstract returned.");
      }
      const a = resp.abstract;
      // defensive normalization
      if (!Array.isArray(a.sentence_results)) a.sentence_results = [];
      a.sentence_results = a.sentence_results.map((s, idx) => ({
        sentence_index: s.sentence_index ?? idx,
        sentence: s.sentence ?? "",
        assertions: Array.isArray(s.assertions) ? s.assertions : [],
        ...s,
      }));
      setAbstract(a);

      // initialize review state map if absent
      const initialMap = {};
      a.sentence_results.forEach((s) => {
        initialMap[s.sentence_index] = (s.assertions || []).map((ass) => ({
          review: "accept",
          comment: ass.comment || "",
          isModified: false,
        }));
      });
      setReviewStatesMap(initialMap);
      setStatusType(STATUS_TYPES.READY);
      setStatusMsg("");
    } catch (err) {
      console.error("loadAbstract error:", err);
      setStatusType(STATUS_TYPES.ERROR);
      setStatusMsg(typeof err === "string" ? err : err?.message || "Failed to load abstract.");
      // Auto redirect if auth lost
      if (err?.toString().toLowerCase().includes("unauthorized") || (err?.status === 401 || err?.status === 403)) {
        setTimeout(() => navigate("/"), 1000);
      }
    }
  }, [navigate]);

  useEffect(() => {
    loadAbstract();
  }, [loadAbstract]);

  // Adaptive overflow control (optional UX)
  useEffect(() => {
    const adjustOverflow = () => {
      const shouldScroll = document.body.scrollHeight > window.innerHeight;
      document.documentElement.style.overflow = shouldScroll ? "auto" : "hidden";
      document.body.style.overflow = shouldScroll ? "auto" : "hidden";
    };
    adjustOverflow();
    window.addEventListener("resize", adjustOverflow);
    return () => window.removeEventListener("resize", adjustOverflow);
  }, []);

  // Mutators ---------------------------------------------------------------
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
      const existing = prev[sentenceIdx] || [];
      return {
        ...prev,
        [sentenceIdx]: [
          ...existing,
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
      const sentenceStates = prev[sentenceIdx] ? [...prev[sentenceIdx]] : [];
      const prevState = sentenceStates[assertionIdx] || { review: "accept", comment: "", isModified: false };
      sentenceStates[assertionIdx] = {
        ...prevState,
        review: prevState.review === "accept" ? "modify" : prevState.review,
        isModified: true,
      };
      return { ...prev, [sentenceIdx]: sentenceStates };
    });
  }, []);

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
      const sentenceStates = prev[sentenceIdx] ? [...prev[sentenceIdx]] : [];
      sentenceStates.splice(assertionIdx, 1);
      return { ...prev, [sentenceIdx]: sentenceStates };
    });
  }, []);

  const handleReviewStateChange = useCallback((sentenceIdx, assertionIdx, { review, comment }) => {
    setReviewStatesMap((prev) => {
      const sentenceStates = prev[sentenceIdx] ? [...prev[sentenceIdx]] : [];
      sentenceStates[assertionIdx] = {
        ...(sentenceStates[assertionIdx] || { review: "accept", comment: "", isModified: false }),
        review,
        comment,
      };
      return { ...prev, [sentenceIdx]: sentenceStates };
    });
  }, []);

  // Decision derivation ----------------------------------------------------
  const allAssertionStates = useMemo(() => {
    if (!abstract) return [];
    return Object.values(reviewStatesMap)
      .flat()
      .map((rs) => ({ review: rs.review, isModified: rs.isModified }));
  }, [reviewStatesMap, abstract]);

  const overallDecision = useMemo(() => {
    return deriveOverallDecision({
      existingReviews: allAssertionStates,
      addedAssertions: [], // placeholder for future
    });
  }, [allAssertionStates]);

  // Submission ------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!abstract || submitting) return;

    if (overallDecision !== "accept") {
      const proceed = window.confirm(
        `Overall decision is "${overallDecision.toUpperCase()}". Are you sure you want to submit?`
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    setStatusType(STATUS_TYPES.SUBMITTING);
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
      setStatusType(STATUS_TYPES.READY);
      setStatusMsg("✅ Review submitted! Fetching next...");
      // small delay for UX
      setTimeout(() => {
        setSubmitting(false);
        loadAbstract();
      }, 800);
    } catch (err) {
      console.error("Submit error:", err);
      setStatusType(STATUS_TYPES.ERROR);
      const msg =
        typeof err === "string"
          ? err
          : err?.message || "Failed to submit review. Please retry.";
      setStatusMsg(`❌ ${msg}`);
      setSubmitting(false);
    }
  }, [abstract, overallDecision, reviewStatesMap, submitting, loadAbstract]);

  const handleExit = useCallback(() => {
    if (window.confirm("Exit review? Unsubmitted changes will be lost.")) {
      userLogout().finally(() => {
        navigate("/");
      });
    }
  }, [userLogout, navigate]);

  // Render ---------------------------------------------------------------
  // Busy: user loading / abstract loading
  if (statusType === STATUS_TYPES.LOADING || isUserUnavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-3">
          <div className="text-2xl font-semibold">
            {statusType === STATUS_TYPES.LOADING
              ? "Loading abstract…"
              : isUserUnavailable
                ? "Loading user…"
                : "Preparing…"}
          </div>
          <div className="text-gray-600">{statusMsg || "Please wait."}</div>
          {statusType === STATUS_TYPES.ERROR && (
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={loadAbstract}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700 transition"
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

  // If abstract missing after loading
  if (!abstract) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white shadow rounded-2xl p-8 max-w-lg text-center">
          <div className="text-xl font-bold mb-2">No abstract assigned</div>
          <div className="text-gray-600 mb-4">
            It looks like you don't have an active assignment. You can try reloading or exiting and logging in again.
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={loadAbstract}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
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

  // Safe guard for sentence_results
  const sentenceResults = Array.isArray(abstract.sentence_results)
    ? abstract.sentence_results
    : [];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-10 px-4 flex justify-center"
      aria-label="Review page container"
    >
      <div className="w-full max-w-[85%] flex flex-col gap-8 relative">
        {/* Header bar */}
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-3xl font-extrabold text-gray-900">
              Abstract Review
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {typeof abstract.sentence_count === "number" && (
                <div className="text-sm text-gray-600">
                  {abstract.sentence_count} sentence
                  {abstract.sentence_count !== 1 ? "s" : ""}
                </div>
              )}
              <DecisionBadge decision={overallDecision} />
              {user && (
                <div className="px-3 py-1 bg-white rounded-full shadow flex items-center gap-2 text-sm">
                  <div
                    className="font-medium truncate"
                    style={{ maxWidth: 140 }}
                    title={user.name || user.email}
                  >
                    {user.name || user.email}
                  </div>
                  {user.is_admin && (
                    <div className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      Admin
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-6 flex-wrap items-center">
            <PricingDisplay abstractId={abstract.pmid} />
            <button
              onClick={handleExit}
              aria-label="Exit review"
              className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg flex items-center gap-1 hover:bg-rose-200 transition font-medium"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Meta */}
        <AbstractMetaCard {...abstract} />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          <div className="flex flex-col gap-6">
            {sentenceResults.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No sentences available for this abstract.
              </div>
            )}
            {sentenceResults.map((s, i) => (
              <AssertionEditor
                key={s.sentence_index ?? i}
                idx={i}
                sentence={s.sentence}
                assertions={s.assertions || []}
                onAddAssertion={handleAddAssertion}
                onModifyAssertion={handleModifyAssertion}
                onDeleteAssertion={handleDeleteAssertion}
                onReviewStateChange={handleReviewStateChange}
              />
            ))}
          </div>
          <div className="sticky top-28">
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
          <div className="flex gap-3 items-center">
            <div className="hidden md:flex flex-col text-right">
              <div className="text-[10px] text-gray-500">Overall decision</div>
              <DecisionBadge decision={overallDecision} />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              aria-label="Submit review"
              className={`relative flex items-center gap-2 px-7 py-3 rounded-full font-semibold transition ${submitting
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-teal-400 text-white shadow-lg hover:scale-[1.02]"
                }`}
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
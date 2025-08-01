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
import { deriveOverallDecision } from "../utils";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";

export default function ReviewPage() {
  const [abstract, setAbstract] = useState(null);
  const [status, setStatus] = useState(""); // user-visible status
  const [submitting, setSubmitting] = useState(false);
  const [loadingAbstract, setLoadingAbstract] = useState(true);
  const navigate = useNavigate();
  const { user, loading: userLoading, logout: userLogout } = useUser();

  // Load abstract assignment
  const loadAbstract = useCallback(() => {
    setLoadingAbstract(true);
    getAssignedAbstract()
      .then((a) => {
        setAbstract(a);
        setStatus("");
      })
      .catch((err) => {
        console.error("Failed to load abstract:", err);
        setStatus("Failed to load abstract. Redirecting to login...");
        setTimeout(() => navigate("/"), 1200);
      })
      .finally(() => {
        setLoadingAbstract(false);
      });
  }, [navigate]);

  useEffect(() => {
    loadAbstract();
  }, [loadAbstract]);

  // Assertion manipulation helpers
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
  }, []);

  // Build review states map (placeholder logic; ideally each AssertionEditor would lift its per-assertion review state up)
  const reviewStatesMap = useMemo(() => {
    if (!abstract) return {};
    const map = {};
    abstract.sentence_results.forEach((s) => {
      map[s.sentence_index] = (s.assertions || []).map((a) => ({
        decision: "accept", // default; can be enriched by syncing from AssertionEditor if lifted
        comment: a.comment || "",
      }));
    });
    return map;
  }, [abstract]);

  const allAssertionStates = useMemo(() => {
    if (!abstract) return [];
    return Object.values(reviewStatesMap).flat();
  }, [reviewStatesMap]);

  const overallDecision = useMemo(() => {
    return deriveOverallDecision(allAssertionStates);
  }, [allAssertionStates]);

  const handleSubmit = useCallback(async () => {
    if (!abstract || submitting) return;
    setSubmitting(true);
    setStatus("Submitting review...");
    try {
      const payload = {
        ...abstract,
        overall_decision: overallDecision,
        review_summary: {
          sentence_count: abstract.sentence_count,
          decision: overallDecision,
        },
        // TODO: include per-assertion reviewState details when available
      };
      await submitReview(payload);
      setStatus("✅ Review submitted! Loading next…");
      // short pause to show success
      setTimeout(() => {
        setSubmitting(false);
        loadAbstract();
      }, 1000);
    } catch (e) {
      console.error("Submit error:", e);
      setStatus(`❌ Submit failed: ${typeof e === "string" ? e : e?.message || "Unknown"}`);
      setSubmitting(false);
    }
  }, [abstract, overallDecision, submitting, loadAbstract]);

  const handleExit = useCallback(() => {
    if (window.confirm("Are you sure you want to exit? Unsubmitted progress will be lost.")) {
      userLogout().finally(() => {
        navigate("/");
      });
    }
  }, [userLogout, navigate]);

  const isBusy = loadingAbstract || userLoading;

  if (isBusy || !abstract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-3">
          <div className="text-2xl font-semibold">
            {loadingAbstract ? "Loading abstract…" : userLoading ? "Loading user…" : "Preparing review..."}
          </div>
          <div className="text-gray-500">
            {status ||
              "Please wait while we fetch your assignment and load your session."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-10 px-4 flex justify-center">
      <div className="w-full max-w-[85%] flex flex-col gap-8 relative">
        {/* Top bar: title, counts, user, pricing, exit */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-2xl font-bold text-gray-800">Abstract Review</div>
            <div className="text-sm text-gray-600">
              {abstract.sentence_count
                ? `${abstract.sentence_count} sentence${abstract.sentence_count > 1 ? "s" : ""}`
                : ""}
            </div>
            {user && (
              <div className="px-3 py-1 bg-white rounded-full shadow flex items-center gap-2 text-sm">
                <div className="font-medium truncate">{user.name || user.email}</div>
                {user.is_admin && (
                  <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                    Admin
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-6 items-center flex-wrap">
            <PricingDisplay abstractId={abstract.pmid} />
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg flex items-center gap-1 hover:bg-red-200 transition font-medium"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Abstract metadata */}
        <AbstractMetaCard {...abstract} />

        {/* Main review area */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          <div className="flex flex-col gap-6">
            {abstract.sentence_results.map((s, i) => (
              <AssertionEditor
                key={s.sentence_index}
                idx={i}
                sentence={s.sentence}
                assertions={s.assertions || []}
                onAddAssertion={handleAddAssertion}
                onModifyAssertion={handleModifyAssertion}
                onDeleteAssertion={handleDeleteAssertion}
              />
            ))}
          </div>
          <div className="sticky top-28">
            <AssertionSummaryPanel
              sentenceResults={abstract.sentence_results}
              reviewStatesMap={reviewStatesMap}
              overallDecision={overallDecision}
            />
          </div>
        </div>

        {/* Submit row */}
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600 flex-1">{status}</div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex items-center gap-2 px-7 py-3 rounded-full font-semibold transition ${submitting
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-teal-400 text-white shadow-lg hover:scale-[1.02]"
              }`}
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
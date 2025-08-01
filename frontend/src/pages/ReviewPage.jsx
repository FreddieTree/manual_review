// src/pages/ReviewPage.jsx
import { useEffect, useState, useCallback } from "react";
import {
  getAssignedAbstract,
  submitReview,
  logout as logoutApi,
} from "../api";
import AbstractMetaCard from "../components/AbstractMetaCard";
import AssertionEditor from "../components/AssertionEditor";
import PricingDisplay from "../components/PricingDisplay";
import { useNavigate } from "react-router-dom";

export default function ReviewPage() {
  const [abstract, setAbstract] = useState(null);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    getAssignedAbstract()
      .then((a) => {
        setAbstract(a);
      })
      .catch(() => {
        setStatus("Failed to load abstract. Redirecting to login...");
        setTimeout(() => navigate("/"), 1200);
      });
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddAssertion = (sentenceIdx, assertion) => {
    setAbstract((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        sentence_results: prev.sentence_results.map((s) =>
          s.sentence_index === sentenceIdx
            ? { ...s, assertions: [...(s.assertions || []), assertion] }
            : s
        ),
      };
      return updated;
    });
  };

  const handleModifyAssertion = (sentenceIdx, assertionIdx, updated) => {
    setAbstract((prev) => {
      if (!prev) return prev;
      const updatedSent = prev.sentence_results.map((s) => {
        if (s.sentence_index !== sentenceIdx) return s;
        const newAssertions = [...(s.assertions || [])];
        newAssertions[assertionIdx] = { ...newAssertions[assertionIdx], ...updated };
        return { ...s, assertions: newAssertions };
      });
      return { ...prev, sentence_results: updatedSent };
    });
  };

  const handleSubmit = async () => {
    if (!abstract) return;
    setSubmitting(true);
    setStatus("Submitting review...");
    try {
      await submitReview(abstract);
      setStatus("✅ Review submitted! Loading next...");
      setTimeout(() => {
        setSubmitting(false);
        load();
      }, 1200);
    } catch (e) {
      setStatus(`❌ Submit failed: ${e}`);
      setSubmitting(false);
    }
  };

  const handleExit = () => {
    if (
      window.confirm(
        "Are you sure you want to exit? Your current progress will be lost if not submitted."
      )
    ) {
      logoutApi().finally(() => {
        window.location.href = "/";
      });
    }
  };

  if (!abstract)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-lg w-full text-center">
          <div className="text-xl font-semibold mb-2">Loading abstract…</div>
          <div className="text-gray-500">Please wait, fetching your next assignment.</div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-10 px-4 flex justify-center">
      <div className="w-full max-w-[85%] flex flex-col gap-6 relative">
        {/* Top bar with pricing and exit */}
        <div className="flex justify-between items-start">
          <div className="flex gap-4 flex-wrap items-center">
            <div className="text-xl font-bold text-gray-800">Abstract Review</div>
            <div className="text-sm text-gray-600">
              {abstract.sentence_count
                ? `${abstract.sentence_count} sentences`
                : ""}
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <PricingDisplay abstractId={abstract.pmid} />
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg flex items-center gap-2 hover:bg-red-200 transition"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Meta card */}
        <AbstractMetaCard {...abstract} />

        {/* Sentence blocks */}
        <div className="flex flex-col gap-6">
          {abstract.sentence_results.map((s, i) => (
            <AssertionEditor
              key={s.sentence_index}
              idx={i}
              sentence={s.sentence}
              assertions={s.assertions || []}
              onAddAssertion={handleAddAssertion}
              onModifyAssertion={handleModifyAssertion}
            />
          ))}
        </div>

        {/* Submit area */}
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-600">{status}</div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition ${submitting
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-teal-400 text-white shadow-lg hover:scale-[1.02]"
              }`}
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </div>

        {/* Lock scroll unless overflow due to content */}
        <style>{`
          html, body { overflow: hidden; }
          @media (max-height: 900px) {
            html, body { overflow: auto; }
          }
        `}</style>
      </div>
    </div>
  );
}
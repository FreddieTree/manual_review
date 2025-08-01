// src/components/SentenceBlock.jsx
import { useState, useMemo, useEffect } from "react";
import AssertionForm from "./AssertionForm";
import DecisionBadge from "./DecisionBadge";
import {
  isPerfectMatch,
  PREDICATE_WHITELIST,
  ENTITY_TYPE_WHITELIST,
  deriveOverallDecision,
} from "../utils";

const pillClass = (valid) =>
  valid
    ? "bg-emerald-100 text-emerald-800"
    : "bg-red-100 text-red-600";

export default function SentenceBlock({
  sentenceObj,
  onAddAssertion,
  onModifyAssertion,
  onDeleteAssertion,
  reviewState = {}, // { [assertionIndex]: { decision, comment, isModified } }
  onReviewChange, // (sentenceIndex, assertionIndex, newDecisionObj) => void
}) {
  const { sentence_index: sentenceIndex, sentence, assertions = [] } = sentenceObj;

  // Local sync of review states
  const [localReviews, setLocalReviews] = useState(
    assertions.map((a, i) => reviewState[i] || { decision: "accept", comment: "", isModified: false })
  );

  // sync when assertions length changes
  useEffect(() => {
    setLocalReviews((prev) =>
      assertions.map((_, i) => prev[i] || { decision: "accept", comment: "", isModified: false })
    );
  }, [assertions.length]);

  // Derive overall decision for sentence
  const overall = useMemo(() => {
    return deriveOverallDecision({
      existingReviews: localReviews.map((r) => ({ review: r.decision, isModified: r.isModified })),
      addedAssertions: (assertions || []).filter((a) => a.is_new),
    });
  }, [localReviews, assertions]);

  // Handlers
  const handleDecisionChange = (assertIdx, newDecision) => {
    setLocalReviews((prev) => {
      const next = [...prev];
      next[assertIdx] = { ...next[assertIdx], decision: newDecision };
      onReviewChange?.(sentenceIndex, assertIdx, next[assertIdx]);
      return next;
    });
  };
  const handleCommentChange = (assertIdx, comment) => {
    setLocalReviews((prev) => {
      const next = [...prev];
      next[assertIdx] = { ...next[assertIdx], comment };
      onReviewChange?.(sentenceIndex, assertIdx, next[assertIdx]);
      return next;
    });
  };
  const markModified = (assertIdx) => {
    setLocalReviews((prev) => {
      const next = [...prev];
      next[assertIdx] = { ...next[assertIdx], isModified: true };
      onReviewChange?.(sentenceIndex, assertIdx, next[assertIdx]);
      return next;
    });
  };

  return (
    <div className="relative bg-white rounded-2xl shadow-md border border-gray-200 p-6 flex flex-col gap-5">
      {/* Header: sentence number / text / overall decision */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-3">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex-shrink-0">
            <div className="text-lg font-bold text-indigo-700">S{sentenceIndex}</div>
          </div>
          <p className="flex-1 text-base text-gray-800 leading-relaxed">{sentence}</p>
        </div>
        <div className="flex items-center gap-2">
          <DecisionBadge decision={overall} />
        </div>
      </div>

      {/* Existing assertions list */}
      <div className="grid gap-4">
        {(assertions || []).map((a, i) => {
          const subjectMatch = isPerfectMatch(sentence, a.subject);
          const objectMatch = isPerfectMatch(sentence, a.object);
          const predicateValid = PREDICATE_WHITELIST.includes(a.predicate);
          const subjectTypeValid = ENTITY_TYPE_WHITELIST.includes(a.subject_type);
          const objectTypeValid = ENTITY_TYPE_WHITELIST.includes(a.object_type);
          return (
            <div
              key={i}
              className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-gray-600">Subject</div>
                    <div
                      className={`px-2 py-1 rounded-full text-sm font-medium ${subjectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
                        }`}
                    >
                      {a.subject}
                    </div>
                    <div className="text-[10px] italic text-gray-500">({a.subject_type || "?"})</div>
                  </div>
                  {!subjectTypeValid && (
                    <div className="text-[11px] text-red-600 ml-3">
                      Invalid subject type
                    </div>
                  )}
                  {!subjectMatch && (
                    <div className="text-[11px] text-red-600 ml-3">
                      Subject not found in sentence
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-gray-600">Predicate</div>
                    <div
                      className={`px-2 py-1 rounded-full text-sm font-medium ${predicateValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
                        }`}
                    >
                      {a.negation ? `neg_${a.predicate}` : a.predicate}
                    </div>
                  </div>
                  {!predicateValid && (
                    <div className="text-[11px] text-red-600 ml-3">
                      Predicate not whitelisted
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-gray-600">Object</div>
                    <div
                      className={`px-2 py-1 rounded-full text-sm font-medium ${objectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
                        }`}
                    >
                      {a.object}
                    </div>
                    <div className="text-[10px] italic text-gray-500">({a.object_type || "?"})</div>
                  </div>
                  {!objectTypeValid && (
                    <div className="text-[11px] text-red-600 ml-3">
                      Invalid object type
                    </div>
                  )}
                  {!objectMatch && (
                    <div className="text-[11px] text-red-600 ml-3">
                      Object not found in sentence
                    </div>
                  )}
                </div>
              </div>

              {/* Review controls */}
              <div className="flex-shrink-0 flex flex-col gap-3 w-full sm:w-auto">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-600">
                    Decision
                  </label>
                  <select
                    aria-label={`Review decision for assertion ${i + 1}`}
                    value={localReviews[i]?.decision || "accept"}
                    onChange={(e) => handleDecisionChange(i, e.target.value)}
                    className="w-full px-3 py-2 rounded-md border text-sm"
                  >
                    <option value="accept">Accept</option>
                    <option value="modify">Modify</option>
                    <option value="reject">Reject</option>
                    <option value="uncertain">Uncertain</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-600">
                    Reviewer note
                  </label>
                  <input
                    type="text"
                    aria-label={`Comment for assertion ${i + 1}`}
                    placeholder="Optional note"
                    value={localReviews[i]?.comment || ""}
                    onChange={(e) => handleCommentChange(i, e.target.value)}
                    className="w-full px-3 py-2 rounded-md border text-sm"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      markModified(i);
                      onModifyAssertion?.(sentenceIndex, i, {
                        ...assertions[i],
                        edited_at: new Date().toISOString(),
                      });
                    }}
                    className="text-xs px-3 py-1 bg-blue-50 rounded-md hover:bg-blue-100 transition flex-1"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAssertion?.(sentenceIndex, i)}
                    className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition flex-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new assertion */}
      <div className="pt-2 border-t border-dashed border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Add / Suggest New Assertion</div>
        </div>
        <AssertionForm
          sentence={sentence}
          onAdd={(newAssertion) => {
            newAssertion.is_new = true;
            onAddAssertion?.(sentenceIndex, newAssertion);
          }}
          submitLabel="Add Assertion"
        />
      </div>
    </div>
  );
}
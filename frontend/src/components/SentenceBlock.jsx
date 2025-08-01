// src/components/SentenceBlock.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import AssertionForm from "./AssertionForm";
import DecisionBadge from "./DecisionBadge";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Badge } from "./ui/Badge";
import { isPerfectMatch, PREDICATE_WHITELIST, ENTITY_TYPE_WHITELIST, deriveOverallDecision } from "../utils";
import clsx from "clsx";

/**
 * SentenceBlock
 *
 * Props:
 *  - sentenceObj: { sentence_index, sentence, assertions: [...] }
 *  - onAddAssertion(sentenceIndex, assertion)
 *  - onModifyAssertion(sentenceIndex, assertionIndex, updatedAssertion)
 *  - onDeleteAssertion(sentenceIndex, assertionIndex)
 *  - reviewState: { [assertionIndex]: { decision, comment, isModified } }
 *  - onReviewChange(sentenceIndex, assertionIndex, newReviewState)
 */
export default function SentenceBlock({
  sentenceObj,
  onAddAssertion,
  onModifyAssertion,
  onDeleteAssertion,
  reviewState = {},
  onReviewChange,
}) {
  const {
    sentence_index: sentenceIndex,
    sentence,
    assertions = [],
  } = sentenceObj;

  // Local mirror of review state per assertion, initialize from prop
  const [localReviews, setLocalReviews] = useState(
    assertions.map((_, i) => reviewState[i] || { decision: "accept", comment: "", isModified: false })
  );

  // Sync when number of assertions changes or external reviewState changes
  useEffect(() => {
    setLocalReviews((prev) =>
      assertions.map((_, i) => reviewState[i] || prev[i] || { decision: "accept", comment: "", isModified: false })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assertions.length, JSON.stringify(reviewState)]);

  // Derive overall decision for this sentence (based on per-assertion reviews and added assertions)
  const overallDecision = useMemo(() => {
    const existingReviews = localReviews.map((r) => ({
      review: r.decision,
      isModified: !!r.isModified,
    }));
    const addedAssertions = assertions.filter((a) => a.is_new);
    return deriveOverallDecision({ existingReviews, addedAssertions });
  }, [localReviews, assertions]);

  // Handlers to keep parent updated
  const updateReview = useCallback(
    (assertIdx, patch) => {
      setLocalReviews((prev) => {
        const next = [...prev];
        next[assertIdx] = { ...(next[assertIdx] || { decision: "accept", comment: "", isModified: false }), ...patch };
        onReviewChange?.(sentenceIndex, assertIdx, next[assertIdx]);
        return next;
      });
    },
    [onReviewChange, sentenceIndex]
  );

  const handleDecisionChange = (i, value) => updateReview(i, { decision: value });
  const handleCommentChange = (i, value) => updateReview(i, { comment: value });
  const markModified = (i) => updateReview(i, { isModified: true, decision: "modify" });

  // Accessibility: generate ids
  const getSelectId = (type, i) => `sentence-${sentenceIndex}-assertion-${i}-${type}`;

  return (
    <div className="relative bg-white rounded-3xl shadow-card border border-gray-200 p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
        <div className="flex gap-4 flex-1 flex-wrap">
          <div className="flex-shrink-0">
            <Badge variant="tag" className="text-sm">
              S{sentenceIndex}
            </Badge>
          </div>
          <p className="flex-1 text-base text-gray-800 leading-relaxed break-words">{sentence}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-xs text-gray-500 mr-1">Sentence decision:</div>
          <DecisionBadge decision={overallDecision} />
        </div>
      </div>

      {/* Assertions */}
      <div className="flex flex-col gap-5">
        {assertions.map((a, i) => {
          const subjectMatch = isPerfectMatch(sentence, a.subject);
          const objectMatch = isPerfectMatch(sentence, a.object);
          const predicateValid = PREDICATE_WHITELIST.includes(a.predicate);
          const subjectTypeValid = ENTITY_TYPE_WHITELIST.includes(a.subject_type);
          const objectTypeValid = ENTITY_TYPE_WHITELIST.includes(a.object_type);
          const review = localReviews[i] || { decision: "accept", comment: "", isModified: false };

          return (
            <div
              key={i}
              className="flex flex-col lg:flex-row gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200"
              aria-label={`Assertion ${i + 1}`}
            >
              {/* Left: assertion content */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-4">
                {/* Subject block */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="text-[12px] font-semibold text-gray-700">Subject</div>
                    <div className={clsx("px-2 py-1 rounded-full text-sm font-medium", subjectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600")}>
                      {a.subject}
                    </div>
                    <div className={clsx("text-[10px] italic", subjectTypeValid ? "text-gray-500" : "text-red-600")}>
                      ({a.subject_type || "?"})
                    </div>
                    {a.is_new && (
                      <div className="ml-auto">
                        <Badge variant="primary" className="text-[10px]">New</Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 pl-1">
                    {!subjectMatch && (
                      <div className="text-[11px] text-red-600">Subject not found exactly in sentence</div>
                    )}
                    {!subjectTypeValid && (
                      <div className="text-[11px] text-red-600">Invalid subject type</div>
                    )}
                  </div>
                </div>

                {/* Predicate block */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-[12px] font-semibold text-gray-700">Predicate</div>
                    <div className={clsx("px-2 py-1 rounded-full text-sm font-medium", predicateValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600")}>
                      {a.negation ? `neg_${a.predicate}` : a.predicate}
                    </div>
                  </div>
                  {!predicateValid && (
                    <div className="text-[11px] text-red-600 pl-1">Predicate not whitelisted</div>
                  )}
                </div>

                {/* Object block */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="text-[12px] font-semibold text-gray-700">Object</div>
                    <div className={clsx("px-2 py-1 rounded-full text-sm font-medium", objectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600")}>
                      {a.object}
                    </div>
                    <div className={clsx("text-[10px] italic", objectTypeValid ? "text-gray-500" : "text-red-600")}>
                      ({a.object_type || "?"})
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 pl-1">
                    {!objectMatch && (
                      <div className="text-[11px] text-red-600">Object not found exactly in sentence</div>
                    )}
                    {!objectTypeValid && (
                      <div className="text-[11px] text-red-600">Invalid object type</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: review controls */}
              <div className="flex-shrink-0 flex flex-col gap-3 w-full sm:w-auto min-w-[220px]">
                <div className="flex flex-col">
                  <label htmlFor={getSelectId("decision", i)} className="text-[11px] font-semibold text-gray-600 mb-1">
                    Decision
                  </label>
                  <Select
                    id={getSelectId("decision", i)}
                    aria-label={`Decision for assertion ${i + 1}`}
                    value={review.decision}
                    onChange={(e) => handleDecisionChange(i, e.target.value)}
                    className="w-full"
                    options={[
                      { label: "Accept", value: "accept" },
                      { label: "Modify", value: "modify" },
                      { label: "Reject", value: "reject" },
                      { label: "Uncertain", value: "uncertain" },
                    ]}
                  />
                </div>
                <div className="flex flex-col">
                  <label htmlFor={getSelectId("comment", i)} className="text-[11px] font-semibold text-gray-600 mb-1">
                    Reviewer note
                  </label>
                  <Input
                    id={getSelectId("comment", i)}
                    placeholder="Optional note"
                    value={review.comment}
                    onChange={(e) => handleCommentChange(i, e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      markModified(i);
                      onModifyAssertion?.(sentenceIndex, i, {
                        ...assertions[i],
                        edited_at: new Date().toISOString(),
                      });
                    }}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive-outline"
                    size="sm"
                    onClick={() => onDeleteAssertion?.(sentenceIndex, i)}
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider + add new */}
      <div className="pt-4 border-t border-dashed border-gray-200">
        <div className="flex items-center justify-between mb-3">
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
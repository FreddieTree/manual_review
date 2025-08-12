import React, { useState, useEffect, useMemo, useCallback, forwardRef, memo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

import AssertionForm from "./AssertionForm";
import DecisionBadge from "./DecisionBadge";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Badge from "./ui/Badge";
import Card from "./ui/Card";

import {
  isPerfectMatch,
  PREDICATE_WHITELIST,
  ENTITY_TYPE_WHITELIST,
  deriveOverallDecision,
} from "../utils";

/**
 * SentenceBlock
 */
function SentenceBlockImpl(
  { sentenceObj, onAddAssertion, onModifyAssertion, onDeleteAssertion, reviewState = {}, onReviewChange },
  ref
) {
  const { sentence_index: sentenceIndex, sentence, assertions = [] } = sentenceObj;

  const [localReviews, setLocalReviews] = useState(() =>
    assertions.map((_, i) => reviewState[i] || { decision: "accept", comment: "", isModified: false })
  );

  useEffect(() => {
    setLocalReviews((prev) =>
      assertions.map((_, i) => reviewState[i] || prev[i] || { decision: "accept", comment: "", isModified: false })
    );
  }, [assertions.length, reviewState]);

  const overallDecision = useMemo(() => {
    const existingReviews = localReviews.map((r) => ({
      review: r.decision,
      isModified: !!r.isModified,
    }));
    const addedAssertions = assertions.filter((a) => a.is_new);
    return deriveOverallDecision({ existingReviews, addedAssertions });
  }, [localReviews, assertions]);

  const updateReview = useCallback(
    (assertIdx, patch) => {
      setLocalReviews((prev) => {
        const next = [...prev];
        next[assertIdx] = {
          ...(next[assertIdx] || { decision: "accept", comment: "", isModified: false }),
          ...patch,
        };
        onReviewChange?.(sentenceIndex, assertIdx, next[assertIdx]);
        return next;
      });
    },
    [onReviewChange, sentenceIndex]
  );

  const handleDecisionChange = (i, value) => updateReview(i, { decision: value });
  const handleCommentChange = (i, value) => updateReview(i, { comment: value });
  const markModified = (i) => updateReview(i, { isModified: true, decision: "modify" });

  const getId = (type, i) => `sentence-${sentenceIndex}-assertion-${i}-${type}`;

  return (
    <Card
      ref={ref}
      className="relative bg-white/90 dark:bg-slate-900/70 backdrop-glass rounded-3xl ring-1 ring-black/5 dark:ring-white/5 flex flex-col gap-6"
    >
      {/* Accent bar */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl bg-gradient-to-b from-indigo-400/70 to-blue-500/70" />
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
        {/* Bubble container */}
        <div className="flex-1">
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white/90 dark:bg-slate-900/70 shadow-sm px-4 py-3 flex items-start gap-3">
            {/* Circular S index */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center font-semibold select-none">
              S{sentenceIndex}
            </div>
            {/* Sentence text */}
            <p className="flex-1 text-[15px] sm:text-base text-gray-800 dark:text-gray-100 leading-relaxed break-words">
              {sentence}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 mr-1">Sentence decision:</div>
          <DecisionBadge decision={overallDecision} />
        </div>
      </div>

      {/* Assertions list */}
      <div className="flex flex-col gap-5">
        {assertions.length === 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-300 italic px-4 py-3 bg-gray-50/80 dark:bg-slate-800/70 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
            No existing assertions. You can add one below.
          </div>
        )}
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
              className="flex flex-col lg:flex-row gap-6 p-4 bg-gradient-to-b from-gray-50 to-white dark:from-slate-800 dark:to-slate-900/60 rounded-2xl border border-gray-200/70 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-shadow"
              aria-label={`Assertion ${i + 1}`}
            >
              {/* Left: assertion content */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-4">
                {/* Subject */}
                <div className="flex flex-col rounded-xl overflow-hidden">
                  <div className="flex items-start gap-2 mb-1 flex-wrap">
                    <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Subject</div>
                     <div
                       className={clsx(
                         "px-2 py-1 rounded-full text-sm font-medium truncate shadow-sm",
                         subjectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
                       )}
                     >
                      {a.subject || "—"}
                    </div>
                    <div
                      className={clsx(
                        "text-[10px] italic",
                        subjectTypeValid ? "text-gray-500 dark:text-gray-400" : "text-red-600"
                      )}
                    >
                      ({a.subject_type || "?"})
                    </div>
                    {a.is_new && (
                      <div className="ml-auto">
                        <Badge variant="solid" color="primary" className="text-[10px]">
                          New
                        </Badge>
                      </div>
                    )}
                    {review.isModified && (
                      <div>
                        <Badge variant="subtle" color="warning" className="text-[10px]">
                          Edited
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 pl-1">
                    {!subjectMatch && (
                      <div className="text-[11px] text-red-600">Subject not found exactly in sentence</div>
                    )}
                    {!subjectTypeValid && <div className="text-[11px] text-red-600">Invalid subject type</div>}
                  </div>
                </div>

                {/* Predicate */}
                <div className="flex flex-col rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Predicate</div>
                     <div
                       className={clsx(
                         "px-2 py-1 rounded-full text-sm font-medium truncate shadow-sm",
                         predicateValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
                       )}
                     >
                      {a.negation ? `neg_${a.predicate}` : a.predicate || "—"}
                    </div>
                  </div>
                  {!predicateValid && (
                    <div className="text-[11px] text-red-600 pl-1">Predicate not whitelisted</div>
                  )}
                </div>

                {/* Object */}
                <div className="flex flex-col rounded-xl overflow-hidden">
                  <div className="flex items-start gap-2 mb-1 flex-wrap">
                    <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Object</div>
                     <div
                       className={clsx(
                         "px-2 py-1 rounded-full text-sm font-medium truncate shadow-sm",
                         objectMatch ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
                       )}
                     >
                      {a.object || "—"}
                    </div>
                    <div
                      className={clsx(
                        "text-[10px] italic",
                        objectTypeValid ? "text-gray-500 dark:text-gray-400" : "text-red-600"
                      )}
                    >
                      ({a.object_type || "?"})
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 pl-1">
                    {!objectMatch && (
                      <div className="text-[11px] text-red-600">Object not found exactly in sentence</div>
                    )}
                    {!objectTypeValid && <div className="text-[11px] text-red-600">Invalid object type</div>}
                  </div>
                </div>
              </div>

              {/* Right: review controls */}
              <div className="flex-shrink-0 flex flex-col gap-3 w-full sm:w-auto min-w-[220px]">
                <div className="flex flex-col">
                  <label
                    htmlFor={getId("decision", i)}
                    className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1"
                  >
                    Decision
                  </label>
                  <Select
                    id={getId("decision", i)}
                    aria-label={`Decision for assertion ${i + 1}`}
                    value={review.decision}
                    onChange={(e) => handleDecisionChange(i, e.target.value)}
                    className="w-full"
                  >
                    <option value="accept">Accept</option>
                    <option value="modify">Modify</option>
                    <option value="reject">Reject</option>
                    <option value="uncertain">Uncertain</option>
                  </Select>
                </div>
                <div className="flex flex-col">
                  <label
                    htmlFor={getId("comment", i)}
                    className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1"
                  >
                    Reviewer note
                  </label>
                  <Input
                    id={getId("comment", i)}
                    placeholder="Optional note"
                    value={review.comment}
                    onChange={(e) => handleCommentChange(i, e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant="secondary"
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
                    variant="destructive"
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

      {/* Add new assertion */}
      <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-100">Add / Suggest New Assertion</div>
        </div>
        <AssertionForm
          sentence={sentence}
          onAdd={(newAssertion) => {
            newAssertion.is_new = true;
            onAddAssertion?.(sentenceIndex, newAssertion);
          }}
          submitLabel="Add Assertion"
          className="bg-white/90 dark:bg-slate-900/70 rounded-2xl backdrop-glass"
        />
      </div>
    </Card>
  );
}

const SentenceBlock = memo(forwardRef(SentenceBlockImpl));

if (process.env.NODE_ENV !== "production") {
  SentenceBlock.propTypes = {
    sentenceObj: PropTypes.shape({
      sentence_index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      sentence: PropTypes.string.isRequired,
      assertions: PropTypes.arrayOf(PropTypes.object),
    }).isRequired,
    onAddAssertion: PropTypes.func,
    onModifyAssertion: PropTypes.func,
    onDeleteAssertion: PropTypes.func,
    reviewState: PropTypes.object,
    onReviewChange: PropTypes.func,
  };
}

export default SentenceBlock;
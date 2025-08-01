// src/components/AssertionEditor.jsx
import { useState, useMemo, useEffect, useCallback } from "react";
import AssertionForm from "./AssertionForm";
import {
    isPerfectMatch,
    PREDICATE_WHITELIST,
    ENTITY_TYPE_WHITELIST,
    deriveOverallDecision,
} from "../utils";

/** Decision badge component */
const DecisionBadge = ({ decision }) => {
    const mapping = {
        accept: { bg: "bg-emerald-100", text: "text-emerald-800", label: "ACCEPT" },
        modify: { bg: "bg-yellow-100", text: "text-yellow-800", label: "MODIFY" },
        reject: { bg: "bg-red-100", text: "text-red-800", label: "REJECT" },
        uncertain: { bg: "bg-gray-100", text: "text-gray-700", label: "UNCERTAIN" },
    };
    const info = mapping[decision] || mapping.uncertain;
    return (
        <div
            aria-label={`Overall decision: ${info.label}`}
            className={`${info.bg} ${info.text} px-3 py-1 rounded-full text-xs font-bold inline-flex items-center whitespace-nowrap`}
        >
            {info.label}
        </div>
    );
};

/** pill style for component parts */
const Pill = ({ children, valid }) => (
    <div
        className={`inline-block px-2 py-1 rounded-full text-xs font-medium mr-2 ${valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
            }`}
    >
        {children}
    </div>
);

/**
 * Props:
 *  - idx: sentence zero-based index
 *  - sentence: string
 *  - assertions: array of assertion objects
 *  - reviewState: optional external review state map: { [assertionIndex]: { decision, comment, isModified } }
 *  - onAddAssertion(sentenceIndex, assertion)
 *  - onModifyAssertion(sentenceIndex, assertionIndex, updatedAssertion)
 *  - onDeleteAssertion(sentenceIndex, assertionIndex)
 *  - onReviewChange(sentenceIndex, assertionIndex, newReviewState)
 */
export default function AssertionEditor({
    idx,
    sentence,
    assertions = [],
    reviewState = {},
    onAddAssertion,
    onModifyAssertion,
    onDeleteAssertion,
    onReviewChange,
}) {
    const sentenceIndex = idx + 1; // human display

    // local review states mirror external if provided
    const [localReviews, setLocalReviews] = useState(
        assertions.map((_, i) => reviewState[i] || { decision: "accept", comment: "", isModified: false })
    );

    // sync when assertions length changes or external reviewState updates
    useEffect(() => {
        setLocalReviews(
            assertions.map((_, i) => reviewState[i] || localReviews[i] || { decision: "accept", comment: "", isModified: false })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assertions.length, JSON.stringify(reviewState)]);

    // Build structured input for deriveOverallDecision
    const overallDecision = useMemo(() => {
        const existingReviews = localReviews.map((r) => ({
            review: r.decision,
            isModified: !!r.isModified,
        }));
        const addedAssertions = (assertions || []).filter((a) => a.is_new);
        return deriveOverallDecision({ existingReviews, addedAssertions });
    }, [localReviews, assertions]);

    // Handlers
    const updateReviewState = useCallback(
        (assertionIdx, patch) => {
            setLocalReviews((prev) => {
                const next = [...prev];
                next[assertionIdx] = { ...next[assertionIdx], ...patch };
                onReviewChange?.(sentenceIndex, assertionIdx, next[assertionIdx]);
                return next;
            });
        },
        [onReviewChange, sentenceIndex]
    );

    const handleDecisionChange = (i, decision) => {
        updateReviewState(i, { decision });
    };

    const handleCommentChange = (i, comment) => {
        updateReviewState(i, { comment });
    };

    const markModified = (i) => {
        updateReviewState(i, { isModified: true });
    };

    // Render
    return (
        <div className="relative bg-white rounded-3xl shadow-xl border border-gray-200 p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start gap-3">
                <div className="flex gap-4 flex-1 flex-wrap">
                    <div className="flex-shrink-0">
                        <div className="text-lg font-semibold text-indigo-700">S{sentenceIndex}</div>
                    </div>
                    <p className="flex-1 text-base text-gray-800 leading-relaxed break-words">{sentence}</p>
                </div>
                <div className="flex-shrink-0">
                    <DecisionBadge decision={overallDecision} />
                </div>
            </div>

            {/* Existing assertions */}
            <div className="flex flex-col gap-5">
                {(assertions || []).map((a, i) => {
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
                            {/* Assertion content */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="text-xs font-medium uppercase tracking-wide text-gray-600">
                                            Assertion #{i + 1}
                                        </div>
                                        {a.is_new && (
                                            <div className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                New
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-6 mt-1">
                                        <div className="flex items-start gap-2">
                                            <div className="text-[12px] font-semibold text-gray-700">Subject:</div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Pill valid={subjectMatch}>{a.subject}</Pill>
                                                    <div className={`text-[10px] italic ${subjectTypeValid ? "text-gray-500" : "text-red-600"}`}>
                                                        ({a.subject_type || "?"})
                                                    </div>
                                                </div>
                                                {!subjectMatch && (
                                                    <div className="text-[11px] text-red-600">
                                                        Not found exactly in sentence
                                                    </div>
                                                )}
                                                {!subjectTypeValid && (
                                                    <div className="text-[11px] text-red-600">
                                                        Invalid subject type
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="text-[12px] font-semibold text-gray-700">Predicate:</div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Pill valid={predicateValid}>
                                                        {a.negation ? `neg_${a.predicate}` : a.predicate}
                                                    </Pill>
                                                </div>
                                                {!predicateValid && (
                                                    <div className="text-[11px] text-red-600">
                                                        Predicate not whitelisted
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="text-[12px] font-semibold text-gray-700">Object:</div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Pill valid={objectMatch}>{a.object}</Pill>
                                                    <div className={`text-[10px] italic ${objectTypeValid ? "text-gray-500" : "text-red-600"}`}>
                                                        ({a.object_type || "?"})
                                                    </div>
                                                </div>
                                                {!objectMatch && (
                                                    <div className="text-[11px] text-red-600">
                                                        Not found exactly in sentence
                                                    </div>
                                                )}
                                                {!objectTypeValid && (
                                                    <div className="text-[11px] text-red-600">
                                                        Invalid object type
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {a.comment && (
                                        <div className="text-xs text-gray-600 mt-1">Original comment: {a.comment}</div>
                                    )}
                                </div>

                                {/* Review controls */}
                                <div className="flex flex-col gap-4 min-w-[220px]">
                                    <div className="flex flex-col">
                                        <label className="text-[11px] font-semibold text-gray-600 mb-1">
                                            Decision
                                        </label>
                                        <select
                                            aria-label={`Decision for assertion ${i + 1}`}
                                            value={review.decision}
                                            onChange={(e) => handleDecisionChange(i, e.target.value)}
                                            className="w-full px-3 py-2 rounded-md border text-sm"
                                        >
                                            <option value="accept">Accept</option>
                                            <option value="modify">Modify</option>
                                            <option value="reject">Reject</option>
                                            <option value="uncertain">Uncertain</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[11px] font-semibold text-gray-600 mb-1">
                                            Reviewer note
                                        </label>
                                        <input
                                            type="text"
                                            aria-label={`Comment for assertion ${i + 1}`}
                                            placeholder="Optional note"
                                            value={review.comment}
                                            onChange={(e) => handleCommentChange(i, e.target.value)}
                                            className="w-full px-3 py-2 rounded-md border text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                markModified(i);
                                                onModifyAssertion?.(sentenceIndex, i, {
                                                    ...assertions[i],
                                                    edited_at: new Date().toISOString(),
                                                });
                                            }}
                                            className="flex-1 text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteAssertion?.(sentenceIndex, i)}
                                            className="flex-1 text-xs px-3 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add new assertion section */}
            <div className="pt-3 border-t border-dashed border-gray-200">
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
// src/components/AssertionEditor.jsx
import { useState, useMemo, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import AssertionForm from "./AssertionForm";
import { useTheme } from "../hooks/useTheme";
import Button from "./ui/Button";
import Select from "./ui/Select";
import Badge from "./ui/Badge";
import Input from "./ui/Input";
import Loader from "./ui/Loader";
import ConfirmModal from "./ConfirmModal";
import {
    isPerfectMatch,
    PREDICATE_WHITELIST,
    ENTITY_TYPE_WHITELIST,
    deriveOverallDecision,
} from "../utils";

/** Compact decision badge */
const DecisionBadge = ({ decision }) => {
    const mapping = {
        accept: { label: "ACCEPT", tone: "success" },
        modify: { label: "MODIFY", tone: "warning" },
        reject: { label: "REJECT", tone: "danger" },
        uncertain: { label: "UNCERTAIN", tone: "muted" },
    };
    const info = mapping[decision] || mapping.uncertain;
    return (
        <Badge variant={info.tone} className="uppercase tracking-wider px-3">
            {info.label}
        </Badge>
    );
};

DecisionBadge.propTypes = {
    decision: PropTypes.string.isRequired,
};

/** Pill for subject/predicate/object with validity coloring */
const Pill = ({ children, valid }) => (
    <div
        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium mr-2 ${valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
            }`}
    >
        {children}
    </div>
);

Pill.propTypes = {
    children: PropTypes.node,
    valid: PropTypes.bool,
};

/**
 * Props:
 *  - idx: zero-based sentence index
 *  - sentence: the sentence string
 *  - assertions: array of assertion objects
 *  - reviewState: external review state map per assertion index
 *  - onAddAssertion(sentenceIdx, assertion)
 *  - onModifyAssertion(sentenceIdx, assertionIdx, updatedAssertion)
 *  - onDeleteAssertion(sentenceIdx, assertionIdx)
 *  - onReviewChange(sentenceIdx, assertionIdx, newReviewState)
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
    const { resolvedTheme } = useTheme();
    const sentenceIndex = idx + 1; // human display
    const [localReviews, setLocalReviews] = useState(
        assertions.map((_, i) => reviewState[i] || { decision: "accept", comment: "", isModified: false })
    );
    const [showAddForm, setShowAddForm] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState({ open: false, assertionIdx: null });

    // sync external reviewState / assertions length
    useEffect(() => {
        setLocalReviews(
            assertions.map((_, i) => reviewState[i] || localReviews[i] || { decision: "accept", comment: "", isModified: false })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assertions.length, JSON.stringify(reviewState)]);

    // derive overall decision for this sentence block
    const overallDecision = useMemo(() => {
        const existingReviews = localReviews.map((r) => ({
            review: r.decision,
            isModified: !!r.isModified,
        }));
        const addedAssertions = (assertions || []).filter((a) => a.is_new);
        return deriveOverallDecision({ existingReviews, addedAssertions });
    }, [localReviews, assertions]);

    // propagate upward when a review changes
    const updateReviewState = useCallback(
        (assertionIdx, patch) => {
            setLocalReviews((prev) => {
                const next = [...prev];
                next[assertionIdx] = { ...next[assertionIdx], ...patch };
                onReviewChange?.(idx + 1, assertionIdx, next[assertionIdx]);
                return next;
            });
        },
        [onReviewChange, idx]
    );

    const handleDecisionChange = (i, decision) => {
        updateReviewState(i, { decision });
    };

    const handleCommentChange = (i, comment) => {
        updateReviewState(i, { comment });
    };

    const markModified = (i) => {
        updateReviewState(i, { isModified: true, decision: "modify" });
    };

    const handleDeleteClick = (i) => {
        setConfirmDelete({ open: true, assertionIdx: i });
    };

    const confirmDeleteAssertion = () => {
        const i = confirmDelete.assertionIdx;
        setConfirmDelete({ open: false, assertionIdx: null });
        onDeleteAssertion?.(sentenceIndex, i);
        setLocalReviews((prev) => {
            const next = [...prev];
            next.splice(i, 1);
            return next;
        });
    };

    const hasAssertions = (assertions || []).length > 0;

    return (
        <div className="relative bg-white rounded-3xl shadow-card border border-gray-200 p-6 flex flex-col gap-6">
            {/* Header: Sentence + overall decision */}
            <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                <div className="flex gap-4 flex-1 flex-wrap">
                    <div className="flex-shrink-0">
                        <div className="text-lg font-semibold text-indigo-700">S{sentenceIndex}</div>
                    </div>
                    <p className="flex-1 text-base text-gray-800 leading-relaxed break-words">{sentence}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-xs text-gray-500 mr-1">Sentence decision:</div>
                    <DecisionBadge decision={overallDecision} />
                </div>
            </div>

            {/* Existing Assertions */}
            <div className="flex flex-col gap-5">
                {hasAssertions ? (
                    assertions.map((a, i) => {
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
                                {/* Content summary */}
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                Assertion #{i + 1}
                                            </div>
                                            {a.is_new && (
                                                <Badge variant="accent" className="text-[10px]">
                                                    New
                                                </Badge>
                                            )}
                                            {review.isModified && (
                                                <Badge variant="warning" className="text-[10px]">
                                                    Edited
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
                                            {/* Subject */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[12px] font-semibold text-gray-700">Subject:</div>
                                                    <Pill valid={subjectMatch}>{a.subject}</Pill>
                                                    <div
                                                        className={`text-[10px] italic ${subjectTypeValid ? "text-gray-500" : "text-red-600"
                                                            }`}
                                                    >
                                                        ({a.subject_type || "?"})
                                                    </div>
                                                </div>
                                                <div className="mt-1 flex flex-col gap-1">
                                                    {!subjectMatch && (
                                                        <div className="text-[11px] text-red-600">
                                                            Exact match missing in sentence
                                                        </div>
                                                    )}
                                                    {!subjectTypeValid && (
                                                        <div className="text-[11px] text-red-600">
                                                            Unsupported subject type
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Predicate */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[12px] font-semibold text-gray-700">Predicate:</div>
                                                    <Pill valid={predicateValid}>
                                                        {a.negation ? `neg_${a.predicate}` : a.predicate}
                                                    </Pill>
                                                </div>
                                                <div className="mt-1">
                                                    {!predicateValid && (
                                                        <div className="text-[11px] text-red-600">Predicate not whitelisted</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Object */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[12px] font-semibold text-gray-700">Object:</div>
                                                    <Pill valid={objectMatch}>{a.object}</Pill>
                                                    <div
                                                        className={`text-[10px] italic ${objectTypeValid ? "text-gray-500" : "text-red-600"
                                                            }`}
                                                    >
                                                        ({a.object_type || "?"})
                                                    </div>
                                                </div>
                                                <div className="mt-1 flex flex-col gap-1">
                                                    {!objectMatch && (
                                                        <div className="text-[11px] text-red-600">
                                                            Exact match missing in sentence
                                                        </div>
                                                    )}
                                                    {!objectTypeValid && (
                                                        <div className="text-[11px] text-red-600">
                                                            Unsupported object type
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {a.comment && (
                                            <div className="text-xs text-gray-600 mt-2">
                                                Original comment: {a.comment}
                                            </div>
                                        )}
                                    </div>

                                    {/* Review controls (right side in wide) */}
                                    <div className="flex flex-col gap-4 min-w-[220px]">
                                        <div className="flex flex-col">
                                            <label className="text-[11px] font-semibold text-gray-600 mb-1">
                                                Decision
                                            </label>
                                            <Select
                                                aria-label={`Decision for assertion ${i + 1}`}
                                                value={review.decision}
                                                onChange={(e) => handleDecisionChange(i, e.target.value)}
                                                options={[
                                                    { label: "Accept", value: "accept" },
                                                    { label: "Modify", value: "modify" },
                                                    { label: "Reject", value: "reject" },
                                                    { label: "Uncertain", value: "uncertain" },
                                                ]}
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[11px] font-semibold text-gray-600 mb-1">
                                                Reviewer note
                                            </label>
                                            <Input
                                                aria-label={`Comment for assertion ${i + 1}`}
                                                placeholder="Optional note"
                                                value={review.comment}
                                                onChange={(e) => handleCommentChange(i, e.target.value)}
                                            />
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    markModified(i);
                                                    onModifyAssertion?.(sentenceIndex, i, {
                                                        ...assertions[i],
                                                        edited_at: new Date().toISOString(),
                                                    });
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="dangerOutline"
                                                onClick={() => handleDeleteClick(i)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-sm text-gray-600 italic">No existing assertions.</div>
                )}
            </div>

            {/* Divider + new assertion */}
            <div className="pt-4 border-t border-dashed border-gray-200">
                <div className="flex justify-between items-center mb-3">
                    <div className="text-sm font-semibold text-gray-700">Add / Suggest New Assertion</div>
                    <div>
                        <Button size="sm" onClick={() => setShowAddForm((s) => !s)} variant="secondary">
                            {showAddForm ? "Hide" : "Add Assertion"}
                        </Button>
                    </div>
                </div>
                {showAddForm ? (
                    <AssertionForm
                        sentence={sentence}
                        onAdd={(newAssertion) => {
                            newAssertion.is_new = true;
                            onAddAssertion?.(sentenceIndex, newAssertion);
                            setShowAddForm(false);
                            // flag new assertion in review state
                            updateReviewState((assertions || []).length, {
                                decision: "accept",
                                comment: newAssertion.comment || "",
                                isModified: true,
                            });
                        }}
                        submitLabel="Add Assertion"
                    />
                ) : (
                    <div className="text-xs text-gray-500">You can propose a new assertion based on the sentence above.</div>
                )}
            </div>

            {/* Delete confirmation */}
            <ConfirmModal
                open={confirmDelete.open}
                title="Delete Assertion"
                description="Are you sure you want to delete this assertion? This action cannot be undone."
                confirmText="Delete"
                intent="danger"
                onConfirm={confirmDeleteAssertion}
                onCancel={() => setConfirmDelete({ open: false, assertionIdx: null })}
            />
        </div>
    );
}

AssertionEditor.propTypes = {
    idx: PropTypes.number.isRequired,
    sentence: PropTypes.string.isRequired,
    assertions: PropTypes.arrayOf(PropTypes.object),
    reviewState: PropTypes.object,
    onAddAssertion: PropTypes.func,
    onModifyAssertion: PropTypes.func,
    onDeleteAssertion: PropTypes.func,
    onReviewChange: PropTypes.func,
};

AssertionEditor.defaultProps = {
    assertions: [],
    reviewState: {},
    onAddAssertion: null,
    onModifyAssertion: null,
    onDeleteAssertion: null,
    onReviewChange: null,
};
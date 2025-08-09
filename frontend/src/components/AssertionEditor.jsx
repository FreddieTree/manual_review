import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef, memo } from "react";
import clsx from "clsx";
import PropTypes from "prop-types";
import AssertionForm from "./AssertionForm";
import Button from "./ui/Button";
import Select from "./ui/Select";
import Badge from "./ui/Badge";
import Input from "./ui/Input";
import ConfirmModal from "./ConfirmModal";
import { isPerfectMatch, deriveOverallDecision } from "../utils";

/** DecisionBadge now maps to semantic badge props */
const DecisionBadge = memo(function DecisionBadge({ decision }) {
    const mapping = {
        accept: { label: "Accept", color: "success", variant: "solid" },
        modify: { label: "Modify", color: "warning", variant: "subtle" },
        reject: { label: "Reject", color: "danger", variant: "solid" },
        uncertain: { label: "Uncertain", color: "warning", variant: "outline" },
    };
    const info = mapping[decision] || mapping.uncertain;
    return (
        <Badge
            variant={info.variant}
            color={info.color}
            size="sm"
            className="uppercase tracking-wider"
            aria-label={`Decision: ${info.label}`}
        >
            {info.label}
        </Badge>
    );
});

function Pill({ children, valid }) {
    return (
        <div
            className={clsx(
                "inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium mr-2",
                valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600"
            )}
        >
            {children}
        </div>
    );
}

function shallowReviewStateEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (
            a[i]?.decision !== b[i]?.decision ||
            a[i]?.comment !== b[i]?.comment ||
            !!a[i]?.isModified !== !!b[i]?.isModified
        ) {
            return false;
        }
    }
    return true;
}

function AssertionEditorImpl(
    {
        idx,
        sentence,
        assertions = [],
        reviewState = {},
        onAddAssertion,
        onModifyAssertion,
        onDeleteAssertion,
        onReviewChange,
        predicateWhitelist,
        entityTypeWhitelist,
    },
    ref
) {
    const sentenceIndex = idx + 1; // display 1-based
    const [localReviews, setLocalReviews] = useState(() =>
        assertions.map((_, i) => reviewState[i] || { decision: "accept", comment: "", isModified: false })
    );
    const [showAddForm, setShowAddForm] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState({ open: false, assertionIdx: null });

    // Sync external reviewState when it changes (shallow compare)
    useEffect(() => {
        const externalArr = assertions.map(
            (_, i) => reviewState[i] || { decision: "accept", comment: "", isModified: false }
        );
        if (!shallowReviewStateEqual(localReviews, externalArr)) {
            setLocalReviews(externalArr);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assertions.length, reviewState]);

    // Derive per-sentence overall decision
    const overallDecision = useMemo(() => {
        const existingReviews = localReviews.map((r) => ({
            review: r.decision,
            isModified: !!r.isModified,
        }));
        const addedAssertions = (assertions || []).filter((a) => a.is_new);
        return deriveOverallDecision({ existingReviews, addedAssertions });
    }, [localReviews, assertions]);

    // Helper to update review internally and bubble up
    const updateReviewState = useCallback(
        (assertionIdx, patch) => {
            setLocalReviews((prev) => {
                const next = [...prev];
                const existing = next[assertionIdx] || { decision: "accept", comment: "", isModified: false };
                const updated = { ...existing, ...patch };
                next[assertionIdx] = updated;
                onReviewChange?.(sentenceIndex, assertionIdx, updated);
                return next;
            });
        },
        [onReviewChange, sentenceIndex]
    );

    const handleDecisionChange = (i, value) => updateReviewState(i, { decision: value });
    const handleCommentChange = (i, value) => updateReviewState(i, { comment: value });
    const markModified = (i) => updateReviewState(i, { isModified: true, decision: "modify" });

    const requestDelete = (i) => setConfirmDelete({ open: true, assertionIdx: i });
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

    const hasAssertions = Array.isArray(assertions) && assertions.length > 0;

    return (
        <div
            ref={ref}
            className="relative bg-white dark:bg-[#1f2937] rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-6 transition-all"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                <div className="flex gap-4 flex-1 flex-wrap">
                    <div className="flex-shrink-0">
                        <div className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">S{sentenceIndex}</div>
                    </div>
                    <p className="flex-1 text-base text-gray-800 dark:text-gray-100 leading-relaxed break-words">{sentence}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mr-1">Sentence decision:</div>
                    <DecisionBadge decision={overallDecision} />
                </div>
            </div>

            {/* Existing assertions */}
            <div className="flex flex-col gap-5">
                {hasAssertions ? (
                    assertions.map((a, i) => {
                        const canEdit = !!a.is_new; // Only allow edit/delete for own new (unsubmitted) assertions
                        const subjectMatch = isPerfectMatch(sentence, a.subject);
                        const objectMatch = isPerfectMatch(sentence, a.object);
                        const predicateValid = Array.isArray(predicateWhitelist) ? predicateWhitelist.includes(a.predicate) : true;
                        const subjectTypeValid = Array.isArray(entityTypeWhitelist) ? entityTypeWhitelist.includes(a.subject_type) : true;
                        const objectTypeValid = Array.isArray(entityTypeWhitelist) ? entityTypeWhitelist.includes(a.object_type) : true;
                        const review = localReviews[i] || { decision: "accept", comment: "", isModified: false };

                        return (
                            <div
                                key={i}
                                className="flex flex-col lg:flex-row gap-6 p-4 bg-gray-50 dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-600"
                                aria-label={`Assertion ${i + 1}`}
                            >
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
                                    {/* Left block: assertion content */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                                Assertion #{i + 1}
                                            </div>
                                            {a.is_new && (
                                                <Badge variant="solid" color="primary" size="sm">
                                                    New
                                                </Badge>
                                            )}
                                            {review.isModified && (
                                                <Badge variant="subtle" color="warning" size="sm">
                                                    Edited
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
                                            {/* Subject */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Subject:</div>
                                                    <Pill valid={subjectMatch}>{a.subject}</Pill>
                                                    <div
                                                        className={clsx(
                                                            "text-[10px] italic",
                                                            subjectTypeValid ? "text-gray-500 dark:text-gray-400" : "text-red-500"
                                                        )}
                                                    >
                                                        ({a.subject_type || "?"})
                                                    </div>
                                                </div>
                                                <div className="mt-1 flex flex-col gap-1">
                                                    {!subjectMatch && (
                                                        <div className="text-[11px] text-red-600">Exact match missing in sentence</div>
                                                    )}
                                                    {!subjectTypeValid && (
                                                        <div className="text-[11px] text-red-600">Unsupported subject type</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Predicate */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Predicate:</div>
                                                    <Pill valid={predicateValid}>{a.negation ? `neg_${a.predicate}` : a.predicate}</Pill>
                                                </div>
                                                <div className="mt-1">
                                                    {!predicateValid && (
                                                        <div className="text-[11px] text-red-600">Predicate not whitelisted</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Object */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Object:</div>
                                                    <Pill valid={objectMatch}>{a.object}</Pill>
                                                    <div
                                                        className={clsx(
                                                            "text-[10px] italic",
                                                            objectTypeValid ? "text-gray-500 dark:text-gray-400" : "text-red-500"
                                                        )}
                                                    >
                                                        ({a.object_type || "?"})
                                                    </div>
                                                </div>
                                                <div className="mt-1 flex flex-col gap-1">
                                                    {!objectMatch && (
                                                        <div className="text-[11px] text-red-600">Exact match missing in sentence</div>
                                                    )}
                                                    {!objectTypeValid && (
                                                        <div className="text-[11px] text-red-600">Unsupported object type</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {a.comment && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                Original comment: {a.comment}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right block: review controls */}
                                    <div className="flex flex-col gap-4 min-w-[240px]">
                                        <div className="flex flex-col">
                                            <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                                Decision
                                            </label>
                                            <Select
                                                aria-label={`Decision for assertion ${i + 1}`}
                                                value={review.decision}
                                                onChange={(e) => handleDecisionChange(i, e.target.value)}
                                                variant={review.decision === "reject" ? "error" : "default"}
                                                size="sm"
                                            >
                                                <option value="accept">Accept</option>
                                                {canEdit && <option value="modify">Modify</option>}
                                                <option value="reject">Reject</option>
                                                <option value="uncertain">Uncertain</option>
                                            </Select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                                Reviewer note
                                            </label>
                                            <Input
                                                aria-label={`Comment for assertion ${i + 1}`}
                                                placeholder="Optional note"
                                                value={review.comment}
                                                onChange={(e) => handleCommentChange(i, e.target.value)}
                                                size="sm"
                                            />
                                            {review.decision === "uncertain" && !review.comment?.trim() && (
                                                <div className="text-[11px] text-red-600 mt-1">Reason required for 'uncertain'.</div>
                                            )}
                                        </div>
                                        {canEdit && (
                                            <div className="flex gap-2 mt-1 flex-wrap">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
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
                                                <Button size="sm" variant="destructive" onClick={() => requestDelete(i)}>
                                                    Delete
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-sm text-gray-500 italic">No existing assertions.</div>
                )}
            </div>

            {/* New assertion area */}
            <div className="pt-4 border-t border-dashed border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Add / Suggest New Assertion
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => setShowAddForm((s) => !s)}>
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
                            updateReviewState(assertions.length, {
                                decision: "accept",
                                comment: newAssertion.comment || "",
                                isModified: true,
                            });
                        }}
                        submitLabel="Add Assertion"
                        predicateWhitelist={predicateWhitelist}
                        entityTypeWhitelist={entityTypeWhitelist}
                    />
                ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        You can propose a new assertion based on the sentence above.
                    </div>
                )}
            </div>

            {/* Delete confirmation modal */}
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

if (process.env.NODE_ENV !== "production") {
    AssertionEditorImpl.propTypes = {
        idx: PropTypes.number.isRequired,
        sentence: PropTypes.string.isRequired,
        assertions: PropTypes.arrayOf(PropTypes.object),
        reviewState: PropTypes.object,
        onAddAssertion: PropTypes.func,
        onModifyAssertion: PropTypes.func,
        onDeleteAssertion: PropTypes.func,
        onReviewChange: PropTypes.func,
    };
}

const AssertionEditor = memo(forwardRef(AssertionEditorImpl));
export default AssertionEditor;
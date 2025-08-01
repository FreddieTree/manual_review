// src/components/AssertionEditor.jsx
import { useState, useMemo } from "react";
import AssertionForm from "./AssertionForm";
import {
    PREDICATE_WHITELIST,
    ENTITY_TYPE_WHITELIST,
    containsIgnoreCase,
} from "../utils";

function Badge({ children, valid }) {
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium mr-1 ${valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                }`}
        >
            {children}
        </span>
    );
}

export default function AssertionEditor({
    idx,
    sentence,
    assertions = [],
    onAddAssertion,
    onModifyAssertion, // (sentenceIdx, assertionIdx, updated)
}) {
    const [showNew, setShowNew] = useState(false);
    // local review decisions for existing assertions
    const [localEdits, setLocalEdits] = useState(
        assertions.map((a) => ({ ...a, review: "accept", comment: "" }))
    );

    // sync if parent updates
    useMemo(() => {
        setLocalEdits(assertions.map((a) => ({ ...a, review: "accept", comment: "" })));
    }, [assertions]);

    const handleChangeExisting = (i, field, value) => {
        setLocalEdits((prev) => {
            const copy = [...prev];
            copy[i] = { ...copy[i], [field]: value };
            return copy;
        });
        if (onModifyAssertion) {
            onModifyAssertion(idx, i, { ...localEdits[i], [field]: value });
        }
    };

    return (
        <div className="relative bg-white border border-gray-200 rounded-2xl shadow-md p-5 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="text-xl font-semibold text-blue-900 mr-2">S{idx + 1}</div>
                    <div className="text-base text-gray-800 flex-1">{sentence}</div>
                </div>
            </div>

            {/* Existing assertions with editable review fields */}
            {assertions.map((a, i) => {
                const subjectMatch = containsIgnoreCase(sentence, a.subject);
                const objectMatch = containsIgnoreCase(sentence, a.object);
                const predicateValid = PREDICATE_WHITELIST.includes(a.predicate);
                const subjectTypeValid = ENTITY_TYPE_WHITELIST.includes(a.subject_type);
                const objectTypeValid = ENTITY_TYPE_WHITELIST.includes(a.object_type);
                return (
                    <div
                        key={i}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-2">
                                <Badge valid={subjectMatch}>
                                    {a.subject} {a.subject_type && `(${a.subject_type})`}
                                </Badge>
                                <Badge valid={predicateValid}>
                                    {a.negation ? `neg_${a.predicate}` : a.predicate}
                                </Badge>
                                <Badge valid={objectMatch}>
                                    {a.object} {a.object_type && `(${a.object_type})`}
                                </Badge>
                            </div>
                            <div className="flex gap-2 flex-wrap mt-1">
                                {!subjectTypeValid && (
                                    <div className="text-xs text-red-600">Subject type invalid</div>
                                )}
                                {!objectTypeValid && (
                                    <div className="text-xs text-red-600">Object type invalid</div>
                                )}
                                {!predicateValid && (
                                    <div className="text-xs text-red-600">Predicate not whitelisted</div>
                                )}
                                {!subjectMatch && (
                                    <div className="text-xs text-red-600">
                                        Subject not found in sentence
                                    </div>
                                )}
                                {!objectMatch && (
                                    <div className="text-xs text-red-600">
                                        Object not found in sentence
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Review controls */}
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex-1 min-w-[160px]">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Review Decision
                                    </label>
                                    <select
                                        className="w-full border rounded px-3 py-2 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        value={localEdits[i]?.review || ""}
                                        onChange={(e) =>
                                            handleChangeExisting(i, "review", e.target.value)
                                        }
                                    >
                                        <option value="accept">Accept</option>
                                        <option value="modify">Modify</option>
                                        <option value="uncertain">Uncertain</option>
                                        <option value="reject">Reject</option>
                                    </select>
                                </div>
                                <div className="flex-1 min-w-[220px]">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Comment (optional)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Reviewer note"
                                        value={localEdits[i]?.comment || ""}
                                        onChange={(e) =>
                                            handleChangeExisting(i, "comment", e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Add new assertion toggle */}
            <div className="mt-2">
                {showNew ? (
                    <div className="pt-2 border-t">
                        <AssertionForm
                            sentence={sentence}
                            onAdd={(newAssertion) => {
                                onAddAssertion(idx, newAssertion);
                                setShowNew(false);
                            }}
                            onCancel={() => setShowNew(false)}
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => setShowNew(true)}
                        className="inline-flex items-center gap-2 text-sm font-medium bg-blue-50 hover:bg-blue-100 transition px-4 py-2 rounded-full border border-blue-200"
                    >
                        + Add Assertion
                    </button>
                )}
            </div>
        </div>
    );
}
// src/components/AssertionForm.jsx
import React, { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { isPerfectMatch } from "../utils";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Badge from "./ui/Badge";
import { useDebouncedValue } from "../hooks/useDebounce";

/**
 * AssertionForm — refined, accessible form for proposing/editing assertions.
 */
export default function AssertionForm({
  sentence,
  onAdd,
  loading = false,
  initial = null,
  submitLabel = "Add Assertion",
  className = "",
  predicateWhitelist = [],
  entityTypeWhitelist = [],
}) {
  const PREDICATES = useMemo(() => (predicateWhitelist.length ? predicateWhitelist : []), [predicateWhitelist]);
  const ENTITY_TYPES = useMemo(() => (entityTypeWhitelist.length ? entityTypeWhitelist : []), [entityTypeWhitelist]);

  const [form, setForm] = useState({
    subject: "",
    subject_type: "",
    predicate: "",
    object: "",
    object_type: "",
    negation: false,
    comment: "",
    ...initial,
  });
  const [touched, setTouched] = useState({});

  const debouncedForm = useDebouncedValue(form, 120);

  // validation computed
  const errors = useMemo(() => {
    const e = {};

    if (!debouncedForm.subject.trim()) e.subject = "Subject is required.";
    if (!debouncedForm.object.trim()) e.object = "Object is required.";
    if (!debouncedForm.predicate.trim()) e.predicate = "Predicate is required.";
    if (!debouncedForm.subject_type) e.subject_type = "Subject type is required.";
    if (!debouncedForm.object_type) e.object_type = "Object type is required.";

    if (
      debouncedForm.subject &&
      !isPerfectMatch(sentence, debouncedForm.subject)
    )
      e.subject_match = "Subject must exactly appear in the sentence.";
    if (
      debouncedForm.object &&
      !isPerfectMatch(sentence, debouncedForm.object)
    )
      e.object_match = "Object must exactly appear in the sentence.";

    if (
      debouncedForm.predicate &&
      PREDICATES.length &&
      !PREDICATES.includes(debouncedForm.predicate)
    )
      e.predicate_whitelist = "Predicate not in approved list.";

    if (
      debouncedForm.subject_type &&
      ENTITY_TYPES.length &&
      !ENTITY_TYPES.includes(debouncedForm.subject_type)
    )
      e.subject_type_whitelist = "Invalid subject type.";

    if (
      debouncedForm.object_type &&
      ENTITY_TYPES.length &&
      !ENTITY_TYPES.includes(debouncedForm.object_type)
    )
      e.object_type_whitelist = "Invalid object type.";

    return e;
  }, [debouncedForm, sentence, PREDICATES, ENTITY_TYPES]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const predicateDisplay = useMemo(
    () => `${form.negation ? "neg_" : ""}${form.predicate || "—"}`,
    [form.negation, form.predicate]
  );
  const summaryPreview = useMemo(
    () => `${predicateDisplay} (${form.subject || "…"} → ${form.object || "…"})`,
    [predicateDisplay, form.subject, form.object]
  );

  const showFieldError = useCallback((key) => touched[key] && errors[key], [touched, errors]);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!isValid || loading) return;
      onAdd?.(form);
    },
    [isValid, loading, onAdd, form]
  );

  const orderedErrorMessages = useMemo(() => {
    const order = [
      "subject",
      "subject_match",
      "subject_type",
      "subject_type_whitelist",
      "predicate",
      "predicate_whitelist",
      "object",
      "object_match",
      "object_type",
      "object_type_whitelist",
    ];
    return order.filter((k) => errors[k]).map((k) => errors[k]);
  }, [errors]);

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Assertion creation form"
      className={clsx(
        "relative grid gap-6 grid-cols-1 lg:grid-cols-[repeat(3,1fr)_auto] bg-white dark:bg-[#1f2937] rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-md",
        className
      )}
      noValidate
    >
      {/* Header */}
      <div className="col-span-full flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none">
            New Assertion
          </h2>
          {loading && (
            <Badge variant="subtle" size="sm" color="gray">
              Loading...
            </Badge>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Required: subject, predicate, object, and their types. Optional comment.
        </div>
      </div>

      {/* Subject */}
      <div className="flex flex-col">
        <label htmlFor="subject" className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
          Subject
        </label>
        <div className="relative">
          <Input
            id="subject"
            aria-label="Subject"
            placeholder="Exact phrase in sentence"
            value={form.subject}
            onChange={(e) => handleChange("subject", e.target.value)}
            variant={
              showFieldError("subject")
                ? "error"
                : form.subject
                  ? isPerfectMatch(sentence, form.subject)
                    ? "success"
                    : "default"
                  : "default"
            }
            size="sm"
            clearable
            onClear={() => handleChange("subject", "")}
            disabled={loading}
          />
          {form.subject && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isPerfectMatch(sentence, form.subject) ? (
                <span className="text-emerald-600 text-xs" aria-label="Exact match">
                  ✓
                </span>
              ) : (
                <span className="text-orange-500 text-xs" aria-label="No exact match">
                  ⚠
                </span>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 min-h-[1rem]">
          {showFieldError("subject") && <div className="text-xs text-red-600">{errors.subject}</div>}
          {!errors.subject && errors.subject_match && (
            <div className="text-xs text-orange-600">{errors.subject_match}</div>
          )}
        </div>
      </div>

      {/* Subject Type */}
      <div className="flex flex-col">
        <label htmlFor="subject_type" className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
          Subject Type
        </label>
        <Select
          id="subject_type"
          aria-label="Subject type"
          value={form.subject_type}
          onChange={(e) => handleChange("subject_type", e.target.value)}
          size="sm"
          variant={errors.subject_type || errors.subject_type_whitelist ? "error" : "default"}
          disabled={loading}
        >
          <option value="">Select type</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <div className="mt-1 min-h-[1rem]">
          {showFieldError("subject_type") && (
            <div className="text-xs text-red-600">{errors.subject_type}</div>
          )}
          {!errors.subject_type && errors.subject_type_whitelist && (
            <div className="text-xs text-red-600">{errors.subject_type_whitelist}</div>
          )}
        </div>
      </div>

      {/* Predicate */}
      <div className="flex flex-col">
        <label htmlFor="predicate" className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
          Predicate
        </label>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Select
              id="predicate"
              aria-label="Predicate"
              value={form.predicate}
              onChange={(e) => handleChange("predicate", e.target.value)}
              size="sm"
              variant={errors.predicate || errors.predicate_whitelist ? "error" : "default"}
              disabled={loading}
            >
              <option value="">Select predicate</option>
              {PREDICATES.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-shrink-0">
            <div
              aria-label="Negated predicate preview"
              className="text-[11px] px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 font-mono"
            >
              {predicateDisplay}
            </div>
          </div>
        </div>
        <div className="mt-1 min-h-[1rem]">
          {showFieldError("predicate") && (
            <div className="text-xs text-red-600">{errors.predicate}</div>
          )}
          {!errors.predicate && errors.predicate_whitelist && (
            <div className="text-xs text-red-600">{errors.predicate_whitelist}</div>
          )}
        </div>
      </div>

      {/* Object */}
      <div className="flex flex-col">
        <label htmlFor="object" className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
          Object
        </label>
        <div className="relative">
          <Input
            id="object"
            aria-label="Object"
            placeholder="Exact phrase in sentence"
            value={form.object}
            onChange={(e) => handleChange("object", e.target.value)}
            variant={
              showFieldError("object")
                ? "error"
                : form.object
                  ? isPerfectMatch(sentence, form.object)
                    ? "success"
                    : "default"
                  : "default"
            }
            size="sm"
            clearable
            onClear={() => handleChange("object", "")}
            disabled={loading}
          />
          {form.object && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isPerfectMatch(sentence, form.object) ? (
                <span className="text-emerald-600 text-xs" aria-label="Exact match">
                  ✓
                </span>
              ) : (
                <span className="text-orange-500 text-xs" aria-label="No exact match">
                  ⚠
                </span>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 min-h-[1rem]">
          {showFieldError("object") && <div className="text-xs text-red-600">{errors.object}</div>}
          {!errors.object && errors.object_match && (
            <div className="text-xs text-orange-600">{errors.object_match}</div>
          )}
        </div>
      </div>

      {/* Object Type */}
      <div className="flex flex-col">
        <label htmlFor="object_type" className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
          Object Type
        </label>
        <Select
          id="object_type"
          aria-label="Object type"
          value={form.object_type}
          onChange={(e) => handleChange("object_type", e.target.value)}
          size="sm"
          variant={errors.object_type || errors.object_type_whitelist ? "error" : "default"}
          disabled={loading}
        >
          <option value="">Select type</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <div className="mt-1 min-h-[1rem]">
          {showFieldError("object_type") && (
            <div className="text-xs text-red-600">{errors.object_type}</div>
          )}
          {!errors.object_type && errors.object_type_whitelist && (
            <div className="text-xs text-red-600">{errors.object_type_whitelist}</div>
          )}
        </div>
      </div>

      {/* Negation */}
      <div className="flex flex-col">
        <label htmlFor="negation" className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
          Negation
        </label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              aria-label="Negation toggle"
              checked={form.negation}
              onChange={(e) => handleChange("negation", e.target.checked)}
              className="sr-only peer"
              disabled={loading}
            />
            <div className="relative">
              <div className="w-12 h-6 bg-gray-200 rounded-full peer-checked:bg-indigo-600 transition" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-6 transition" />
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-200">
              {form.negation ? <span className="font-mono">negated</span> : "positive"}
            </div>
          </label>
        </div>
      </div>

      {/* Comment */}
      <div className="col-span-full flex flex-col">
        <label htmlFor="comment" className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
          Comment <span className="text-xs text-gray-400">(optional)</span>
        </label>
        <Input
          id="comment"
          aria-label="Reviewer note"
          placeholder="Add context or rationale"
          value={form.comment}
          onChange={(e) => handleChange("comment", e.target.value)}
          size="sm"
          disabled={loading}
        />
      </div>

      {/* Action / summary */}
      <div className="col-span-full flex flex-wrap justify-between items-center gap-3">
        <div aria-live="polite" className="flex-1 min-w-[180px] space-y-1 text-xs">
          {orderedErrorMessages.length > 0 ? (
            <div className="flex flex-col gap-1 text-red-600">
              {orderedErrorMessages.map((msg, i) => (
                <div key={i}>• {msg}</div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <div className="font-medium">Preview:</div>
              <div className="font-mono truncate">{summaryPreview}</div>
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center flex-shrink-0">
          <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {isValid ? (
              <span className="flex items-center gap-1">
                <span className="hidden sm:inline">Ready:</span>{" "}
                <span className="font-mono truncate">{summaryPreview}</span>
              </span>
            ) : (
              <span className="text-xs italic">Fix required fields</span>
            )}
          </div>
          <Button
            type="submit"
            size="md"
            variant="primary"
            loading={loading}
            disabled={!isValid || loading}
            aria-label={submitLabel}
          >
            {loading ? "Adding…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

AssertionForm.propTypes = {
  sentence: PropTypes.string.isRequired,
  onAdd: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  initial: PropTypes.object,
  submitLabel: PropTypes.string,
  className: PropTypes.string,
  predicateWhitelist: PropTypes.arrayOf(PropTypes.string),
  entityTypeWhitelist: PropTypes.arrayOf(PropTypes.string),
};

AssertionForm.defaultProps = {
  loading: false,
  initial: null,
  submitLabel: "Add Assertion",
  className: "",
  predicateWhitelist: [],
  entityTypeWhitelist: [],
};
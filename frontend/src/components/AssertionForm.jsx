// src/components/AssertionForm.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { isPerfectMatch } from "../utils";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Badge from "./ui/Badge";
import { useDebouncedValue } from "../hooks/useDebounce";

/**
 * AssertionForm
 * Enhanced assertion creation / suggestion form.
 * - Live validation with debounce to avoid jitter
 * - Clear error summary
 * - Inline match indicators
 * - Negation toggle with prefix preview
 * - Accepts override whitelists (for future dynamic backend sync)
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
  // default fallback if not provided
  const PREDICATES = predicateWhitelist.length ? predicateWhitelist : [];
  const ENTITY_TYPES = entityTypeWhitelist.length ? entityTypeWhitelist : [];

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
  const [errors, setErrors] = useState({});
  const debouncedForm = useDebouncedValue(form, 120); // small delay before validating

  // validation rules centralized
  const validate = useCallback(
    (f) => {
      const newErr = {};

      if (!f.subject.trim()) newErr.subject = "Subject is required.";
      if (!f.object.trim()) newErr.object = "Object is required.";
      if (!f.predicate.trim()) newErr.predicate = "Predicate is required.";
      if (!f.subject_type) newErr.subject_type = "Subject type is required.";
      if (!f.object_type) newErr.object_type = "Object type is required.";

      if (f.subject && !isPerfectMatch(sentence, f.subject))
        newErr.subject_match = "Subject must exactly appear in sentence.";
      if (f.object && !isPerfectMatch(sentence, f.object))
        newErr.object_match = "Object must exactly appear in sentence.";

      if (f.predicate && PREDICATES.length && !PREDICATES.includes(f.predicate))
        newErr.predicate_whitelist = "Predicate not in approved list.";
      if (f.subject_type && ENTITY_TYPES.length && !ENTITY_TYPES.includes(f.subject_type))
        newErr.subject_type_whitelist = "Invalid subject type.";
      if (f.object_type && ENTITY_TYPES.length && !ENTITY_TYPES.includes(f.object_type))
        newErr.object_type_whitelist = "Invalid object type.";

      return newErr;
    },
    [sentence, PREDICATES, ENTITY_TYPES]
  );

  // run validation on debounced form
  useEffect(() => {
    const newErrors = validate(debouncedForm);
    setErrors(newErrors);
  }, [debouncedForm, validate]);

  const canSubmit = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
  };

  // Derived display
  const predicateDisplay = useMemo(
    () => `${form.negation ? "neg_" : ""}${form.predicate || ""}`,
    [form.negation, form.predicate]
  );

  // Helper for showing inline validation state
  const showError = (key) => touched[key] && errors[key];

  const handleSubmit = () => {
    if (!canSubmit || loading) return;
    onAdd?.(form);
  };

  return (
    <div
      className={`relative grid gap-5 grid-cols-1 lg:grid-cols-[repeat(3,1fr)_auto] bg-white rounded-2xl p-6 border shadow-md ${className}`}
      aria-label="Assertion creation form"
    >
      {/* Header */}
      <div className="col-span-full flex flex-wrap justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-gray-800">New Assertion</div>
          {loading && <Badge variant="muted" className="text-xs">Loading...</Badge>}
        </div>
        <div className="text-xs text-gray-500">All fields required except comment.</div>
      </div>

      {/* Subject */}
      <div className="flex flex-col">
        <label htmlFor="subject" className="text-[11px] font-semibold text-gray-600 mb-1">
          Subject
        </label>
        <div className="relative">
          <Input
            id="subject"
            aria-label="Subject"
            placeholder="Subject (exact phrase)"
            value={form.subject}
            onChange={(e) => handleChange("subject", e.target.value)}
            status={
              errors.subject
                ? "error"
                : form.subject
                  ? isPerfectMatch(sentence, form.subject)
                    ? "success"
                    : "warning"
                  : undefined
            }
            size="sm"
          />
          {form.subject && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isPerfectMatch(sentence, form.subject) ? (
                <span className="text-emerald-600 text-xs" aria-label="Exact match">✔</span>
              ) : (
                <span className="text-rose-600 text-xs" aria-label="No match">✕</span>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 min-h-[1rem] text-xs">
          {showError("subject") && <div className="text-red-600">{errors.subject}</div>}
          {!errors.subject && errors.subject_match && (
            <div className="text-orange-600">{errors.subject_match}</div>
          )}
        </div>
      </div>

      {/* Subject Type */}
      <div className="flex flex-col">
        <label htmlFor="subject_type" className="text-[11px] font-semibold text-gray-600 mb-1">
          Subject Type
        </label>
        <Select
          id="subject_type"
          aria-label="Subject type"
          value={form.subject_type}
          onChange={(e) => handleChange("subject_type", e.target.value)}
          options={[
            { label: "Select type", value: "" },
            ...(ENTITY_TYPES.length
              ? ENTITY_TYPES.map((t) => ({ label: t, value: t }))
              : []),
          ]}
          size="sm"
          status={errors.subject_type || errors.subject_type_whitelist ? "error" : form.subject_type ? "success" : undefined}
        />
        <div className="mt-1 min-h-[1rem] text-xs">
          {showError("subject_type") && (
            <div className="text-red-600">{errors.subject_type}</div>
          )}
          {!errors.subject_type && errors.subject_type_whitelist && (
            <div className="text-red-600">{errors.subject_type_whitelist}</div>
          )}
        </div>
      </div>

      {/* Predicate */}
      <div className="flex flex-col">
        <label htmlFor="predicate" className="text-[11px] font-semibold text-gray-600 mb-1">
          Predicate
        </label>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Select
              id="predicate"
              aria-label="Predicate"
              value={form.predicate}
              onChange={(e) => handleChange("predicate", e.target.value)}
              options={[
                { label: "Select predicate", value: "" },
                ...(PREDICATES.length
                  ? PREDICATES.map((p) => ({ label: p.replace(/_/g, " "), value: p }))
                  : []),
              ]}
              size="sm"
              status={
                errors.predicate || errors.predicate_whitelist
                  ? "error"
                  : form.predicate
                    ? "success"
                    : undefined
              }
            />
          </div>
          <div className="flex-shrink-0">
            <div className="text-[11px] px-3 py-1 rounded-full bg-gray-100 font-mono text-xs">
              {form.negation ? `neg_${form.predicate || ""}` : form.predicate || "-"}
            </div>
          </div>
        </div>
        <div className="mt-1 min-h-[1rem] text-xs">
          {showError("predicate") && (
            <div className="text-red-600">{errors.predicate}</div>
          )}
          {!errors.predicate && errors.predicate_whitelist && (
            <div className="text-red-600">{errors.predicate_whitelist}</div>
          )}
        </div>
      </div>

      {/* Object */}
      <div className="flex flex-col">
        <label htmlFor="object" className="text-[11px] font-semibold text-gray-600 mb-1">
          Object
        </label>
        <div className="relative">
          <Input
            id="object"
            aria-label="Object"
            placeholder="Object (exact phrase)"
            value={form.object}
            onChange={(e) => handleChange("object", e.target.value)}
            status={
              errors.object
                ? "error"
                : form.object
                  ? isPerfectMatch(sentence, form.object)
                    ? "success"
                    : "warning"
                  : undefined
            }
            size="sm"
          />
          {form.object && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isPerfectMatch(sentence, form.object) ? (
                <span className="text-emerald-600 text-xs" aria-label="Exact match">✔</span>
              ) : (
                <span className="text-rose-600 text-xs" aria-label="No match">✕</span>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 min-h-[1rem] text-xs">
          {showError("object") && <div className="text-red-600">{errors.object}</div>}
          {!errors.object && errors.object_match && (
            <div className="text-orange-600">{errors.object_match}</div>
          )}
        </div>
      </div>

      {/* Object Type */}
      <div className="flex flex-col">
        <label htmlFor="object_type" className="text-[11px] font-semibold text-gray-600 mb-1">
          Object Type
        </label>
        <Select
          id="object_type"
          aria-label="Object type"
          value={form.object_type}
          onChange={(e) => handleChange("object_type", e.target.value)}
          options={[
            { label: "Select type", value: "" },
            ...(ENTITY_TYPES.length
              ? ENTITY_TYPES.map((t) => ({ label: t, value: t }))
              : []),
          ]}
          size="sm"
          status={
            errors.object_type || errors.object_type_whitelist
              ? "error"
              : form.object_type
                ? "success"
                : undefined
          }
        />
        <div className="mt-1 min-h-[1rem] text-xs">
          {showError("object_type") && (
            <div className="text-red-600">{errors.object_type}</div>
          )}
          {!errors.object_type && errors.object_type_whitelist && (
            <div className="text-red-600">{errors.object_type_whitelist}</div>
          )}
        </div>
      </div>

      {/* Negation toggle */}
      <div className="flex flex-col">
        <label htmlFor="negation" className="text-[11px] font-semibold text-gray-600 mb-1">
          Negation
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              aria-label="Negation toggle"
              checked={form.negation}
              onChange={(e) => handleChange("negation", e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative">
              <div className="w-12 h-6 bg-gray-200 rounded-full peer-checked:bg-indigo-500 transition" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-6 transition" />
            </div>
            <div className="text-sm">
              {form.negation ? <span className="font-mono">neg_</span> : <span>positive</span>}
            </div>
          </label>
        </div>
      </div>

      {/* Comment */}
      <div className="col-span-full flex flex-col">
        <label htmlFor="comment" className="text-[11px] font-semibold text-gray-600 mb-1">
          Comment (optional)
        </label>
        <Input
          id="comment"
          aria-label="Reviewer note"
          placeholder="Reviewer note"
          value={form.comment}
          onChange={(e) => handleChange("comment", e.target.value)}
          size="sm"
        />
      </div>

      {/* Action row */}
      <div className="col-span-full flex flex-wrap justify-end items-center gap-3">
        {/* error summary */}
        {Object.keys(errors).length > 0 && (
          <div className="flex-1 min-w-[180px] text-xs text-red-600">
            <div className="flex flex-col gap-1">
              {errors.subject && <div>• {errors.subject}</div>}
              {errors.subject_match && <div>• {errors.subject_match}</div>}
              {errors.predicate && <div>• {errors.predicate}</div>}
              {errors.predicate_whitelist && <div>• {errors.predicate_whitelist}</div>}
              {errors.object && <div>• {errors.object}</div>}
              {errors.object_match && <div>• {errors.object_match}</div>}
              {errors.subject_type && <div>• {errors.subject_type}</div>}
              {errors.subject_type_whitelist && (
                <div>• {errors.subject_type_whitelist}</div>
              )}
              {errors.object_type && <div>• {errors.object_type}</div>}
              {errors.object_type_whitelist && (
                <div>• {errors.object_type_whitelist}</div>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <div className="text-sm text-gray-500 mr-2">
            Preview:&nbsp;
            <span className="font-mono">
              {predicateDisplay}({form.subject} → {form.object})
            </span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            aria-label={submitLabel}
            size="md"
            variant={!canSubmit || loading ? "disabled" : "primary"}
          >
            {loading ? "Adding…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
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
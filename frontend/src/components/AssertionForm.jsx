// src/components/AssertionForm.jsx
import { useState, useEffect, useCallback } from "react";
import {
  isPerfectMatch,
  PREDICATE_WHITELIST as DEFAULT_PREDICATES,
  ENTITY_TYPE_WHITELIST as DEFAULT_ENTITY_TYPES,
} from "../utils";

export default function AssertionForm({
  sentence,
  onAdd,
  loading = false,
  initial = null,
  submitLabel = "Add",
  className = "",
  // allow override from parent (future backend sync)
  predicateWhitelist = DEFAULT_PREDICATES,
  entityTypeWhitelist = DEFAULT_ENTITY_TYPES,
}) {
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
  const [errors, setErrors] = useState({});
  const [canSubmit, setCanSubmit] = useState(false);
  const [touched, setTouched] = useState({}); // track touched for UX

  const validate = useCallback(() => {
    const newErr = {};
    if (!form.subject.trim()) newErr.subject = "Required";
    if (!form.object.trim()) newErr.object = "Required";
    if (!form.predicate.trim()) newErr.predicate = "Required";
    if (!form.subject_type) newErr.subject_type = "Required";
    if (!form.object_type) newErr.object_type = "Required";

    if (form.subject && !isPerfectMatch(sentence, form.subject))
      newErr.subject_match = "Subject must exactly appear in sentence";
    if (form.object && !isPerfectMatch(sentence, form.object))
      newErr.object_match = "Object must exactly appear in sentence";

    if (form.predicate && !predicateWhitelist.includes(form.predicate))
      newErr.predicate_whitelist = "Predicate not in official list";
    if (form.subject_type && !entityTypeWhitelist.includes(form.subject_type))
      newErr.subject_type_whitelist = "Invalid subject type";
    if (form.object_type && !entityTypeWhitelist.includes(form.object_type))
      newErr.object_type_whitelist = "Invalid object type";

    setErrors(newErr);
    setCanSubmit(Object.keys(newErr).length === 0);
  }, [form, sentence, predicateWhitelist, entityTypeWhitelist]);

  // debounce validation so quick typing doesn't jitter
  useEffect(() => {
    const handle = setTimeout(() => {
      validate();
    }, 150);
    return () => clearTimeout(handle);
  }, [form, validate]);

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const fieldBorder = (fieldKey, positiveCondition) => {
    if (errors[fieldKey]) return "border-red-400";
    if (positiveCondition) return "border-emerald-400";
    return "border-gray-300";
  };

  // derived display for negation prefix
  const predicateDisplay = `${form.negation ? "neg_" : ""}${form.predicate || ""}`;

  return (
    <div
      className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(3,1fr)_auto] items-start bg-white rounded-2xl p-5 border shadow-md ${className}`}
    >
      {/* Header */}
      <div className="col-span-full flex justify-between items-center">
        <div className="text-sm font-semibold text-gray-800">New Assertion</div>
        <div className="text-xs text-gray-500">All fields required except comment</div>
      </div>

      {/* Subject */}
      <div className="flex flex-col">
        <label htmlFor="subject" className="text-[11px] font-semibold text-gray-600 mb-1">
          Subject
        </label>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md bg-white border ${fieldBorder(
            "subject",
            isPerfectMatch(sentence, form.subject)
          )} transition`}
        >
          <input
            id="subject"
            aria-label="Subject"
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => handleChange("subject", e.target.value)}
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {form.subject && (
            <div aria-hidden="true" className="flex-shrink-0">
              {isPerfectMatch(sentence, form.subject) ? (
                <span className="text-emerald-600 text-xs">✔</span>
              ) : (
                <span className="text-red-600 text-xs">✕</span>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 min-h-[1rem] text-xs">
          {errors.subject && <div className="text-red-600">{errors.subject}</div>}
          {!errors.subject && errors.subject_match && (
            <div className="text-red-600">{errors.subject_match}</div>
          )}
        </div>
      </div>

      {/* Subject Type */}
      <div className="flex flex-col">
        <label htmlFor="subject_type" className="text-[11px] font-semibold text-gray-600 mb-1">
          Subject Type
        </label>
        <select
          id="subject_type"
          aria-label="Subject type"
          value={form.subject_type}
          onChange={(e) => handleChange("subject_type", e.target.value)}
          className={`w-full px-3 py-2 rounded-md border text-sm bg-white transition ${fieldBorder(
            errors.subject_type_whitelist ? "subject_type_whitelist" : "",
            !!form.subject_type
          )}`}
        >
          <option value="">Select type</option>
          {entityTypeWhitelist.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="mt-1 min-h-[1rem] text-xs">
          {errors.subject_type && <div className="text-red-600">{errors.subject_type}</div>}
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
        <select
          id="predicate"
          aria-label="Predicate"
          value={form.predicate}
          onChange={(e) => handleChange("predicate", e.target.value)}
          className={`w-full px-3 py-2 rounded-md border text-sm bg-white transition ${fieldBorder(
            errors.predicate_whitelist ? "predicate_whitelist" : "",
            !!form.predicate && predicateWhitelist.includes(form.predicate)
          )}`}
        >
          <option value="">Select predicate</option>
          {predicateWhitelist.map((p) => (
            <option key={p} value={p}>
              {p.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <div className="mt-1 min-h-[1rem] text-xs">
          {errors.predicate && <div className="text-red-600">{errors.predicate}</div>}
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
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md bg-white border ${fieldBorder(
            "object",
            isPerfectMatch(sentence, form.object)
          )} transition`}
        >
          <input
            id="object"
            aria-label="Object"
            placeholder="Object"
            value={form.object}
            onChange={(e) => handleChange("object", e.target.value)}
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {form.object && (
            <div aria-hidden="true" className="flex-shrink-0">
              {isPerfectMatch(sentence, form.object) ? (
                <span className="text-emerald-600 text-xs">✔</span>
              ) : (
                <span className="text-red-600 text-xs">✕</span>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 min-h-[1rem] text-xs">
          {errors.object && <div className="text-red-600">{errors.object}</div>}
          {!errors.object && errors.object_match && (
            <div className="text-red-600">{errors.object_match}</div>
          )}
        </div>
      </div>

      {/* Object Type */}
      <div className="flex flex-col">
        <label htmlFor="object_type" className="text-[11px] font-semibold text-gray-600 mb-1">
          Object Type
        </label>
        <select
          id="object_type"
          aria-label="Object type"
          value={form.object_type}
          onChange={(e) => handleChange("object_type", e.target.value)}
          className={`w-full px-3 py-2 rounded-md border text-sm bg-white transition ${fieldBorder(
            errors.object_type_whitelist ? "object_type_whitelist" : "",
            !!form.object_type && entityTypeWhitelist.includes(form.object_type)
          )}`}
        >
          <option value="">Select type</option>
          {entityTypeWhitelist.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="mt-1 min-h-[1rem] text-xs">
          {errors.object_type && <div className="text-red-600">{errors.object_type}</div>}
          {!errors.object_type && errors.object_type_whitelist && (
            <div className="text-red-600">{errors.object_type_whitelist}</div>
          )}
        </div>
      </div>

      {/* Negation */}
      <div className="flex flex-col">
        <label className="text-[11px] font-semibold text-gray-600 mb-1">
          Negation
        </label>
        <div className="inline-flex items-center gap-3">
          <div className="relative">
            <input
              id="negation_toggle"
              type="checkbox"
              checked={form.negation}
              onChange={(e) => handleChange("negation", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-gray-300 rounded-full peer-checked:bg-indigo-500 transition" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-6 transition" />
          </div>
          <label htmlFor="negation_toggle" className="select-none text-sm">
            {form.negation ? "neg_" : "positive"}
          </label>
        </div>
      </div>

      {/* Comment */}
      <div className="col-span-full flex flex-col">
        <label htmlFor="comment" className="text-[11px] font-semibold text-gray-600 mb-1">
          Comment (optional)
        </label>
        <input
          id="comment"
          aria-label="Reviewer note"
          placeholder="Reviewer note"
          value={form.comment}
          onChange={(e) => handleChange("comment", e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm bg-white"
        />
      </div>

      {/* Submit row */}
      <div className="col-span-full flex flex-wrap justify-end items-center gap-3">
        {Object.keys(errors).length > 0 && (
          <div className="text-xs text-red-600 flex-1 min-w-[180px]">
            Fix highlighted fields before submitting.
          </div>
        )}
        <button
          disabled={!canSubmit || loading}
          onClick={() => canSubmit && onAdd?.(form)}
          type="button"
          className={`flex items-center gap-2 px-6 py-2 rounded-full font-semibold transition ${!canSubmit || loading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-green-500 to-teal-400 text-white shadow-lg hover:scale-[1.02]"
            }`}
        >
          {loading ? "Adding…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
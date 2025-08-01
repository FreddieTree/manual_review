// src/components/AssertionForm.jsx
import { useState, useEffect } from "react";
import {
  PREDICATE_WHITELIST,
  ENTITY_TYPE_WHITELIST,
  containsIgnoreCase,
} from "../utils";

export default function AssertionForm({
  sentence,
  onAdd,
  onCancel, // optional
}) {
  const [form, setForm] = useState({
    subject: "",
    subject_type: "",
    predicate: "",
    object: "",
    object_type: "",
    negation: false,
  });
  const [error, setError] = useState("");
  const [validations, setValidations] = useState({
    subjectMatch: false,
    objectMatch: false,
    predicateValid: false,
    subjectTypeValid: false,
    objectTypeValid: false,
  });

  useEffect(() => {
    setValidations({
      subjectMatch: containsIgnoreCase(sentence, form.subject),
      objectMatch: containsIgnoreCase(sentence, form.object),
      predicateValid: PREDICATE_WHITELIST.includes(form.predicate),
      subjectTypeValid: ENTITY_TYPE_WHITELIST.includes(form.subject_type),
      objectTypeValid: ENTITY_TYPE_WHITELIST.includes(form.object_type),
    });
  }, [form, sentence]);

  const allGreen = Object.values(validations).every(Boolean);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!allGreen) {
      setError("Fix all validation errors before adding.");
      return;
    }
    setError("");
    onAdd({
      subject: form.subject.trim(),
      subject_type: form.subject_type,
      predicate: form.predicate,
      object: form.object.trim(),
      object_type: form.object_type,
      negation: form.negation,
    });
    setForm({
      subject: "",
      subject_type: "",
      predicate: "",
      object: "",
      object_type: "",
      negation: false,
    });
  };

  const badge = (label, ok) => (
    <div
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
        }`}
    >
      {label}
    </div>
  );

  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col">
          <label className="text-xs font-semibold mb-1">Subject</label>
          <input
            aria-label="subject"
            value={form.subject}
            onChange={(e) =>
              setForm((f) => ({ ...f, subject: e.target.value }))
            }
            placeholder="Subject text"
            className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300 focus:outline-none"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {badge(
              `In sentence: ${validations.subjectMatch ? "✔" : "✖"}`,
              validations.subjectMatch
            )}
          </div>
          <div className="mt-1">
            <select
              aria-label="subject type"
              value={form.subject_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject_type: e.target.value }))
              }
              className="mt-2 w-full border rounded px-2 py-1 focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Subject Type</option>
              {ENTITY_TYPE_WHITELIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="mt-1">
              {badge(
                `Type: ${validations.subjectTypeValid ? "✔" : "✖"}`,
                validations.subjectTypeValid
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-semibold mb-1">Predicate</label>
          <select
            aria-label="predicate"
            value={form.predicate}
            onChange={(e) =>
              setForm((f) => ({ ...f, predicate: e.target.value }))
            }
            className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Predicate</option>
            {PREDICATE_WHITELIST.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="mt-1">
            {badge(
              `Valid: ${validations.predicateValid ? "✔" : "✖"}`,
              validations.predicateValid
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.negation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, negation: e.target.checked }))
                }
              />
              Negation
            </label>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-semibold mb-1">Object</label>
          <input
            aria-label="object"
            value={form.object}
            onChange={(e) =>
              setForm((f) => ({ ...f, object: e.target.value }))
            }
            placeholder="Object text"
            className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300 focus:outline-none"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {badge(
              `In sentence: ${validations.objectMatch ? "✔" : "✖"}`,
              validations.objectMatch
            )}
          </div>
          <div className="mt-1">
            <select
              aria-label="object type"
              value={form.object_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, object_type: e.target.value }))
              }
              className="mt-2 w-full border rounded px-2 py-1 focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Object Type</option>
              {ENTITY_TYPE_WHITELIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="mt-1">
              {badge(
                `Type: ${validations.objectTypeValid ? "✔" : "✖"}`,
                validations.objectTypeValid
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:items-end">
        {error && (
          <div className="text-red-600 text-sm font-medium">{error}</div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAdd}
            disabled={!allGreen}
            className={`flex-shrink-0 px-5 py-2 rounded-md font-semibold transition-shadow ${allGreen
                ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg hover:scale-[1.02]"
                : "bg-gray-200 text-gray-600 cursor-not-allowed"
              }`}
          >
            Add Assertion
          </button>
          {onCancel && (
            <button
              onClick={() => onCancel()}
              className="px-5 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
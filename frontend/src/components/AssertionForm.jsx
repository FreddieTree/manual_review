import { useState } from "react";

const PREDICATE_LIST = [
  "causes", "increases", "reduces", "decreases",
  "associated_with", "inhibits", "induces", "related_to", "no_effect", "prevents"
];

export default function AssertionForm({ onAdd, loading = false }) {
  const [subject, setSubject] = useState("");
  const [predicate, setPredicate] = useState("");
  const [object, setObject] = useState("");
  const [negation, setNegation] = useState("false");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  // 强校验+清理
  const handleAdd = (e) => {
    e.preventDefault();
    if (!subject.trim() || !predicate.trim() || !object.trim()) {
      setError("All fields except comment are required.");
      return;
    }
    if (!PREDICATE_LIST.includes(predicate.trim())) {
      setError("Predicate must be from the allowed list.");
      return;
    }
    setError("");
    onAdd({
      subject: subject.trim(),
      predicate: predicate.trim(),
      object: object.trim(),
      negation: negation === "true",
      comment: comment.trim()
    });
    setSubject(""); setPredicate(""); setObject(""); setComment(""); setNegation("false");
  };

  return (
    <form className="flex flex-wrap gap-2 mt-2 items-center" onSubmit={handleAdd} autoComplete="off">
      <input
        className="border rounded px-2 py-1 w-32"
        placeholder="Subject"
        value={subject}
        onChange={e => setSubject(e.target.value)}
        required
        maxLength={32}
      />
      <select
        className="border rounded px-2 py-1 w-36"
        value={predicate}
        onChange={e => setPredicate(e.target.value)}
        required
      >
        <option value="">Predicate</option>
        {PREDICATE_LIST.map(pred => <option key={pred}>{pred}</option>)}
      </select>
      <input
        className="border rounded px-2 py-1 w-32"
        placeholder="Object"
        value={object}
        onChange={e => setObject(e.target.value)}
        required
        maxLength={32}
      />
      <select
        className="border rounded px-2 py-1 w-20"
        value={negation}
        onChange={e => setNegation(e.target.value)}
        required
      >
        <option value="false">Neg: False</option>
        <option value="true">Neg: True</option>
      </select>
      <input
        className="border rounded px-2 py-1 flex-1 min-w-36"
        placeholder="Comment (optional)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        maxLength={80}
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-green-700 text-white px-4 py-1 rounded-lg shadow hover:bg-green-800 font-semibold transition"
      >
        Add
      </button>
      {error && (
        <div className="w-full text-red-500 text-xs mt-1">{error}</div>
      )}
    </form>
  );
}
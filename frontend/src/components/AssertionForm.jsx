import { useState } from "react";

export default function AssertionForm({ onAdd }) {
  const [subject, setSubject] = useState("");
  const [predicate, setPredicate] = useState("");
  const [object, setObject] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleAdd = (e) => {
    e.preventDefault();
    if (!subject || !predicate || !object) {
      setError("Please fill all fields");
      return;
    }
    onAdd({ subject, predicate, object, comment });
    setSubject(""); setPredicate(""); setObject(""); setComment("");
    setError("");
  };

  return (
    <form className="mt-4 flex flex-col gap-2" onSubmit={handleAdd}>
      <input className="border rounded p-1" placeholder="Subject"
        value={subject} onChange={e => setSubject(e.target.value)} />
      <input className="border rounded p-1" placeholder="Predicate"
        value={predicate} onChange={e => setPredicate(e.target.value)} />
      <input className="border rounded p-1" placeholder="Object"
        value={object} onChange={e => setObject(e.target.value)} />
      <input className="border rounded p-1" placeholder="Comment (optional)"
        value={comment} onChange={e => setComment(e.target.value)} />
      {error && <span className="text-red-600">{error}</span>}
      <button type="submit" className="bg-green-600 text-white py-1 rounded">Add</button>
    </form>
  );
}
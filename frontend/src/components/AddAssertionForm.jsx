import { useState } from "react";

export default function AssertionForm({ abstract, onSubmit }) {
  const [subject, setSubject] = useState("");
  const [predicate, setPredicate] = useState("");
  const [object, setObject] = useState("");
  const [comment, setComment] = useState("");
  const [userAdd, setUserAdd] = useState([]);
  const [error, setError] = useState("");

  // 可自定义支持多条新增
  const handleAdd = () => {
    if (!subject || !predicate || !object) {
      setError("Please fill all fields");
      return;
    }
    setUserAdd([...userAdd, { subject, predicate, object, comment }]);
    setSubject(""); setPredicate(""); setObject(""); setComment("");
    setError("");
  };

  return (
    <div className="mt-6">
      <h4 className="font-semibold mb-2">Add New Assertion</h4>
      <div className="flex flex-col gap-2 mb-2">
        <input className="border rounded p-1" placeholder="Subject"
          value={subject} onChange={e => setSubject(e.target.value)} />
        <input className="border rounded p-1" placeholder="Predicate"
          value={predicate} onChange={e => setPredicate(e.target.value)} />
        <input className="border rounded p-1" placeholder="Object"
          value={object} onChange={e => setObject(e.target.value)} />
        <input className="border rounded p-1" placeholder="Comment (optional)"
          value={comment} onChange={e => setComment(e.target.value)} />
        {error && <span className="text-red-600">{error}</span>}
        <button className="bg-green-600 text-white py-1 rounded" onClick={handleAdd}>Add</button>
      </div>
      <button className="bg-blue-700 text-white px-6 py-2 rounded mt-2"
        onClick={() => onSubmit([], userAdd)}>
        Submit All
      </button>
    </div>
  );
}
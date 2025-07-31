import { useEffect, useState } from "react";
import { getAssignedAbstract, submitReview } from "../api";
import AssertionTable from "../components/AssertionTable";
import AssertionForm from "../components/AssertionForm";
import { useNavigate } from "react-router-dom";

export default function ReviewPage() {
  const [abstract, setAbstract] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getAssignedAbstract()
      .then((res) => {
        setAbstract(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        navigate("/");
      });
  }, []);

  const handleSubmit = async (assertions, userAdd) => {
    try {
      setStatus("Submitting…");
      await submitReview({ assertions, userAdd });
      setStatus("Review submitted!");
      setTimeout(() => navigate("/"), 1200);
    } catch (e) {
      setStatus("Submission failed. Please try again.");
    }
  };

  if (loading) return <div className="text-center mt-24 text-gray-500 text-lg">Loading abstract…</div>;
  if (!abstract)
    return <div className="text-center mt-24 text-red-600">Abstract load failed, please refresh or relogin.</div>;

  return (
    <div className="max-w-3xl w-full mx-auto bg-white p-7 rounded-2xl shadow">
      <h2 className="text-xl font-bold mb-2 text-blue-900">Abstract Review</h2>
      <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded text-gray-800">
        <div className="font-bold mb-1">{abstract.title}</div>
        <div className="mb-1"><span className="text-gray-600">PMID:</span> {abstract.pmid}</div>
        <div className="mb-1 text-gray-600">{abstract.journal} ({abstract.year})</div>
        <div className="text-gray-800">{abstract.text}</div>
      </div>
      <AssertionTable assertions={abstract.assertions} />
      <AssertionForm abstract={abstract} onSubmit={handleSubmit} />
      {status && <div className="text-blue-700 mt-5">{status}</div>}
    </div>
  );
}
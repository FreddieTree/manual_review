import { useEffect, useState } from "react";
import { getAssignedAbstract, submitReview } from "../api";
import AssertionTable from "../components/AssertionTable";
import AssertionForm from "../components/AssertionForm";
import { useNavigate } from "react-router-dom";

export default function ReviewPage() {
  const [abstract, setAbstract] = useState(null);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getAssignedAbstract()
      .then(setAbstract)
      .catch(() => navigate("/"));
  }, []);

  const handleSubmit = async (assertions, userAdd) => {
    try {
      await submitReview({ assertions, userAdd });
      setStatus("Review submitted!");
      setTimeout(() => navigate("/"), 1200);
    } catch (e) {
      setStatus("Submission failed. Try again.");
    }
  };

  if (!abstract) return <div>Loading...</div>;
  return (
    <div className="max-w-3xl w-full bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-bold mb-3">Abstract: {abstract.title}</h2>
      <p className="text-gray-700 mb-4">{abstract.text}</p>
      <AssertionTable assertions={abstract.assertions} />
      <AssertionForm abstract={abstract} onSubmit={handleSubmit} />
      {status && <div className="text-blue-700 mt-4">{status}</div>}
    </div>
  );
}
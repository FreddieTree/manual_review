import { useEffect, useState } from "react";
import { getAssignedAbstract, submitReview } from "../api";
import AssertionTable from "../components/AssertionTable";
import AssertionForm from "../components/AssertionForm";
import { useNavigate } from "react-router-dom";

export default function ReviewPage() {
  const [abstract, setAbstract] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitPending, setSubmitPending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getAssignedAbstract()
      .then((res) => {
        setAbstract(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        navigate("/"); // 回首页（如未登录/异常）
      });
  }, [navigate]);

  // 支持断言review提交
  const handleSubmit = async (assertions, userAdd) => {
    try {
      setSubmitPending(true);
      setStatus("Submitting…");
      await submitReview({ assertions, userAdd });
      setStatus("✅ Review submitted!");
      setTimeout(() => navigate("/"), 1400);
    } catch (e) {
      setStatus("❌ Submission failed. Please try again.");
    }
    setSubmitPending(false);
  };

  if (loading)
    return (
      <div className="flex flex-col items-center mt-36 text-gray-500 text-lg">
        <span className="animate-pulse text-3xl mb-3">🌀</span>
        Loading abstract…
      </div>
    );
  if (!abstract)
    return (
      <div className="flex flex-col items-center mt-36 text-red-600 text-lg">
        <span className="text-3xl mb-3">⚠️</span>
        Abstract load failed, please refresh or relogin.
      </div>
    );

  return (
    <div className="max-w-3xl w-full mx-auto bg-white p-7 rounded-3xl shadow-2xl border border-blue-100 mt-10">
      <div className="mb-6 flex items-start gap-3">
        <h2 className="text-2xl font-black text-blue-900 flex-1">Abstract Review</h2>
        <span className="bg-blue-50 text-blue-800 rounded px-2 py-1 text-xs font-semibold">Step 1/2</span>
      </div>
      <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-xl text-gray-800">
        <div className="font-extrabold mb-2 text-lg">{abstract.title}</div>
        <div className="mb-1 flex gap-2 text-sm">
          <span className="text-gray-500">PMID:</span> <span>{abstract.pmid}</span>
        </div>
        <div className="mb-1 text-gray-500 text-sm">
          {abstract.journal} <span className="text-gray-400">({abstract.year})</span>
        </div>
        {abstract.text && (
          <div className="text-gray-800 text-base mt-2">
            {abstract.text}
          </div>
        )}
      </div>
      {/* 断言表格展示（仅当有现有断言时显示） */}
      {abstract.assertions && abstract.assertions.length > 0 && (
        <div className="mb-6">
          <AssertionTable assertions={abstract.assertions} />
        </div>
      )}
      <AssertionForm
        abstract={abstract}
        onSubmit={handleSubmit}
        disabled={submitPending}
      />
      {status && (
        <div
          className={`mt-6 text-base font-bold text-center ${status.includes("failed") ? "text-red-600" : "text-blue-800"
            }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
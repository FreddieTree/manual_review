import AssertionTable from "./AssertionTable";
import AssertionForm from "./AssertionForm";

export default function SentenceBlock({
  idx,
  sentence,
  assertions,
  reviewState,
  onReviewChange,
  onCommentChange,
  onAddAssertion,
  loadingAdd,
}) {
  return (
    <div className="mb-8 bg-gray-50 rounded-2xl p-5 shadow-lg border border-blue-100">
      <div className="font-bold mb-3 text-blue-800 text-base">
        Sentence {idx + 1}:
        <span className="ml-2 text-gray-800 font-normal">{sentence}</span>
      </div>
      <AssertionTable
        assertions={assertions}
        reviewState={reviewState}
        onReviewChange={onReviewChange}
        onCommentChange={onCommentChange}
      />
      <div className="mt-4">
        <AssertionForm onAdd={a => onAddAssertion(idx, a)} loading={loadingAdd} />
      </div>
    </div>
  );
}
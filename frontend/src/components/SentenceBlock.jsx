import AssertionTable from "./AssertionTable";
import AssertionForm from "./AssertionForm";

export default function SentenceBlock({ idx, sentence, assertions, reviewState, onReviewChange, onCommentChange, onAddAssertion }) {
  return (
    <div className="mb-6 bg-gray-50 rounded-lg p-4 shadow">
      <div className="font-semibold mb-2">
        Sentence {idx + 1}: <span className="ml-2 text-gray-800">{sentence}</span>
      </div>
      <AssertionTable
        assertions={assertions}
        reviewState={reviewState}
        onReviewChange={onReviewChange}
        onCommentChange={onCommentChange}
      />
      <AssertionForm onAdd={a => onAddAssertion(idx, a)} />
    </div>
  );
}
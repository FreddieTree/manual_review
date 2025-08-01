import AssertionForm from "./AssertionForm";
import { perfectMatch } from "../utils";

export default function SentenceBlock({ sentenceObj, onAddAssertion }) {
  const { sentence, assertions } = sentenceObj;

  return (
    <div className="mb-4 p-5 bg-white shadow rounded-xl">
      <p className="font-semibold text-lg">{sentence}</p>
      {assertions.map((a, i) => (
        <div key={i} className="flex items-center gap-2 mt-2">
          <span className={perfectMatch(sentence, a.subject) ? "text-green-600" : "text-red-600"}>{a.subject} ({a.subject_type})</span>
          <span className="font-bold">{a.negation ? `neg_${a.predicate}` : a.predicate}</span>
          <span className={perfectMatch(sentence, a.object) ? "text-green-600" : "text-red-600"}>{a.object} ({a.object_type})</span>
        </div>
      ))}
      <AssertionForm sentence={sentence} onAdd={assertion => onAddAssertion(sentenceObj.sentence_index, assertion)} />
    </div>
  );
}
import AssertionTable from "./AssertionTable";
import AddAssertionForm from "./AddAssertionForm";

export default function SentenceBlock({ idx, sentence, assertions }) {
  return (
    <div className="mb-6 bg-gray-50 rounded-lg p-4 shadow">
      <div className="font-semibold mb-2">
        Sentence {idx}:
        <span className="ml-2 text-gray-800">{sentence}</span>
      </div>
      <AssertionTable assertions={assertions} />
      <AddAssertionForm sentence={sentence} />
    </div>
  );
}
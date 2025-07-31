export default function AssertionTable({
  assertions = [],
  reviewState = {},
  onReviewChange,
  onCommentChange
}) {
  // assertions: [{subject, predicate, object, negation, ...}]
  return (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-sm border rounded shadow-sm bg-white">
        <thead>
          <tr className="bg-blue-50 border-b text-blue-900 font-semibold">
            <th className="px-2 py-1 border">Subject</th>
            <th className="px-2 py-1 border">Predicate</th>
            <th className="px-2 py-1 border">Object</th>
            <th className="px-2 py-1 border">Negation</th>
            <th className="px-2 py-1 border">Review</th>
            <th className="px-2 py-1 border">Comment</th>
          </tr>
        </thead>
        <tbody>
          {assertions.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-gray-400 py-4 text-center">
                No assertions to review.
              </td>
            </tr>
          ) : (
            assertions.map((a, idx) => (
              <tr key={idx} className="border-t">
                <td className="border px-2 text-blue-900">{a.subject}</td>
                <td className="border px-2">{a.predicate}</td>
                <td className="border px-2">{a.object}</td>
                <td className="border px-2">
                  <span
                    className={
                      a.negation
                        ? "text-red-600 font-bold"
                        : "text-emerald-700 font-bold"
                    }
                  >
                    {a.negation ? "True" : "False"}
                  </span>
                </td>
                <td className="border px-2">
                  {onReviewChange ? (
                    <select
                      className="border rounded px-1 py-0.5"
                      value={reviewState?.[idx]?.review || ""}
                      onChange={e => onReviewChange(idx, e.target.value)}
                      required
                    >
                      <option value="">-</option>
                      <option value="accept">Accept</option>
                      <option value="uncertain">Uncertain</option>
                      <option value="reject">Reject</option>
                      <option value="modify">Modify</option>
                    </select>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="border px-2">
                  {onCommentChange ? (
                    <input
                      type="text"
                      className="border rounded px-1 py-0.5 w-24"
                      value={reviewState?.[idx]?.comment || ""}
                      onChange={e => onCommentChange(idx, e.target.value)}
                    />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function AssertionTable({ assertions }) {
  // fallback: ensure assertions is always an array
  const safeAssertions = Array.isArray(assertions) ? assertions : [];

  return (
    <table className="min-w-full text-sm border my-2">
      <thead>
        <tr className="bg-gray-100">
          <th className="px-2 py-1 border">Subject</th>
          <th className="px-2 py-1 border">Predicate</th>
          <th className="px-2 py-1 border">Object</th>
          <th className="px-2 py-1 border">Negation</th>
          <th className="px-2 py-1 border">Review</th>
          <th className="px-2 py-1 border">Comment</th>
        </tr>
      </thead>
      <tbody>
        {safeAssertions.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-gray-400 py-4 text-center">
              No assertions to review.
            </td>
          </tr>
        ) : (
          safeAssertions.map((a, idx) => (
            <tr key={idx}>
              <td className="border px-2">{a.subject}</td>
              <td className="border px-2">{a.predicate}</td>
              <td className="border px-2">{a.object}</td>
              <td className="border px-2">{a.negation ? "True" : "False"}</td>
              <td className="border px-2">
                <select className="border rounded">
                  <option>Accept</option>
                  <option>Uncertain</option>
                  <option>Reject</option>
                </select>
              </td>
              <td className="border px-2">
                <input type="text" className="border rounded px-1" />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
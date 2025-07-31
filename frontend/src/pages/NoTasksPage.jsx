import { Link } from "react-router-dom";

export default function NoTasksPage() {
  return (
    <div className="text-center mt-40">
      <div className="text-2xl font-bold text-gray-800 mb-4">
        🎉 All abstracts are fully reviewed!
      </div>
      <div className="text-gray-600 mb-6">
        There are currently <b>no more abstracts</b> that need your review.<br />
        Thank you for your valuable contributions!
      </div>
      <Link to="/" className="inline-block px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 font-semibold transition">
        Back to Home
      </Link>
    </div>
  );
}
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="text-center mt-48">
      <div className="text-4xl font-extrabold text-red-500 mb-4">404</div>
      <div className="text-lg text-gray-800 mb-4">Page Not Found</div>
      <Link
        to="/"
        className="inline-block px-5 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 shadow"
      >
        Go Home
      </Link>
    </div>
  );
}
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="w-full bg-white shadow mb-8">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-blue-800">Manual Review System</Link>
        <nav className="space-x-4">
          <Link to="/" className="text-gray-700 hover:text-blue-600">Login</Link>
          <Link to="/review" className="text-gray-700 hover:text-blue-600">Review</Link>
          <Link to="/admin" className="text-gray-700 hover:text-blue-600">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
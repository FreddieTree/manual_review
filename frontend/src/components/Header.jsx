import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();

  const navItems = [
    { path: "/", label: "Login" },
    { path: "/review", label: "Review" },
    { path: "/admin", label: "Admin" },
  ];

  return (
    <header className="w-full bg-white shadow-lg border-b mb-8 z-10">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="text-2xl font-black text-blue-900 tracking-wider flex items-center"
        >
          <span className="mr-2">🧬</span>
          Manual Review System
        </Link>
        <nav className="space-x-2">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`inline-block px-3 py-1 rounded-lg font-medium text-sm ${pathname === item.path
                  ? "bg-blue-700 text-white shadow"
                  : "text-gray-700 hover:text-blue-600"
                } transition`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
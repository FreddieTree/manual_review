import { useLocation } from "react-router-dom";

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname === "/") return null; // 登录页不渲染footer

  return (
    <footer className="bg-gradient-to-r from-gray-100 to-blue-50 text-center py-4 mt-10 text-gray-400 text-sm rounded-t-xl shadow-inner border-t">
      &copy; {new Date().getFullYear()} Biomedical Assertion Review Platform.
    </footer>
  );
}
import Header from "./components/Header";
import Footer from "./components/Footer";
import { Routes, Route, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ReviewPage from "./pages/ReviewPage";
import AdminPage from "./pages/AdminPage";
import NoTasksPage from "./pages/NoTasksPage";
import NotFoundPage from "./pages/NotFoundPage";
import ReviewersPage from "./pages/ReviewersPage";
import ArbitrationPage from "./pages/ArbitrationPage";

export default function App() {
  const { pathname } = useLocation();
  // 登录页无Header/Footer，内容100%居中且无额外Padding
  const isLogin = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-sky-50 via-blue-50 to-slate-100 transition-all">
      {!isLogin && <Header />}
      <main className={`flex-1 flex flex-col items-center justify-center ${isLogin ? "px-2 py-0" : "py-10 px-4 md:px-8"} transition-all`}>
        <div className={isLogin ? "w-full flex flex-col items-center justify-center" : "w-full max-w-4xl"}>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/reviewers" element={<ReviewersPage />} />
            <Route path="/admin/arbitration" element={<ArbitrationPage />} />
            <Route path="/no_more_tasks" element={<NoTasksPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </main>
      {!isLogin && <Footer />}
    </div>
  );
}
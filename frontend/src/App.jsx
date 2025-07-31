// src/App.jsx
import Header from "./components/Header";
import Footer from "./components/Footer";
import { Routes, Route } from "react-router-dom";

// 页面
import LoginPage from "./pages/LoginPage";
import ReviewPage from "./pages/ReviewPage";
import AdminPage from "./pages/AdminPage";
import NoTasksPage from "./pages/NoTasksPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50">
      {/* 顶部导航 */}
      <Header />

      {/* 主内容区，居中展示 */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/no_more_tasks" element={<NoTasksPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {/* 页脚 */}
      <Footer />
    </div>
  );
}
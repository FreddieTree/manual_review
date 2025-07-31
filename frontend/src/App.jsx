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
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-gray-100 via-blue-50 to-gray-200 transition-all">
      {/* 顶部导航条，吸顶渐变 */}
      <Header />

      {/* 主内容区，适配大中小屏，自动居中且有最大宽度 */}
      <main className="flex-1 flex flex-col w-full items-center justify-center py-10 px-3 md:px-8 transition-all">
        <div className="w-full max-w-4xl">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/no_more_tasks" element={<NoTasksPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </main>

      {/* 页脚，吸底渐变 */}
      <Footer />
    </div>
  );
}
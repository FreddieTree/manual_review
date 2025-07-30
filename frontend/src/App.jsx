import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import LoginPage from "./pages/LoginPage";
import ReviewPage from "./pages/ReviewPage";
import AdminPage from "./pages/AdminPage";
import NoTasksPage from "./pages/NoTasksPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 flex flex-col items-center px-4 py-6">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/no_more_tasks" element={<NoTasksPage />} />
            {/* 404 fallback */}
            <Route path="*" element={<NotFoundPage />} />
            {/* 或者自动回主页 */}
            {/* <Route path="*" element={<Navigate to="/" />} /> */}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
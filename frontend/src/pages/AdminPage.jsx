import { useEffect, useState } from "react";
import { getAdminStats } from "../api";

export default function AdminPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getAdminStats().then(setStats);
  }, []);

  if (!stats) return <div>Loading...</div>;
  return (
    <div className="max-w-4xl w-full bg-white p-6 rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      <div>
        <p>Total abstracts: {stats.total_abstracts}</p>
        <p>Total reviewers: {stats.total_reviewers}</p>
        <p>Conflicts: {stats.conflicts}</p>
        {/* 更多数据展示 */}
      </div>
      {/* 可扩展仲裁、报表导出等 */}
    </div>
  );
}
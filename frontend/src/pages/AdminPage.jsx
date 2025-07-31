import { useEffect, useState } from "react";
import { getAdminStats } from "../api";

/**
 * 单个数据卡片组件
 */
function StatCard({ label, value, icon, color = "blue" }) {
  return (
    <div className={`bg-${color}-50 rounded-2xl p-7 shadow flex flex-col items-center border border-${color}-100`}>
      <div className={`text-4xl mb-3 ${icon ? "" : "hidden"}`}>{icon}</div>
      <div className={`text-3xl font-extrabold text-${color}-800 mb-2`}>{value}</div>
      <div className="text-gray-500 font-semibold">{label}</div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => {
        setStats(null);
        setError("Failed to load admin stats.");
      });
  }, []);

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center text-red-600 font-bold text-lg animate-pulse">
        {error}
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="w-full flex justify-center mt-28">
        <span className="text-gray-500 text-lg animate-pulse">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full bg-white p-10 rounded-3xl shadow-2xl border border-blue-100 mt-10">
      <div className="flex items-center gap-4 mb-9">
        <h2 className="text-3xl font-black text-blue-900 flex items-center gap-3">
          <span>Admin Dashboard</span>
          <span className="ml-2 px-2 py-1 rounded bg-blue-50 text-blue-800 text-xs font-bold tracking-wider">
            Beta
          </span>
        </h2>
        <span className="ml-auto text-blue-500 animate-bounce text-2xl">🛡️</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-7 mb-8">
        <StatCard label="Total Abstracts" value={stats.total_abstracts} icon="📄" color="blue" />
        <StatCard label="Total Reviewers" value={stats.total_reviewers} icon="👩‍🔬" color="emerald" />
        <StatCard label="Conflicts" value={stats.conflicts} icon="⚡" color="red" />
        <StatCard label="Fully Reviewed" value={stats.reviewed_count || 0} icon="✅" color="indigo" />
      </div>

      {/* 实时动态面板 */}
      <section className="bg-gray-50 rounded-xl p-6 mt-6 border">
        <h3 className="font-bold text-blue-800 mb-3 text-lg flex items-center gap-2">
          <span className="text-blue-500">📊</span> Platform Status &amp; Roadmap
        </h3>
        <ul className="list-disc ml-7 text-gray-700 text-base space-y-1">
          <li>Current reviewers working: <span className="font-semibold text-green-700">{stats.active_reviewers || 0}</span></li>
          <li>Arbitration queue: <span className="font-semibold text-blue-700">{stats.arbitration_count || 0}</span></li>
          <li>Latest export: <span className="text-gray-500">{stats.last_export || "—"}</span></li>
        </ul>
        <div className="mt-4 text-gray-500 text-xs">
          Arbitration, conflict resolution, export logs and reviewer leaderboard are coming soon.<br />
          <span className="italic">Want to export data or force unlock a task? Ask the system admin.</span>
        </div>
      </section>
    </div>
  );
}
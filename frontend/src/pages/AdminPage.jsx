// src/pages/AdminPage.jsx
import { useEffect, useState } from "react";
import { getAdminStats } from "../api";
import { Link } from "react-router-dom";

// 彩色Icon支持
const icons = {
  blue: "📄",
  emerald: "👩‍🔬",
  red: "⚡",
  indigo: "✅",
};

// 彩色背景与文本映射
const colorMap = {
  blue: "bg-blue-50 text-blue-800 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
  red: "bg-red-50 text-red-800 border-red-100",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-100",
};

// 单卡片
function StatCard({ label, value, icon, color = "blue", extra }) {
  return (
    <div className={`rounded-2xl p-7 shadow flex flex-col items-center border ${colorMap[color]} transition`}>
      <div className="text-4xl mb-3 select-none">{icon}</div>
      <div className="text-3xl font-extrabold mb-1 tabular-nums">{value ?? <span className="opacity-60">—</span>}</div>
      <div className="text-gray-500 font-semibold mb-1 text-center">{label}</div>
      {extra && <div className="text-xs mt-1 text-gray-400">{extra}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // 动态加载数据
  useEffect(() => {
    refresh();
  }, []);
  function refresh() {
    setLoading(true);
    getAdminStats()
      .then(data => {
        setStats(data);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load admin stats.");
        setLoading(false);
      });
  }

  // 错误
  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center text-red-600 font-bold text-lg animate-pulse">
        {error}
        <button
          className="ml-6 px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-700 text-sm"
          onClick={refresh}
        >
          Retry
        </button>
      </div>
    );
  }

  // 加载中
  if (loading || !stats) {
    return (
      <div className="w-full flex flex-col justify-center items-center mt-32">
        <span className="text-blue-400 text-3xl mb-4 animate-spin">🧬</span>
        <span className="text-gray-500 text-lg animate-pulse">Loading dashboard…</span>
      </div>
    );
  }

  // 卡片数据
  const cards = [
    {
      label: "Total Abstracts",
      value: stats.total_abstracts,
      icon: icons.blue,
      color: "blue",
      extra: stats.abstracts_today ? `+${stats.abstracts_today} today` : undefined,
    },
    {
      label: "Total Reviewers",
      value: stats.total_reviewers,
      icon: icons.emerald,
      color: "emerald",
      extra: stats.new_reviewers ? `+${stats.new_reviewers} joined` : undefined,
    },
    {
      label: "Conflicts",
      value: stats.conflicts,
      icon: icons.red,
      color: "red",
      extra: stats.conflicts ? (
        <Link to="/admin/arbitration" className="underline hover:text-red-600">Resolve now</Link>
      ) : null,
    },
    {
      label: "Fully Reviewed",
      value: stats.reviewed_count || 0,
      icon: icons.indigo,
      color: "indigo",
      extra: stats.reviewed_ratio ? `${stats.reviewed_ratio}% done` : undefined,
    },
  ];

  // 扩展功能入口
  const adminLinks = [
    { to: "/admin/reviewers", label: "Manage Reviewers", icon: "👥" },
    { to: "/admin/arbitration", label: "Arbitration Queue", icon: "⚖️" },
    { to: "/admin/export", label: "Export Data", icon: "📤" },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full bg-white p-10 rounded-3xl shadow-2xl border border-blue-100 mt-10">
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <h2 className="text-3xl font-black text-blue-900 flex items-center gap-3 tracking-wide">
          <span className="drop-shadow">Admin Dashboard</span>
          <span className="ml-2 px-2 py-1 rounded bg-blue-50 text-blue-800 text-xs font-bold tracking-wider shadow">
            Beta
          </span>
        </h2>
        <span className="sm:ml-auto text-blue-500 animate-bounce text-3xl select-none">🛡️</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        {cards.map((c, i) => (
          <StatCard key={i} {...c} />
        ))}
      </div>

      <section className="bg-gray-50 rounded-xl p-6 border flex flex-col lg:flex-row gap-10">
        <div className="flex-1">
          <h3 className="font-bold text-blue-800 mb-3 text-lg flex items-center gap-2">
            <span className="text-blue-500 text-xl">📊</span> Platform Status &amp; Roadmap
          </h3>
          <ul className="list-disc ml-6 text-gray-700 text-base space-y-1">
            <li>
              <span className="font-semibold text-green-700">{stats.active_reviewers ?? 0}</span> active reviewers
            </li>
            <li>
              Arbitration queue: <span className="font-semibold text-blue-700">{stats.arbitration_count ?? 0}</span>
            </li>
            <li>
              Latest export: <span className="text-gray-500">{stats.last_export || "—"}</span>
            </li>
            <li>
              Leaderboard, logs, and reviewer activity coming soon.
            </li>
          </ul>
          <div className="mt-4 text-gray-400 text-xs">
            Need to export data or force unlock a task? <b>Contact the system admin.</b>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-center">
          <h4 className="font-bold text-blue-900 mb-2">Quick Links</h4>
          {adminLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-900 rounded-lg shadow border border-blue-100 hover:bg-blue-100 hover:scale-105 transition"
            >
              <span className="text-lg">{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
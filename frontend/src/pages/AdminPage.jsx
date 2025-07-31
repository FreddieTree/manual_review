import { useEffect, useState } from "react";
import { getAdminStats } from "../api";

export default function AdminPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => setStats(false));
  }, []);

  if (stats === false) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center text-red-500 font-bold text-lg">
        Failed to load admin stats.
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="w-full flex justify-center mt-20">
        <span className="text-gray-600 animate-pulse">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full bg-white p-8 rounded-2xl shadow">
      <h2 className="text-2xl font-bold mb-6 text-blue-900 flex items-center gap-2">
        <span>Admin Dashboard</span>
        <span className="ml-2 px-2 py-1 rounded bg-blue-50 text-blue-800 text-xs">Beta</span>
      </h2>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <Stat label="Total Abstracts" value={stats.total_abstracts} />
        <Stat label="Total Reviewers" value={stats.total_reviewers} />
        <Stat label="Conflicts" value={stats.conflicts} />
        <Stat label="Fully Reviewed" value={stats.reviewed_count} />
      </div>
      <div className="text-sm text-gray-600">
        Arbitration, log export, team ranking, and more features coming soon!
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 shadow-sm flex flex-col items-center border">
      <div className="text-3xl font-extrabold text-blue-700 mb-2">{value}</div>
      <div className="text-gray-500">{label}</div>
    </div>
  );
}
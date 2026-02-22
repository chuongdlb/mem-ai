import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useUser } from "../lib/userContext.js";
import { Brain, Users, FolderOpen, MessageSquare, AlertCircle } from "lucide-react";

interface Stats {
  users: number;
  groups: number;
  projects: number;
  memories: number;
  sessions: number;
}

export default function DashboardPage() {
  const { user, isAdmin } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    api
      .get<Stats>("/api/v1/admin/stats")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-600">
            Welcome back{user?.name ? `, ${user.name}` : ""}. Use the sidebar to navigate to your memories, sessions, and repos.
          </p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Users", value: stats?.users ?? "-", icon: Users },
    { label: "Groups", value: stats?.groups ?? "-", icon: FolderOpen },
    { label: "Memories", value: stats?.memories ?? "-", icon: Brain },
    { label: "Sessions", value: stats?.sessions ?? "-", icon: MessageSquare },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {loading && <p className="text-sm text-gray-500">Loading stats...</p>}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
          <AlertCircle size={16} />
          Failed to load stats: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{label}</span>
                <Icon size={18} className="text-gray-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Brain, Users, FolderOpen, MessageSquare } from "lucide-react";

interface Stats {
  users: number;
  groups: number;
  projects: number;
  memories: number;
  sessions: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/api/v1/admin/stats").then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: "Users", value: stats?.users ?? "-", icon: Users, color: "blue" },
    { label: "Groups", value: stats?.groups ?? "-", icon: FolderOpen, color: "green" },
    { label: "Memories", value: stats?.memories ?? "-", icon: Brain, color: "purple" },
    { label: "Sessions", value: stats?.sessions ?? "-", icon: MessageSquare, color: "amber" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

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
    </div>
  );
}

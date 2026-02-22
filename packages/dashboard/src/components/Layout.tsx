import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Brain,
  MessageSquare,
  GitBranch,
  Settings,
  LogOut,
} from "lucide-react";
import { clearToken } from "../lib/api.js";
import { useUser } from "../lib/userContext.js";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/students", label: "Students", icon: Users, adminOnly: true },
  { to: "/groups", label: "Groups", icon: FolderOpen, adminOnly: false },
  { to: "/memories", label: "Memories", icon: Brain, adminOnly: false },
  { to: "/sessions", label: "Sessions", icon: MessageSquare, adminOnly: false },
  { to: "/repos", label: "Repos", icon: GitBranch, adminOnly: false },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAdmin } = useUser();

  const visibleNav = nav.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">MemAI</h1>
          <p className="text-xs text-gray-500 mt-1">Memory Platform</p>
        </div>

        <nav className="flex-1 px-3">
          {visibleNav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}

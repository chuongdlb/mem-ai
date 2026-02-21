import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Copy, Trash2, Plus, Play, Archive } from "lucide-react";

interface Pat {
  id: string;
  name: string;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface RetentionPolicy {
  id: string;
  resource: string;
  days: number;
  enabled: boolean;
  updatedAt: string;
}

interface RetentionStats {
  [resource: string]: { active: number; archived: number };
}

const RESOURCE_LABELS: Record<string, string> = {
  session_events: "Session Events",
  memory_versions: "Memory Versions",
  audit_logs: "Audit Logs",
};

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<Pat[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [editingDays, setEditingDays] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<User>("/api/v1/auth/me").then(setUser).catch(() => {});
    loadTokens();
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      loadPolicies();
      loadStats();
    }
  }, [user]);

  function loadTokens() {
    api.get<Pat[]>("/api/v1/auth/tokens").then(setTokens).catch(() => {});
  }

  function loadPolicies() {
    api.get<RetentionPolicy[]>("/api/v1/admin/retention").then((p) => {
      setPolicies(p);
      const days: Record<string, string> = {};
      for (const policy of p) {
        days[policy.resource] = String(policy.days);
      }
      setEditingDays(days);
    }).catch(() => {});
  }

  function loadStats() {
    api.get<RetentionStats>("/api/v1/admin/retention/stats").then(setStats).catch(() => {});
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post<Pat & { token: string }>("/api/v1/auth/tokens", {
      name: newTokenName,
    });
    setCreatedToken(res.token);
    setNewTokenName("");
    loadTokens();
  }

  async function deleteToken(id: string) {
    await api.delete(`/api/v1/auth/tokens/${id}`);
    loadTokens();
  }

  async function updatePolicy(resource: string, updates: { days?: number; enabled?: boolean }) {
    await api.patch(`/api/v1/admin/retention/${resource}`, updates);
    loadPolicies();
  }

  async function handleDaysBlur(resource: string) {
    const days = parseInt(editingDays[resource]);
    if (!isNaN(days) && days >= 1 && days <= 3650) {
      await updatePolicy(resource, { days });
    }
  }

  async function runCleanup() {
    setRunningCleanup(true);
    try {
      await api.post("/api/v1/admin/retention/run");
      loadStats();
    } finally {
      setRunningCleanup(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* Profile */}
      {user && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Profile</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Name:</span> {user.name}</p>
            <p><span className="text-gray-500">Email:</span> {user.email}</p>
            <p><span className="text-gray-500">Role:</span> {user.role}</p>
          </div>
        </div>
      )}

      {/* Personal Access Tokens */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Personal Access Tokens</h3>
        <p className="text-sm text-gray-500 mb-4">
          Use tokens to authenticate the MCP server with your agent CLI.
        </p>

        {createdToken && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800 mb-2">Token created. Copy it now — it won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-green-100 px-2 py-1 rounded flex-1 break-all">{createdToken}</code>
              <button
                onClick={() => navigator.clipboard.writeText(createdToken)}
                className="p-1 text-green-600 hover:text-green-800"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={createToken} className="flex gap-2 mb-4">
          <input
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="Token name (e.g. Claude Code)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
          <button type="submit" className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Plus size={16} />
            Create
          </button>
        </form>

        <div className="space-y-2">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <span className="text-sm font-medium text-gray-900">{t.name}</span>
                <p className="text-xs text-gray-400">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt && ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => deleteToken(t.id)}
                className="p-2 text-gray-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Retention (admin only) */}
      {user?.role === "admin" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Archive size={18} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Data Retention</h3>
            </div>
            <button
              onClick={runCleanup}
              disabled={runningCleanup}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm hover:bg-amber-100 disabled:opacity-50"
            >
              <Play size={14} />
              {runningCleanup ? "Running..." : "Run Now"}
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Configure how long high-volume data is retained before being archived.
          </p>

          <div className="space-y-3">
            {policies.map((policy) => (
              <div key={policy.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {RESOURCE_LABELS[policy.resource] || policy.resource}
                    </span>
                    {stats && stats[policy.resource] && (
                      <span className="text-xs text-gray-400">
                        {stats[policy.resource].active.toLocaleString()} active
                        {stats[policy.resource].archived > 0 && (
                          <> · {stats[policy.resource].archived.toLocaleString()} archived</>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={editingDays[policy.resource] ?? policy.days}
                      onChange={(e) =>
                        setEditingDays((prev) => ({
                          ...prev,
                          [policy.resource]: e.target.value,
                        }))
                      }
                      onBlur={() => handleDaysBlur(policy.resource)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policy.enabled}
                      onChange={(e) =>
                        updatePolicy(policy.resource, { enabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

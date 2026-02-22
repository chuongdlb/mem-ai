import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { GitBranch, RefreshCw, Trash2, Plus, AlertCircle, Loader2 } from "lucide-react";

interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
}

interface ConnectedRepo {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  isActive: boolean;
  lastSyncedAt?: string;
  memoryFiles?: Array<{ id: string; filePath: string; agentType?: string }>;
}

export default function ReposPage() {
  const [connected, setConnected] = useState<ConnectedRepo[]>([]);
  const [available, setAvailable] = useState<GithubRepo[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnected();
  }, []);

  function loadConnected() {
    setLoading(true);
    setError(null);
    api
      .get<ConnectedRepo[]>("/api/v1/repos")
      .then(setConnected)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function loadAvailable() {
    setShowConnect(true);
    setLoadingAvailable(true);
    try {
      const repos = await api.get<GithubRepo[]>("/api/v1/repos/available");
      const connectedIds = new Set(connected.map((c) => c.fullName));
      setAvailable(repos.filter((r) => !connectedIds.has(r.fullName)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingAvailable(false);
    }
  }

  async function connectRepo(repo: GithubRepo) {
    try {
      await api.post("/api/v1/repos/connect", {
        githubRepoId: repo.id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
      });
      setShowConnect(false);
      loadConnected();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function syncRepo(id: string) {
    try {
      await api.post(`/api/v1/repos/${id}/sync`);
      loadConnected();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function disconnectRepo(id: string) {
    if (!confirm("Are you sure you want to disconnect this repo? The webhook will be removed.")) return;
    try {
      await api.delete(`/api/v1/repos/${id}`);
      loadConnected();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Connected Repos</h2>
        <button
          onClick={loadAvailable}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} />
          Connect Repo
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">x</button>
        </div>
      )}

      {showConnect && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Select a Repository</h3>
          {loadingAvailable ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Loading your repos...
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {available.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => connectRepo(repo)}
                  className="w-full text-left flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <GitBranch size={16} className="text-gray-400" />
                    <span className="text-sm font-medium">{repo.fullName}</span>
                    {repo.private && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">private</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading...
        </div>
      )}

      {!loading && connected.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
          No repos connected yet. Click "Connect Repo" to get started.
        </div>
      )}

      <div className="space-y-4">
        {connected.map((repo) => (
          <div key={repo.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitBranch size={18} className="text-gray-400" />
                <span className="font-semibold text-gray-900">{repo.fullName}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => syncRepo(repo.id)}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                  title="Re-sync"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  onClick={() => disconnectRepo(repo.id)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  title="Disconnect"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {repo.lastSyncedAt && (
              <p className="text-xs text-gray-400 mb-3">
                Last synced: {new Date(repo.lastSyncedAt).toLocaleString()}
              </p>
            )}

            {repo.memoryFiles && repo.memoryFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {repo.memoryFiles.map((f) => (
                  <span key={f.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {f.filePath} {f.agentType && `(${f.agentType})`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

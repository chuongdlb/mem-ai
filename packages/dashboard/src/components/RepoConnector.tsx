import { useState } from "react";
import { api } from "../lib/api.js";
import { GitBranch, Check } from "lucide-react";

interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
}

export default function RepoConnector({
  onConnected,
}: {
  onConnected: () => void;
}) {
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<number | null>(null);

  async function loadRepos() {
    setLoading(true);
    try {
      const r = await api.get<GithubRepo[]>("/api/v1/repos/available");
      setRepos(r);
    } finally {
      setLoading(false);
    }
  }

  async function connect(repo: GithubRepo) {
    setConnecting(repo.id);
    try {
      await api.post("/api/v1/repos/connect", {
        githubRepoId: repo.id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
      });
      onConnected();
    } finally {
      setConnecting(null);
    }
  }

  if (repos.length === 0) {
    return (
      <button
        onClick={loadRepos}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? "Loading..." : "Browse Repos"}
      </button>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {repos.map((repo) => (
        <div key={repo.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-gray-400" />
            <span className="text-sm">{repo.fullName}</span>
          </div>
          <button
            onClick={() => connect(repo)}
            disabled={connecting === repo.id}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
          >
            {connecting === repo.id ? "..." : "Connect"}
          </button>
        </div>
      ))}
    </div>
  );
}

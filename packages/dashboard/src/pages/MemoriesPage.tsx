import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { AlertCircle, Loader2 } from "lucide-react";

interface Memory {
  id: string;
  title: string;
  content: string;
  category: string;
  sourceAgent?: string;
  tags: string[];
  isPinned: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  function loadMemories() {
    setLoading(true);
    setError(null);
    api
      .get<Memory[]>("/api/v1/memories")
      .then(setMemories)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) {
      loadMemories();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await api.post<Memory[]>("/api/v1/memories/search", { query: search });
      setMemories(results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this memory? This cannot be undone.")) return;
    try {
      await api.delete(`/api/v1/memories/${id}`);
      setSelected(null);
      loadMemories();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Memories</h2>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            Search
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
          <Loader2 size={16} className="animate-spin" />
          Loading...
        </div>
      )}

      {!loading && !error && memories.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
          {search ? "No memories match your search" : "No memories yet"}
        </div>
      )}

      {!loading && memories.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* List */}
          <div className="lg:col-span-1 space-y-2">
            {memories.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selected?.id === m.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">{m.title}</span>
                  {m.isPinned && <span className="text-xs text-amber-500">pinned</span>}
                </div>
                <div className="flex gap-1">
                  <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{m.category}</span>
                  {m.sourceAgent && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{m.sourceAgent}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{selected.title}</h3>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex gap-2 mb-4">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{selected.category}</span>
                  {selected.sourceAgent && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{selected.sourceAgent}</span>
                  )}
                  <span className="text-xs text-gray-400">v{selected.version}</span>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selected.content}
                </pre>
                {selected.tags.length > 0 && (
                  <div className="flex gap-1 mt-4">
                    {selected.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
                Select a memory to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { AlertCircle, Loader2 } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description?: string;
  members?: Array<{ user: { id: string; name: string; email: string } }>;
  createdAt: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  function loadGroups() {
    setLoading(true);
    setError(null);
    api
      .get<Group[]>("/api/v1/groups")
      .then(setGroups)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/v1/groups", { name, description });
      setName("");
      setDescription("");
      setShowCreate(false);
      loadGroups();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Groups</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          New Group
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              Create
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading...
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
          No groups yet
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">{group.name}</h3>
            {group.description && <p className="text-sm text-gray-500 mt-1">{group.description}</p>}
            <div className="mt-3 flex gap-2 flex-wrap">
              {group.members?.map((m) => (
                <span key={m.user.id} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                  {m.user.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

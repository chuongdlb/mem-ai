import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

interface Session {
  id: string;
  agentType: string;
  title?: string;
  summary?: string;
  startedAt: string;
  endedAt?: string;
  events?: Array<{
    id: string;
    eventType: string;
    content: string;
    createdAt: string;
  }>;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);

  useEffect(() => {
    api.get<Session[]>("/api/v1/sessions").then(setSessions).catch(() => {});
  }, []);

  async function viewSession(id: string) {
    const session = await api.get<Session>(`/api/v1/sessions/${id}`);
    setSelected(session);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sessions</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => viewSession(s.id)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                selected?.id === s.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {s.title || s.agentType}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.endedAt ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"
                }`}>
                  {s.endedAt ? "ended" : "active"}
                </span>
              </div>
              <p className="text-xs text-gray-400">{new Date(s.startedAt).toLocaleString()}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {selected.title || selected.agentType}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {new Date(selected.startedAt).toLocaleString()}
                {selected.endedAt && ` — ${new Date(selected.endedAt).toLocaleString()}`}
              </p>
              {selected.summary && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-4">{selected.summary}</p>
              )}
              <div className="space-y-2">
                {selected.events?.map((e) => (
                  <div key={e.id} className="flex gap-3 text-sm">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded shrink-0">
                      {e.eventType}
                    </span>
                    <span className="text-gray-700">{e.content}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
              Select a session to view events
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

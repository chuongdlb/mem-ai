import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";

interface Project {
  id: string;
  name: string;
  description?: string;
  group?: { name: string };
  memories?: Array<{ id: string; title: string; category: string; updatedAt: string }>;
  sessions?: Array<{ id: string; agentType: string; startedAt: string; endedAt?: string }>;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (id) {
      api.get<Project>(`/api/v1/projects/${id}`).then(setProject).catch(() => {});
    }
  }, [id]);

  if (!project) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
      {project.description && <p className="text-gray-500 mt-1">{project.description}</p>}
      {project.group && (
        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 mt-2 inline-block">
          {project.group.name}
        </span>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Memories */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Memories ({project.memories?.length || 0})</h3>
          <div className="space-y-2">
            {project.memories?.map((m) => (
              <div key={m.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{m.title}</span>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{m.category}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{new Date(m.updatedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Sessions ({project.sessions?.length || 0})</h3>
          <div className="space-y-2">
            {project.sessions?.map((s) => (
              <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{s.agentType}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.endedAt ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"
                  }`}>
                    {s.endedAt ? "ended" : "active"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{new Date(s.startedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

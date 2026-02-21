import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

interface AuditEntry {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    api.get<AuditEntry[]>("/api/v1/admin/audit").then(setEntries).catch(() => {});
  }, []);

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-4 text-sm py-2 border-b border-gray-100">
          <span className="text-xs text-gray-400 shrink-0">
            {new Date(entry.createdAt).toLocaleString()}
          </span>
          <span className="font-medium text-gray-700">{entry.action}</span>
          <span className="text-gray-500">{entry.resourceType}</span>
          {entry.resourceId && (
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
              {entry.resourceId.slice(0, 8)}
            </code>
          )}
        </div>
      ))}
    </div>
  );
}

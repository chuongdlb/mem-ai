import { useState } from "react";
import { api } from "../lib/api.js";

interface ShareDialogProps {
  memoryId: string;
  onClose: () => void;
}

export default function ShareDialog({ memoryId, onClose }: ShareDialogProps) {
  const [userId, setUserId] = useState("");
  const [level, setLevel] = useState("read");

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/v1/memories/share", {
      memoryId,
      sharedWithUserId: userId,
      level,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Share Memory</h3>
        <form onSubmit={handleShare} className="space-y-4">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID to share with"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="read">Read only</option>
            <option value="write">Read & Write</option>
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              Share
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

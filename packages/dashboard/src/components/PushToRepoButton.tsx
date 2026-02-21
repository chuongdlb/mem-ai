import { useState } from "react";
import { api } from "../lib/api.js";
import { Upload } from "lucide-react";

export default function PushToRepoButton({
  repoId,
  memoryId,
  filePath,
}: {
  repoId: string;
  memoryId: string;
  filePath: string;
}) {
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState(false);

  async function handlePush() {
    setPushing(true);
    try {
      await api.post(`/api/v1/repos/${repoId}/push`, { memoryId, filePath });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setPushing(false);
    }
  }

  return (
    <button
      onClick={handlePush}
      disabled={pushing}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        done
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      <Upload size={14} />
      {pushing ? "Pushing..." : done ? "Pushed!" : "Push to Repo"}
    </button>
  );
}

import { useState } from "react";
import { api } from "../lib/api.js";
import { Download } from "lucide-react";

const FORMATS = [
  { value: "claude-md", label: "Claude MD" },
  { value: "gemini-md", label: "Gemini MD" },
  { value: "cursorrules", label: "Cursor Rules" },
  { value: "json", label: "JSON" },
  { value: "report", label: "Report" },
];

export default function ExportButton({ projectId }: { projectId: string }) {
  const [format, setFormat] = useState("claude-md");

  async function handleExport() {
    const content = await api.post<string>("/api/v1/export", {
      projectId,
      format,
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export.${format === "json" ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        {FORMATS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
      >
        <Download size={16} />
        Export
      </button>
    </div>
  );
}

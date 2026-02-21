import { GitBranch } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">MemAI</h1>
          <p className="text-gray-500 text-sm mt-2">
            AI Agent Memory Platform
          </p>
        </div>

        <div className="space-y-3">
          <a
            href={`${API_URL}/api/v1/auth/github`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <GitBranch size={18} />
            Continue with GitHub
          </a>

          <a
            href={`${API_URL}/api/v1/auth/google`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Continue with Google
          </a>
        </div>
      </div>
    </div>
  );
}

export class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // Auth
  async validateToken(): Promise<{ id: string; email: string; role: string }> {
    return this.request("GET", "/api/v1/auth/validate");
  }

  // Memories
  async listMemories(params?: {
    projectId?: string;
    category?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.projectId) query.set("projectId", params.projectId);
    if (params?.category) query.set("category", params.category);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.request<any[]>("GET", `/api/v1/memories${qs ? `?${qs}` : ""}`);
  }

  async getMemory(id: string) {
    return this.request<any>("GET", `/api/v1/memories/${id}`);
  }

  async createMemory(data: {
    projectId: string;
    title: string;
    content: string;
    category?: string;
    sourceAgent?: string;
    tags?: string[];
  }) {
    return this.request<any>("POST", "/api/v1/memories", data);
  }

  async updateMemory(
    id: string,
    data: { title?: string; content?: string; category?: string; tags?: string[]; isPinned?: boolean }
  ) {
    return this.request<any>("PATCH", `/api/v1/memories/${id}`, data);
  }

  async deleteMemory(id: string) {
    return this.request<void>("DELETE", `/api/v1/memories/${id}`);
  }

  async searchMemories(data: {
    query: string;
    projectId?: string;
    category?: string;
    limit?: number;
  }) {
    return this.request<any[]>("POST", "/api/v1/memories/search", data);
  }

  async getSharedMemories() {
    return this.request<any[]>("GET", "/api/v1/memories/shared");
  }

  // Sessions
  async createSession(data: {
    projectId: string;
    agentType: string;
    title?: string;
  }) {
    return this.request<any>("POST", "/api/v1/sessions", data);
  }

  async addSessionEvent(data: {
    sessionId: string;
    eventType: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request<any>("POST", "/api/v1/sessions/events", data);
  }

  async endSession(id: string, summary?: string) {
    return this.request<any>("POST", `/api/v1/sessions/${id}/end`, { summary });
  }

  // Projects
  async getProject(id: string) {
    return this.request<any>("GET", `/api/v1/projects/${id}`);
  }
}

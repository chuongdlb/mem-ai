import type { EmbeddingProviderInterface } from "./types.js";

export class OllamaProvider implements EmbeddingProviderInterface {
  readonly name = "ollama";
  readonly model: string;
  private readonly url: string;

  constructor() {
    this.url = process.env.OLLAMA_URL || "http://localhost:11434";
    this.model = process.env.EMBEDDING_MODEL || "nomic-embed-text";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${this.url}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama embedding failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings[0];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

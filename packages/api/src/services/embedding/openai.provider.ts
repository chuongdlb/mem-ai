import { EMBEDDING_DIMENSION } from "@memai/shared";
import type { EmbeddingProviderInterface } from "./types.js";

export class OpenAIProvider implements EmbeddingProviderInterface {
  readonly name = "openai";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai");
    }
    this.apiKey = apiKey;
    this.baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    this.model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        dimensions: EMBEDDING_DIMENSION,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embedding failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0].embedding;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Lightweight check — list models with a short timeout
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

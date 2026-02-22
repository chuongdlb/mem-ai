import type { EmbeddingProviderInterface } from "./types.js";

export class NoneProvider implements EmbeddingProviderInterface {
  readonly name = "none";
  readonly model = "none";

  async generateEmbedding(_text: string): Promise<number[]> {
    throw new Error("Embedding generation is disabled (EMBEDDING_PROVIDER=none)");
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

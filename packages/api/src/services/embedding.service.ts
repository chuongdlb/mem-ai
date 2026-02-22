import type { EmbeddingProvider } from "@memai/shared";
import { EMBEDDING_PROVIDERS } from "@memai/shared";
import type { EmbeddingProviderInterface } from "./embedding/types.js";
import { OllamaProvider } from "./embedding/ollama.provider.js";
import { OpenAIProvider } from "./embedding/openai.provider.js";
import { NoneProvider } from "./embedding/none.provider.js";

function createProvider(): EmbeddingProviderInterface {
  const raw = process.env.EMBEDDING_PROVIDER || "ollama";
  if (!EMBEDDING_PROVIDERS.includes(raw as EmbeddingProvider)) {
    throw new Error(
      `Invalid EMBEDDING_PROVIDER "${raw}". Must be one of: ${EMBEDDING_PROVIDERS.join(", ")}`
    );
  }
  const name = raw as EmbeddingProvider;

  switch (name) {
    case "ollama":
      return new OllamaProvider();
    case "openai":
      return new OpenAIProvider();
    case "none":
      return new NoneProvider();
  }
}

let _provider: EmbeddingProviderInterface | undefined;

function getProvider(): EmbeddingProviderInterface {
  if (!_provider) {
    _provider = createProvider();
  }
  return _provider;
}

// ─── Public API (backward-compatible + new) ──────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  return getProvider().generateEmbedding(text);
}

/** @deprecated Use isEmbeddingAvailable() instead */
export async function isOllamaAvailable(): Promise<boolean> {
  return getProvider().isAvailable();
}

export async function isEmbeddingAvailable(): Promise<boolean> {
  return getProvider().isAvailable();
}

export function isEmbeddingEnabled(): boolean {
  return getProvider().name !== "none";
}

export function getProviderName(): string {
  return getProvider().name;
}

export function getProviderModel(): string {
  return getProvider().model;
}

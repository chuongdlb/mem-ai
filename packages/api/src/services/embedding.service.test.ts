import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the facade's provider selection logic by mocking env vars
describe("embedding service — provider selection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("defaults to ollama when EMBEDDING_PROVIDER is not set", async () => {
    delete process.env.EMBEDDING_PROVIDER;
    const mod = await import("./embedding.service.js");
    expect(mod.getProviderName()).toBe("ollama");
  });

  it('selects none provider when EMBEDDING_PROVIDER=none', async () => {
    process.env.EMBEDDING_PROVIDER = "none";
    const mod = await import("./embedding.service.js");
    expect(mod.getProviderName()).toBe("none");
    expect(mod.isEmbeddingEnabled()).toBe(false);
  });

  it('isEmbeddingEnabled returns true for ollama', async () => {
    process.env.EMBEDDING_PROVIDER = "ollama";
    const mod = await import("./embedding.service.js");
    expect(mod.isEmbeddingEnabled()).toBe(true);
  });

  it("none provider throws on generateEmbedding", async () => {
    process.env.EMBEDDING_PROVIDER = "none";
    const mod = await import("./embedding.service.js");
    await expect(mod.generateEmbedding("test")).rejects.toThrow("disabled");
  });

  it("none provider isAvailable returns true", async () => {
    process.env.EMBEDDING_PROVIDER = "none";
    const mod = await import("./embedding.service.js");
    await expect(mod.isEmbeddingAvailable()).resolves.toBe(true);
  });

  it("getProviderModel returns 'none' for none provider", async () => {
    process.env.EMBEDDING_PROVIDER = "none";
    const mod = await import("./embedding.service.js");
    expect(mod.getProviderModel()).toBe("none");
  });
});

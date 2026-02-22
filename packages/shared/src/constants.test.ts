import { describe, it, expect } from "vitest";
import {
  AGENT_TYPES,
  MEMORY_CATEGORIES,
  SESSION_EVENT_TYPES,
  EXPORT_FORMATS,
  ROLES,
  SHARE_LEVELS,
  EMBEDDING_DIMENSION,
  EMBEDDING_PROVIDERS,
} from "./constants.js";

describe("constants", () => {
  it("AGENT_TYPES includes expected agents", () => {
    expect(AGENT_TYPES).toContain("claude-code");
    expect(AGENT_TYPES).toContain("gemini-cli");
    expect(AGENT_TYPES).toContain("cursor");
    expect(AGENT_TYPES.length).toBe(6);
  });

  it("MEMORY_CATEGORIES includes expected categories", () => {
    expect(MEMORY_CATEGORIES).toContain("architecture");
    expect(MEMORY_CATEGORIES).toContain("other");
    expect(MEMORY_CATEGORIES.length).toBe(7);
  });

  it("SESSION_EVENT_TYPES includes expected types", () => {
    expect(SESSION_EVENT_TYPES).toContain("message");
    expect(SESSION_EVENT_TYPES).toContain("error");
    expect(SESSION_EVENT_TYPES.length).toBe(5);
  });

  it("EXPORT_FORMATS includes all formats", () => {
    expect(EXPORT_FORMATS).toContain("claude-md");
    expect(EXPORT_FORMATS).toContain("skill-md");
    expect(EXPORT_FORMATS).toContain("json");
    expect(EXPORT_FORMATS.length).toBe(6);
  });

  it("ROLES has student and admin", () => {
    expect(ROLES).toEqual(["student", "admin"]);
  });

  it("SHARE_LEVELS has read and write", () => {
    expect(SHARE_LEVELS).toEqual(["read", "write"]);
  });

  it("EMBEDDING_DIMENSION is 768", () => {
    expect(EMBEDDING_DIMENSION).toBe(768);
  });

  it("EMBEDDING_PROVIDERS includes ollama, openai, none", () => {
    expect(EMBEDDING_PROVIDERS).toEqual(["ollama", "openai", "none"]);
  });
});

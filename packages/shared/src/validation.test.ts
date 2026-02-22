import { describe, it, expect } from "vitest";
import {
  createPatSchema,
  createMemorySchema,
  updateMemorySchema,
  searchMemoriesSchema,
  shareMemorySchema,
  createSessionSchema,
  createSessionEventSchema,
  exportSchema,
  connectRepoSchema,
  createGroupSchema,
  createProjectSchema,
  updateRetentionPolicySchema,
} from "./validation.js";

describe("createPatSchema", () => {
  it("accepts valid input", () => {
    const result = createPatSchema.parse({ name: "Test Token" });
    expect(result.name).toBe("Test Token");
  });

  it("accepts optional expiresInDays", () => {
    const result = createPatSchema.parse({ name: "Token", expiresInDays: 30 });
    expect(result.expiresInDays).toBe(30);
  });

  it("rejects empty name", () => {
    expect(() => createPatSchema.parse({ name: "" })).toThrow();
  });

  it("rejects name exceeding 100 chars", () => {
    expect(() => createPatSchema.parse({ name: "a".repeat(101) })).toThrow();
  });

  it("rejects non-positive expiresInDays", () => {
    expect(() => createPatSchema.parse({ name: "Token", expiresInDays: 0 })).toThrow();
    expect(() => createPatSchema.parse({ name: "Token", expiresInDays: -1 })).toThrow();
  });
});

describe("createMemorySchema", () => {
  const valid = {
    projectId: "550e8400-e29b-41d4-a716-446655440000",
    title: "Test Memory",
    content: "Some content",
  };

  it("accepts valid input with defaults", () => {
    const result = createMemorySchema.parse(valid);
    expect(result.category).toBe("other");
    expect(result.tags).toEqual([]);
  });

  it("accepts all categories", () => {
    for (const cat of ["architecture", "convention", "decision", "preference", "snippet", "context", "other"]) {
      const result = createMemorySchema.parse({ ...valid, category: cat });
      expect(result.category).toBe(cat);
    }
  });

  it("rejects invalid category", () => {
    expect(() => createMemorySchema.parse({ ...valid, category: "invalid" })).toThrow();
  });

  it("rejects empty title", () => {
    expect(() => createMemorySchema.parse({ ...valid, title: "" })).toThrow();
  });

  it("rejects title exceeding 500 chars", () => {
    expect(() => createMemorySchema.parse({ ...valid, title: "a".repeat(501) })).toThrow();
  });

  it("rejects non-UUID projectId", () => {
    expect(() => createMemorySchema.parse({ ...valid, projectId: "not-a-uuid" })).toThrow();
  });

  it("accepts valid agent types", () => {
    for (const agent of ["claude-code", "gemini-cli", "cursor", "kilo-code", "opencode", "generic"]) {
      const result = createMemorySchema.parse({ ...valid, sourceAgent: agent });
      expect(result.sourceAgent).toBe(agent);
    }
  });

  it("rejects more than 20 tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(() => createMemorySchema.parse({ ...valid, tags })).toThrow();
  });
});

describe("updateMemorySchema", () => {
  it("accepts partial updates", () => {
    expect(updateMemorySchema.parse({ title: "New Title" }).title).toBe("New Title");
    expect(updateMemorySchema.parse({ isPinned: true }).isPinned).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateMemorySchema.parse({});
    expect(result).toEqual({});
  });
});

describe("searchMemoriesSchema", () => {
  it("accepts valid search with defaults", () => {
    const result = searchMemoriesSchema.parse({ query: "test" });
    expect(result.limit).toBe(20);
  });

  it("rejects empty query", () => {
    expect(() => searchMemoriesSchema.parse({ query: "" })).toThrow();
  });

  it("enforces limit range 1-100", () => {
    expect(() => searchMemoriesSchema.parse({ query: "test", limit: 0 })).toThrow();
    expect(() => searchMemoriesSchema.parse({ query: "test", limit: 101 })).toThrow();
    expect(searchMemoriesSchema.parse({ query: "test", limit: 100 }).limit).toBe(100);
  });
});

describe("shareMemorySchema", () => {
  const memoryId = "550e8400-e29b-41d4-a716-446655440000";
  const userId = "660e8400-e29b-41d4-a716-446655440000";

  it("accepts share with user", () => {
    const result = shareMemorySchema.parse({ memoryId, sharedWithUserId: userId });
    expect(result.level).toBe("read");
  });

  it("rejects without user or group", () => {
    expect(() => shareMemorySchema.parse({ memoryId })).toThrow();
  });

  it("accepts write level", () => {
    const result = shareMemorySchema.parse({ memoryId, sharedWithUserId: userId, level: "write" });
    expect(result.level).toBe("write");
  });
});

describe("createSessionSchema", () => {
  it("accepts valid session", () => {
    const result = createSessionSchema.parse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      agentType: "claude-code",
    });
    expect(result.agentType).toBe("claude-code");
  });

  it("rejects invalid agent type", () => {
    expect(() =>
      createSessionSchema.parse({
        projectId: "550e8400-e29b-41d4-a716-446655440000",
        agentType: "invalid-agent",
      })
    ).toThrow();
  });
});

describe("createSessionEventSchema", () => {
  it("accepts valid event", () => {
    const result = createSessionEventSchema.parse({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      eventType: "message",
      content: "Hello",
    });
    expect(result.eventType).toBe("message");
  });

  it("accepts all event types", () => {
    for (const type of ["message", "tool_call", "file_edit", "decision", "error"]) {
      expect(() =>
        createSessionEventSchema.parse({
          sessionId: "550e8400-e29b-41d4-a716-446655440000",
          eventType: type,
          content: "test",
        })
      ).not.toThrow();
    }
  });
});

describe("exportSchema", () => {
  it("accepts valid export", () => {
    const result = exportSchema.parse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      format: "claude-md",
    });
    expect(result.format).toBe("claude-md");
  });

  it("accepts all formats", () => {
    for (const fmt of ["claude-md", "gemini-md", "cursorrules", "skill-md", "json", "report"]) {
      expect(() =>
        exportSchema.parse({
          projectId: "550e8400-e29b-41d4-a716-446655440000",
          format: fmt,
        })
      ).not.toThrow();
    }
  });
});

describe("connectRepoSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = connectRepoSchema.parse({
      githubRepoId: 12345,
      owner: "user",
      name: "repo",
      fullName: "user/repo",
    });
    expect(result.defaultBranch).toBe("main");
  });
});

describe("createGroupSchema", () => {
  it("accepts valid group", () => {
    const result = createGroupSchema.parse({ name: "Test Group" });
    expect(result.name).toBe("Test Group");
  });

  it("rejects empty name", () => {
    expect(() => createGroupSchema.parse({ name: "" })).toThrow();
  });
});

describe("createProjectSchema", () => {
  it("accepts valid project", () => {
    const result = createProjectSchema.parse({
      name: "Project",
      groupId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.name).toBe("Project");
  });

  it("rejects non-UUID groupId", () => {
    expect(() => createProjectSchema.parse({ name: "Project", groupId: "bad" })).toThrow();
  });
});

describe("updateRetentionPolicySchema", () => {
  it("accepts valid update", () => {
    const result = updateRetentionPolicySchema.parse({ days: 90, enabled: true });
    expect(result.days).toBe(90);
  });

  it("enforces days range 1-3650", () => {
    expect(() => updateRetentionPolicySchema.parse({ days: 0 })).toThrow();
    expect(() => updateRetentionPolicySchema.parse({ days: 3651 })).toThrow();
  });
});

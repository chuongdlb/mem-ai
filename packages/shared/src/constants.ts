export const MEMORY_FILE_PATTERNS = [
  { path: "CLAUDE.md", agent: "claude-code" },
  { path: ".claude/CLAUDE.md", agent: "claude-code" },
  { path: "GEMINI.md", agent: "gemini-cli" },
  { path: ".gemini/GEMINI.md", agent: "gemini-cli" },
  { path: ".cursorrules", agent: "cursor" },
  { path: ".kilocode/rules/**/*.md", agent: "kilo-code" },
  { path: "MEMORY.md", agent: "generic" },
  { path: "memory.md", agent: "generic" },
] as const;

export const AGENT_TYPES = [
  "claude-code",
  "gemini-cli",
  "cursor",
  "kilo-code",
  "opencode",
  "generic",
] as const;

export const MEMORY_CATEGORIES = [
  "architecture",
  "convention",
  "decision",
  "preference",
  "snippet",
  "context",
  "other",
] as const;

export const SESSION_EVENT_TYPES = [
  "message",
  "tool_call",
  "file_edit",
  "decision",
  "error",
] as const;

export const CHANGE_REASONS = [
  "manual_edit",
  "mcp_write",
  "repo_sync",
  "admin_edit",
] as const;

export const EXPORT_FORMATS = [
  "claude-md",
  "gemini-md",
  "cursorrules",
  "skill-md",
  "json",
  "report",
] as const;

export const ROLES = ["student", "admin"] as const;

export const SHARE_LEVELS = ["read", "write"] as const;

export const EMBEDDING_DIMENSION = 768;

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { memories, projects } from "../db/schema.js";
import type { ExportFormat } from "@memai/shared";

export async function exportProjectMemories(
  projectId: string,
  format: ExportFormat
): Promise<string> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) throw new Error("Project not found");

  const projectMemories = await db.query.memories.findMany({
    where: eq(memories.projectId, projectId),
    orderBy: [memories.category, memories.createdAt],
  });

  switch (format) {
    case "claude-md":
      return formatClaudeMd(project.name, projectMemories);
    case "gemini-md":
      return formatGeminiMd(project.name, projectMemories);
    case "cursorrules":
      return formatCursorrules(projectMemories);
    case "skill-md":
      return formatSkillMd(project.name, projectMemories);
    case "json":
      return JSON.stringify(projectMemories, null, 2);
    case "report":
      return formatReport(project.name, projectMemories);
    default:
      return JSON.stringify(projectMemories, null, 2);
  }
}

function formatClaudeMd(
  projectName: string,
  mems: Array<{ title: string; content: string; category: string; tags: string[] }>
): string {
  let out = `# ${projectName}\n\n`;
  const grouped = groupByCategory(mems);
  for (const [category, items] of Object.entries(grouped)) {
    out += `## ${capitalize(category)}\n\n`;
    for (const m of items) {
      out += `### ${m.title}\n${m.content}\n\n`;
    }
  }
  return out;
}

function formatGeminiMd(
  projectName: string,
  mems: Array<{ title: string; content: string; category: string; tags: string[] }>
): string {
  let out = `# ${projectName} — Project Context\n\n`;
  for (const m of mems) {
    out += `- **${m.title}**: ${m.content}\n`;
  }
  return out;
}

function formatCursorrules(
  mems: Array<{ title: string; content: string; category: string }>
): string {
  let out = "";
  for (const m of mems) {
    out += `# ${m.title}\n${m.content}\n\n`;
  }
  return out;
}

function formatReport(
  projectName: string,
  mems: Array<{ title: string; content: string; category: string; tags: string[]; createdAt: Date }>
): string {
  let out = `# Memory Report: ${projectName}\n`;
  out += `Generated: ${new Date().toISOString()}\n`;
  out += `Total memories: ${mems.length}\n\n`;

  const grouped = groupByCategory(mems);
  for (const [category, items] of Object.entries(grouped)) {
    out += `## ${capitalize(category)} (${items.length})\n\n`;
    for (const m of items) {
      out += `### ${m.title}\n${m.content}\n\n`;
    }
  }
  return out;
}

function formatSkillMd(
  projectName: string,
  mems: Array<{ title: string; content: string; category: string; tags: string[] }>
): string {
  let out = `# ${projectName} — Skill Knowledge\n\n`;
  const grouped = groupByCategory(mems);
  for (const [category, items] of Object.entries(grouped)) {
    out += `## ${capitalize(category)}\n\n`;
    for (const m of items) {
      const tagStr = m.tags?.length ? ` [${m.tags.join(", ")}]` : "";
      out += `### ${m.title}${tagStr}\n${m.content}\n\n`;
    }
  }
  return out;
}

function groupByCategory<T extends { category: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    (groups[item.category] ??= []).push(item);
  }
  return groups;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

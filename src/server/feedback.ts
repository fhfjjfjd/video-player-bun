import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FeedbackItem, FeedbackStatus, FeedbackType } from "../types";

/**
 * Feedback storage — one Markdown file per suggestion, stored in the
 * `feedback/` folder (overridable via `FEEDBACK_DIR`). Each file carries a
 * small YAML frontmatter block:
 *
 *   ---
 *   id: <uuid>
 *   type: feature|bug|other
 *   title: <single-line title>
 *   status: open|closed
 *   created_at: <ISO timestamp>
 *   author: <username or empty>
 *   ---
 *   <free-form description>
 *
 * Files with `status: open` are still actionable; `status: closed` items are
 * done and must not be edited. The agent edits the file to flip status after
 * implementing a suggestion.
 */
export const FEEDBACK_DIR = process.env.FEEDBACK_DIR ?? path.join(process.cwd(), "feedback");

mkdirSync(FEEDBACK_DIR, { recursive: true });

export const FEEDBACK_TYPES: FeedbackType[] = ["feature", "bug", "other"];

export const MAX_TITLE_LENGTH = 100;
export const MAX_BODY_LENGTH = 2000;

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "item"
  );
}

function fileName(item: Pick<FeedbackItem, "id" | "title">): string {
  return `${new Date().toISOString().slice(0, 10)}-${item.id.slice(0, 8)}-${slug(item.title)}.md`;
}

function toMarkdown(item: FeedbackItem): string {
  return [
    "---",
    `id: ${item.id}`,
    `type: ${item.type}`,
    `title: ${item.title}`,
    `status: ${item.status}`,
    `created_at: ${item.created_at}`,
    `author: ${item.author ?? ""}`,
    "---",
    "",
    item.body,
    "",
  ].join("\n");
}

function parseItem(raw: string): FeedbackItem | null {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.trimStart());
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    fields[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }

  const id = fields.id;
  const type = fields.type;
  const title = fields.title;
  const status = fields.status;
  const created_at = fields.created_at;
  if (!id || !title || !created_at) return null;
  if (!FEEDBACK_TYPES.includes(type as FeedbackType)) return null;
  if (status !== "open" && status !== "closed") return null;

  return {
    id,
    type: type as FeedbackType,
    title,
    status: status as FeedbackStatus,
    created_at,
    author: fields.author || undefined,
    body: match[2].trim(),
  };
}

export function listFeedback(): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  for (const entry of readdirSync(FEEDBACK_DIR)) {
    if (!entry.endsWith(".md")) continue;
    const raw = readFileSync(path.join(FEEDBACK_DIR, entry), "utf8");
    const item = parseItem(raw);
    if (item) items.push(item);
  }
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function createFeedback(input: {
  type: FeedbackType;
  title: string;
  body: string;
  author?: string;
}): FeedbackItem {
  const item: FeedbackItem = {
    id: crypto.randomUUID(),
    type: input.type,
    title: input.title,
    body: input.body,
    status: "open",
    created_at: new Date().toISOString(),
    author: input.author || undefined,
  };
  writeFileSync(path.join(FEEDBACK_DIR, fileName(item)), toMarkdown(item), "utf8");
  return item;
}

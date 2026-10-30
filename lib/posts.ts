/**
 * Sermon blog — sermon posts and question pages. Client-safe: types, labels,
 * the draft-file parser the import endpoint uses, the editor's form parser,
 * and the publish gate. Queries live in lib/posts-server.ts.
 */

export type PostKind = "sermon" | "question";
export type PostStatus = "idea" | "draft" | "needs_changes" | "published";

export const POST_KIND_LABEL: Record<PostKind, string> = {
  sermon: "Sermon post",
  question: "Question page",
};

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  idea: "Sermon idea",
  draft: "Ready for review",
  needs_changes: "Needs changes",
  published: "On the website",
};

/** Public path of a post. */
export function postPath(kind: PostKind, slug: string): string {
  return kind === "sermon" ? `/sermons/${slug}` : `/questions/${slug}`;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function wordCount(md: string): number {
  return md
    .replace(/[#>*_|`-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** "00:12:34" or "12:34" → seconds. */
export function parseTimestamp(value: string): number {
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) {
    throw new Error(`Not a timestamp: ${value}`);
  }
  return parts.map(Number).reduce((total, n) => total * 60 + n, 0);
}

/** Seconds → "12:34" (or "1:02:03" past an hour). */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ============================================================ draft files

export type DraftFile = {
  meta: Record<string, string>;
  body: string;
  notes: string;
};

/**
 * A draft written off-site: `---` front matter of `key: value` lines, a
 * markdown body, and an optional trailing `<!-- REVIEWER NOTES … -->` block.
 * The body's own `# Title` line is dropped — the page renders the title.
 */
export function parseDraftFile(text: string): DraftFile {
  const normalized = text.replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  if (!fm) throw new Error("Draft has no front matter block");

  const meta: Record<string, string> = {};
  for (const line of fm[1].split("\n")) {
    if (!line.trim()) continue;
    const m = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!m) throw new Error(`Bad front matter line: ${line}`);
    let value = m[2].trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    meta[m[1]] = value;
  }

  let rest = normalized.slice(fm[0].length);
  let notes = "";
  const notesMatch = /<!--\s*REVIEWER NOTES[^\n]*\n([\s\S]*?)-->\s*$/.exec(rest);
  if (notesMatch) {
    notes = notesMatch[1].trim();
    rest = rest.slice(0, notesMatch.index);
  }

  const body = rest
    .replace(/^\s*#\s+[^\n]*\n/, "")
    .replace(/\n-{3,}\s*$/, "")
    .trim();
  return { meta, body, notes };
}

// ============================================================ editor form

export type PostForm = {
  title: string;
  slug: string;
  description: string;
  question: string;
  body_md: string;
  reviewer_notes: string;
};

export type PostParse = { ok: true; value: PostForm } | { ok: false; error: string };

function text(form: Record<string, unknown>, name: string): string {
  const v = form[name];
  return typeof v === "string" ? v.trim() : "";
}

/** Validates an editor save. Saving never publishes, so only the shape is
 *  checked here — the publish gate holds the content rules. */
export function parsePostForm(kind: PostKind, form: Record<string, unknown>): PostParse {
  const value: PostForm = {
    title: text(form, "title"),
    slug: text(form, "slug"),
    description: text(form, "description"),
    question: text(form, "question"),
    body_md: text(form, "body_md"),
    reviewer_notes: text(form, "reviewer_notes"),
  };
  if (!value.title) return { ok: false, error: "Title is required." };
  if (value.title.length > 200) return { ok: false, error: "Title is too long (200 characters max)." };
  if (!SLUG_RE.test(value.slug) || value.slug.length > 80) {
    return { ok: false, error: "Web address must be lowercase words joined by dashes, like the-promise-of-heaven." };
  }
  if (kind === "question" && !value.question) return { ok: false, error: "Question is required." };
  if (value.description.length > 400) return { ok: false, error: "Search summary is too long." };
  if (value.body_md.length > 60000) return { ok: false, error: "Post is too long." };
  return { ok: true, value };
}

// ============================================================ pinning

/** Pinned posts each list page shows first, per kind. */
export const MAX_PINNED = 3;

/** Why a post can't be pinned, in plain language. Null = it can.
 *  `pinnedOthers` counts the other pinned posts of the same kind. */
export function pinProblem(kind: PostKind, status: PostStatus, pinnedOthers: number): string | null {
  if (status !== "published") return "Only a post that's on the website can be pinned.";
  if (pinnedOthers >= MAX_PINNED) {
    return `Only ${MAX_PINNED} ${kind === "sermon" ? "sermon posts" : "question pages"} can be pinned at once. Unpin one first.`;
  }
  return null;
}

// ============================================================ publish gate

export const TITLE_RANGE = { min: 30, max: 60 } as const;
export const DESCRIPTION_RANGE = { min: 120, max: 160 } as const;
export const MIN_WORDS: Record<PostKind, number> = { sermon: 500, question: 250 };

/** Text that marks something a person still has to check. */
const UNRESOLVED = /\bCONFIRM\b|\bTODO\b|\[C\d+\]|<!--/;

export type GateInput = {
  kind: PostKind;
  title: string;
  description: string;
  question: string;
  body_md: string;
  sermon: { preacher: string; title: string } | null;
};

/** Everything that blocks publishing, in plain language. Empty = ready. */
export function publishProblems(post: GateInput): string[] {
  const problems: string[] = [];
  const title = post.title.trim();
  if (title.length < TITLE_RANGE.min || title.length > TITLE_RANGE.max) {
    problems.push(`Title should be ${TITLE_RANGE.min}–${TITLE_RANGE.max} characters (now ${title.length}).`);
  }
  const description = post.description.trim();
  if (description.length < DESCRIPTION_RANGE.min || description.length > DESCRIPTION_RANGE.max) {
    problems.push(`Search summary should be ${DESCRIPTION_RANGE.min}–${DESCRIPTION_RANGE.max} characters (now ${description.length}).`);
  }
  const words = wordCount(post.body_md);
  if (words < MIN_WORDS[post.kind]) problems.push(`The post needs at least ${MIN_WORDS[post.kind]} words (now ${words}).`);
  if (/^#\s/m.test(post.body_md)) problems.push("Remove the top-level “# ” heading — the page already shows the title.");
  if (UNRESOLVED.test([post.title, post.description, post.question, post.body_md].join("\n"))) {
    problems.push("The post still has a CONFIRM, TODO or note marker in it.");
  }
  if (post.kind === "question" && !post.question.trim()) problems.push("A question page needs its question.");
  if (post.kind === "sermon") {
    if (!post.sermon) problems.push("Link the post to its sermon.");
    else if (!post.sermon.preacher.trim() || UNRESOLVED.test(post.sermon.preacher)) {
      problems.push("Confirm who preached this sermon on the Sermons page.");
    }
  }
  return problems;
}

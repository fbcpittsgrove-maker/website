/**
 * Minimal markdown renderer for roadmap content — headings, bold/italic,
 * inline code, links, images, lists (bulleted, numbered, one nested level),
 * paragraphs, tables, blockquote callouts. HTML is escaped BEFORE
 * transforming, so the only tags in the output are the ones this file emits.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code class="rounded bg-inset px-1 py-0.5 font-mono text-[0.9em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)\s]+|blob:[^)\s]+)\)/g,
      '<img src="$2" alt="$1" class="my-2 block h-auto max-h-[30rem] w-auto max-w-full rounded-lg border border-border object-contain" />',
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="font-medium text-brand hover:underline">$1</a>',
    );
}

type ListItem = {
  ordered: boolean;
  text: string;
  children: { ordered: boolean; text: string }[];
};

const wrapList = (ordered: boolean, inner: string, nested: boolean) => {
  const spacing = nested ? "mt-1 space-y-0.5 pl-4" : "my-2 space-y-1 pl-5";
  return ordered ? `<ol class="${spacing} list-decimal">${inner}</ol>` : `<ul class="${spacing} list-disc">${inner}</ul>`;
};

function runsOf<T extends { ordered: boolean }>(items: T[]): T[][] {
  const runs: T[][] = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    if (last && last[0].ordered === it.ordered) last.push(it);
    else runs.push([it]);
  }
  return runs;
}

function listHtml(items: ListItem[]): string {
  return runsOf(items)
    .map((run) =>
      wrapList(
        run[0].ordered,
        run
          .map((it) => {
            const kids = runsOf(it.children)
              .map((r) => wrapList(r[0].ordered, r.map((c) => `<li>${inline(c.text)}</li>`).join(""), true))
              .join("");
            return `<li>${inline(it.text)}${kids}</li>`;
          })
          .join(""),
        false,
      ),
    )
    .join("");
}

export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "section";

function toHtml(md: string): string {
  const lines = escapeHtml(md).split(/\r?\n/);
  const out: string[] = [];
  let list: ListItem[] | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p class="my-2 leading-relaxed">${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list?.length) out.push(listHtml(list));
    list = null;
  };
  let table: string[] | null = null;
  const flushTable = () => {
    if (!table?.length) {
      table = null;
      return;
    }
    const rows = table
      .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
    const header = rows[0];
    const body = rows.slice(1).filter((r) => !r.every((c) => /^:?-{3,}:?$/.test(c)));
    const th = (c: string) => `<th class="border border-border bg-inset px-2 py-1 text-left font-semibold">${inline(c)}</th>`;
    const td = (c: string) => `<td class="border border-border px-2 py-1 align-top">${inline(c)}</td>`;
    const bodyHtml = body.map((r) => `<tr>${r.map(td).join("")}</tr>`).join("");
    out.push(`<div class="my-3 overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr>${header.map(th).join("")}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`);
    table = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|.*\|$/.test(line) && line.includes("|")) {
      flushPara();
      flushList();
      table = table ?? [];
      table.push(line);
      continue;
    }
    if (table) flushTable();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const li = /^([ \t]*)([-*]|\d{1,3}\.)\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const cls =
        level === 1
          ? "font-display text-xl font-semibold mt-5 mb-2"
          : level === 2
            ? "font-display text-lg font-medium mt-4 mb-1.5"
            : "text-sm font-semibold mt-3 mb-1";
      out.push(`<h${level + 2} id="${headingId(h[2])}" class="${cls} scroll-mt-20">${inline(h[2])}</h${level + 2}>`);
    } else if (/^(---|\*\*\*)\s*$/.test(line)) {
      flushPara();
      flushList();
      out.push('<hr class="my-4 border-border" />');
    } else if (/^&gt;\s?/.test(line)) {
      flushPara();
      flushList();
      out.push(
        `<div class="my-3 rounded-lg border-l-4 border-brand bg-brand-soft px-3 py-2 leading-relaxed">${inline(line.replace(/^&gt;\s?/, ""))}</div>`,
      );
    } else if (li) {
      flushPara();
      list = list ?? [];
      const nested = li[1].length >= 2 || li[1].includes("\t");
      const ordered = li[2] !== "-" && li[2] !== "*";
      const text = li[3];
      const parent = list[list.length - 1];
      if (nested && parent) parent.children.push({ ordered, text });
      else list.push({ ordered, text, children: [] });
    } else {
      flushList();
      para.push(line);
    }
  }
  flushTable();
  flushPara();
  flushList();
  return out.join("");
}

export function Markdown({ md }: { md: string }) {
  return (
    <div className="break-words text-sm [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: toHtml(md) }} />
  );
}

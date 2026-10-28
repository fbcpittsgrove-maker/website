/**
 * Markdown renderer for public sermon posts and question pages — the
 * reading-typography sibling of lib/markdown.tsx (which stays the roadmap's).
 * Supports `##`/`###` headings, paragraphs, bold/italic, links (https or
 * site-relative), bulleted and numbered lists, `>` scripture/quote blocks and
 * `---` rules. HTML is escaped BEFORE transforming, so the only tags in the
 * output are the ones this file emits.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LINK = "font-semibold text-accent underline decoration-accent-line underline-offset-4 hover:decoration-accent";

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer" class="${LINK}">$1</a>`)
    .replace(/\[([^\]]+)\]\((\/(?!\/)[a-z0-9/#-]*)\)/g, `<a href="$2" class="${LINK}">$1</a>`);
}

export const articleHeadingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "section";

export function articleHtml(md: string): string {
  const lines = escapeHtml(md).split(/\r?\n/);
  const out: string[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(
        `<blockquote class="my-8 border-l-4 border-accent bg-accent-soft px-6 py-5 font-display text-xl leading-snug text-ink">${quote
          .map((q) => `<p>${inline(q)}</p>`)
          .join("")}</blockquote>`,
      );
    }
    quote = [];
  };
  const flushList = () => {
    if (list?.items.length) {
      const tag = list.ordered ? "ol" : "ul";
      const cls = list.ordered ? "list-decimal" : "list-disc";
      out.push(`<${tag} class="${cls} space-y-2 pl-6 marker:text-accent">${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${tag}>`);
    }
    list = null;
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const li = /^\s*([-*]|\d{1,3}\.)\s+(.*)$/.exec(line);
    const q = /^&gt;\s?(.*)$/.exec(line);
    if (!line.trim()) {
      flushAll();
    } else if (h) {
      flushAll();
      const tag = h[1].length === 3 ? "h3" : "h2";
      const cls =
        tag === "h2"
          ? "mt-12 scroll-mt-24 font-display text-3xl font-semibold leading-tight text-ink"
          : "mt-8 scroll-mt-24 text-lg font-semibold text-ink";
      out.push(`<${tag} id="${articleHeadingId(h[2])}" class="${cls}">${inline(h[2])}</${tag}>`);
    } else if (/^(---|\*\*\*)\s*$/.test(line)) {
      flushAll();
      out.push('<hr class="my-10 border-border" />');
    } else if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
    } else if (li) {
      flushPara();
      flushQuote();
      const ordered = li[1] !== "-" && li[1] !== "*";
      if (list && list.ordered !== ordered) flushList();
      list = list ?? { ordered, items: [] };
      list.items.push(li[2]);
    } else {
      flushQuote();
      flushList();
      para.push(line);
    }
  }
  flushAll();
  return out.join("");
}

export function ArticleMarkdown({ md }: { md: string }) {
  return (
    <div
      className="space-y-5 text-lg leading-relaxed text-text [overflow-wrap:anywhere]"
      dangerouslySetInnerHTML={{ __html: articleHtml(md) }}
    />
  );
}

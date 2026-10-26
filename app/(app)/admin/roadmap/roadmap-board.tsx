"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Markdown } from "@/lib/markdown";
import {
  ATTACH_MAX_FILES,
  attachProblem,
  ATTACH_LABEL,
} from "@/lib/attachments";
import type { RoadmapItem, RoadmapAttachment } from "@/lib/roadmap";
import {
  KINDS,
  PRIORITIES,
  STATUSES,
  STATUS_ORDER,
  KIND_LABEL,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type RoadmapKind,
  type RoadmapPriority,
  type RoadmapStatus,
} from "./constants";
import {
  commentOnRoadmapItem,
  createRoadmapItem,
  deleteAttachment,
  deleteRoadmapComment,
  deleteRoadmapItem,
  editRoadmapItemText,
  registerAttachment,
  requestAttachmentTicket,
  attachmentDownloadUrl,
  saveSectionCollapsed,
  saveSectionOrder,
  setRoadmapPin,
  updateRoadmapItem,
  voteOnRoadmapItem,
} from "./actions";
import { Dropdown } from "@/components/dropdown";

// ---------------------------------------------------------------- meta

const STATUS_META: Record<RoadmapStatus, { icon: string; tone: string }> = {
  requested: { icon: "◌", tone: "text-muted" },
  planned: { icon: "◇", tone: "text-brand" },
  building: { icon: "◍", tone: "text-signal" },
  on_dev: { icon: "▶", tone: "text-warn" },
  live: { icon: "✓", tone: "text-ok" },
  declined: { icon: "⊘", tone: "text-muted" },
};

const KIND_META: Record<RoadmapKind, { icon: string }> = {
  feature: { icon: "◆" },
  bug: { icon: "✕" },
  change: { icon: "⇄" },
};

const PRIORITY_RANK: Record<RoadmapPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

type RoadmapSort = "priority" | "modified" | "newest" | "oldest" | "discussed" | "wanted";
const SORTS: { value: RoadmapSort; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "modified", label: "Recently modified" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "discussed", label: "Most discussed" },
  { value: "wanted", label: "Most wanted" },
];

const BIG_SECTION = 8;

// ---------------------------------------------------------------- helpers

function isPinned(item: RoadmapItem): boolean {
  if (!item.pinnedAt) return false;
  if (!item.pinnedUntil) return true;
  return new Date(item.pinnedUntil).getTime() > Date.now();
}

function pinLeftLabel(item: RoadmapItem): string | null {
  if (!item.pinnedUntil || !item.pinnedAt) return null;
  const days = Math.ceil((new Date(item.pinnedUntil).getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? null : days === 1 ? "1d left" : `${days}d left`;
}

/** Latest touch of ANY kind — a status move, an edit, a note, an attachment.
 *  Drives the "recently modified" sort and the "updated" stamp. */
function lastActivity(item: RoadmapItem): string {
  const times = [item.updatedAt, item.createdAt];
  for (const c of item.comments) times.push(c.createdAt);
  for (const a of item.attachments) times.push(a.createdAt);
  return times.filter(Boolean).sort().pop() ?? item.createdAt;
}

function sinceLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ATTACH_LABEL[ext] ?? "FILE";
}

/** An item is "answered" when any comment is stamped after the dev update. */
function questionState(item: RoadmapItem): "awaiting" | "answered" | null {
  if (!item.devUpdate) return null;
  if (!item.devUpdateNeedsReply) return null;
  const answered = item.comments.some(
    (c) => new Date(c.createdAt).getTime() > new Date(item.devUpdateAt ?? 0).getTime(),
  );
  return answered ? "answered" : "awaiting";
}

function withInlineImages(md: string, resolve: (name: string) => string | null): string {
  return md.replace(/!\[([^\]]*)\]\((attach:[^)\s]+)\)/g, (_, alt: string, token: string) => {
    const name = token.slice("attach:".length);
    const url = resolve(name);
    return url ? `![${alt}](${url})` : `🖼️ ${name} (uploading…)`;
  });
}

function pastedImages(e: React.ClipboardEvent): File[] {
  return Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
}

function attachToken(name: string): string {
  return `![${name}](attach:${name})`;
}

function insertAtCursor(el: HTMLTextAreaElement | null, value: string, insert: string): string {
  if (!el) return `${value}${value && !value.endsWith("\n") ? "\n\n" : ""}${insert}`;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  return `${value.slice(0, start)}${insert}${value.slice(end)}`;
}

function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

async function sendFiles(
  itemId: string,
  files: File[],
  onProgress: (i: number, pct: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const ticket = await requestAttachmentTicket(itemId, { name: file.name, sizeBytes: file.size });
      if (!ticket.ok) return { ok: false, error: ticket.error };
      await uploadToSignedUrl(ticket.signedUrl, file, (pct) => onProgress(i, pct));
      const reg = await registerAttachment(itemId, {
        name: file.name,
        path: ticket.path,
        mimeType: file.type || null,
        sizeBytes: file.size,
      });
      if (!reg.ok) return { ok: false, error: reg.error };
      onProgress(i, 100);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Upload failed" };
    }
  }
  return { ok: true };
}

const inputCls =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const actionPill =
  "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

// ---------------------------------------------------------------- board

export function RoadmapBoard({
  items,
  isOwner,
  viewerKey,
  sectionOrder,
  savedCollapsed,
}: {
  items: RoadmapItem[];
  isOwner: boolean;
  viewerKey?: string;
  sectionOrder: string[];
  savedCollapsed: string[] | null;
}) {
  const [order, setOrder] = useState<RoadmapStatus[]>(() => {
    const saved = sectionOrder.filter((s): s is RoadmapStatus =>
      (STATUS_ORDER as readonly string[]).includes(s),
    );
    return [...saved, ...STATUS_ORDER.filter((s) => !saved.includes(s))];
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<RoadmapStatus>>(() => {
    if (savedCollapsed !== null) {
      return new Set(savedCollapsed.filter((s): s is RoadmapStatus =>
        (STATUS_ORDER as readonly string[]).includes(s),
      ));
    }
    const start = new Set<RoadmapStatus>(["live", "declined"]);
    const counts = new Map<RoadmapStatus, number>();
    for (const i of items) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
    for (const [s, n] of counts) if (n > BIG_SECTION) start.add(s);
    return start;
  });

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<RoadmapKind | "all">("all");
  const [priority, setPriority] = useState<RoadmapPriority | "all">("all");
  const [area, setArea] = useState("all");
  const [sort, setSort] = useState<RoadmapSort>("priority");
  const [jumpId, setJumpId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [showRequest, setShowRequest] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const clearJump = useCallback(() => setJumpId(null), []);

  const filtering = q.trim() !== "" || kind !== "all" || priority !== "all" || area !== "all";
  const activeFilters =
    (q.trim() ? 1 : 0) + (kind !== "all" ? 1 : 0) + (priority !== "all" ? 1 : 0) + (area !== "all" ? 1 : 0);

  const areas = useMemo(
    () => Array.from(new Set(items.map((i) => i.area))).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = items.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (priority !== "all" && i.priority !== priority) return false;
      if (area !== "all" && i.area !== area) return false;
      if (!needle) return true;
      return (
        i.title.toLowerCase().includes(needle) ||
        i.body.toLowerCase().includes(needle) ||
        (i.decisionNote?.toLowerCase().includes(needle) ?? false) ||
        (i.devUpdate?.toLowerCase().includes(needle) ?? false)
      );
    });
    const cmp: Record<RoadmapSort, (a: RoadmapItem, b: RoadmapItem) => number> = {
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.localeCompare(a.createdAt),
      modified: (a, b) => lastActivity(b).localeCompare(lastActivity(a)),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      discussed: (a, b) => b.comments.length - a.comments.length,
      wanted: (a, b) => b.votes.length - a.votes.length,
    };
    return rows.sort(cmp[sort]);
  }, [items, q, kind, priority, area, sort]);

  const pinnedItems = useMemo(
    () => items.filter(isPinned).sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "")),
    [items],
  );

  const attention = useMemo(() => {
    const rank = { answered: 0, awaiting: 1 };
    return visible
      .map((i) => ({ item: i, s: questionState(i) }))
      .filter((r): r is { item: RoadmapItem; s: "awaiting" | "answered" } => r.s !== null)
      .filter((r) => !isPinned(r.item))
      .sort(
        (a, b) =>
          rank[a.s] - rank[b.s] || (b.item.devUpdateAt ?? "").localeCompare(a.item.devUpdateAt ?? ""),
      );
  }, [visible]);

  const grouped = useMemo(() => {
    const g = new Map<RoadmapStatus, RoadmapItem[]>();
    for (const s of STATUS_ORDER) g.set(s, []);
    for (const i of visible) g.get(i.status)?.push(i);
    return g;
  }, [visible]);

  const waiting = attention.filter((r) => r.s === "awaiting").length;
  const answered = attention.length - waiting;

  const liveCount = items.filter((i) => i.status === "live").length;
  const accepted = items.filter((i) => i.status !== "declined").length;
  const moving = items.filter((i) => i.status === "building" || i.status === "on_dev").length;
  const pct = accepted === 0 ? 0 : Math.round((liveCount / accepted) * 100);
  const shipped = items
    .filter((i) => i.status === "live" && now - new Date(i.updatedAt).getTime() < 14 * 86_400_000)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const moveSection = (from: number, to: number) => {
    setDragIdx(null);
    setOverIdx(null);
    if (from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    void saveSectionOrder(next);
  };

  const setSectionOpen = (s: RoadmapStatus, open: boolean) => {
    const next = new Set(collapsed);
    if (open) next.delete(s);
    else next.add(s);
    setCollapsed(next);
    void saveSectionCollapsed([...next]);
  };

  const jumpTo = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target) setSectionOpen(target.status, true);
    if (filtering) {
      setQ("");
      setKind("all");
      setPriority("all");
      setArea("all");
    }
    setJumpId(id);
  };

  return (
    <div className="space-y-6">
      <ProgressBar pct={pct} live={liveCount} accepted={accepted} moving={moving} shipped={shipped} onJump={jumpTo} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowRequest((v) => !v)}
          aria-expanded={showRequest}
          className="inline-flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {showRequest ? "Close request" : "＋ Request a feature or bug"}
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {showFilters ? "Hide filters" : "Search & filters"}
          {activeFilters > 0 && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-deep">{activeFilters}</span>
          )}
        </button>
        <span className="ml-auto text-xs text-muted">
          {filtering ? `${visible.length} of ${items.length} shown` : `${items.length} items`}
        </span>
      </div>

      {showRequest && <RequestForm areas={areas} />}

      {showFilters && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the board…" className={`min-w-48 flex-1 ${inputCls}`} />
            <Dropdown
              value={sort}
              onChange={(v) => setSort(v as RoadmapSort)}
              ariaLabel="Sort by"
              options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              value={kind}
              onChange={(v) => setKind(v as RoadmapKind | "all")}
              ariaLabel="Filter by kind"
              active={kind !== "all"}
              options={[{ value: "all", label: "All kinds" }, ...KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))]}
            />
            <Dropdown
              value={priority}
              onChange={(v) => setPriority(v as RoadmapPriority | "all")}
              ariaLabel="Filter by priority"
              active={priority !== "all"}
              options={[{ value: "all", label: "Any priority" }, ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))]}
            />
            <Dropdown
              value={area}
              onChange={setArea}
              ariaLabel="Filter by area"
              active={area !== "all"}
              options={[{ value: "all", label: "Any area" }, ...areas.map((a) => ({ value: a, label: a }))]}
            />
            {filtering && (
              <button onClick={() => { setQ(""); setKind("all"); setPriority("all"); setArea("all"); }} className="rounded-lg px-2 py-1 text-sm font-medium text-muted hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {!visible.length && (
        <p className="rounded-xl border border-dashed border-border bg-inset px-4 py-8 text-center text-sm text-muted">
          Nothing matches — try a wider net.
        </p>
      )}

      {pinnedItems.length > 0 && (
        <section className="space-y-2 rounded-xl border border-brand-line bg-brand-soft p-3">
          <h2 className="px-1 font-display text-lg font-bold text-ink">📌 Pinned</h2>
          {pinnedItems.map((i) => (
            <PinnedCard key={i.id} item={i} isOwner={isOwner} />
          ))}
        </section>
      )}

      {attention.length > 0 && (
        <section className={`space-y-2 rounded-xl border p-3 ${waiting ? "border-warn-line bg-warn-soft" : "border-ok-line bg-ok-soft"}`}>
          <h2 className="px-1 font-display text-lg font-bold text-ink">
            🙋 Needs attention
            <span className="ml-2 text-sm font-normal text-muted">
              {waiting > 0 && `${waiting} waiting`}
              {waiting > 0 && answered > 0 && " · "}
              {answered > 0 && `${answered} answered`}
            </span>
          </h2>
          {attention.map((r) => (
            <ItemCard key={r.item.id} item={r.item} isOwner={isOwner} viewerKey={viewerKey} />
          ))}
        </section>
      )}

      {order.map((s, idx) => {
        const rows = grouped.get(s) ?? [];
        if (!rows.length) return null;
        const open = filtering || !collapsed.has(s);
        return (
          <section
            key={s}
            onDragOver={(e) => { if (dragIdx !== null) { e.preventDefault(); setOverIdx(idx); } }}
            onDragLeave={() => setOverIdx((v) => (v === idx ? null : v))}
            onDrop={(e) => { if (dragIdx !== null) { e.preventDefault(); moveSection(dragIdx, idx); } }}
            className={`space-y-2 ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "outline-2 outline-dashed outline-brand/50" : ""}`}
          >
            <div
              draggable
              onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              role="button"
              tabIndex={0}
              onClick={() => setSectionOpen(s, !open)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSectionOpen(s, !open); }
                else if (e.key === "ArrowUp" && idx > 0) { e.preventDefault(); moveSection(idx, idx - 1); }
                else if (e.key === "ArrowDown" && idx < order.length - 1) { e.preventDefault(); moveSection(idx, idx + 1); }
              }}
              aria-expanded={open}
              aria-label={`${STATUS_LABEL[s]} — ${rows.length} item${rows.length === 1 ? "" : "s"}. Arrow keys reorder.`}
              className="flex w-full cursor-grab items-center gap-2 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden className="select-none text-muted">⠿</span>
              <span aria-hidden className="text-muted transition-transform">{open ? "▾" : "▸"}</span>
              <h2 className={`font-display text-lg font-semibold ${STATUS_META[s].tone}`}>
                {STATUS_META[s].icon} {STATUS_LABEL[s]}
              </h2>
              <span className="text-sm text-muted">{rows.length}</span>
            </div>
            {open && (
              <div className="space-y-2 pl-2">
                {rows.map((i) => (
                  <ItemCard key={i.id} item={i} isOwner={isOwner} viewerKey={viewerKey} jumpId={jumpId} onJumped={clearJump} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- progress

function ProgressBar({
  pct, live, accepted, moving, shipped, onJump,
}: {
  pct: number;
  live: number;
  accepted: number;
  moving: number;
  shipped: RoadmapItem[];
  onJump: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs tracking-wide text-muted">
          <span className="text-ok">{live}</span> OF {accepted} LIVE
          {moving > 0 && <> · <span className="text-signal">{moving} IN MOTION</span></>}
        </p>
        <p className="font-display text-lg font-bold text-ok">{pct}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-inset">
        <div className="h-full rounded-full bg-action transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      {shipped.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ok">Just shipped</span>
          {shipped.slice(0, 5).map((i) => (
            <button key={i.id} onClick={() => onJump(i.id)} title={i.title} className="max-w-56 truncate rounded-full border border-ok-line bg-ok-soft px-2.5 py-0.5 text-xs text-ok hover:bg-ok-line/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {i.title}
            </button>
          ))}
          {shipped.length > 5 && <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">+{shipped.length - 5} more</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- intake

function RequestForm({ areas }: { areas: string[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<RoadmapKind>("feature");
  const [priority, setPriority] = useState<RoadmapPriority>("medium");
  const [area, setArea] = useState("");
  const [preview, setPreview] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stagedUrls = useMemo(() => new Map(files.map((f) => [f.name, URL.createObjectURL(f)])), [files]);
  useEffect(() => () => { for (const u of stagedUrls.values()) URL.revokeObjectURL(u); }, [stagedUrls]);

  const addFiles = (incoming: File[]) => {
    setMsg(null);
    const room = ATTACH_MAX_FILES - files.length;
    if (incoming.length > room) { setMsg(`Only ${room} more file${room === 1 ? "" : "s"} fit on one request.`); return; }
    for (const f of incoming) {
      const problem = attachProblem(f.name, f.size);
      if (problem) { setMsg(problem); return; }
    }
    setFiles((prev) => [...prev, ...incoming]);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = pastedImages(e);
    if (!imgs.length) return;
    e.preventDefault();
    addFiles(imgs);
    const tokens = imgs.map((f) => attachToken(f.name)).join("\n");
    setBody((b) => `${b}${b && !b.endsWith("\n") ? "\n\n" : ""}${tokens}`);
  };

  const file = () => {
    const clean = title.trim();
    if (!clean) return;
    setMsg(null);
    startTransition(async () => {
      const created = await createRoadmapItem({ title: clean, body, kind, priority, area });
      if (!created.ok) { setMsg(created.error); return; }
      if (files.length) {
        const sent = await sendFiles(created.id, files, (i, pct) => setProgress((p) => ({ ...p, [i]: pct })));
        if (!sent.ok) { setFiles([]); setProgress({}); setMsg(`Filed, but ${sent.error} Add the rest from its card below.`); return; }
      }
      setFiles([]); setProgress({}); setTitle(""); setBody(""); setArea("");
      window.location.reload();
    });
  };

  return (
    <div onPaste={onPaste} className="rounded-xl border border-border bg-surface p-5">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`w-full font-semibold ${inputCls}`} />
      {preview ? (
        <div className="mt-3 min-h-20 rounded-lg border border-border bg-inset px-3 py-2 [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1">
          <Markdown md={withInlineImages(body.trim() || "*Nothing to preview yet…*", (n) => stagedUrls.get(n) ?? null)} />
        </div>
      ) : (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What and why — paste screenshots right in" rows={3} className={`mt-3 w-full ${inputCls}`} />
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>**bold** · - bullet · 1. numbered · 2 spaces to nest</span>
        <button onClick={() => setPreview((v) => !v)} className="font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {preview ? "Keep writing" : "Preview"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Dropdown value={kind} onChange={(v) => setKind(v as RoadmapKind)} ariaLabel="Kind" options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        <Dropdown value={priority} onChange={(v) => setPriority(v as RoadmapPriority)} ariaLabel="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        <input value={area} onChange={(e) => setArea(e.target.value)} list="roadmap-areas" placeholder="Area (optional)" className={inputCls} />
        <button onClick={file} disabled={pending || !title.trim()} className="rounded-lg bg-action px-5 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {pending ? "Filing…" : "File it"}
        </button>
      </div>
      <FileDrop staged={files} progress={progress} slots={ATTACH_MAX_FILES - files.length} onAdd={addFiles} onRemove={(i) => setFiles((prev) => prev.filter((_, x) => x !== i))} disabled={pending} />
      {msg && <p className="mt-3 text-sm font-medium text-bad">{msg}</p>}
      <datalist id="roadmap-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
    </div>
  );
}

// ---------------------------------------------------------------- card

function ItemCard({
  item, isOwner, viewerKey, jumpId, onJumped,
}: {
  item: RoadmapItem;
  isOwner: boolean;
  viewerKey?: string;
  jumpId?: string | null;
  onJumped?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [bodyText, setBodyText] = useState(item.body ?? "");
  const [status, setStatus] = useState<RoadmapStatus>(item.status);
  const [priority, setPriority] = useState<RoadmapPriority>(item.priority);
  const [kind, setKind] = useState<RoadmapKind>(item.kind);
  const [area, setArea] = useState(item.area);
  const [note, setNote] = useState(item.decisionNote ?? "");
  const [devUpdate, setDevUpdate] = useState(item.devUpdate ?? "");
  const [devNeedsReply, setDevNeedsReply] = useState(item.devUpdateNeedsReply);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);

  const [seenJump, setSeenJump] = useState(jumpId);
  if (seenJump !== jumpId) {
    setSeenJump(jumpId);
    if (jumpId === item.id) {
      setExpanded(true);
      setFlash(true);
    }
  }

  useEffect(() => {
    if (jumpId !== item.id) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    onJumped?.();
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [jumpId, item.id, onJumped]);

  const question = questionState(item);
  const images = item.attachments.filter((a) => a.previewUrl);
  const resolveAttach = (name: string) => item.attachments.find((a) => a.fileName === name)?.previewUrl ?? null;

  const pasteScreenshots = (e: React.ClipboardEvent) => {
    const imgs = pastedImages(e);
    if (!imgs.length) return;
    e.preventDefault();
    const room = ATTACH_MAX_FILES - item.attachments.length;
    if (imgs.length > room) { setMsg(`Only ${room} more file${room === 1 ? "" : "s"} fit on this item.`); return; }
    if (editing) {
      const tokens = imgs.map((f) => attachToken(f.name)).join("\n");
      setBodyText((prev) => insertAtCursor(document.activeElement === bodyRef.current ? bodyRef.current : null, prev, tokens));
    }
    startTransition(async () => {
      const sent = await sendFiles(item.id, imgs, () => {});
      setMsg(sent.ok ? null : (sent.error ?? "Upload failed"));
      if (sent.ok) window.location.reload();
    });
  };

  const save = () =>
    startTransition(async () => {
      if (title.trim() !== item.title || bodyText.trim() !== (item.body ?? "")) {
        const res = await editRoadmapItemText(item.id, { title, body: bodyText });
        if (!res.ok) { setMsg(res.error); return; }
      }
      if (isOwner) {
        const res = await updateRoadmapItem(item.id, { status, priority, kind, area, decisionNote: note, devUpdate, devUpdateNeedsReply: devNeedsReply });
        if (!res.ok) { setMsg(res.error); return; }
      }
      setMsg(null); setEditing(false);
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteRoadmapItem(item.id);
      setMsg(res.ok ? null : res.error);
    });

  const vote = () =>
    startTransition(async () => {
      const res = await voteOnRoadmapItem(item.id);
      setMsg(res.ok ? null : res.error);
    });

  const quickStatus = (s: RoadmapStatus) =>
    startTransition(async () => {
      setStatus(s);
      const res = await updateRoadmapItem(item.id, { status: s, priority: item.priority, kind: item.kind, area: item.area, decisionNote: item.decisionNote ?? "", devUpdate: item.devUpdate ?? "", devUpdateNeedsReply: item.devUpdateNeedsReply });
      setMsg(res.ok ? null : res.error);
    });

  const myVote = item.votes.some((v) => v.voterKey === viewerKey);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onPaste={pasteScreenshots}
      className={`rounded-xl border bg-surface p-4 ${question === "awaiting" ? "border-warn-line ring-2 ring-warn/15" : question === "answered" ? "border-ok-line ring-2 ring-ok/15" : "border-border"} ${flash ? "ring-2 ring-ok/50" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span aria-hidden className="text-base leading-6" title={KIND_LABEL[item.kind]}>{KIND_META[item.kind].icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">{item.title}</div>
          {item.body && (
            <div role="button" tabIndex={0} aria-expanded={expanded} onClick={(e) => {
              const t = e.target as HTMLElement;
              if (t.tagName === "IMG") { const idx = images.findIndex((a) => a.previewUrl === (t as HTMLImageElement).src); if (idx >= 0) { setLightbox(idx); return; } }
              setExpanded((v) => !v);
            }} onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); }
            }} className="mt-1 w-full cursor-pointer rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <div className={`text-muted [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1 ${expanded ? "" : "line-clamp-2"}`}>
                <Markdown md={withInlineImages(item.body, resolveAttach)} />
              </div>
            </div>
          )}
          {item.decisionNote && !editing && (
            <div className="mt-2 rounded-lg border border-warn-line bg-warn-soft px-2.5 py-1.5 text-sm text-text [&_ol]:my-1 [&_p]:my-0 [&_ul]:my-1">
              <Markdown md={item.decisionNote} />
            </div>
          )}
          <div className="mt-2 text-xs text-muted">
            {item.area !== "general" && <span className="capitalize">{item.area} · </span>}
            {item.requestedBy ? `requested by ${item.requestedBy} · ` : ""}
            {new Date(item.createdAt).toLocaleDateString()}
            {lastActivity(item) > item.createdAt && ` · updated ${sinceLabel(lastActivity(item))}`}
            {isPinned(item) && " · 📌 pinned"}
          </div>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_RANK[priority] <= 1 ? "border-signal-line bg-signal-soft text-signal" : "border-border text-muted"}`}>
          {PRIORITY_LABEL[priority]}
        </span>
        {!editing && <button onClick={() => { setEditing(true); setTitle(item.title); setBodyText(item.body ?? ""); setKind(item.kind); setPriority(item.priority); setArea(item.area); setNote(item.decisionNote ?? ""); setDevUpdate(item.devUpdate ?? ""); setDevNeedsReply(item.devUpdateNeedsReply); }} className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Edit</button>}
        {isOwner && !editing && (
          <Dropdown value={status} onChange={(v) => quickStatus(v as RoadmapStatus)} ariaLabel="Status" disabled={pending} options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], dot: STATUS_META[s].icon }))} />
        )}
      </div>

      {!editing && <DevUpdateCallout item={item} />}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={vote} disabled={pending} title={item.votes.length ? `${item.votes.map((v) => v.voterName || "Someone").join(", ")} want this` : "Be the first to want this"} className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold disabled:opacity-60 ${myVote ? "border-brand bg-brand-soft text-brand-deep" : "border-border text-muted hover:border-brand hover:text-signal"}`}>
          👍 {item.votes.length}
        </button>
        <AttachmentRow item={item} isOwner={isOwner} editing={editing} expanded={expanded} onOpenImage={setLightbox} />
        <CommentThread item={item} isOwner={isOwner} startOpen={question === "answered"} />
        {isOwner && <PinMenu item={item} />}
      </div>
      {!editing && msg && <p className="mt-2 text-sm font-medium text-bad">{msg}</p>}
      {lightbox !== null && images[lightbox] && <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />}

      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`w-full font-semibold ${inputCls}`} />
          {preview ? (
            <div className="min-h-28 rounded-lg border border-border bg-inset px-3 py-2 [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1"><Markdown md={withInlineImages(bodyText.trim() || "*Nothing to preview yet…*", resolveAttach)} /></div>
          ) : (
            <textarea ref={bodyRef} value={bodyText} onChange={(e) => setBodyText(e.target.value)} placeholder="Describe it — what, why, where…" rows={6} className={`w-full ${inputCls}`} />
          )}
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>**bold** · - bullet · 1. numbered · 2 spaces to nest</span>
            <button onClick={() => setPreview((v) => !v)} className="font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{preview ? "Keep writing" : "Preview"}</button>
          </div>
          {isOwner && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Dropdown value={kind} onChange={(v) => setKind(v as RoadmapKind)} ariaLabel="Kind" options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
                <Dropdown value={status} onChange={(v) => setStatus(v as RoadmapStatus)} ariaLabel="Status" options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
                <Dropdown value={priority} onChange={(v) => setPriority(v as RoadmapPriority)} ariaLabel="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
                <input value={area} onChange={(e) => setArea(e.target.value)} list="roadmap-areas" placeholder="Area" className={inputCls} />
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Decision note — why parked, what's blocking, what shipped…" className={`w-full ${inputCls}`} />
              <textarea value={devUpdate} onChange={(e) => setDevUpdate(e.target.value)} rows={2} placeholder="🛠 Dev update — progress for the client, plain words…" className={`w-full border-l-4 ${devNeedsReply ? "border-l-warn" : "border-l-brand"} ${inputCls}`} />
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <input type="checkbox" checked={devNeedsReply} onChange={(e) => setDevNeedsReply(e.target.checked)} />
                🙋 This update asks a question — flag it for an answer
              </label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={save} disabled={pending || !title.trim()} className="rounded-lg bg-action px-4 py-1.5 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{pending ? "Saving…" : "Save"}</button>
            <button onClick={() => { setEditing(false); setConfirmDelete(false); }} className="px-3 py-1.5 text-sm font-medium text-muted hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Cancel</button>
            {isOwner && (
              <button onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))} disabled={pending} className={`ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${confirmDelete ? "bg-bad text-white" : "border border-bad-line bg-bad-soft text-bad"}`}>
                {confirmDelete ? "Really delete" : "Delete"}
              </button>
            )}
          </div>
          {msg && <p className="text-sm text-bad">{msg}</p>}
        </div>
      )}
    </div>
  );
}

function DevUpdateCallout({ item }: { item: RoadmapItem }) {
  if (!item.devUpdate) return null;
  const q = questionState(item);
  const tone = q === "answered"
    ? { panel: "border-l-ok bg-ok-soft", header: "text-ok", label: "✓ ANSWERED BELOW — THANK YOU" }
    : q === "awaiting"
      ? { panel: "border-l-warn bg-warn-soft", header: "text-warn", label: "🙋 WE NEED YOUR ANSWER" }
      : { panel: "border-l-brand bg-brand-soft", header: "text-brand-deep", label: "🛠 FROM THE DEV TEAM" };
  return (
    <div className={`mt-3 rounded-r-lg border-l-[6px] py-2.5 pl-4 pr-3 ${tone.panel}`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${tone.header}`}>
        {tone.label}
        {item.devUpdateAt && <span className="ml-2 font-semibold normal-case">· {new Date(item.devUpdateAt).toLocaleDateString()}</span>}
      </p>
      <div className="mt-1 text-sm text-text [&_ol]:my-1 [&_p]:my-0.5 [&_ul]:my-1"><Markdown md={item.devUpdate} /></div>
      {q === "awaiting" && <p className="mt-1.5 text-xs font-semibold text-warn">Reply with “Add a note” below 👇</p>}
    </div>
  );
}

function PinMenu({ item }: { item: RoadmapItem }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pinnedNow = isPinned(item);
  const set = (pinned: boolean, days: number | null) => {
    setOpen(false);
    startTransition(async () => {
      const res = await setRoadmapPin(item.id, { pinned, days });
      setMsg(res.ok ? null : res.error);
    });
  };

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button onClick={() => setOpen((v) => !v)} disabled={pending} aria-haspopup="menu" aria-expanded={open} className={pinnedNow ? "inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" : `${actionPill}`}>
        📌 {pinnedNow ? "Pinned" : "Pin"}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 z-30 mb-1.5 w-32 rounded-xl border border-border bg-surface p-1 shadow-lg">
          {[{ label: "1 day", days: 1 }, { label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "Always", days: null }].map((o) => (
            <button key={o.label} role="menuitem" onClick={() => set(true, o.days)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{o.label}</button>
          ))}
          {pinnedNow && <button role="menuitem" onClick={() => set(false, null)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-bad hover:bg-bad-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Unpin</button>}
        </div>
      )}
      {msg && <span className="absolute top-full right-0 mt-1 whitespace-nowrap text-xs font-medium text-bad">{msg}</span>}
    </div>
  );
}

function PinnedCard({ item, isOwner }: { item: RoadmapItem; isOwner: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unpin = () => startTransition(async () => {
    const res = await setRoadmapPin(item.id, { pinned: false, days: null });
    setMsg(res.ok ? null : res.error);
  });
  const left = pinLeftLabel(item);
  return (
    <div className="rounded-xl border border-brand-line bg-surface p-4">
      <div className="flex flex-wrap items-start gap-2">
        <span aria-hidden className="text-base leading-6">{KIND_META[item.kind].icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">{item.title}</div>
          {item.body && <div className="mt-1 text-muted [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1"><Markdown md={withInlineImages(item.body, (n) => item.attachments.find((a) => a.fileName === n)?.previewUrl ?? null)} /></div>}
        </div>
        <span className="rounded-full border border-brand-line bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-deep">📌 Pinned{left && ` · ${left}`}</span>
        {isOwner && <button onClick={unpin} disabled={pending} className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-inset">Unpin</button>}
      </div>
      <DevUpdateCallout item={item} />
      {msg && <p className="mt-2 text-sm font-medium text-bad">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- comments

function CommentThread({ item, isOwner, startOpen }: { item: RoadmapItem; isOwner: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => startTransition(async () => {
    const res = await commentOnRoadmapItem(item.id, text);
    if (!res.ok) { setMsg(res.error); return; }
    setText(""); setMsg(null);
  });

  const remove = (c: RoadmapItem["comments"][number]) => {
    const preview = c.body.length > 120 ? `${c.body.slice(0, 120)}…` : c.body;
    if (!window.confirm(`Delete this note by ${c.author ?? "Someone"}?\n\n"${preview}"`)) return;
    startTransition(async () => {
      const res = await deleteRoadmapComment(c.id);
      setMsg(res.ok ? null : res.error);
    });
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} className={actionPill}>💬 {item.comments.length ? `${item.comments.length} note${item.comments.length > 1 ? "s" : ""}` : "Add a note"}</button>;
  }

  return (
    <div className="w-full space-y-2 border-t border-border pt-3">
      {item.comments.map((c) => (
        <div key={c.id} className="group/note rounded-lg bg-inset px-2.5 py-1.5 text-sm">
          <div className="[&_ol]:my-1 [&_p]:my-0 [&_ul]:my-1"><Markdown md={c.body} /></div>
          <p className="mt-0.5 flex items-center text-xs text-muted">
            {c.author ?? "Someone"} · {new Date(c.createdAt).toLocaleDateString()}
            {isOwner && <button onClick={() => remove(c)} disabled={pending} title="Delete this note" aria-label="Delete this note" className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-1.5 font-semibold text-bad opacity-0 transition-opacity group-hover/note:opacity-100 focus-visible:opacity-100 hover:text-bad focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">✕</button>}
          </p>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.trim() && !pending) { e.preventDefault(); send(); } }} placeholder="Add a note… (Enter sends, Shift+Enter new line)" className={`w-full ${inputCls}`} />
        <button onClick={send} disabled={pending || !text.trim()} className="rounded-lg bg-action px-3 py-1.5 text-xs font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{pending ? "…" : "Post"}</button>
      </div>
      {msg && <p className="text-xs font-medium text-bad">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- attachments

function AttachmentRow({ item, isOwner, editing, expanded, onOpenImage }: { item: RoadmapItem; isOwner: boolean; editing: boolean; expanded: boolean; onOpenImage: (i: number) => void }) {
  const [adding, setAdding] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slots = ATTACH_MAX_FILES - item.attachments.length - files.length;

  const addFiles = (incoming: File[]) => {
    setMsg(null);
    if (incoming.length > slots) { setMsg(`Only ${slots} more file${slots === 1 ? "" : "s"} fit on this item.`); return; }
    for (const f of incoming) { const p = attachProblem(f.name, f.size); if (p) { setMsg(p); return; } }
    setFiles((prev) => [...prev, ...incoming]);
  };

  const upload = () => startTransition(async () => {
    const sent = await sendFiles(item.id, files, (i, pct) => setProgress((p) => ({ ...p, [i]: pct })));
    if (!sent.ok) { setMsg(sent.error ?? "Upload failed"); return; }
    setFiles([]); setProgress({}); setMsg(null); setAdding(false);
    window.location.reload();
  });

  if (!item.attachments.length && !adding) {
    return <button onClick={() => setAdding(true)} className={actionPill}>📎 Attach files</button>;
  }

  const images = item.attachments.filter((a) => a.previewUrl);
  const docs = item.attachments.filter((a) => !a.previewUrl);

  return (
    <div className="w-full space-y-2">
      {item.attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {images.map((a, i) => (
            <AttachmentThumb key={a.id} attachment={a} size={expanded ? "md" : "sm"} canRemove={isOwner && editing} onOpen={() => onOpenImage(i)} />
          ))}
          {docs.map((a) => (
            <AttachmentChip key={a.id} attachment={a} canRemove={isOwner && editing} />
          ))}
          {!adding && item.attachments.length < ATTACH_MAX_FILES && <button onClick={() => setAdding(true)} className={actionPill}>📎 Add</button>}
        </div>
      )}
      {adding && (
        <>
          <FileDrop staged={files} progress={progress} slots={slots} onAdd={addFiles} onRemove={(i) => setFiles((prev) => prev.filter((_, x) => x !== i))} disabled={pending} />
          <div className="flex items-center gap-2">
            <button onClick={() => { setAdding(false); setFiles([]); setProgress({}); setMsg(null); }} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-inset">Cancel</button>
            <button onClick={upload} disabled={pending || !files.length} className="rounded-full bg-action px-3 py-1.5 text-xs font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{pending ? "Uploading…" : "Upload"}</button>
          </div>
        </>
      )}
      {msg && <p className="text-xs font-medium text-bad">{msg}</p>}
    </div>
  );
}

function AttachmentChip({ attachment, canRemove }: { attachment: RoadmapAttachment; canRemove: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const download = () => startTransition(async () => {
    const res = await attachmentDownloadUrl(attachment.id);
    if (!res.ok) { setMsg(res.error); return; }
    setMsg(null);
    window.location.assign(res.url);
  });

  const remove = () => startTransition(async () => {
    const res = await deleteAttachment(attachment.id);
    if (!res.ok) setMsg(res.error);
  });

  return (
    <span className={`group inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2 pr-1 text-xs ${canRemove ? "border-border hover:border-bad" : "border-border"}`}>
      <button onClick={download} disabled={pending} title={`${attachment.fileName} · ${fmtSize(attachment.sizeBytes)}${attachment.uploadedBy ? ` · from ${attachment.uploadedBy}` : ""}`} className="inline-flex min-w-0 items-center gap-1.5 font-medium text-text hover:text-signal disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <span className="rounded bg-inset px-1 py-0.5 text-[10px] font-semibold text-muted">{fileIcon(attachment.fileName)}</span>
        <span className="max-w-40 truncate">{attachment.fileName}</span>
      </button>
      {canRemove && (confirming
        ? <button onClick={remove} disabled={pending} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full bg-bad px-1.5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">sure?</button>
        : <button onClick={() => setConfirming(true)} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-1 text-bad opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label={`Delete ${attachment.fileName}`}>✕</button>)}
      {msg && <span className="font-medium text-bad">{msg}</span>}
    </span>
  );
}

function AttachmentThumb({ attachment, size, canRemove, onOpen }: { attachment: RoadmapAttachment; size: "sm" | "md"; canRemove: boolean; onOpen: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const remove = () => startTransition(async () => {
    const res = await deleteAttachment(attachment.id);
    if (!res.ok) window.location.reload();
  });
  return (
    <span className="group relative inline-flex">
      <button onClick={onOpen} title={`${attachment.fileName} · ${fmtSize(attachment.sizeBytes)} — tap to view`} className={`overflow-hidden rounded-lg border transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${canRemove ? "border-border group-hover:border-bad" : "border-border"} ${size === "sm" ? "h-10 w-14" : "h-28 w-40"}`}>
        <Image
          src={attachment.previewUrl ?? ""}
          alt={attachment.fileName}
          width={size === "sm" ? 56 : 160}
          height={size === "sm" ? 40 : 112}
          unoptimized
          className="h-full w-full object-cover"
        />
      </button>
      {canRemove && (confirming
        ? <button onClick={remove} disabled={pending} className="absolute -top-1.5 -right-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-bad px-1.5 text-[10px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">sure?</button>
        : <button onClick={() => setConfirming(true)} aria-label={`Delete ${attachment.fileName}`} className="absolute -top-1.5 -right-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-bad px-1.5 text-[11px] text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">✕</button>)}
    </span>
  );
}

function FileDrop({ staged, progress, slots, onAdd, onRemove, disabled }: { staged: File[]; progress: Record<number, number>; slots: number; onAdd: (files: File[]) => void; onRemove: (i: number) => void; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(Array.from(e.dataTransfer.files)); }}
      className={`mt-3 rounded-lg border-2 border-dashed p-3 text-center text-xs text-muted transition-colors ${over ? "border-brand bg-brand-soft" : "border-border"}`}
    >
      <input type="file" multiple disabled={disabled || slots <= 0} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.heic,.txt,.md,.html,.eml,.zip" className="hidden" id={`file-${staged.length}-${slots}`} onChange={(e) => { onAdd(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <label htmlFor={`file-${staged.length}-${slots}`} className="cursor-pointer">Drop files or click to browse</label>
      {staged.length > 0 && (
        <ul className="mt-2 space-y-1 text-left">
          {staged.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-muted">{progress[i] ?? 0}%</span>
              <button onClick={() => onRemove(i)} disabled={disabled} aria-label={`Remove ${f.name}`} className="inline-flex min-h-9 min-w-9 items-center justify-center text-bad focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Lightbox({ images, index, onClose, onIndex }: { images: RoadmapAttachment[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const img = images[index];
  const many = images.length > 1;
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const prev = () => onIndex((index - 1 + images.length) % images.length);
  const next = () => onIndex((index + 1) % images.length);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      openerRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) next();
      else if (e.key === "ArrowLeft" && many) prev();
      else if (e.key === "Tab") {
        const els = Array.from(
          boxRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        );
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!img?.previewUrl) return null;
  return createPortal(
    <div ref={boxRef} role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-[100] flex flex-col bg-ink/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/90">
        <span className="min-w-0 truncate text-sm font-medium">{img.fileName}</span>
        <span className="flex shrink-0 items-center gap-3">
          {many && <span className="text-xs">{index + 1} / {images.length}</span>}
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">✕</button>
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {many && <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous image" className="absolute left-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">‹</button>}
        <Image src={img.previewUrl} alt={img.fileName} width={1600} height={1200} unoptimized onClick={(e) => e.stopPropagation()} className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain" />
        {many && <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next image" className="absolute right-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">›</button>}
      </div>
    </div>,
    document.body,
  );
}

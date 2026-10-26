"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveIssue } from "./actions";

type Issue = {
  id: string;
  environment: string;
  source: string;
  route: string | null;
  message: string;
  error_code: string | null;
  times_seen: number;
  last_seen_at: string;
  resolved_at: string | null;
};

/** Live tail: Realtime on app_issues (RLS scopes events to owners). */
export function IssuesList({ initial }: { initial: Issue[] }) {
  const [issues, setIssues] = useState<Issue[]>(initial);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("app_issues")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_issues" },
        (payload) => {
          setIssues((prev) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string })?.id;
              return prev.filter((i) => i.id !== id);
            }
            const row = payload.new as Issue;
            const rest = prev.filter((i) => i.id !== row.id);
            return [row, ...rest].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const open = issues.filter((i) => !i.resolved_at);

  if (open.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-ok-line bg-ok-soft px-5 py-4 text-sm text-ok">
        Nothing open. The log is quiet.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {open.map((issue) => (
        <li key={issue.id} className="rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-inset px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {issue.environment}
            </span>
            <span className="rounded-full bg-inset px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {issue.source}
            </span>
            {issue.route && (
              <span className="font-mono text-xs text-brand-deep">{issue.route}</span>
            )}
            {issue.error_code && (
              <span className="font-mono text-xs text-signal">{issue.error_code}</span>
            )}
            {issue.times_seen > 1 && (
              <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[10px] font-semibold text-signal">
                ×{issue.times_seen}
              </span>
            )}
            <span className="ml-auto text-xs text-muted">
              {new Date(issue.last_seen_at).toLocaleString()}
            </span>
          </div>
          <p className="mt-2 font-mono text-xs leading-relaxed text-text">{issue.message}</p>
          <button
            onClick={() =>
              startTransition(async () => {
                const res = await resolveIssue(issue.id);
                if (res.ok) router.refresh();
              })
            }
            disabled={pending}
            className="mt-2 rounded-lg border border-border-strong px-2 py-1 text-xs font-medium text-text hover:bg-inset disabled:opacity-50"
          >
            Resolve
          </button>
        </li>
      ))}
    </ul>
  );
}

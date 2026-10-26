"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PROD_ONLY_TABLES,
  diffMigrationLedgers,
  migrationProblem,
  type DriftRow,
  type Fingerprint,
  type MigrationEntry,
} from "@/lib/schema-fingerprint";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const label = "text-xs font-semibold tracking-wide uppercase";

function StatusChip({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-ok-line bg-ok-soft text-ok"
      : tone === "warn"
        ? "border-warn-line bg-warn-soft text-warn"
        : tone === "bad"
          ? "border-bad-line bg-bad-soft text-bad"
          : "border-border bg-inset text-muted";
  return (
    <span className={`${label} inline-flex items-center rounded-full border px-2.5 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}

function Section({
  title,
  chip,
  defaultOpen,
  children,
}: {
  title: string;
  chip: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span aria-hidden className={`text-muted transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
        <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
        <span className="ml-auto">{chip}</span>
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </section>
  );
}

export function DiagnosticsView({
  here,
  peer,
  peerError,
  drift,
}: {
  here: Fingerprint;
  peer: Fingerprint | null;
  peerError: string | null;
  drift: DriftRow[];
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const releasesMatch = Boolean(here.release_sha && peer?.release_sha === here.release_sha);

  const hereLedgerProblem = migrationProblem(here);
  const peerLedgerProblem = migrationProblem(peer);
  const ledgerDiff = useMemo(() => peer ? diffMigrationLedgers(here, peer) : null, [here, peer]);

  const envDiff = useMemo(() => {
    if (!here.env_keys) return [];
    const peerByKey = new Map((peer?.env_keys ?? []).map((k) => [k.key, k.set]));
    return here.env_keys.map((k) => ({
      key: k.key,
      here: k.set,
      peer: peer?.env_keys ? (peerByKey.get(k.key) ?? false) : null,
    }));
  }, [here.env_keys, peer?.env_keys]);

  const envProblems = envDiff.filter((k) => !k.here || k.peer === false).length;
  const mismatchProblems = (ledgerDiff?.mismatched.length ?? 0) + (ledgerDiff?.changed.length ?? 0);
  const ledgerProblems = (ledgerDiff?.hereOnly.length ?? 0) + (ledgerDiff?.peerOnly.length ?? 0);
  const rlsProblems =
    here.tables.filter((t) => !t.rls_enabled).length +
    (peer?.tables.filter((t) => !t.rls_enabled).length ?? 0);

  const syncProblems: string[] = [];
  if (!peer) syncProblems.push(peerError ?? "peer unreachable");
  if (peer && !releasesMatch) syncProblems.push("releases differ");
  if (hereLedgerProblem) syncProblems.push(`this environment: ${hereLedgerProblem}`);
  if (peer && peerLedgerProblem) syncProblems.push(`peer: ${peerLedgerProblem}`);
  if (drift.length) syncProblems.push(`${drift.length} schema difference${drift.length === 1 ? "" : "s"}`);
  if (ledgerProblems) syncProblems.push(`${ledgerProblems} one-sided migration${ledgerProblems === 1 ? "" : "s"}`);
  if (mismatchProblems) syncProblems.push(`${mismatchProblems} migration version/content difference${mismatchProblems === 1 ? "" : "s"}`);
  if (envProblems) syncProblems.push(`${envProblems} config key${envProblems === 1 ? "" : "s"} missing`);
  if (rlsProblems) syncProblems.push(`${rlsProblems} table${rlsProblems === 1 ? "" : "s"} without RLS`);

  const healthy = syncProblems.length === 0;
  const openIssues = (here.issues?.open ?? 0) + (peer?.issues?.open ?? 0);

  const envs: { label: string; fp: Fingerprint | null }[] = [
    { label: "This environment", fp: here },
    { label: "Peer environment", fp: peer },
  ];

  return (
    <div className="space-y-6">
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-5 ${
          healthy ? "border-ok-line bg-ok-soft" : "border-bad-line bg-bad-soft"
        }`}
      >
        <span aria-hidden className="text-2xl leading-none">
          {healthy ? "✓" : "✗"}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-display text-xl font-medium ${healthy ? "text-ok" : "text-bad"}`}>
            {healthy ? "Environments in sync" : "Environments apart"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {healthy
              ? `Schema, migrations, config and releases all match.${openIssues ? ` ${openIssues} open issue${openIssues === 1 ? "" : "s"} logged.` : ""}`
              : syncProblems.join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">checked {timeAgo(here.captured_at)}</span>
          <button
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={refreshing}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-inset disabled:opacity-50"
          >
            {refreshing ? "Checking…" : "↻ Re-check"}
          </button>
        </div>
      </div>

      <div className="relative grid gap-4 sm:grid-cols-2">
        <span
          aria-hidden
          className={`absolute top-1/2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-xs sm:inline ${
            healthy ? "border-ok-line bg-surface text-ok" : "border-bad-line bg-surface text-bad"
          }`}
        >
          {healthy ? "⇄" : "≠"}
        </span>
        {envs.map(({ label: envLabel, fp }) => (
          <div key={envLabel} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-medium text-ink">{envLabel}</h2>
              {fp && <StatusChip tone="muted">{fp.environment}</StatusChip>}
            </div>
            {fp ? (
              <dl className="mt-3 space-y-1.5 text-sm">
                {(
                  [
                    ["Release", fp.release_sha ?? "—", true],
                     ["Latest migration", fp.migrations?.[0]?.name ?? "—", false],
                     ["Migration count", fp.migration_total === undefined ? "Unverified" : String(fp.migration_total), true],
                    ["Tables", String(fp.tables.length), true],
                    ["Tables without RLS", String(fp.tables.filter((t) => !t.rls_enabled).length), true],
                    ["Open issues", fp.issues?.open != null ? String(fp.issues.open) : "—", true],
                    ["DB round-trip", fp.db_latency_ms !== undefined ? `${fp.db_latency_ms} ms` : "—", true],
                  ] as [string, string, boolean][]
                ).map(([dt, dd, mono]) => (
                  <div key={dt} className="flex items-center justify-between">
                    <dt className="text-muted">{dt}</dt>
                    <dd className={mono ? "font-mono text-xs" : "max-w-[60%] truncate text-right"}>
                      {dd}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-bad">
                {peerError ?? "Not configured — set SCHEMA_PEER_URL and SCHEMA_PEER_SECRET on both deployments."}
              </p>
            )}
          </div>
        ))}
      </div>

      <Section
        title="Schema drift"
        chip={
          !peer ? (
            <StatusChip tone="muted">peer unavailable</StatusChip>
          ) : drift.length === 0 ? (
            <StatusChip tone="ok">match</StatusChip>
          ) : (
            <StatusChip tone="bad">{drift.length} difference{drift.length === 1 ? "" : "s"}</StatusChip>
          )
        }
        defaultOpen={drift.length > 0}
      >
        {peer && drift.length === 0 && (
          <p className="px-5 py-5 text-sm text-muted">
            No differences. Schema, RLS, grants, functions and reference data all match — the
            roadmap tables ({PROD_ONLY_TABLES.join(", ")}) are excluded by design, they live in
            production only. That&apos;s the table-count gap between the two cards above.
          </p>
        )}
        {!peer && <p className="px-5 py-5 text-sm text-muted">Nothing to compare against.</p>}
        {drift.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">What</th>
                  <th className="px-3 py-2.5 font-medium">{here.environment}</th>
                  <th className="px-3 py-2.5 font-medium">{peer?.environment ?? "peer"}</th>
                </tr>
              </thead>
              <tbody>
                {drift.map((row) => (
                  <tr key={`${row.kind}:${row.key}`} className="border-t border-border align-top">
                    <td className="px-5 py-3">
                      <span className="font-medium text-ink">{row.key}</span>
                      <span className="ml-2 text-xs text-muted">{row.kind}</span>
                    </td>
                    {[row.here, row.there].map((side, i) => (
                      <td
                        key={i}
                        className={`max-w-64 px-3 py-3 ${
                          side === null || side === "EMPTY" ? "font-semibold text-bad" : "text-muted"
                        }`}
                      >
                        <span className="block break-words">{side ?? "missing"}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Migration ledger"
        chip={
          hereLedgerProblem || peerLedgerProblem ? (
            <StatusChip tone="bad">verification incomplete</StatusChip>
          ) : ledgerProblems + mismatchProblems === 0 ? (
            <StatusChip tone="ok">in step</StatusChip>
          ) : (
            <StatusChip tone="bad">
              {ledgerProblems + mismatchProblems} finding{ledgerProblems + mismatchProblems === 1 ? "" : "s"}
            </StatusChip>
          )
        }
        defaultOpen={!!hereLedgerProblem || !!peerLedgerProblem || ledgerProblems + mismatchProblems > 0}
      >
        {(hereLedgerProblem || peerLedgerProblem) && <div className="border-b border-border px-5 py-4 text-sm text-bad">
          {hereLedgerProblem && <p>This environment: {hereLedgerProblem}.</p>}
          {peerLedgerProblem && <p>Peer environment: {peerLedgerProblem}.</p>}
        </div>}
        {ledgerDiff && ledgerDiff.changed.length > 0 && <div className="border-b border-border px-5 py-4">
          <p className={`${label} text-bad`}>Stored migration contents differ</p>
          <p className="mt-0.5 text-xs text-muted">Digests cover stored statement arrays, not raw repository SQL files.</p>
          <ul className="mt-2 space-y-1 text-sm">{ledgerDiff.changed.map((m) => <li key={m.version} className="flex flex-wrap items-baseline gap-2">
            <code className="rounded bg-inset px-1 text-xs">{m.version}</code><span>{m.name}</span>
            <code title={m.here} className="text-xs">{m.here.slice(0, 12)}</code><span className="text-xs text-muted">vs</span>
            <code title={m.peer} className="text-xs">{m.peer.slice(0, 12)}</code>
          </li>)}</ul>
        </div>}
        {ledgerDiff && ledgerDiff.mismatched.length > 0 && (
          <div className="border-b border-border px-5 py-4">
            <p className={`${label} text-bad`}>Same migration, different version</p>
            <p className="mt-0.5 text-xs text-muted">
              A ledger renumbered away from the repo&apos;s filename — this is what silently halts
              the migration runner.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {ledgerDiff.mismatched.map((m) => (
                <li key={m.name} className="flex flex-wrap items-baseline gap-2">
                  <span className="min-w-0 font-medium text-ink">{m.name}</span>
                  <code className="rounded bg-inset px-1 text-xs">{m.here}</code>
                  <span className="text-xs text-muted">vs</span>
                  <code className="rounded bg-inset px-1 text-xs">{m.peer}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
        {ledgerDiff && ledgerProblems > 0 && (
          <div className="grid gap-4 border-b border-border px-5 py-4 sm:grid-cols-2">
            {[
              { label: `Only on ${here.environment}`, list: ledgerDiff.hereOnly },
              { label: `Only on ${peer?.environment ?? "peer"}`, list: ledgerDiff.peerOnly },
            ].map(({ label: sideLabel, list }) => (
              <div key={sideLabel}>
                <p className={`${label} text-bad`}>{sideLabel}</p>
                {list.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">none</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {list.map((m) => (
                      <li key={m.version} className="flex items-baseline gap-2">
                        <code className="rounded bg-inset px-1 text-xs">{m.version}</code>
                        <span className="min-w-0 truncate">{m.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {envs.map(({ label: envLabel, fp }) => (
            <div key={envLabel}>
              <p className={`${label} text-muted`}>{fp?.environment ?? envLabel}</p>
              {fp?.migration_total !== undefined && <p className="mt-1 text-xs text-muted">{fp.migration_total} migrations · showing newest 8</p>}
              {fp?.migrations ? (
                <ol className="mt-1.5 space-y-1 text-sm">
                  {fp.migrations.slice(0, 8).map((m: MigrationEntry) => (
                    <li key={m.version} className="flex items-baseline gap-2">
                      <code className="shrink-0 rounded bg-inset px-1 text-xs">{m.version}</code>
                      <span className="min-w-0 truncate" title={m.name}>{m.name}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1.5 text-sm text-muted">Ledger unavailable on this build.</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Open issues"
        chip={
          openIssues === 0 ? <StatusChip tone="ok">none</StatusChip> : <StatusChip tone="warn">{openIssues} open</StatusChip>
        }
        defaultOpen={openIssues > 0}
      >
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {envs.map(({ label: envLabel, fp }) => (
            <div key={envLabel}>
              <p className={`${label} text-muted`}>{fp?.environment ?? envLabel}</p>
              {!fp?.issues ? (
                <p className="mt-1.5 text-sm text-muted">No issue data from this build.</p>
              ) : fp.issues.recent.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted">Nothing open.</p>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {fp.issues.recent.map((issue, i) => (
                    <li key={i} className="rounded-lg bg-inset px-3 py-2 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-xs text-muted">{issue.route ?? "—"}</span>
                        <span className="shrink-0 text-xs text-muted">
                          ×{issue.times_seen} · {timeAgo(issue.last_seen_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-text">{issue.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Full history with resolve controls lives in{" "}
          <a href="/admin/issues" className="text-brand underline underline-offset-2">Issues</a>.
        </p>
      </Section>

      <Section
        title="Config"
        chip={
          envProblems === 0 ? (
            <StatusChip tone="ok">all keys present</StatusChip>
          ) : (
            <StatusChip tone="bad">{envProblems} missing</StatusChip>
          )
        }
        defaultOpen={envProblems > 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Key</th>
                <th className="px-3 py-2.5 font-medium">{here.environment}</th>
                <th className="px-3 py-2.5 font-medium">{peer?.environment ?? "peer"}</th>
              </tr>
            </thead>
            <tbody>
              {envDiff.map((k) => (
                <tr key={k.key} className="border-t border-border">
                  <td className="px-5 py-2 font-mono text-xs">{k.key}</td>
                  <td className={`px-3 py-2 ${k.here ? "text-ok" : "font-semibold text-bad"}`}>
                    {k.here ? "✓ set" : "✗ missing"}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      k.peer === null ? "text-muted" : k.peer ? "text-ok" : "font-semibold text-bad"
                    }`}
                  >
                    {k.peer === null ? "—" : k.peer ? "✓ set" : "✗ missing"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Presence only — values never leave their deployment.
        </p>
      </Section>
    </div>
  );
}

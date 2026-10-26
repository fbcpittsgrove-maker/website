import { createAdminClient } from "@/lib/supabase/admin";
import { environmentName, releaseSha } from "@/lib/issues";

/**
 * A structural snapshot of whatever database this instance points at.
 * Structure only — table names, RLS state, policy counts, column grants,
 * function names. Never row data.
 */

export type TableShape = { table: string; rls_enabled: boolean; policies: number; columns: number };
export type GrantShape = { table: string; privilege: string; columns: string };
export type ReferenceCount = { table: string; rows: number };
export type MigrationEntry = { version: string; name: string; statements_sha256?: string | null };
export const MIGRATION_DIGEST_ALGORITHM = "sha256-jsonb-statements-v1";
type MigrationLedger = { version: 1; total: number; complete: boolean; digestAlgorithm: string; entries: MigrationEntry[] };

export function parseMigrationLedger(value: unknown): MigrationLedger {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!record(value) || Object.keys(value).sort().join(",") !== "complete,digestAlgorithm,entries,total,version"
    || value.version !== 1 || typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0
    || typeof value.complete !== "boolean" || value.digestAlgorithm !== MIGRATION_DIGEST_ALGORITHM || !Array.isArray(value.entries)
    || value.entries.length > 10000 || value.entries.length > value.total || value.complete !== (value.entries.length === value.total)) {
    throw new Error("migration_ledger_invalid");
  }
  let previous: string | null = null;
  const entries = value.entries.map((entry): MigrationEntry => {
    if (!record(entry) || Object.keys(entry).sort().join(",") !== "name,statements_sha256,version"
      || typeof entry.version !== "string" || !/^\d{14}$/.test(entry.version) || (previous !== null && entry.version >= previous)
      || typeof entry.name !== "string" || !entry.name.length || entry.name.length > 256 || entry.name !== entry.name.trim() || /[\x00-\x1f\x7f]/.test(entry.name)
      || (entry.statements_sha256 !== null && (typeof entry.statements_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.statements_sha256)))) throw new Error("migration_ledger_invalid");
    previous = entry.version;
    return { version: entry.version, name: entry.name, statements_sha256: entry.statements_sha256 };
  });
  return { version: 1, total: value.total, complete: value.complete, digestAlgorithm: MIGRATION_DIGEST_ALGORITHM, entries };
}

async function migrationSnapshot(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  try {
    const result = await admin.rpc("migration_ledger_full");
    if (result.error) return { migration_error: "migration_ledger_unavailable" };
    const ledger = parseMigrationLedger(result.data);
    return { migrations: ledger.entries, migration_total: ledger.total, migrations_complete: ledger.complete,
      migration_digest_algorithm: ledger.digestAlgorithm,
      ...(!ledger.complete ? { migration_error: "migration_history_incomplete" } : {}) };
  } catch (error) {
    return { migration_error: error instanceof Error && error.message === "migration_ledger_invalid" ? error.message : "migration_ledger_unavailable" };
  }
}
export type IssueSummary = {
  open: number;
  recent: { route: string | null; message: string; times_seen: number; last_seen_at: string }[];
};
export type EnvKeyCheck = { key: string; set: boolean };

export type Fingerprint = {
  environment: string;
  release_sha: string | null;
  captured_at: string;
  tables: TableShape[];
  grants: GrantShape[];
  functions: string[];
  reference?: ReferenceCount[];
  migrations?: MigrationEntry[];
  migration_total?: number;
  migrations_complete?: boolean;
  migration_digest_algorithm?: string;
  migration_error?: string;
  issues?: IssueSummary;
  env_keys?: EnvKeyCheck[];
  db_latency_ms?: number;
  error?: string;
};

/** `exact` = SQL/seed-managed config that must match count-for-count.
 *  `nonempty` = client-editable content that grows in production — only
 *  alarming when one side was never seeded at all. Curate per app; update
 *  whenever a new seeded module lands. */
const REFERENCE_TABLES: { table: string; mode: "exact" | "nonempty" }[] = [
  { table: "email_settings", mode: "exact" },
];

/** The keys this app cannot run without. Presence only — values never leave
 *  the process. EMAIL_DEV_REDIRECT is absent on purpose (unset on production
 *  is the design). */
const CRITICAL_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_CANONICAL_SUPABASE_URL",
  "SCHEMA_PEER_URL",
  "SCHEMA_PEER_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "CRON_SECRET",
];

export async function captureFingerprint(): Promise<Fingerprint> {
  const base: Fingerprint = {
    environment: environmentName(),
    release_sha: releaseSha(),
    captured_at: new Date().toISOString(),
    tables: [],
    grants: [],
    functions: [],
    env_keys: CRITICAL_ENV_KEYS.map((key) => ({ key, set: Boolean(process.env[key]) })),
  };

  const admin = createAdminClient();
  if (!admin) return { ...base, error: "No service-role key configured." };

  try {
    const snapshotStarted = Date.now();
    const [{ data, error }, reference, migrations, issues] = await Promise.all([
      admin.rpc("schema_snapshot"),
      Promise.all(
        REFERENCE_TABLES.map(async ({ table }) => {
          const { count, error: cntErr } = await admin
            .from(table)
            .select("*", { count: "exact", head: true });
          return cntErr ? null : { table, rows: count ?? 0 };
        }),
      ).then((rows) => rows.filter((r): r is ReferenceCount => r !== null)),
      migrationSnapshot(admin),
      Promise.all([
        admin.from("app_issues").select("id", { count: "exact", head: true }).is("resolved_at", null),
        admin
          .from("app_issues")
          .select("route, message, times_seen, last_seen_at")
          .is("resolved_at", null)
          .order("last_seen_at", { ascending: false })
          .limit(5),
      ]).then(([{ count, error: cntErr }, { data: recent, error: recentErr }]) =>
        cntErr || recentErr
          ? undefined
          : {
              open: count ?? 0,
              recent: (recent ?? []).map((r) => ({
                route: r.route,
                message: String(r.message).slice(0, 200),
                times_seen: r.times_seen,
                last_seen_at: r.last_seen_at,
              })),
            },
      ),
    ]);
    if (error) return { ...base, error: error.message };
    return {
      ...base,
      ...(data as Omit<Fingerprint, keyof typeof base>),
      reference,
      ...migrations,
      issues,
      db_latency_ms: Date.now() - snapshotStarted,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "capture failed" };
  }
}

// ---------------------------------------------------------------- diffing

export type DriftRow = {
  key: string;
  kind: "table" | "grant" | "function" | "reference";
  here: string | null;
  there: string | null;
};

/** The roadmap board lives in the production database only (playbook §4) —
 *  its tables, grants and trigger function existing only on master is the
 *  design, not drift. */
const PROD_ONLY = /^(roadmap_(items|comments|attachments|votes)\b|touch_roadmap_item$)/;

export const PROD_ONLY_TABLES = [
  "roadmap_items",
  "roadmap_comments",
  "roadmap_attachments",
  "roadmap_votes",
] as const;

export function migrationProblem(fp: Fingerprint | null | undefined): string | null {
  if (!fp) return "migration ledger unavailable";
  if (fp.migration_error) return fp.migration_error;
  if (fp.migrations_complete !== true || fp.migration_total === undefined || fp.migration_digest_algorithm !== MIGRATION_DIGEST_ALGORITHM || !fp.migrations) return "complete migration ledger unavailable on this build";
  try {
    parseMigrationLedger({ version: 1, total: fp.migration_total, complete: fp.migrations_complete, digestAlgorithm: fp.migration_digest_algorithm, entries: fp.migrations });
  } catch {
    return "migration ledger invalid or incomplete";
  }
  if (fp.migrations.some((m) => !m.statements_sha256)) return "migration statement digests unavailable";
  return null;
}

export function diffMigrationLedgers(a: Fingerprint, b: Fingerprint) {
  if (migrationProblem(a) || migrationProblem(b)) return null;
  const here = a.migrations!;
  const peer = b.migrations!;
  const sanctioned = (m: MigrationEntry) => m.name.startsWith("roadmap_");
  const hereByVersion = new Map(here.map((m) => [m.version, m]));
  const peerByVersion = new Map(peer.map((m) => [m.version, m]));
  const peerByName = new Map(peer.map((m) => [m.name, m.version]));
  const mismatched = here.filter((m) => peerByName.has(m.name) && peerByName.get(m.name) !== m.version && !sanctioned(m))
    .map((m) => ({ name: m.name, here: m.version, peer: peerByName.get(m.name)! }));
  const mismatchNames = new Set(mismatched.map((m) => m.name));
  return {
    hereOnly: here.filter((m) => !peerByVersion.has(m.version) && !sanctioned(m) && !mismatchNames.has(m.name)),
    peerOnly: peer.filter((m) => !hereByVersion.has(m.version) && !sanctioned(m) && !mismatchNames.has(m.name)),
    mismatched,
    changed: here.filter((m) => {
      const other = peerByVersion.get(m.version);
      return other && !sanctioned(m) && (other.name !== m.name || other.statements_sha256 !== m.statements_sha256);
    }).map((m) => ({ version: m.version, name: m.name, here: m.statements_sha256!, peer: peerByVersion.get(m.version)!.statements_sha256! })),
  };
}

export function diffFingerprints(a: Fingerprint, b: Fingerprint): DriftRow[] {
  const rows: DriftRow[] = [];

  const describe = (t?: TableShape) =>
    t ? `rls ${t.rls_enabled ? "on" : "OFF"} · ${t.policies} policies · ${t.columns} cols` : null;

  const tableNames = new Set([...a.tables.map((t) => t.table), ...b.tables.map((t) => t.table)]);
  for (const name of [...tableNames].sort()) {
    if (PROD_ONLY.test(name)) continue;
    const here = a.tables.find((t) => t.table === name);
    const there = b.tables.find((t) => t.table === name);
    const h = describe(here);
    const t = describe(there);
    if (h !== t) rows.push({ key: name, kind: "table", here: h, there: t });
  }

  const grantKey = (g: GrantShape) => `${g.table} · ${g.privilege}`;
  const grantNames = new Set([...a.grants.map(grantKey), ...b.grants.map(grantKey)]);
  for (const name of [...grantNames].sort()) {
    if (PROD_ONLY.test(name)) continue;
    const h = a.grants.find((g) => grantKey(g) === name)?.columns ?? null;
    const t = b.grants.find((g) => grantKey(g) === name)?.columns ?? null;
    if (h !== t) rows.push({ key: name, kind: "grant", here: h, there: t });
  }

  const fnNames = new Set([...a.functions, ...b.functions]);
  for (const name of [...fnNames].sort()) {
    if (PROD_ONLY.test(name)) continue;
    const h = a.functions.includes(name) ? "present" : null;
    const t = b.functions.includes(name) ? "present" : null;
    if (h !== t) rows.push({ key: name, kind: "function", here: h, there: t });
  }

  if (a.reference && b.reference) {
    const refNames = new Set([
      ...a.reference.map((r) => r.table),
      ...b.reference.map((r) => r.table),
    ]);
    for (const name of [...refNames].sort()) {
      const h = a.reference.find((r) => r.table === name)?.rows;
      const t = b.reference.find((r) => r.table === name)?.rows;
      if (h === undefined || t === undefined) continue; // deploy-order skew
      const mode = REFERENCE_TABLES.find((r) => r.table === name)?.mode ?? "nonempty";
      const differs = mode === "exact" ? h !== t : (h === 0) !== (t === 0);
      if (differs) {
        rows.push({
          key: name,
          kind: "reference",
          here: h === 0 ? "EMPTY" : `${h} rows`,
          there: t === 0 ? "EMPTY" : `${t} rows`,
        });
      }
    }
  }

  return rows.sort((x, y) => {
    const sev = (r: DriftRow) =>
      r.here === null || r.there === null || r.here === "EMPTY" || r.there === "EMPTY" ? 0 : 1;
    return sev(x) - sev(y) || x.key.localeCompare(y.key);
  });
}

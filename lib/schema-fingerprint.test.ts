import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureFingerprint, diffMigrationLedgers, MIGRATION_DIGEST_ALGORITHM, migrationProblem, parseMigrationLedger, type Fingerprint, type MigrationEntry } from "./schema-fingerprint";
import { DiagnosticsView } from "../app/(app)/admin/diagnostics/diagnostics-view";

const { createAdminClient, rpc } = vi.hoisted(() => ({ createAdminClient: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/issues", () => ({ environmentName: () => "develop", releaseSha: () => "a".repeat(40) }));
vi.mock("@/lib/schema-fingerprint", () => import("./schema-fingerprint"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function entries(count = 35): MigrationEntry[] {
  return Array.from({ length: count }, (_, i) => ({ version: String(20261005000000n + BigInt(i)), name: `migration_${i}`, statements_sha256: "a".repeat(64) })).reverse();
}

function ledger(rows = entries()) {
  return { version: 1, total: rows.length, complete: true, digestAlgorithm: MIGRATION_DIGEST_ALGORITHM, entries: rows };
}

function fingerprint(rows = entries()): Fingerprint {
  return { environment: "develop", release_sha: "a".repeat(40), captured_at: "2026-10-18T00:00:00Z", tables: [], grants: [], functions: [],
    migrations: rows, migration_total: rows.length, migrations_complete: true, migration_digest_algorithm: MIGRATION_DIGEST_ALGORITHM, env_keys: [] };
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockImplementation(async (name: string) => ({ data: name === "schema_snapshot" ? { tables: [], grants: [], functions: [] } : ledger(), error: null }));
  const query = { select: vi.fn(), is: vi.fn(), order: vi.fn(), limit: vi.fn(), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve) };
  for (const method of [query.select, query.is, query.order, query.limit]) method.mockReturnValue(query);
  createAdminClient.mockReturnValue({ rpc, from: () => query });
});

describe("full migration ledger contract", () => {
  it("keeps more than twenty migrations and validates completeness", () => {
    expect(parseMigrationLedger(ledger()).entries).toHaveLength(35);
    expect(migrationProblem(fingerprint())).toBeNull();
  });

  it.each([
    null, [], { ...ledger(), complete: false }, { ...ledger(), total: 36 },
    { ...ledger(), total: -1 }, { ...ledger(), digestAlgorithm: "raw-file-sha256" },
    { ...ledger(), extra: true }, { ...ledger(), entries: entries().reverse() },
    ledger([entries()[0], entries()[0]]), ledger([{ ...entries()[0], statements_sha256: "bad" }]),
    ledger([{ ...entries()[0], version: "invalid" }]), ledger([{ ...entries()[0], name: " " }]),
  ])("rejects malformed or misleading ledger responses", (value) => {
    expect(() => parseMigrationLedger(value)).toThrow("migration_ledger_invalid");
  });

  it("supports a bounded but explicitly incomplete history without declaring it healthy", () => {
    const value = parseMigrationLedger({ ...ledger(), total: 36, complete: false });
    expect(value.complete).toBe(false);
    expect(migrationProblem({ ...fingerprint(), migration_total: 36, migrations_complete: false })).not.toBeNull();
  });

  it("does not treat absent historical statement arrays as verified digests", () => {
    const rows = [{ ...entries()[0], statements_sha256: null }];
    expect(parseMigrationLedger(ledger(rows)).entries[0].statements_sha256).toBeNull();
    expect(migrationProblem(fingerprint(rows))).toBe("migration statement digests unavailable");
  });

  it("enforces the response bound", () => {
    expect(() => parseMigrationLedger(ledger(entries(10001)))).toThrow();
  });

  it("rejects an older peer's twenty-entry history as incomplete", () => {
    const old = { ...fingerprint(entries(20)), migration_total: undefined, migrations_complete: undefined };
    expect(migrationProblem(old)).not.toBeNull();
    expect(diffMigrationLedgers(fingerprint(), old)).toBeNull();
  });
});

describe("complete history comparison", () => {
  it("detects a missing oldest migration outside the former twenty-entry window", () => {
    const rows = entries();
    const result = diffMigrationLedgers(fingerprint(rows), fingerprint(rows.slice(0, -1)))!;
    expect(result.hereOnly.map((r) => r.version)).toEqual([rows.at(-1)!.version]);
  });

  it("detects changed stored statements on an old migration despite equal counts", () => {
    const rows = entries();
    const changed = rows.map((r, i) => i === rows.length - 1 ? { ...r, statements_sha256: "b".repeat(64) } : r);
    expect(diffMigrationLedgers(fingerprint(rows), fingerprint(changed))!.changed).toHaveLength(1);
  });

  it("retains renumbering checks and the existing roadmap exception", () => {
    const row = entries(1)[0];
    expect(diffMigrationLedgers(fingerprint([row]), fingerprint([{ ...row, version: "20261005000001" }]))!.mismatched).toHaveLength(1);
    expect(diffMigrationLedgers(fingerprint([{ ...row, name: "roadmap_comments" }]), fingerprint([]))!.hereOnly).toEqual([]);
  });
});

describe("fingerprint capture", () => {
  it("publishes full count, digests and completeness using only the new RPC", async () => {
    const result = await captureFingerprint();
    expect(result.migrations).toHaveLength(35);
    expect(result.migration_total).toBe(35);
    expect(result.migrations_complete).toBe(true);
    expect(result.migration_error).toBeUndefined();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["schema_snapshot", "migration_ledger_full"]);
  });

  it.each(["missing", "malformed", "truncated", "throws"])("reports %s results explicitly without falling back", async (mode) => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "schema_snapshot") return { data: { tables: [], grants: [], functions: [] }, error: null };
      if (mode === "throws") throw new Error("private connection details");
      return mode === "missing" ? { data: null, error: { code: "PGRST202" } }
        : { data: mode === "malformed" ? [] : { ...ledger(), total: 36, complete: false }, error: null };
    });
    const result = await captureFingerprint();
    expect(result.migration_error).toBeTruthy();
    expect(migrationProblem(result)).not.toBeNull();
    expect(rpc).not.toHaveBeenCalledWith("migration_ledger");
    expect(JSON.stringify(result)).not.toContain("private connection");
  });
});

describe("diagnostics verdict rendering", () => {
  it("keeps the display compact while comparing all entries", () => {
    const fp = fingerprint();
    const html = renderToStaticMarkup(createElement(DiagnosticsView, { here: fp, peer: fp, peerError: null, drift: [] }));
    expect(html).toContain("Environments in sync");
    expect(html).toContain("Migration count");
    const expanded = renderToStaticMarkup(createElement(DiagnosticsView, { here: fp, peer: fingerprint(entries(36)), peerError: null, drift: [] }));
    expect(expanded).toContain("35 migrations");
    expect(expanded).toContain("showing newest 8");
    expect(expanded).not.toContain(">migration_0<");
  });

  it("never displays green sync or in-step chips for an old peer or missing ledger", () => {
    const here = fingerprint();
    for (const peer of [{ ...here, migrations_complete: undefined }, { ...here, migration_error: "migration_ledger_unavailable" }]) {
      const html = renderToStaticMarkup(createElement(DiagnosticsView, { here, peer, peerError: null, drift: [] }));
      expect(html).not.toContain("Environments in sync");
      expect(html).not.toContain(">in step<");
      expect(html).toContain("verification incomplete");
    }
  });

  it("labels content differences as stored-statement digests, not file checksums", () => {
    const here = fingerprint();
    const peer = fingerprint(here.migrations!.map((r, i) => i === 34 ? { ...r, statements_sha256: "b".repeat(64) } : r));
    const html = renderToStaticMarkup(createElement(DiagnosticsView, { here, peer, peerError: null, drift: [] }));
    expect(html).toContain("Stored migration contents differ");
    expect(html).toContain("not raw repository SQL files");
    expect(html).not.toContain("Environments in sync");
  });
});

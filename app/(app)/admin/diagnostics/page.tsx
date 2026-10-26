import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import {
  captureFingerprint,
  diffFingerprints,
  type Fingerprint,
} from "@/lib/schema-fingerprint";
import { peerConfigured, peerFetch } from "@/lib/peer";
import { DiagnosticsView } from "./diagnostics-view";

export const dynamic = "force-dynamic";

async function fetchPeer(): Promise<Fingerprint | { error: string } | null> {
  if (!peerConfigured()) return null;
  try {
    const res = await peerFetch("/api/schema-fingerprint");
    if (!res.ok) return { error: `Peer returned ${res.status}` };
    return (await res.json()) as Fingerprint;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Peer unreachable" };
  }
}

export default async function DiagnosticsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_owner) redirect("/hub");

  const [here, peer] = await Promise.all([captureFingerprint(), fetchPeer()]);
  const peerOk = peer && !("error" in peer) ? (peer as Fingerprint) : null;
  const peerError = peer && "error" in peer ? (peer.error ?? null) : null;
  const drift = peerOk ? diffFingerprints(here, peerOk) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-brand">Owner</div>
        <h1 className="font-display text-3xl font-semibold text-ink">Diagnostics</h1>
        <p className="mt-1 text-sm text-muted">
          Everything that decides “why does production behave differently?” — schema,
          migrations, config, releases and open failures, both environments side by side.
        </p>
      </div>
      <DiagnosticsView here={here} peer={peerOk} peerError={peerError} drift={drift} />
    </div>
  );
}

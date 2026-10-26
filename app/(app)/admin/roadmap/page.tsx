import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { listRoadmapItems } from "@/lib/roadmap";
import { RoadmapBoard } from "./roadmap-board";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && !profile.is_owner) redirect("/hub");

  const { items, shared, error } = await listRoadmapItems();

  const supabase = await createClient();
  const { data: prefRow } = await supabase
    .from("profiles")
    .select("ui_prefs")
    .eq("id", profile.id)
    .maybeSingle();
  const prefs = (prefRow?.ui_prefs ?? null) as {
    roadmap_section_order?: unknown;
    roadmap_collapsed?: unknown;
  } | null;
  const sectionOrder = Array.isArray(prefs?.roadmap_section_order)
    ? prefs.roadmap_section_order.filter((s): s is string => typeof s === "string")
    : [];
  const savedCollapsed = Array.isArray(prefs?.roadmap_collapsed)
    ? prefs.roadmap_collapsed.filter((s): s is string => typeof s === "string")
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-brand">Admin</div>
        <h1 className="font-display text-3xl font-semibold text-ink">Roadmap</h1>
        <p className="mt-1 text-sm text-muted">
          What&apos;s being built, what&apos;s next, and what&apos;s already live — request a
          feature or report a bug right here instead of docs and email.
        </p>
        {shared && (
          <p className="mt-1 text-xs text-muted">↔ One board everywhere — you&apos;re viewing the live production roadmap.</p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">{error}</div>
      )}

      <RoadmapBoard items={items} isOwner={profile.is_owner} viewerKey={profile.id} sectionOrder={sectionOrder} savedCollapsed={savedCollapsed} />
    </div>
  );
}

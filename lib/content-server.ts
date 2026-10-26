import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { ContentKind, ContentRow } from "@/lib/content";

const ORDER: Record<ContentKind, { column: string; ascending: boolean }> = {
  events: { column: "starts_at", ascending: false },
  sermons: { column: "preached_on", ascending: false },
  announcements: { column: "created_at", ascending: false },
};

/** Every row of a kind for the admin editor (RLS: active members only). */
export async function listContent(kind: ContentKind): Promise<ContentRow[]> {
  const supabase = await createClient();
  const { column, ascending } = ORDER[kind];
  const { data, error } = await supabase.from(kind).select("*").order(column, { ascending });
  if (error) throw new Error(`${kind} read failed — ${error.message}`);
  return data as ContentRow[];
}

export async function contentCounts(): Promise<Record<ContentKind, number>> {
  const supabase = await createClient();
  const kinds: ContentKind[] = ["events", "sermons", "announcements"];
  const results = await Promise.all(
    kinds.map((k) => supabase.from(k).select("id", { count: "exact", head: true })),
  );
  const out = {} as Record<ContentKind, number>;
  results.forEach(({ count, error }, i) => {
    if (error) throw new Error(`${kinds[i]} count failed — ${error.message}`);
    out[kinds[i]] = count ?? 0;
  });
  return out;
}

export type PublicEvent = { id: string; title: string; description: string; location: string; starts_at: string; ends_at: string | null };
export type PublicSermon = {
  id: string;
  title: string;
  preacher: string;
  preached_on: string;
  scripture: string;
  summary: string;
  video_url: string | null;
  audio_url: string | null;
};
export type PublicAnnouncement = { id: string; title: string; body: string };

/** Upcoming published events (anything that started in the last 6 hours
 *  still counts, so a running service stays listed). */
export async function publicEvents(limit = 50): Promise<PublicEvent[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, location, starts_at, ends_at")
    .gte("starts_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Public events read failed — ${error.message}`);
  return data;
}

export async function publicSermons(limit = 100): Promise<PublicSermon[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("sermons")
    .select("id, title, preacher, preached_on, scripture, summary, video_url, audio_url")
    .order("preached_on", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Public sermons read failed — ${error.message}`);
  return data;
}

export async function publicAnnouncements(limit = 5): Promise<PublicAnnouncement[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Public announcements read failed — ${error.message}`);
  return data;
}

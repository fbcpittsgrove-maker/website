import { formatEventWhen } from "@/lib/content";
import type { PublicEvent } from "@/lib/content-server";

export function EventList({ events, empty }: { events: PublicEvent[]; empty: string }) {
  if (events.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {events.map((e) => (
        <li key={e.id} className="py-5 first:pt-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{formatEventWhen(e.starts_at, e.ends_at)}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{e.title}</p>
          {e.location && <p className="text-sm text-muted">{e.location}</p>}
          {e.description && <p className="mt-2 whitespace-pre-line text-text">{e.description}</p>}
        </li>
      ))}
    </ul>
  );
}

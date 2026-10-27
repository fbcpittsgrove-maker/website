import { CHURCH } from "@/lib/church";
import { churchLocalToUtc, utcToChurchLocal } from "@/lib/content";

export type NextService = { label: string; when: string; until: string; at: Date };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_RE = /^(\d{1,2}):(\d{2}) (AM|PM)$/;

/** "6:30 PM" → "18:30". Throws on anything else so a typo in lib/church.ts
 *  can't silently drop a service. */
export function to24h(time: string): string {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Service time must look like "6:30 PM", got "${time}"`);
  const hour = (Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${m[2]}`;
}

function untilText(minutes: number): string {
  if (minutes < 60) return `in ${minutes} min`;
  if (minutes < 1440) {
    const m = minutes % 60;
    return `in ${Math.floor(minutes / 60)} hr${m ? ` ${m} min` : ""}`;
  }
  const days = Math.round(minutes / 1440);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** The next service on the weekly schedule after `now`, in church time
 *  (DST-safe), whatever the visitor's own time zone. */
export function nextService(now: Date, schedule = CHURCH.schedule): NextService {
  const today = utcToChurchLocal(now.toISOString()).slice(0, 10);
  for (let add = 0; add < 8; add++) {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + add);
    const date = day.toISOString().slice(0, 10);
    const services = schedule.find((d) => d.day === DAYS[day.getUTCDay()])?.services ?? [];
    const upcoming = services
      .map((s) => ({ ...s, at: new Date(churchLocalToUtc(`${date}T${to24h(s.time)}`)) }))
      .filter((s) => s.at > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
    if (upcoming) {
      const dayLabel = add === 0 ? "Today" : add === 1 ? "Tomorrow" : DAYS[day.getUTCDay()];
      return {
        label: upcoming.label,
        when: `${dayLabel} · ${upcoming.time}`,
        until: untilText(Math.ceil((upcoming.at.getTime() - now.getTime()) / 60000)),
        at: upcoming.at,
      };
    }
  }
  throw new Error("The weekly schedule has no services");
}

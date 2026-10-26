import { BRAND } from "@/lib/brand";

/** The firm's calendar day (Newington, CT) as YYYY-MM-DD — never the UTC day,
 *  so evening work doesn't roll expiry flags and countdowns forward a day. */
export function firmToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAND.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

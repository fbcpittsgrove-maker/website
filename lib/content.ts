/**
 * Church content — events, sermons, announcements. Client-safe: types, the
 * field schema the admin editor renders from, and pure parsers the server
 * actions validate with. Queries live in lib/content-server.ts.
 */

export const CHURCH_TIME_ZONE = "America/New_York";

export type ContentKind = "events" | "sermons" | "announcements";

export type FieldType = "text" | "textarea" | "datetime" | "date" | "url" | "checkbox";

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
};

export const CONTENT_FIELDS: Record<ContentKind, FieldSpec[]> = {
  events: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "starts_at", label: "Starts", type: "datetime", required: true },
    { name: "ends_at", label: "Ends", type: "datetime" },
    { name: "location", label: "Location", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "published", label: "Show on the website", type: "checkbox" },
  ],
  sermons: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "preached_on", label: "Date preached", type: "date", required: true },
    { name: "preacher", label: "Preacher", type: "text" },
    { name: "scripture", label: "Scripture", type: "text", hint: "e.g. John 3:16–21" },
    { name: "summary", label: "Summary", type: "textarea" },
    { name: "video_url", label: "Video link", type: "url", hint: "YouTube or Facebook link, starting with https://" },
    { name: "audio_url", label: "Audio link", type: "url" },
    { name: "published", label: "Show on the website", type: "checkbox" },
  ],
  announcements: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "body", label: "Message", type: "textarea" },
    { name: "starts_on", label: "Show from", type: "date", hint: "Leave blank to show right away" },
    { name: "ends_on", label: "Show until", type: "date", hint: "Leave blank to keep showing" },
    { name: "published", label: "Show on the website", type: "checkbox" },
  ],
};

export const CONTENT_LABEL: Record<ContentKind, { singular: string; plural: string }> = {
  events: { singular: "event", plural: "Events" },
  sermons: { singular: "sermon", plural: "Sermons" },
  announcements: { singular: "announcement", plural: "Announcements" },
};

export type ContentRow = Record<string, string | boolean | null> & { id: string };

export type ParseResult = { ok: true; value: Record<string, string | boolean | null> } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant.getTime();
}

/** A `datetime-local` value typed in church time → the UTC instant (ISO).
 *  Throws on a malformed value; callers validate first. */
export function churchLocalToUtc(local: string, timeZone = CHURCH_TIME_ZONE): string {
  const m = LOCAL_DATETIME_RE.exec(local);
  if (!m) throw new Error(`Not a local date-time: ${local}`);
  const wallAsUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Two passes settle the offset across a DST boundary.
  let guess = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timeZone);
  guess = wallAsUtc - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess).toISOString();
}

/** UTC instant → the `datetime-local` value an editor sees, in church time. */
export function utcToChurchLocal(iso: string, timeZone = CHURCH_TIME_ZONE): string {
  const instant = new Date(iso);
  const shifted = new Date(instant.getTime() + zoneOffsetMs(instant, timeZone));
  return shifted.toISOString().slice(0, 16);
}

function text(form: Record<string, unknown>, name: string): string {
  const v = form[name];
  return typeof v === "string" ? v.trim() : "";
}

/** Validates one content submission against its field schema and returns the
 *  row values to write. Expected problems come back as `{ ok: false }` with a
 *  plain-language message — never a throw. */
export function parseContent(kind: ContentKind, form: Record<string, unknown>): ParseResult {
  const value: Record<string, string | boolean | null> = {};
  for (const field of CONTENT_FIELDS[kind]) {
    if (field.type === "checkbox") {
      value[field.name] = form[field.name] === true || form[field.name] === "on" || form[field.name] === "true";
      continue;
    }
    const raw = text(form, field.name);
    if (!raw) {
      if (field.required) return { ok: false, error: `${field.label} is required.` };
      value[field.name] = field.type === "text" || field.type === "textarea" ? "" : null;
      continue;
    }
    if (field.type === "date" && !DATE_RE.test(raw)) return { ok: false, error: `${field.label} must be a date.` };
    if (field.type === "datetime") {
      if (!LOCAL_DATETIME_RE.test(raw)) return { ok: false, error: `${field.label} must be a date and time.` };
      value[field.name] = churchLocalToUtc(raw);
      continue;
    }
    if (field.type === "url") {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return { ok: false, error: `${field.label} must be a full link starting with https://.` };
      }
      if (url.protocol !== "https:") return { ok: false, error: `${field.label} must start with https://.` };
    }
    if (field.type === "text" && raw.length > 200) return { ok: false, error: `${field.label} is too long (200 characters max).` };
    if (field.type === "textarea" && raw.length > 10000) return { ok: false, error: `${field.label} is too long.` };
    value[field.name] = raw;
  }

  if (kind === "events" && value.ends_at && value.starts_at && String(value.ends_at) < String(value.starts_at)) {
    return { ok: false, error: "The event can't end before it starts." };
  }
  if (kind === "announcements" && value.starts_on && value.ends_on && String(value.ends_on) < String(value.starts_on)) {
    return { ok: false, error: "“Show until” can't be before “Show from”." };
  }
  return { ok: true, value };
}

/** Pulls the row's stored values into the strings an editor form shows. */
export function formValues(kind: ContentKind, row: ContentRow | null): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const field of CONTENT_FIELDS[kind]) {
    const v = row?.[field.name];
    if (field.type === "checkbox") out[field.name] = v === true;
    else if (field.type === "datetime") out[field.name] = typeof v === "string" && v ? utcToChurchLocal(v) : "";
    else out[field.name] = typeof v === "string" ? v : "";
  }
  return out;
}

/** "Sun, Nov 2 · 10:30 AM" in church time. */
export function formatEventWhen(startsAt: string, endsAt: string | null): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(startsAt));
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: CHURCH_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return endsAt ? `${day} · ${time(startsAt)}–${time(endsAt)}` : `${day} · ${time(startsAt)}`;
}

/** A calendar day (YYYY-MM-DD) as "November 2, 2026" — rendered in UTC so the
 *  stored day never shifts to the day before. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

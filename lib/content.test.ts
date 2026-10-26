import { describe, expect, it } from "vitest";
import {
  churchLocalToUtc,
  formValues,
  formatDay,
  formatEventWhen,
  parseContent,
  utcToChurchLocal,
} from "@/lib/content";

describe("church time conversion", () => {
  it("reads a summer wall time as Eastern Daylight Time", () => {
    expect(churchLocalToUtc("2026-07-05T10:30")).toBe("2026-07-05T14:30:00.000Z");
  });

  it("reads a winter wall time as Eastern Standard Time", () => {
    expect(churchLocalToUtc("2026-12-20T18:00")).toBe("2026-12-20T23:00:00.000Z");
  });

  it("settles the offset on the day clocks change", () => {
    expect(churchLocalToUtc("2026-11-01T11:00")).toBe("2026-11-01T16:00:00.000Z");
    expect(churchLocalToUtc("2026-03-08T11:00")).toBe("2026-03-08T15:00:00.000Z");
  });

  it("round-trips back to the value an editor typed", () => {
    for (const local of ["2026-07-05T10:30", "2026-12-20T18:00", "2026-11-01T11:00"]) {
      expect(utcToChurchLocal(churchLocalToUtc(local))).toBe(local);
    }
  });

  it("refuses a malformed value instead of guessing", () => {
    expect(() => churchLocalToUtc("next sunday")).toThrow("Not a local date-time");
  });
});

describe("parseContent", () => {
  it("accepts a full event and stores its times in UTC", () => {
    const r = parseContent("events", {
      title: "  Fall revival  ",
      starts_at: "2026-11-08T18:00",
      ends_at: "2026-11-08T20:00",
      location: "Sanctuary",
      description: "",
      published: true,
    });
    expect(r).toEqual({
      ok: true,
      value: {
        title: "Fall revival",
        starts_at: "2026-11-08T23:00:00.000Z",
        ends_at: "2026-11-09T01:00:00.000Z",
        location: "Sanctuary",
        description: "",
        published: true,
      },
    });
  });

  it("requires the required fields", () => {
    expect(parseContent("events", { title: "", starts_at: "2026-11-08T18:00" })).toEqual({ ok: false, error: "Title is required." });
    expect(parseContent("sermons", { title: "Grace", preached_on: "" })).toEqual({ ok: false, error: "Date preached is required." });
  });

  it("rejects an event that ends before it starts", () => {
    const r = parseContent("events", { title: "x", starts_at: "2026-11-08T18:00", ends_at: "2026-11-08T17:00" });
    expect(r).toEqual({ ok: false, error: "The event can't end before it starts." });
  });

  it("only takes https links for recordings", () => {
    expect(parseContent("sermons", { title: "x", preached_on: "2026-10-25", video_url: "http://youtu.be/a" })).toEqual({
      ok: false,
      error: "Video link must start with https://.",
    });
    expect(parseContent("sermons", { title: "x", preached_on: "2026-10-25", video_url: "not a link" })).toEqual({
      ok: false,
      error: "Video link must be a full link starting with https://.",
    });
    const ok = parseContent("sermons", { title: "x", preached_on: "2026-10-25", video_url: "https://youtu.be/a" });
    expect(ok.ok && ok.value.video_url).toBe("https://youtu.be/a");
  });

  it("stores blank optional fields as empty text or null, never undefined", () => {
    const r = parseContent("sermons", { title: "x", preached_on: "2026-10-25" });
    expect(r).toEqual({
      ok: true,
      value: {
        title: "x",
        preached_on: "2026-10-25",
        preacher: "",
        scripture: "",
        summary: "",
        video_url: null,
        audio_url: null,
        published: false,
      },
    });
  });

  it("keeps an announcement window in order", () => {
    expect(parseContent("announcements", { title: "x", starts_on: "2026-11-10", ends_on: "2026-11-01" })).toEqual({
      ok: false,
      error: "“Show until” can't be before “Show from”.",
    });
  });

  it("rejects a malformed date and an over-long title", () => {
    expect(parseContent("announcements", { title: "x", starts_on: "11/10/2026" })).toEqual({ ok: false, error: "Show from must be a date." });
    expect(parseContent("announcements", { title: "x".repeat(201) })).toEqual({ ok: false, error: "Title is too long (200 characters max)." });
  });

  it("treats only real checkbox values as published", () => {
    for (const v of [true, "on", "true"]) {
      const r = parseContent("announcements", { title: "x", published: v });
      expect(r.ok && r.value.published).toBe(true);
    }
    const off = parseContent("announcements", { title: "x", published: "yes please" });
    expect(off.ok && off.value.published).toBe(false);
  });
});

describe("formValues", () => {
  it("shows stored UTC times back in church time", () => {
    const v = formValues("events", {
      id: "1",
      title: "Service",
      starts_at: "2026-07-05T14:30:00+00:00",
      ends_at: null,
      location: "",
      description: "",
      published: true,
    });
    expect(v).toEqual({ title: "Service", starts_at: "2026-07-05T10:30", ends_at: "", location: "", description: "", published: true });
  });

  it("gives an empty form for a new row", () => {
    expect(formValues("announcements", null)).toEqual({ title: "", body: "", starts_on: "", ends_on: "", published: false });
  });
});

describe("formatting", () => {
  it("formats event times in church time", () => {
    expect(formatEventWhen("2026-07-05T14:30:00Z", null)).toBe("Sun, Jul 5 · 10:30 AM");
    expect(formatEventWhen("2026-12-20T23:00:00Z", "2026-12-21T01:00:00Z")).toBe("Sun, Dec 20 · 6:00 PM–8:00 PM");
  });

  it("never shifts a calendar day to the day before", () => {
    expect(formatDay("2026-11-01")).toBe("November 1, 2026");
  });
});

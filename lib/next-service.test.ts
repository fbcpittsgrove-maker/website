import { describe, expect, it } from "vitest";
import { nextService, to24h } from "@/lib/next-service";

describe("to24h", () => {
  it("converts 12-hour service times", () => {
    expect(to24h("9:45 AM")).toBe("09:45");
    expect(to24h("12:00 PM")).toBe("12:00");
    expect(to24h("6:30 PM")).toBe("18:30");
  });

  it("refuses a time it can't read", () => {
    expect(() => to24h("6.30pm")).toThrow('got "6.30pm"');
  });
});

describe("nextService", () => {
  it("finds the next service later the same Sunday", () => {
    // Sun 1 Nov 2026, 10:00 EST (15:00 UTC) — clocks went back that morning.
    expect(nextService(new Date("2026-11-01T15:00:00Z"))).toMatchObject({
      label: "Morning Service",
      when: "Today · 11:00 AM",
      until: "in 1 hr",
      at: new Date("2026-11-01T16:00:00Z"),
    });
  });

  it("counts minutes when the service is under an hour away", () => {
    expect(nextService(new Date("2026-11-01T15:41:30Z")).until).toBe("in 19 min");
  });

  it("rolls from Sunday night to Wednesday", () => {
    // Sun 25 Oct 2026, 19:00 EDT (23:00 UTC).
    expect(nextService(new Date("2026-10-25T23:00:00Z"))).toMatchObject({
      label: "Bible Study & Prayer",
      when: "Wednesday · 6:30 PM",
      until: "in 3 days",
      at: new Date("2026-10-28T22:30:00Z"),
    });
  });

  it("says tomorrow on a Tuesday evening and uses church time, not UTC", () => {
    // Tue 27 Oct 2026, 21:00 EDT — already Wednesday in UTC.
    expect(nextService(new Date("2026-10-28T01:00:00Z"))).toMatchObject({ when: "Tomorrow · 6:30 PM", until: "in 21 hr 30 min" });
  });

  it("counts hours, not days, when the service is under two days away", () => {
    // Tue 27 Oct 2026, 14:30 EDT.
    expect(nextService(new Date("2026-10-27T18:30:00Z"))).toMatchObject({ when: "Tomorrow · 6:30 PM", until: "in 28 hr" });
  });

  it("skips Saturday visitation for the prayer meeting", () => {
    // Wed 28 Oct 2026, 20:00 EDT, then Sat 31 Oct, 9:00 EDT.
    expect(nextService(new Date("2026-10-29T00:00:00Z"))).toMatchObject({ label: "Prayer Meeting", when: "Saturday · 4:30 PM" });
    expect(nextService(new Date("2026-10-31T13:00:00Z"))).toMatchObject({ label: "Prayer Meeting", when: "Today · 4:30 PM" });
  });

  it("wraps from Saturday night to Sunday School", () => {
    // Sat 31 Oct 2026, 20:00 EDT.
    expect(nextService(new Date("2026-11-01T00:00:00Z"))).toMatchObject({ label: "Sunday School", when: "Tomorrow · 9:45 AM" });
  });
});

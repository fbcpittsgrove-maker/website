import { describe, expect, it } from "vitest";
import { TEXT_MESSAGES, textHref, type TextKind } from "@/lib/text-us";

describe("textHref", () => {
  it("opens a text to the church phone with the message started", () => {
    expect(textHref("prayer")).toBe("sms:+18563624851?&body=Hi%2C%20I%20have%20a%20prayer%20request%3A%20");
  });

  it("round-trips every message body", () => {
    for (const kind of Object.keys(TEXT_MESSAGES) as TextKind[]) {
      const body = new URL(textHref(kind).replace("sms:", "https://x/")).searchParams.get("body");
      expect(body).toBe(TEXT_MESSAGES[kind].body);
    }
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEAL, sealDataUri, sealSvg } from "@/lib/logo";

describe("church seal", () => {
  it("draws the design's laurel and Bible page lines", () => {
    expect(SEAL.stems).toHaveLength(2);
    expect(SEAL.leaves).toHaveLength(62);
    expect(SEAL.lines).toHaveLength(12);
    expect(SEAL.leaves[0]).toBe("translate(222.5 392.7) rotate(154.0) scale(1.12)");
  });

  it("keeps the favicon in step with the seal geometry", () => {
    expect(readFileSync("app/icon.svg", "utf8").trim()).toBe(sealSvg());
  });

  it("only adds a backdrop when asked", () => {
    expect(sealSvg()).not.toContain("<rect");
    expect(sealSvg({ background: "#f8f4ec" })).toContain('<rect x="86" y="88" width="348" height="348" fill="#f8f4ec"/>');
  });

  it("encodes as an SVG data URI", () => {
    expect(atob(sealDataUri().split(",")[1])).toBe(sealSvg());
  });
});

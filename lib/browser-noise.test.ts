import { describe, expect, it } from "vitest";
import { isBrowserNoise } from "@/lib/browser-noise";

describe("isBrowserNoise", () => {
  it("drops a hidden cross-origin error with no stack", () => {
    expect(isBrowserNoise("Script error.")).toBe(true);
    expect(isBrowserNoise("Script error.", "at f (https://fbc.example/_next/static/chunks/a.js:1:2)")).toBe(false);
  });

  it("drops errors from scripts in-app browsers inject", () => {
    expect(isBrowserNoise("TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')")).toBe(true);
    expect(isBrowserNoise("ReferenceError: Can't find variable: __gCrWeb")).toBe(true);
    expect(isBrowserNoise("x is undefined", "instantSearchSDKJSBridgeClearHighlight@")).toBe(true);
  });

  it("keeps the site's own errors", () => {
    expect(isBrowserNoise("TypeError: Cannot read properties of undefined (reading 'title')", "at EventList (https://fbc.example/_next/static/chunks/b.js:3:9)")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { fmtSig } from "./format";

describe("significant-figure formatting", () => {
  it("preserves whole-number zeros", () => {
    expect(fmtSig(1230)).toBe("1230");
    expect(fmtSig(1000)).toBe("1000");
    expect(fmtSig(9999)).toBe("9999");
    expect(fmtSig(10000)).toBe("10000");
  });

  it("rounds to four significant figures without decimal padding", () => {
    expect(fmtSig(12.30)).toBe("12.3");
    expect(fmtSig(0.012345)).toBe("0.01235");
    expect(fmtSig(9999.9)).toBe("10000");
  });

  it("uses scientific notation outside the fixed range", () => {
    expect(fmtSig(123456)).toBe("1.235e+5");
    expect(fmtSig(0.001)).toBe("1.000e-3");
    expect(fmtSig(0.01)).toBe("0.01");
    expect(fmtSig(0.009999)).toBe("9.999e-3");
    expect(fmtSig(100000)).toBe("1.000e+5");
  });

  it("applies the same formatting to negative values", () => {
    expect(fmtSig(-1230)).toBe("-1230");
    expect(fmtSig(-1000)).toBe("-1000");
    expect(fmtSig(-12.30)).toBe("-12.3");
    expect(fmtSig(-0.012345)).toBe("-0.01235");
    expect(fmtSig(-123456)).toBe("-1.235e+5");
    expect(fmtSig(-0.001)).toBe("-1.000e-3");
  });

  it("preserves zero and missing-value displays", () => {
    expect(fmtSig(0)).toBe("0");
    expect(fmtSig(-0)).toBe("0");
    expect(fmtSig(null)).toBe("—");
    expect(fmtSig(undefined)).toBe("—");
  });
});

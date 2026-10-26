export function fmtSig(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  return a >= 0.01 && a < 100000 ? String(Number(v.toPrecision(4))) : v.toExponential(3);
}

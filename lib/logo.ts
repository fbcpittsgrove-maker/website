/**
 * The church seal — the centre of the logo designed in Claude Design
 * ("FBC Logo"): a navy disc in a gold ring holding the cross, the open
 * Bible and a laurel. The full logo adds the name around the ring in
 * Cinzel; the seal alone is what reads at icon and header sizes.
 * Geometry is on the design's 520×520 canvas, centred on (260, 262).
 */

export const LOGO = {
  navy: "#1c2b55",
  gold: "#b8903f",
  goldStops: ["#e2c27c", "#b8903f", "#d6b468"],
  /** Square around the gold ring (r 174). */
  viewBox: "86 88 348 348",
} as const;

const f = (n: number) => n.toFixed(1);

function geometry() {
  const cx = 260, cy = 262, R = 136;
  const rad = (d: number) => (d * Math.PI) / 180;
  const pt = (th: number): [number, number] => [cx + R * Math.cos(rad(th)), cy + R * Math.sin(rad(th))];
  const stems: string[] = [];
  const leaves: string[] = [];
  for (const m of [false, true]) {
    const X = (x: number) => (m ? 520 - x : x);
    const A = (a: number) => (m ? 180 - a : a);
    const [x0, y0] = pt(94), [x1, y1] = pt(236);
    stems.push(`M${f(X(x0))} ${f(y0)} A${R} ${R} 0 0 ${m ? 0 : 1} ${f(X(x1))} ${f(y1)}`);
    for (let i = 0; i < 15; i++) {
      const th = 106 + i * 8.6, [x, y] = pt(th), s = (1.12 - i * 0.028).toFixed(2);
      leaves.push(`translate(${f(X(x))} ${f(y)}) rotate(${f(A(th + 48))}) scale(${s})`);
      leaves.push(`translate(${f(X(x))} ${f(y)}) rotate(${f(A(th + 132))}) scale(${s})`);
    }
    const [tx, ty] = pt(235);
    leaves.push(`translate(${f(X(tx))} ${f(ty)}) rotate(${f(A(325))}) scale(0.75)`);
  }
  const top = [[178, 250], [205, 243], [238, 248], [260, 262]];
  const bot = [[170, 302], [200, 295], [236, 299], [260, 314]];
  const lines: string[] = [];
  for (let k = 1; k <= 6; k++) {
    const t = k / 7.2;
    const p = top.map((q, j) => [q[0] + (bot[j][0] - q[0]) * t, q[1] + (bot[j][1] - q[1]) * t]);
    p[0][0] += 9; p[3][0] -= 8; p[3][1] -= 4;
    for (const m of [false, true]) {
      const X = (x: number) => (m ? 520 - x : x);
      lines.push(`M${f(X(p[0][0]))} ${f(p[0][1])}C${f(X(p[1][0]))} ${f(p[1][1])} ${f(X(p[2][0]))} ${f(p[2][1])} ${f(X(p[3][0]))} ${f(p[3][1])}`);
    }
  }
  return { stems, leaves, lines };
}

export const SEAL = {
  ...geometry(),
  leaf: "M0 0C7-6.5 19-7 28 0C19 7 7 6.5 0 0Z",
  cross: "M252 150h16v28h26v16h-26v70h-16v-70h-26v-16h26z",
  bibleBase: "M166 304C198 297 236 301 260 316C284 301 322 297 354 304L357 316C323 309 285 313 260 328C235 313 197 309 163 316Z",
  bibleEdge: "M168 309C199 303 236 307 260 321C284 307 321 303 352 309",
  pageLeft: "M260 262C238 248 205 243 178 250L170 302C200 295 236 299 260 314Z",
  pageRight: "M260 262C282 248 315 243 342 250L350 302C320 295 284 299 260 314Z",
  spine: "M260 262V314",
};

/** Standalone seal SVG with the gold gradient — the favicon, Apple icon
 *  and share card. `background` fills the square behind the seal. */
export function sealSvg({ background }: { background?: string } = {}): string {
  const { navy, gold, goldStops, viewBox } = LOGO;
  const g = "url(#g)";
  const [vx, vy, vw] = viewBox.split(" ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${goldStops[0]}"/><stop offset=".5" stop-color="${goldStops[1]}"/><stop offset="1" stop-color="${goldStops[2]}"/>`,
    `</linearGradient></defs>`,
    background ? `<rect x="${vx}" y="${vy}" width="${vw}" height="${vw}" fill="${background}"/>` : "",
    `<circle cx="260" cy="262" r="174" fill="${g}"/>`,
    `<circle cx="260" cy="262" r="165" fill="${navy}"/>`,
    `<circle cx="260" cy="262" r="160" fill="none" stroke="${gold}" stroke-opacity=".35"/>`,
    ...SEAL.stems.map((d) => `<path d="${d}" fill="none" stroke="${g}" stroke-width="3.2" stroke-linecap="round"/>`),
    ...SEAL.leaves.map(
      (t) => `<g transform="${t}"><path d="${SEAL.leaf}" fill="${g}"/><path d="M2 0L24 0" stroke="${navy}" stroke-opacity=".45"/></g>`,
    ),
    `<path d="${SEAL.cross}" fill="${g}"/>`,
    `<path d="${SEAL.bibleBase}" fill="${g}"/>`,
    `<path d="${SEAL.bibleEdge}" fill="none" stroke="${navy}" stroke-opacity=".5" stroke-width="1.2"/>`,
    `<path d="${SEAL.pageLeft}" fill="${g}" stroke="${navy}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path d="${SEAL.pageRight}" fill="${g}" stroke="${navy}" stroke-width="1.6" stroke-linejoin="round"/>`,
    ...SEAL.lines.map((d) => `<path d="${d}" fill="none" stroke="${navy}" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>`),
    `<path d="${SEAL.spine}" stroke="${navy}" stroke-width="2"/>`,
    `</svg>`,
  ].join("");
}

export function sealDataUri(options?: { background?: string }): string {
  return `data:image/svg+xml;base64,${btoa(sealSvg(options))}`;
}

// Scenes for DotArt. Each returns tone + brightness for one dot: 0.x white, 1.x accent, 2.x green, 0 = resting dot.
type Fn = (c: number, r: number, t: number, C: number, R: number) => number;

const w = (v: number) => Math.min(0.999, Math.max(0, v));
const W = (v: number) => w(v), A = (v: number) => 1 + w(v), G = (v: number) => 2 + w(v);
const hash = (a: number, b: number, k = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return x - Math.floor(x); };
const near = (d: number, edge: number) => w(1 - Math.abs(d - edge) / 0.8);

/** A prompt travels right: plain, then scrambled in transit, then into a sealed container where it is erased. */
const trust: Fn = (c, r, t, C, R) => {
  const p = (t % 9) / 9, cx = 3 + p * 25, cy = R / 2, d = Math.hypot(c - cx, r - cy);
  const box = c >= 21 && c <= 31 && r >= 8 && r <= 17, wall = box && (c === 21 || c === 31 || r === 8 || r === 17);
  if (cx < 11 && d < 2.6) return A(0.95);
  if (cx >= 11 && cx < 21 && d < 3.6) return hash(c, r, Math.floor(t * 10)) > 0.5 ? A(0.7) : 0;
  if (cx >= 21 && d < 2.6) { const gone = Math.max(0, (p - 0.78) / 0.2); return hash(c, r) > gone ? A(0.95) : 0; }
  if (wall) return G(0.35);
  if (r === Math.round(cy) && c < 21) return W(0.12);
  return 0;
};

/** A scan sweeps the field; one weakness is flagged, reported, then fixed. */
const security: Fn = (c, r, t) => {
  const L = t % 8, y = (L / 5) * 26, tx = 22, ty = 10;
  if (c === tx && r === ty && y > ty) return L > 6 ? G(0.95) : A(0.95);
  const d = Math.hypot(c - tx, r - ty);
  if (y > ty && L <= 6) { const ring = ((L - (ty / 26) * 5) * 4) % 5; if (near(d, ring) > 0.3) return A(near(d, ring) * 0.7); }
  if (L > 6 && d < 1.6) return G(0.6);
  const scan = Math.abs(r - y);
  return L < 5.2 && scan < 1.5 ? W(0.55 - scan * 0.3) : W(hash(c, r) > 0.9 ? 0.12 : 0);
};

/** A policy read top to bottom: lines of text, the current line underlined as it is read. */
const legal: Fn = (c, r, t) => {
  if (r % 2 === 0 || r < 3 || r > 23) return 0;
  const line = (r - 3) / 2, head = line % 4 === 0, len = head ? 10 + Math.floor(hash(r, 1) * 6) : 20 + Math.floor(hash(r, 2) * 10);
  if (c < 2 || c >= 2 + len) return 0;
  const k = ((t % 11) / 11) * 11, cur = Math.floor(k), frac = k - cur;
  if (line < cur) return W(head ? 0.75 : 0.5);
  if (line === cur) return (c - 2) / len < frac ? A(0.85) : W(0.25);
  return W(head ? 0.35 : 0.2);
};

/** A graphics card drawn in dots: fans turning, tokens streaming out to the right. */
const operators: Fn = (c, r, t) => {
  const card = c >= 2 && c <= 24 && r >= 6 && r <= 19;
  if (card && (c === 2 || c === 24 || r === 6 || r === 19)) return W(0.45);
  for (const fx of [8.5, 18]) {
    const d = Math.hypot(c - fx, r - 12.5);
    if (d < 4.2 && d > 1.2) { const a = (Math.atan2(r - 12.5, c - fx) + t * 3) % (Math.PI * 2); return W(0.2 + ((a + Math.PI * 2) % 1.57 < 0.5 ? 0.55 : 0)); }
    if (d <= 1.2) return W(0.6);
  }
  if (r >= 10 && r <= 15 && c >= 26) return ((c - t * 9 + hash(r, 3) * 30) % 7 + 7) % 7 < 1 ? A(0.9) : 0;
  if (r === 20 && c >= 4 && c <= 22 && c % 2 === 0) return W(0.3);
  return 0;
};

/** Idle machines light up green one by one and their donated work fills a shared circle. */
const good: Fn = (c, r, t, C, R) => {
  const p = (t % 10) / 10, d = Math.hypot(c - C / 2, r - R / 2);
  if (d < 1 + p * 6.5) return G(0.55 + 0.35 * (1 - d / 8));
  if (hash(c, r) > 0.84) return hash(c, r, 1) < p * 1.2 ? G(0.7) : W(0.45);
  return 0;
};

/** Four weekly allowances drain in turn; half of what each week leaves falls into a green rollover pool. */
const checkout: Fn = (c, r, t) => {
  const p = (t % 9) / 9, wk = Math.floor(p * 4), f = p * 4 - wk, g = Math.floor((c - 2) / 8), x = (c - 2) % 8;
  const left = [0.35, 0.5, 0.25, 0.6];
  if (r === 22 || r === 23) {
    const pool = [0, 1, 2, 3].reduce((s, i) => s + (i < wk ? left[i] / 2 : 0), 0) / 2;
    return c >= 2 && c <= 31 && (c - 2) / 30 < pool ? G(0.75) : W(c >= 2 && c <= 31 ? 0.08 : 0);
  }
  if (g < 0 || g > 3 || x > 4 || r < 4 || r > 19) return 0;
  const h = (19 - r) / 16, used = g < wk ? 1 - left[g] : g === wk ? f * (1 - left[g]) : 0;
  if (h > 1 - used) return 0;
  return g < wk ? G(0.4) : g === wk ? A(0.85) : W(0.45);
};

/** Code typed line by line, then the response comes back below in green. */
const docs: Fn = (c, r, t) => {
  const lines = [[3, 0, 14], [5, 2, 20], [7, 2, 12], [9, 2, 17], [11, 0, 3]], out = [[16, 0, 22], [18, 2, 15], [20, 0, 9]];
  const p = (t % 9) / 9, total = lines.reduce((s, l) => s + l[2], 0);
  let typed = Math.floor(Math.min(1, p / 0.55) * total);
  for (const [row, ind, len] of lines) {
    if (r === row) {
      const k = c - 2 - ind;
      if (k >= 0 && k < len) return k < typed ? W(0.7) : 0;
      if (k === typed && typed < len && Math.floor(t * 3) % 2) return A(0.9);
      return 0;
    }
    typed = Math.max(-1, typed - len);
  }
  for (const [row, ind, len] of out) {
    const k = c - 2 - ind;
    if (r === row && k >= 0 && k < len) return p > 0.6 + (row - 16) * 0.05 ? G(0.65) : 0;
  }
  return 0;
};

/** A message arcs from you to us, then the reply arcs back. */
const contact: Fn = (c, r, t) => {
  const p = (t % 7) / 7, ax = 4, bx = 29, y0 = 13;
  if (Math.hypot(c - ax, r - y0) < 1.6) return W(0.85);
  if (Math.hypot(c - bx, r - y0) < 1.6) return A(0.85);
  const arc = (s: number, up: boolean) => [ax + (bx - ax) * (up ? s : 1 - s), y0 + (up ? -1 : 1) * Math.sin(Math.PI * s) * 8];
  for (const [up, a, b] of [[true, 0, 0.45], [false, 0.5, 0.95]] as const) {
    if (p < a) continue;
    const s = Math.min(1, (p - a) / (b - a));
    for (let k = 0; k <= 24; k++) {
      const q = (k / 24) * s, [x, y] = arc(q, up);
      if (Math.hypot(c - x, r - y) < 0.6) { const head = s - q < 0.08 && s < 1; return up ? A(head ? 0.95 : 0.25) : G(head ? 0.95 : 0.25); }
    }
  }
  return 0;
};

export const SCENES = {
  trust: { fn: trust, still: 6.5 },
  security: { fn: security, still: 7 },
  legal: { fn: legal, still: 5.5 },
  operators: { fn: operators, still: 1 },
  good: { fn: good, still: 7 },
  checkout: { fn: checkout, still: 5.5 },
  docs: { fn: docs, still: 7.5 },
  contact: { fn: contact, still: 3 },
} satisfies Record<string, { fn: Fn; still: number }>;
export type SceneName = keyof typeof SCENES;

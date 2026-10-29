'use strict';
/* ------------------------------------------------------------------ *
 *  Motion toolkit: timing constants, easing, color, drawing helpers.
 *  Everything is a pure function of time so any frame can be rendered
 *  in isolation (and in parallel).
 * ------------------------------------------------------------------ */

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const FPS = 60, DURATION = 15, BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4; // 32 beats == 15.000 s
const TAU = Math.PI * 2;

const C = {
  ink: '#0b0b10', cream: '#f4efe6', orange: '#ff5a2c', amber: '#ff9b3d', yellow: '#ffd23f',
  lime: '#c8ff3d', cyan: '#19e3ff', violet: '#7b4dff', pink: '#ff3d8b', navy: '#0d0e24',
};

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const map = (t, a, b) => clamp((t - a) / (b - a));
const fract = x => x - Math.floor(x);
const mod = (a, n) => ((a % n) + n) % n;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------- easing ----------------------------- */
const E = {
  lin: x => x,
  inQ: x => x * x,
  outQ: x => 1 - (1 - x) * (1 - x),
  inC: x => x * x * x,
  outC: x => 1 - Math.pow(1 - x, 3),
  ioC: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQt: x => 1 - Math.pow(1 - x, 5),
  ioQt: x => (x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2),
  inExp: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExp: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  ioExp: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
  outElastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1),
  // critically-underdamped spring, x in 0..1
  spring: (x, f = 2.6, d = 5.5) => (x <= 0 ? 0 : 1 - Math.exp(-d * x) * Math.cos(f * TAU * x)),
};

/* ---------------------------- color ------------------------------ */
const _hexCache = {};
function rgb(h) {
  if (_hexCache[h]) return _hexCache[h];
  const n = parseInt(h.slice(1), 16);
  return (_hexCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
function mixc(a, b, t, alpha = 1) {
  const A = rgb(a), B = rgb(b);
  return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${alpha})`;
}
function ramp(stops, t, alpha = 1) {
  const n = stops.length - 1, x = clamp(t) * n, i = Math.min(n - 1, Math.floor(x));
  return mixc(stops[i], stops[i + 1], x - i, alpha);
}
function rampRGB(stops, t) {
  const n = stops.length - 1, x = clamp(t) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const A = rgb(stops[i]), B = rgb(stops[i + 1]);
  return [lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f)];
}
function withA(hex, a) { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

/* ------------------------- drawing helpers ----------------------- */
function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)));
}

/** Round-capped asterisk burst — the recurring brand glyph of the reel. */
function sparkle(c, x, y, R, color, rot = 0, n = 12, lw = null) {
  c.save();
  c.translate(x, y); c.rotate(rot);
  c.strokeStyle = color; c.lineCap = 'round'; c.lineWidth = lw == null ? R * 0.27 : lw;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const len = R * (i % 2 === 0 ? 1 : 0.74) * (1 - 0.1 * ((i * 7) % 3) / 2);
    c.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12);
    c.lineTo(Math.cos(a) * len, Math.sin(a) * len);
  }
  c.stroke();
  c.restore();
}

/** Per-glyph layout using the current ctx font. */
function glyphs(c, str, track = 0) {
  const g = [];
  for (let i = 0; i < str.length; i++) {
    const pre = c.measureText(str.slice(0, i)).width;
    g.push({ ch: str[i], x: pre + i * track, w: c.measureText(str[i]).width, i });
  }
  return { g, total: c.measureText(str).width + (str.length - 1) * track };
}

const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>=';
function scramble(str, p, seed = 1, tt = 0) {
  let out = '';
  const n = str.length, step = Math.floor(tt * 24);
  for (let i = 0; i < n; i++) {
    if (str[i] === ' ' || i < p * n) out += str[i];
    else out += SCRAMBLE[Math.floor(hash(i * 7.13 + seed * 3.1 + step * 1.7) * SCRAMBLE.length)];
  }
  return out;
}

/** Catmull-Rom → bezier smooth path through points (c must be mid-path). */
function smoothThrough(c, pts) {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.18;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t,
      p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
}

/** global kick envelope (1 on the beat, decays). t in seconds on the global timeline. */
const kickEnv = (t, k = 6) => Math.exp(-fract(t / BEAT) * k);

/** radial glow sprite, cached per color */
const _glow = {};
function glowSprite(color, size = 128) {
  const key = color + size;
  if (_glow[key]) return _glow[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c0 = rgb(color);
  g.addColorStop(0, `rgba(${c0[0]},${c0[1]},${c0[2]},1)`);
  g.addColorStop(0.25, `rgba(${c0[0]},${c0[1]},${c0[2]},0.55)`);
  g.addColorStop(1, `rgba(${c0[0]},${c0[1]},${c0[2]},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return (_glow[key] = cv);
}

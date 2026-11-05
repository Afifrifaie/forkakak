'use strict';
/* Soundtrack generated entirely in code (no samples): node synth.js out.wav
   Ambient pad + ink/pen textures + kalimba plucks + FM bells, all locked to js/timeline.js. */
const fs = require('fs');
const TL = require('./js/timeline.js');
const SR = 44100, DUR = TL.DUR, N = Math.floor(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);       // dry bus
const RL = new Float32Array(N), RR = new Float32Array(N);     // reverb send

let seed = 20240929; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);          // midi -> Hz
const TAU = Math.PI * 2;
function add(i, v, pan, send = 0) {                            // equal-power pan
  if (i < 0 || i >= N) return;
  const a = (pan + 1) * Math.PI / 4, l = Math.cos(a) * v, r = Math.sin(a) * v;
  L[i] += l; R[i] += r; RL[i] += l * send; RR[i] += r * send;
}

// ---- instruments -------------------------------------------------------------------------
function pluck(t0, f, amp, pan = 0, send = 0.5) {              // kalimba / marimba-ish
  const n = Math.floor(SR * 1.6), s0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, atk = Math.min(1, t / 0.002);
    const v = (Math.sin(TAU * f * t) * Math.exp(-t / 0.55) + 0.32 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / 0.09) + 0.15 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / 0.03)) * atk * amp;
    add(s0 + i, v, pan, send);
  }
}
function bell(t0, f, amp, pan = 0, tau = 2.2) {               // FM bell
  const n = Math.floor(SR * tau * 4), s0 = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.exp(-t / tau) * Math.min(1, t / 0.004), idx = 2.6 * Math.exp(-t / 0.7);
    add(s0 + i, Math.sin(TAU * f * t + idx * Math.sin(TAU * f * 3.5 * t)) * env * amp, pan, 0.7);
  }
}
function thump(t0, f0, f1, amp, tau = 0.12) {
  const n = Math.floor(SR * 0.6), s0 = Math.floor(t0 * SR); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.05)) / SR; add(s0 + i, Math.sin(ph) * Math.exp(-t / tau) * amp, 0, 0.15); }
}
function tick(t0, amp, f = 1800, pan = 0) {                    // woody click
  const n = Math.floor(SR * 0.05), s0 = Math.floor(t0 * SR); let lp = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; lp += 0.4 * (noise() - lp); add(s0 + i, (lp * 0.8 + Math.sin(TAU * f * t) * 0.5) * Math.exp(-t / 0.008) * amp, pan, 0.3); }
}
// band-passed noise with a volume/centre-frequency curve — used for pen scratches, whooshes, shimmers
function noiseBand(t0, t1, ampFn, freqFn, q, panFn, send = 0.25, gate = 0) {
  const s0 = Math.floor(t0 * SR), s1 = Math.floor(t1 * SR); let lo = 0, bp = 0, g = 1, gc = 0;
  for (let i = s0; i < s1; i++) {
    const u = (i - s0) / (s1 - s0), f = freqFn(u), a = ampFn(u); if (a <= 0) continue;
    const F = 2 * Math.sin(Math.PI * f / SR), Q = 1 / q;
    const x = noise(); lo += F * bp; const hi = x - lo - Q * bp; bp += F * hi;
    if (gate && --gc <= 0) { g = rnd() < gate ? 0.25 : 1; gc = 40 + Math.floor(rnd() * 160); }  // crackle: breaks in the stroke
    add(i, bp * a * g, panFn ? panFn(u) : 0, send);
  }
}
const dprog = u => { const e = 1e-3; return (TL.prog(Math.min(1, u + e)) - TL.prog(Math.max(0, u - e))) / (2 * e); };

// ---- pad ---------------------------------------------------------------------------------
function padNote(t0, t1, f, amp, pan, cutoff = 0.05) {
  const rel = 1.3, atk = 1.3, s0 = Math.floor(t0 * SR), s1 = Math.floor((t1 + rel) * SR); let lp1 = 0, lp2 = 0;
  const ph = [rnd(), rnd(), rnd()], det = [1, 1.0035, 0.9965];
  for (let i = s0; i < s1 && i < N; i++) {
    const t = (i - s0) / SR; const env = Math.min(1, t / atk) * (i / SR < t1 ? 1 : Math.max(0, 1 - (i / SR - t1) / rel));
    let x = 0; for (let v = 0; v < 3; v++) { ph[v] += f * det[v] / SR; for (let k = 1; k <= 7; k++) x += Math.sin(TAU * ph[v] * k) / Math.pow(k, 1.4); }
    lp1 += cutoff * (x - lp1); lp2 += cutoff * (lp1 - lp2);
    add(i, lp2 * env * env * amp / 3, pan + Math.sin(t * 0.4 + f) * 0.2, 0.55);
  }
}
const M = { D2: 38, A2: 45, Bb2: 46, G2: 43, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, Bb3: 58, Cs4: 61, D4: 62, E4: 64, Fs3: 54 };
const chords = [
  [0.0, 2.7, [M.D3, M.A3], 0.20],
  [2.5, 5.6, [M.D3, M.F3, M.A3, M.E4], 0.26],
  [5.4, 7.5, [M.Bb2, M.D3, M.F3, M.A3], 0.27],
  [7.3, 9.4, [M.G2, M.D3, M.F3, M.Bb3], 0.24],
  [9.2, 12.2, [M.A2, M.E3, M.G3, M.Cs4], 0.27],
  [12.1, 14.6, [M.D3, M.Fs3, M.A3, M.E4, M.D4], 0.34],
];
chords.forEach(([a, b, notes, amp]) => notes.forEach((m, i) => padNote(a, b, hz(m), amp / Math.sqrt(notes.length) * 0.9, (i / Math.max(1, notes.length - 1) - 0.5) * 0.9, m < 48 ? 0.03 : 0.055)));
{ let ph = 0; for (let i = 0; i < N; i++) { const t = i / SR, env = Math.min(1, t / 1.5) * (t > 14 ? Math.max(0, 1 - (t - 14)) : 1); ph += TAU * hz(M.D2) / SR; add(i, (Math.sin(ph) + 0.25 * Math.sin(ph * 2)) * 0.10 * env, 0, 0.1); } }

// ---- scene 1: card builds in ---------------------------------------------------------------
noiseBand(TL.card[0], TL.card[1] + 0.05, u => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.96)), 1.5) * 0.35, u => 350 + 5200 * u * u, 1.4, u => -0.5 + u, 0.5);
thump(TL.card[1] - 0.02, 95, 48, 0.55); tick(TL.card[1] - 0.02, 0.18, 900);
noiseBand(TL.cardBorder[0], TL.cardBorder[1], u => Math.sin(Math.PI * u) * 0.07, u => 3000 + 4000 * u, 9, u => Math.sin(u * 6) * 0.7, 0.6);
for (let i = 0; i < 9; i++) pluck(TL.cardBorder[0] + i * 0.1, hz([74, 78, 81, 86, 90, 93, 98, 102, 105][i]), 0.035, (i / 8 - 0.5) * 1.2, 0.8);
noiseBand(TL.panelBorder[0], TL.panelBorder[1] + 0.2, u => Math.sin(Math.PI * u) * 0.12, u => 600 + 2600 * u, 2, () => 0, 0.5);
bell(TL.panelBorder[1] + 0.05, hz(86), 0.07, 0.2, 1.4);
noiseBand(TL.penIn[0], TL.penIn[1] + 0.2, u => Math.sin(Math.PI * u) * 0.10, u => 1800 + 2200 * u, 3, () => 0.5, 0.4);

// ---- scene 2: ba is written ------------------------------------------------------------------
const panAt = (x0, x1, c0 = 540, span = 330) => u => -((x0 + (x1 - x0) * u) - c0) / span * 0.8;     // follows the pen on screen (right -> left)
noiseBand(TL.baBody[0], TL.baBody[1], u => Math.min(1, u * 30) * Math.min(1, (1 - u) * 20) * (0.04 + 0.4 * dprog(u)), u => 2300 + 2300 * dprog(u) + 700 * Math.sin(u * 40), 2.6, panAt(706, 346), 0.25, 0.35);
noiseBand(TL.baBody[0], TL.baBody[1], u => (0.02 + 0.22 * dprog(u)), u => 420 + 200 * dprog(u), 1.2, panAt(706, 346, 540, 660), 0.2);
noiseBand(TL.baBody[0] + 0.2, TL.baBody[1] + 0.2, u => Math.pow(u, 2) * 0.10, u => 800 + 3000 * u, 1.5, () => 0, 0.5);
{ const t = TL.baDot; pluck(t, hz(74), 0.34, 0.1, 0.6); pluck(t, hz(62), 0.10, 0, 0.5); tick(t - 0.005, 0.26, 1500, 0.1); thump(t, 160, 90, 0.18, 0.08); }
noiseBand(TL.labelBa[0], TL.labelBa[1], u => Math.sin(Math.PI * u) * 0.13, u => 2800 + 900 * u, 3, u => -0.7 + 0.2 * u, 0.3, 0.2);

// ---- scene 3: the small row pops in ----------------------------------------------------------------
[['ba', 74, 0.6], ['bi', 78, 0.0], ['bu', 81, -0.6]].forEach(([id, m, pan]) => {
  const T0 = TL.row[id]; thump(T0, 200, 110, 0.20, 0.07); pluck(T0, hz(m), 0.26, pan, 0.7);
  pluck(T0 + TL.rowDot, hz(m + 12), 0.10, pan, 0.8); tick(T0 + TL.rowDot, 0.12, 2200, pan);
  tick(T0 + TL.rowMark, 0.16, 1200, pan); pluck(T0 + TL.rowMark, hz(m + 7), 0.10, pan, 0.8);
  noiseBand(T0 + TL.rowLabel[0], T0 + TL.rowLabel[1], u => Math.sin(Math.PI * u) * 0.08, u => 2600 + 900 * u, 3, () => pan, 0.35, 0.15);
});
bell(5.75, hz(86), 0.12, 0.1, 1.6);

// ---- scene 4: zoom in --------------------------------------------------------------------------------
noiseBand(TL.zoom[0], TL.zoom[1] + 0.1, u => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.97)), 1.3) * 0.34, u => 300 + 6200 * u * u, 1.2, u => -0.3 + 0.6 * u, 0.5);
{ const s0 = Math.floor(TL.zoom[0] * SR), s1 = Math.floor((TL.zoom[1] + 0.15) * SR); let ph = 0;                       // pitch riser under the whoosh
  for (let i = s0; i < s1; i++) { const u = (i - s0) / (s1 - s0), f = 110 * Math.pow(4, u); ph += TAU * f / SR; add(i, Math.sin(ph) * Math.pow(Math.sin(Math.PI * u), 1.2) * 0.12, 0, 0.3); } }
thump(TL.zoom[1], 70, 42, 0.32, 0.22);
bell(TL.zoom[1] + 0.05, hz(62), 0.10, 0, 2.2);

// ---- scene 5: shrink and re-form ---------------------------------------------------------------------------
noiseBand(TL.retract[0], TL.retract[1] + 0.05, u => Math.pow(u, 1.4) * 0.22 * Math.min(1, (1 - u) * 14), u => 6500 - 4800 * u, 6, u => 0.7 - 1.4 * u, 0.8);     // reverse shimmer as the bowl is pulled back
{ const s0 = Math.floor(TL.retract[0] * SR), s1 = Math.floor(TL.retract[1] * SR); let ph = 0;
  for (let i = s0; i < s1; i++) { const u = (i - s0) / (s1 - s0), f = 1500 - 900 * u; ph += TAU * f / SR; add(i, Math.sin(ph) * Math.pow(u, 2) * 0.07, -0.2, 0.8); } }
tick(TL.retract[1], 0.20, 1400, 0.2); thump(TL.retract[1], 180, 100, 0.16, 0.07);
{ const s0 = Math.floor(TL.dotSlide[0] * SR), s1 = Math.floor(TL.dotSlide[1] * SR); let ph = 0;                          // the dot gliding to its new place
  for (let i = s0; i < s1; i++) { const u = (i - s0) / (s1 - s0), f = 900 - 220 * u; ph += TAU * f / SR; add(i, Math.sin(ph) * Math.sin(Math.PI * u) * 0.05, 0.4, 0.8); } }
tick(TL.dotSlide[1], 0.12, 2000, 0.4);

// ---- scene 6: tha is written and joined ------------------------------------------------------------------------
noiseBand(TL.wordBase[0], TL.wordBase[1], u => Math.min(1, u * 30) * Math.min(1, (1 - u) * 15) * (0.04 + 0.3 * dprog(u)), u => 2600 + 1800 * dprog(u), 2.6, panAt(640, 532, 467, 300), 0.25, 0.3);
noiseBand(TL.thWrite[0], TL.thWrite[1], u => Math.min(1, u * 40) * Math.min(1, (1 - u) * 25) * (0.04 + 0.4 * dprog(u)), u => 2300 + 2300 * dprog(u) + 700 * Math.sin(u * 40), 2.6, panAt(582, 208, 467, 300), 0.25, 0.35);
noiseBand(TL.thWrite[0], TL.thWrite[1], u => (0.02 + 0.22 * dprog(u)), u => 420 + 200 * dprog(u), 1.2, panAt(582, 208, 467, 600), 0.2);
[74, 81].forEach((m, i) => { pluck(TL.seamT + i * 0.03, hz(m), 0.20, 0.1 - i * 0.2, 0.9); bell(TL.seamT + i * 0.03, hz(m + 12), 0.07, 0, 1.6); });       // the join: a perfect fifth
TL.thaDots.forEach((t, i) => { const pan = [0.25, -0.25, 0][i]; pluck(t, hz([81, 83, 86][i]), 0.34, pan, 0.6); pluck(t, hz([69, 71, 74][i]), 0.10, 0, 0.5); tick(t - 0.005, 0.26, 1500 + 300 * i, pan); thump(t, 160, 90, 0.18, 0.08); });

// ---- scene 7: the finished word + caption -------------------------------------------------------------------------
const tf = TL.pulse; thump(tf, 110, 40, 0.5, 0.25);
[74, 78, 81, 88].forEach((m, i) => bell(tf + i * 0.045, hz(m), 0.19, (i - 1.5) * 0.35, 2.6)); bell(tf, hz(62), 0.13, 0, 3.0);
noiseBand(TL.sweep[0], TL.sweep[1] + 0.3, u => Math.sin(Math.PI * Math.min(1, u * 0.95)) * 0.11, u => 2500 + 7000 * u, 6, u => Math.sin(u * 9) * 0.8, 0.8);
noiseBand(TL.cap.ba[0], TL.cap.ba[1], u => Math.sin(Math.PI * u) * 0.10, u => 2600 + 900 * u, 3, () => -0.2, 0.3, 0.15);
pluck(TL.cap.plus, hz(90), 0.14, 0, 0.9); tick(TL.cap.plus, 0.14, 2400, 0);
noiseBand(TL.cap.tha[0], TL.cap.tha[1], u => Math.sin(Math.PI * u) * 0.10, u => 2600 + 900 * u, 3, () => 0.2, 0.3, 0.15);
const pent = [86, 88, 90, 93, 95, 98, 100, 102];
for (let i = 0; i < 16; i++) { const t = TL.sparkles[0] + 0.45 + i * 0.12 + rnd() * 0.04; if (t < 14.5) pluck(t, hz(pent[Math.floor(rnd() * pent.length)]), 0.05 * (1 - i / 22), (rnd() - 0.5) * 1.6, 0.9); }
bell(13.7, hz(98), 0.07, 0.4, 2.2);

// ---- reverb (Freeverb-style, stereo) -------------------------------------------------------
function reverb(inp, spread) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d: d + spread, b: new Float32Array(d + spread), i: 0, s: 0 }));
  const aps = [225, 556].map(d => ({ d: d + spread, b: new Float32Array(d + spread), i: 0 }));
  const out = new Float32Array(N), fb = 0.86, damp = 0.35;
  for (let n = 0; n < N; n++) {
    let y = 0; const x = inp[n] * 0.06;
    for (const c of combs) { const v = c.b[c.i]; c.s = v * (1 - damp) + c.s * damp; c.b[c.i] = x + c.s * fb; if (++c.i >= c.d) c.i = 0; y += v; }
    for (const a of aps) { const v = a.b[a.i]; const o = -y + v; a.b[a.i] = y + v * 0.5; y = o; if (++a.i >= a.d) a.i = 0; }
    out[n] = y;
  }
  return out;
}
const wl = reverb(RL, 0), wr = reverb(RR, 23);

// ---- master: mix, tilt, fade, soft-clip, normalise ------------------------------------------------
const outL = new Float32Array(N), outR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.15) * (t > DUR - 0.9 ? Math.pow(Math.max(0, (DUR - t) / 0.9), 1.5) : 1);
  outL[i] = (L[i] + wl[i] * 1.0) * fade; outR[i] = (R[i] + wr[i] * 1.0) * fade;
}
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
const gain = 0.89 / peak * 0.62;   // lands around -15 LUFS, true peak ≈ -4 dB
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.tanh(outL[i] * gain * 1.15) / Math.tanh(1.15) * 32000), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.tanh(outR[i] * gain * 1.15) / Math.tanh(1.15) * 32000), 46 + i * 4);
}
fs.writeFileSync(process.argv[2] || 'soundtrack.wav', buf);
console.log(`soundtrack: ${DUR}s, peak(pre-norm)=${peak.toFixed(3)}, gain=${gain.toFixed(2)}`);

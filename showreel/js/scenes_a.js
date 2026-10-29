'use strict';
/* ================================================================== *
 *  SCENES 1-4.   Each scene is  fn(ctx, t)  with t = seconds since the
 *  scene's own downbeat (can be slightly negative during the pre-roll
 *  that overlaps the preceding transition).
 * ================================================================== */

/* ---------------------------------------------------------------- *
 *  S1 — OPENER : slit reveal, masked kinetic type, spinning spark
 * ---------------------------------------------------------------- */
function S1(c, t) {
  c.fillStyle = C.ink; c.fillRect(0, 0, W, H);

  const lineIn = E.outExp(map(t, 0, 0.3));
  const open = E.outExp(map(t, 0.26, 0.8));
  const ph = H * open;

  c.fillStyle = C.orange;
  c.fillRect(0, CY - ph / 2, W, ph);

  // the slit: two cream edges that peel apart
  if (open < 0.995) {
    const lw = W * 0.48 * lineIn;
    c.fillStyle = C.cream;
    c.fillRect(CX - lw, CY - ph / 2 - 3, lw * 2, 6);
    c.fillRect(CX - lw, CY + ph / 2 - 3, lw * 2, 6);
  }

  // push-in anticipation before the iris transition
  c.save();
  const push = 1 + 0.035 * E.inQ(map(t, 1.35, 1.9));
  c.translate(CX, CY); c.scale(push, push); c.translate(-CX, -CY);

  // spark behind the type
  const sT = map(t, 0.5, 1.3);
  const sc = E.outBack(sT, 2.4);
  const srot = (1 - E.outExp(map(t, 0.5, 1.7))) * -TAU * 0.75 + t * 0.55;
  if (sc > 0.001) sparkle(c, 1630, 238, 158 * sc, C.cream, srot, 12);

  // type
  c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.miterLimit = 2;
  const fs = 308;
  c.font = `${fs}px "Archivo Black"`;
  const g1 = glyphs(c, 'MOTION', -6);
  const g2 = glyphs(c, 'DESIGN', -6);
  const x1 = CX - g1.total / 2, x2 = CX - g2.total / 2;
  const base1 = 538, base2 = 818, capH = fs * 0.74;

  // line 1: solid, rises out of a mask
  c.save();
  c.beginPath(); c.rect(0, base1 - capH - 6, W, capH + 6 + fs * 0.03); c.clip();
  g1.g.forEach(q => {
    const a = E.outExp(map(t, 0.38 + q.i * 0.05, 0.98 + q.i * 0.05));
    c.save();
    c.translate(x1 + q.x, base1 + (1 - a) * fs * 1.0);
    c.scale(1, 1 + (1 - a) * 0.25);
    c.fillStyle = C.ink; c.fillText(q.ch, 0, 0);
    c.restore();
  });
  c.restore();

  // line 2: outline drops in from above, then fills with a wipe
  c.save();
  c.beginPath(); c.rect(0, base2 - capH - 6, W, capH + 6 + fs * 0.03); c.clip();
  g2.g.forEach(q => {
    const a = E.outExp(map(t, 0.62 + q.i * 0.05, 1.2 + q.i * 0.05));
    c.save();
    c.translate(x2 + q.x, base2 - (1 - a) * fs * 1.0);
    c.strokeStyle = C.ink; c.lineWidth = 5; c.strokeText(q.ch, 0, 0);
    c.restore();
  });
  const sweep = E.ioC(map(t, 1.1, 1.62));
  if (sweep > 0) {
    c.beginPath(); c.rect(x2 - 10, base2 - capH - 10, (g2.total + 20) * sweep, capH + fs * 0.1); c.clip();
    g2.g.forEach(q => { c.fillStyle = C.ink; c.fillText(q.ch, x2 + q.x, base2); });
  }
  c.restore();

  // small mono captions that decode in
  c.font = '500 24px "JetBrains Mono"';
  c.letterSpacing = '5px';
  c.fillStyle = C.ink;
  const p1 = map(t, 0.9, 1.5);
  if (p1 > 0) c.fillText(scramble('PORTFOLIO / SHOWREEL / 2026', p1, 2, t), x1 + 4, 262);
  c.textAlign = 'right';
  if (p1 > 0) c.fillText(scramble('15 SECONDS OF CRAFT', p1, 5, t), x2 + g2.total - 4, 880);
  c.textAlign = 'left';
  c.letterSpacing = '0px';

  // ruler ticks
  c.fillStyle = C.ink;
  for (let k = 0; k < 116; k++) {
    const x = 64 + k * 15.58;
    const d = Math.abs(k - 58) * 0.0045;
    const a = E.outExp(map(t, 0.75 + d, 1.15 + d));
    const h = (k % 10 === 0 ? 46 : k % 5 === 0 ? 30 : 16) * a;
    c.fillRect(x, 986 - h, 3, h);
  }
  c.restore();
}

/* ---------------------------------------------------------------- *
 *  S2 — GEOMETRY : 144 shapes, radial stagger, circle→square→pinwheel
 * ---------------------------------------------------------------- */
function S2(c, t) {
  const u = t / BEAT;
  c.fillStyle = C.navy; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(CX, CY, 0, CX, CY, 1000);
  gl.addColorStop(0, 'rgba(123,77,255,0.30)'); gl.addColorStop(1, 'rgba(13,14,36,0)');
  c.fillStyle = gl; c.fillRect(0, 0, W, H);

  // shock rings on every beat
  c.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    const p = map(u, k, k + 1.5);
    if (p <= 0 || p >= 1) continue;
    c.strokeStyle = `rgba(244,239,230,${(1 - p) * 0.45})`;
    c.beginPath(); c.arc(CX, CY, E.outExp(p) * 1300, 0, TAU); c.stroke();
  }

  const cols = 16, rows = 9, cell = 120, maxd = Math.hypot(7.5, 4);
  const stops = [C.cyan, C.violet, C.pink, C.orange];
  const pulse = Math.exp(-fract(u) * 5);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = cell * (i + 0.5), y = cell * (j + 0.5);
      const d = Math.hypot(i - 7.5, j - 4) / maxd;
      const ap = E.outBack(map(u, -0.5 + d * 0.8, 0.1 + d * 0.8), 2.2);
      if (ap <= 0.001) continue;
      const m1 = E.ioC(map(u, 1.0 + d * 0.5, 1.8 + d * 0.5));
      const m2 = E.ioC(map(u, 2.0 + d * 0.5, 2.9 + d * 0.5));
      const ang = Math.atan2(y - CY, x - CX);
      const target = ang + TAU * Math.round((Math.PI / 2 - ang) / TAU);
      const rot = lerp(m1 * Math.PI / 2, target, m2);

      const size = 80 * ap * (1 + 0.1 * pulse * (1 - m2));
      const w = size * lerp(1, 1.6, m2) * (1 + 0.38 * Math.sin(d * 7 - u * 2.6) * m2);
      const h = size * lerp(1, 0.13, m2);
      const rad = lerp(lerp(0.5, 0.2, m1), 0.5, m2) * Math.min(w, h);
      const col = ramp(stops, clamp(d * 1.02 + 0.05 * Math.sin(u * 1.6 + d * 4)));

      c.save();
      c.translate(x, y); c.rotate(rot);
      c.globalAlpha = 0.16; c.fillStyle = col;
      rrect(c, -w * 0.85, -h * 0.85, w * 1.7, h * 1.7, rad * 1.7); c.fill();
      c.globalAlpha = 1;
      rrect(c, -w / 2, -h / 2, w, h, rad); c.fill();
      c.restore();
    }
  }
}

/* ---------------------------------------------------------------- *
 *  S3 — DEPTH : twisting light tunnel, speed streaks, word fly-through
 * ---------------------------------------------------------------- */
function S3(c, t) {
  c.fillStyle = '#04040c'; c.fillRect(0, 0, W, H);
  const tt = Math.max(t, -0.2);
  const K = kickEnv(t);

  c.save();
  c.translate(CX, CY);
  c.rotate(Math.sin(tt * 1.6) * 0.1 + tt * 0.12);
  const zm = 1 + 0.03 * K; c.scale(zm, zm);
  c.globalCompositeOperation = 'lighter';

  const P = 0.9 * tt + 0.7 * tt * tt;
  const N = 36, cols = [C.cyan, C.violet, C.pink, C.orange];
  for (let i = 0; i < N; i++) {
    const d = fract(i / N + P);
    const hw = 22 * Math.pow(110, d);
    const a = smooth(0, 0.14, d) * (1 - smooth(0.78, 0.98, d));
    if (a < 0.01) continue;
    c.save();
    c.rotate(d * 2.4 + tt * 0.3);
    c.strokeStyle = withA(cols[i % 4], a * 0.95);
    c.lineWidth = 1.5 + 30 * Math.pow(d, 2.6);
    if (i % 7 === 0) { c.beginPath(); c.arc(0, 0, hw * 0.9, 0, TAU); }
    else rrect(c, -hw, -hw, hw * 2, hw * 2, hw * 0.2);
    c.stroke();
    c.restore();
  }

  // speed streaks
  c.lineCap = 'round';
  for (let k = 0; k < 170; k++) {
    const a = hash(k) * TAU, sp = 0.6 + hash(k + 50) * 1.4;
    const f = fract(hash(k + 99) + tt * sp * 1.3);
    const r1 = 70 + Math.pow(f, 2.2) * 1500;
    const r0 = r1 - (20 + f * f * 380) * (0.5 + hash(k + 3));
    c.strokeStyle = withA(k % 3 ? C.cream : C.cyan, 0.6 * smooth(0, 0.2, f) * (1 - smooth(0.85, 1, f)));
    c.lineWidth = 1 + f * 3;
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
  }

  // the word flies through the camera
  const wp = map(t, 0.05, 1.7);
  const wa = smooth(0.05, 0.22, t) * (1 - smooth(1.4, 1.78, t));
  if (wa > 0.01) {
    const size = 70 * Math.pow(24, wp);
    c.font = `${size}px "Archivo Black"`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const split = size * 0.018 + 1;
    c.fillStyle = `rgba(255,50,90,${wa * 0.8})`; c.fillText('DEPTH', -split, 0);
    c.fillStyle = `rgba(30,235,255,${wa * 0.8})`; c.fillText('DEPTH', split, 0);
    c.fillStyle = `rgba(255,255,255,${wa * 0.95})`; c.fillText('DEPTH', 0, 0);
  }
  c.restore();

  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.35 + 0.4 * K;
  c.drawImage(glowSprite(C.violet), CX - 520, CY - 520, 1040, 1040);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

/* ---------------------------------------------------------------- *
 *  S4 — FLUID : per-pixel metaballs (analytic normals, chrome LUT) with a
 *  word that is *refracted* by the liquid surface via a sampled text mask.
 * ---------------------------------------------------------------- */
const FW = 960, FH = 540;
const fieldCv = document.createElement('canvas'); fieldCv.width = FW; fieldCv.height = FH;
const fieldCx = fieldCv.getContext('2d');
const fieldImg = fieldCx.createImageData(FW, FH);
const maskCv = document.createElement('canvas'); maskCv.width = FW; maskCv.height = FH;
const maskCx = maskCv.getContext('2d', { willReadFrequently: true });
const LIQ = (() => {
  const stops = ['#0a0620', '#2a1190', '#6b3cff', '#ff3d8b', '#ff8a3d', '#ffe9b0'];
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) { const v = rampRGB(stops, i / 255); lut[i * 3] = v[0]; lut[i * 3 + 1] = v[1]; lut[i * 3 + 2] = v[2]; }
  return lut;
})();

function S4(c, t) {
  const K = kickEnv(t);
  const tt = Math.max(t, -0.2);
  const NB = 9;
  const bx = new Float32Array(NB), by = new Float32Array(NB), br2 = new Float32Array(NB);
  const aspect = W / H;
  const burst = E.outExp(map(t, -0.2, 0.7));
  for (let k = 0; k < NB; k++) {
    let x, y, r;
    if (k === 0) {
      x = aspect / 2 + 0.14 * Math.sin(tt * 2.1); y = 0.5 + 0.09 * Math.cos(tt * 2.7);
      r = 0.19 * E.outBack(map(t, -0.2, 0.45), 2) * (1 + 0.2 * K);
    } else {
      const a1 = 0.7 + 0.37 * k, a2 = 0.9 + 0.29 * k;
      const px = aspect / 2 + (0.2 + 0.1 * (k % 4)) * aspect * Math.sin(tt * a1 * 1.25 + k * 1.7);
      const py = 0.5 + (0.22 + 0.04 * (k % 3)) * Math.cos(tt * a2 * 1.3 + k * 2.3);
      x = lerp(aspect / 2, px, burst); y = lerp(0.5, py, burst);
      r = (0.07 + 0.05 * hash(k)) * (1 + 0.3 * K) * burst;
    }
    bx[k] = x; by[k] = y; br2[k] = r * r;
  }

  // text mask (half-res), letters rise & settle
  maskCx.clearRect(0, 0, FW, FH);
  maskCx.font = '262px "Anton"'; maskCx.textBaseline = 'alphabetic'; maskCx.fillStyle = '#fff';
  const g = glyphs(maskCx, 'LIQUID', 4), mx0 = FW / 2 - g.total / 2;
  g.g.forEach(q => {
    const a = E.outExp(map(t, 0.1 + q.i * 0.05, 0.6 + q.i * 0.05));
    if (a <= 0.001) return;
    maskCx.save();
    maskCx.translate(mx0 + q.x, 372 + Math.sin(tt * 3 + q.i * 0.8) * 9 + (1 - a) * 150);
    maskCx.scale(1, a); maskCx.fillText(q.ch, 0, 0);
    maskCx.restore();
  });
  const md = maskCx.getImageData(0, 0, FW, FH).data;

  const d = fieldImg.data;
  const L0 = -0.45, L1 = -0.55, L2 = 0.7, ll = Math.hypot(L0, L1, L2);
  const lx = L0 / ll, ly = L1 / ll, lz = L2 / ll;
  const hx = lx, hy = ly, hz = lz + 1, hl = Math.hypot(hx, hy, hz);
  const REF = 54;
  let o = 0;
  for (let j = 0; j < FH; j++) {
    const ny = (j + 0.5) / FH;
    for (let i = 0; i < FW; i++) {
      const nx = (i + 0.5) / FH;
      let f = 0, gx = 0, gy = 0;
      for (let k = 0; k < NB; k++) {
        const dx = nx - bx[k], dy = ny - by[k];
        const d2 = dx * dx + dy * dy + 1e-6;
        const q = br2[k] / d2;
        f += q;
        const k2 = -2 * q / d2;
        gx += k2 * dx; gy += k2 * dy;
      }
      const gl = Math.sqrt(gx * gx + gy * gy) + 1e-6;
      const sd = (f - 1) / gl * FH;               // signed distance estimate in field pixels (+ inside)
      const a = clamp(sd + 0.5, 0, 1);
      // background + soft halo + plain cream text
      const hh = Math.pow(clamp(f, 0, 1), 2.2);
      let r = 7 + 150 * hh * 0.55 + 255 * hh * hh * 0.18;
      let g2 = 4 + 60 * hh * 0.55 + 70 * hh * hh * 0.18;
      let b = 16 + 255 * hh * 0.55 + 120 * hh * hh * 0.18;
      const tOut = md[(j * FW + i) * 4 + 3] / 255 * 0.96;
      r += (244 - r) * tOut; g2 += (239 - g2) * tOut; b += (230 - b) * tOut;
      if (a > 0) {
        // dome height = 1 - exp(-1.2 (f-1)); normal from its gradient (flat in the middle, grazing at the rim)
        const e1 = 1.2 * Math.exp(-1.2 * (f - 1));
        const ux = -gx * e1 * 0.08, uy = -gy * e1 * 0.08, il = 1 / Math.sqrt(ux * ux + uy * uy + 1);
        const nxx = ux * il, nyy = uy * il, nz = il;
        const dif = nxx * lx + nyy * ly + nz * lz;
        const spec = Math.pow(Math.max(0, (nxx * hx + nyy * hy + nz * hz) / hl), 48);
        const rim = Math.pow(1 - nz, 2.5);
        const idx = Math.floor(clamp(0.52 * dif + 0.33 + 0.1 * Math.sin(Math.min(f, 3.5) * 2.2 + tt * 1.6)) * 255) * 3;
        let ir = LIQ[idx], ig = LIQ[idx + 1], ib = LIQ[idx + 2];
        // refracted ink text seen through the liquid
        const sx = Math.min(FW - 1, Math.max(0, Math.round(i - nxx * REF))), sy = Math.min(FH - 1, Math.max(0, Math.round(j - nyy * REF)));
        const tIn = md[(sy * FW + sx) * 4 + 3] / 255 * 0.94;
        ir += (20 - ir) * tIn; ig += (8 - ig) * tIn; ib += (48 - ib) * tIn;
        ir += spec * 230 + rim * 40; ig += spec * 230 + rim * 170; ib += spec * 230 + rim * 220;
        r += (ir - r) * a; g2 += (ig - g2) * a; b += (ib - b) * a;
      }
      d[o++] = r > 255 ? 255 : r; d[o++] = g2 > 255 ? 255 : g2; d[o++] = b > 255 ? 255 : b; d[o++] = 255;
    }
  }
  fieldCx.putImageData(fieldImg, 0, 0);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(fieldCv, 0, 0, W, H);
}

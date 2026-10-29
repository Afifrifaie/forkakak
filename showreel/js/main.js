'use strict';
/* ================================================================== *
 *  Compositor: scene scheduling, transitions, post FX, HUD.
 *  window.renderFrame(t) is a pure function of t (seconds).
 * ================================================================== */

const mk = () => { const x = document.createElement('canvas'); x.width = W; x.height = H; return x; };
const cv = document.getElementById('cv');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const cA = mk(), cB = mk(), comp = mk(), tmp = mk(), chR = mk(), chG = mk(), chB = mk();
const compX = comp.getContext('2d');

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8];
const LABELS = ['INTRO', 'GEOMETRY', 'DEPTH', 'FLUID', 'DATA / UI', 'DIMENSION', 'TYPE', 'FINALE'];
const TRW = 0.19; // half-width of a transition window (s)
const TR_ANCHOR_S1 = [1630, 238];

function drawScene(i, canvas, t) {
  const x = canvas.getContext('2d');
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.shadowBlur = 0;
  SCENES[i](x, t - i * BAR);
  x.restore();
}

/* ----------------------------- transitions ----------------------------- */
function transition(kind, x, A, B, p, t) {
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  switch (kind) {
    case 1: { // iris wipe growing out of the spark
      x.drawImage(A, 0, 0);
      const R = Math.hypot(W, H) * E.ioQt(p) * 1.02;
      const s = lerp(1.14, 1, E.outC(p));
      x.save(); x.beginPath(); x.arc(TR_ANCHOR_S1[0], TR_ANCHOR_S1[1], R, 0, TAU); x.clip();
      x.translate(CX, CY); x.scale(s, s); x.translate(-CX, -CY); x.drawImage(B, 0, 0); x.restore();
      x.strokeStyle = C.cream; x.lineWidth = 14 * (1 - p) + 1;
      x.beginPath(); x.arc(TR_ANCHOR_S1[0], TR_ANCHOR_S1[1], R, 0, TAU); x.stroke();
      break;
    }
    case 2: { // staggered horizontal slice wipe
      const n = 9, hh = H / n;
      for (let i = 0; i < n; i++) {
        const q = E.ioC(map(p, i * 0.035, i * 0.035 + 0.62)), dir = i % 2 ? 1 : -1;
        x.save(); x.beginPath(); x.rect(0, i * hh, W, hh); x.clip();
        x.drawImage(A, -dir * q * W * 0.3, 0);
        x.drawImage(B, (1 - q) * W * dir, 0);
        x.restore();
      }
      break;
    }
    case 3: { // zoom-through with flash
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      const sb = lerp(0.62, 1, E.outExp(p));
      x.globalAlpha = smooth(0.2, 0.75, p);
      x.save(); x.translate(CX, CY); x.scale(sb, sb); x.translate(-CX, -CY); x.drawImage(B, 0, 0); x.restore();
      const sa = lerp(1, 3.6, E.inExp(p));
      x.globalAlpha = 1 - smooth(0.3, 0.8, p);
      x.save(); x.translate(CX, CY); x.scale(sa, sa); x.translate(-CX, -CY); x.drawImage(A, 0, 0); x.restore();
      x.globalAlpha = 1;
      const fl = Math.exp(-Math.pow((p - 0.5) / 0.16, 2));
      x.fillStyle = `rgba(255,255,255,${fl * 0.85})`; x.fillRect(0, 0, W, H);
      break;
    }
    case 4: { // whip pan with sampled motion blur
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      const shift = W * E.ioC(p), blur = Math.sin(p * Math.PI) * 0.4 * W, ns = 16;
      for (let s = 0; s < ns; s++) {
        const f = (s / (ns - 1) - 0.5) * blur;
        x.globalAlpha = 1 / (s + 1);
        x.drawImage(A, -shift + f, 0); x.drawImage(B, W - shift + f, 0);
      }
      x.globalAlpha = 1;
      break;
    }
    case 5: { // diagonal wipe + glitch bands
      x.drawImage(A, 0, 0);
      const sk = 0.55, pos = lerp(-H * 0.7, W + H * 0.7, E.ioC(p));
      const xt = pos - sk * CY, xb = pos + sk * CY;
      x.save(); x.beginPath(); x.moveTo(0, 0); x.lineTo(xt, 0); x.lineTo(xb, H); x.lineTo(0, H); x.closePath(); x.clip();
      x.drawImage(B, 0, 0); x.restore();
      x.strokeStyle = C.cream; x.lineWidth = 10;
      x.beginPath(); x.moveTo(xt, 0); x.lineTo(xb, H); x.stroke();
      // glitch: self-displaced bands near the edge
      const tx = tmp.getContext('2d'); tx.clearRect(0, 0, W, H); tx.drawImage(comp, 0, 0);
      const amp = Math.sin(p * Math.PI);
      const step = Math.floor(p * 40);
      for (let k = 0; k < 12; k++) {
        const y = hash(k * 3.7 + step) * H, h = 14 + hash(k + step * 0.3) * 70;
        const off = (hash(k * 9.1 + step * 1.3) - 0.5) * 220 * amp;
        x.drawImage(tmp, 0, y, W, h, off, y, W, h);
      }
      break;
    }
    case 6: { // pixel-block reveal
      x.drawImage(A, 0, 0);
      const bs = 60, cols = W / bs, rows = H / bs;
      x.save(); x.beginPath();
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const th = hash(q * 13.1 + r * 7.7) * 0.5 + (q / cols) * 0.4;
        const g = E.outBack(map(p, th * 0.7, th * 0.7 + 0.3), 1.2);
        if (g <= 0) continue;
        const s = Math.min(bs + 2, bs * g + 0.5);
        x.rect(q * bs + (bs - s) / 2, r * bs + (bs - s) / 2, s, s);
      }
      x.clip(); x.drawImage(B, 0, 0); x.restore();
      break;
    }
    case 7: { // iris-close into the finale
      x.drawImage(B, 0, 0);
      const R = Math.hypot(W, H) / 2 * (1 - E.ioExp(p)) + 0.01;
      x.save(); x.beginPath(); x.arc(CX, CY, R, 0, TAU); x.clip(); x.drawImage(A, 0, 0); x.restore();
      x.strokeStyle = C.cream; x.lineWidth = 12 * (1 - p) + 2; x.beginPath(); x.arc(CX, CY, R, 0, TAU); x.stroke();
      const fl = Math.exp(-Math.pow((p - 0.88) / 0.1, 2));
      x.fillStyle = `rgba(255,255,255,${fl * 0.9})`; x.fillRect(0, 0, W, H);
      break;
    }
  }
  x.restore();
}

/* ------------------------------- post FX ------------------------------- */
const vig = mk();
(() => {
  const x = vig.getContext('2d');
  const g = x.createRadialGradient(CX, CY, 380, CX, CY, 1250);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.36)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
})();

const grainTile = (() => {
  const s = 512, cvn = document.createElement('canvas'); cvn.width = cvn.height = s;
  const x = cvn.getContext('2d'), im = x.createImageData(s, s), r = rng(7);
  for (let i = 0; i < s * s; i++) { const v = 128 + (r() - 0.5) * 150; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0);
  return ctx.createPattern(cvn, 'repeat');
})();

function chroma(amount) {
  [[chR, '#ff0000', -amount], [chG, '#00ff00', 0], [chB, '#0000ff', amount]].forEach(([ch, col]) => {
    const x = ch.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.drawImage(comp, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
  });
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(chR, -amount, 0); ctx.drawImage(chG, 0, 0); ctx.drawImage(chB, amount, 0);
  ctx.globalCompositeOperation = 'source-over';
}

/* --------------------------------- HUD --------------------------------- */
const pad2 = n => String(n).padStart(2, '0');
function hud(t, frame) {
  const a = smooth(0.35, 0.9, t) * (1 - smooth(DURATION - 0.3, DURATION - 0.05, t));
  if (a <= 0.01) return;
  const si = clamp(Math.floor(t / BAR), 0, 7);
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.globalAlpha = a;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  ctx.font = '500 19px "JetBrains Mono"'; ctx.letterSpacing = '3px'; ctx.textBaseline = 'alphabetic';

  ctx.textAlign = 'left';
  ctx.fillText('CLAUDE®  —  MOTION REEL', 64, 66);
  ctx.fillText(`${pad2(si + 1)} / 08  ${LABELS[si]}`, 64, 1022);
  ctx.textAlign = 'right';
  const secs = Math.floor(frame / FPS), fr = frame % FPS;
  ctx.fillText(`00:${pad2(secs)}:${pad2(fr)}`, W - 64, 66);
  ctx.fillText(`${BPM} BPM  ·  ${FPS} FPS`, W - 64, 1022);

  // crop marks
  ctx.lineWidth = 2;
  [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + 22 * sy); ctx.lineTo(x, y); ctx.lineTo(x + 22 * sx, y); ctx.stroke();
  });

  // beat timeline
  const x0 = 64, x1 = W - 64, y = 1046;
  ctx.globalAlpha = a * 0.35; ctx.fillRect(x0, y, x1 - x0, 2);
  ctx.globalAlpha = a * 0.9;
  for (let b = 0; b <= 32; b++) { const xx = lerp(x0, x1, b / 32); ctx.fillRect(xx - 1, y - (b % 4 === 0 ? 9 : 4), 2, b % 4 === 0 ? 9 : 4); }
  ctx.fillRect(x0, y - 1, (x1 - x0) * clamp(t / DURATION), 4);
  ctx.beginPath(); ctx.arc(lerp(x0, x1, clamp(t / DURATION)), y + 1, 6, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ---------------------------- frame renderer --------------------------- */
function renderFrame(t, frameIdx, tNominal) {
  t = clamp(t, 0, DURATION - 1e-6);
  const frame = frameIdx == null ? Math.round(t * FPS) : frameIdx;

  let tr = -1, p = 0;
  for (let i = 1; i < 8; i++) {
    const b = i * BAR;
    if (t >= b - TRW && t < b + TRW) { tr = i; p = (t - (b - TRW)) / (2 * TRW); }
  }
  if (tr < 0) {
    drawScene(Math.min(7, Math.floor(t / BAR)), comp, t);
  } else {
    drawScene(tr - 1, cA, t);
    drawScene(tr, cB, t);
    compX.setTransform(1, 0, 0, 1, 0, 0);
    transition(tr, compX, cA, cB, p, t);
  }

  const K = kickEnv(t, 7);
  const ca = (t > 0.05 ? 5.5 * K * K : 0) + (tr > 0 ? 12 * Math.sin(p * Math.PI) : 0);
  const sc = 1 + 0.008 * K + (tr > 0 ? 0.01 * Math.sin(p * Math.PI) : 0);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(sc, sc); ctx.translate(-CX, -CY);
  if (ca > 0.8) chroma(ca); else ctx.drawImage(comp, 0, 0);
  ctx.restore();

  ctx.drawImage(vig, 0, 0);

  // film grain
  ctx.save();
  const ox = Math.floor(hash(frame * 1.7) * 512), oy = Math.floor(hash(frame * 2.9) * 512);
  ctx.translate(-ox, -oy);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.10;
  ctx.fillStyle = grainTile; ctx.fillRect(ox, oy, W, H);
  ctx.restore();

  hud(tNominal == null ? t : tNominal, frame);
}

/** temporal supersampling: n sub-frames across a shutter angle, averaged */
const acc = mk(), accX = acc.getContext('2d');
function renderBlurred(t, n = 5, shutter = 0.8) {
  const frame = Math.round(t * FPS);
  for (let s = 0; s < n; s++) {
    renderFrame(t + ((s + 0.5) / n - 0.5) * shutter / FPS, frame, t);
    accX.globalAlpha = 1 / (s + 1); accX.globalCompositeOperation = 'source-over'; accX.drawImage(cv, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.drawImage(acc, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

window.renderFrame = renderFrame;
window.renderBlurred = renderBlurred;
window.__ready = (async () => {
  await Promise.all([
    document.fonts.load('100px "Archivo Black"'), document.fonts.load('100px "Anton"'),
    document.fonts.load('italic 100px "Instrument Serif"'), document.fonts.load('700 100px "Space Grotesk"'),
    document.fonts.load('500 20px "JetBrains Mono"'),
  ]);
  await document.fonts.ready;
  return true;
})();

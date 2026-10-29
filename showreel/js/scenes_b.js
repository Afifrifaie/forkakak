'use strict';
/* ================================================================== *
 *  SCENES 5-8
 * ================================================================== */

/* ---------------------------------------------------------------- *
 *  S5 — DATA : UI motion. Cards, donut, line, bars, toggle, cursor.
 *  S5_CLICK is mirrored in audio/synth.py so the UI "click" is in sync.
 * ---------------------------------------------------------------- */
const S5_CLICK = 1.42;
const S5_INK = '#15131a';

function bezPt(pts, s) {
  const n = pts.length, i = Math.min(n - 2, Math.floor(s)), u = s - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)], k = 0.18;
  const c1x = p1[0] + (p2[0] - p0[0]) * k, c1y = p1[1] + (p2[1] - p0[1]) * k;
  const c2x = p2[0] - (p3[0] - p1[0]) * k, c2y = p2[1] - (p3[1] - p1[1]) * k;
  const a = 1 - u, b = a * a * a, cc = 3 * a * a * u, d = 3 * a * u * u, e = u * u * u;
  return [b * p1[0] + cc * c1x + d * c2x + e * p2[0], b * p1[1] + cc * c1y + d * c2y + e * p2[1]];
}
const fmtInt = v => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function uiCard(c, x, y, w, h, e) {
  c.translate(x + w / 2, y + h / 2 + (1 - e) * 240);
  const sc = 0.9 + 0.1 * e; c.scale(sc, sc); c.translate(-w / 2, -h / 2);
  c.globalAlpha = clamp(e * 1.6);
  c.shadowColor = 'rgba(40,25,10,0.18)'; c.shadowBlur = 60; c.shadowOffsetY = 24;
  c.fillStyle = '#fffdf8'; rrect(c, 0, 0, w, h, 44); c.fill();
  c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
}

function S5(c, t) {
  c.fillStyle = '#efe9df'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(21,19,26,0.11)';
  for (let y = 40; y < H; y += 48) for (let x = 40; x < W; x += 48) c.fillRect(x, y, 3, 3);

  const cardY = 250, cardH = 670;
  const cards = [{ x: 100, w: 500 }, { x: 640, w: 640 }, { x: 1320, w: 500 }];
  const enter = i => E.outExp(map(t, -0.14 + i * 0.08, 0.5 + i * 0.08));

  // ----- header ------------------------------------------------------
  const hA = E.outExp(map(t, -0.15, 0.4));
  c.save();
  c.globalAlpha = hA; c.translate(0, (1 - hA) * -30);
  c.fillStyle = S5_INK;
  c.font = '700 60px "Space Grotesk"'; c.fillText('Overview', 100, 160);
  c.font = '500 20px "JetBrains Mono"'; c.letterSpacing = '3px';
  c.fillStyle = 'rgba(21,19,26,0.55)'; c.fillText('LAST 7 DAYS  /  LIVE', 104, 198);
  c.letterSpacing = '0px';
  // toggle
  const tg = E.spring(map(t, 0.8, 1.5), 1.6, 6);
  c.fillStyle = mixc('#cfc8bb', C.lime, clamp(tg));
  rrect(c, 1440, 128, 104, 52, 26); c.fill();
  c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
  c.beginPath(); c.arc(lerp(1466, 1518, tg), 154, 20, 0, TAU); c.fill();
  c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.fillStyle = S5_INK; c.font = '500 20px "JetBrains Mono"'; c.letterSpacing = '3px'; c.fillText('LIVE', 1566, 161); c.letterSpacing = '0px';
  // avatars
  [C.orange, C.violet, C.cyan].forEach((col, i) => {
    const a = E.outBack(map(t, 0.1 + i * 0.07, 0.55 + i * 0.07), 2.4);
    c.fillStyle = col; c.strokeStyle = '#efe9df'; c.lineWidth = 6;
    c.beginPath(); c.arc(1708 + i * 50, 154, 28 * a, 0, TAU); c.fill(); c.stroke();
  });
  c.restore();

  // ----- card 1 : donut ---------------------------------------------
  {
    const e = enter(0), tc = t - 0.15;
    c.save(); uiCard(c, cards[0].x, cardY, cards[0].w, cardH, e);
    c.fillStyle = S5_INK; c.font = '700 40px "Space Grotesk"'; c.fillText('Retention', 44, 86);
    c.font = '500 18px "JetBrains Mono"'; c.letterSpacing = '3px'; c.fillStyle = 'rgba(21,19,26,.5)'; c.fillText('COHORT / Q3', 46, 120); c.letterSpacing = '0px';
    const segs = [['Organic', 38, C.orange], ['Referral', 27, S5_INK], ['Direct', 21, C.violet], ['Paid', 14, C.cyan]];
    let a0 = -Math.PI / 2;
    c.lineCap = 'round'; c.lineWidth = 36;
    c.strokeStyle = 'rgba(21,19,26,0.06)'; c.beginPath(); c.arc(250, 330, 148, 0, TAU); c.stroke();
    segs.forEach((s, i) => {
      const len = s[1] / 100 * TAU, p = E.outExp(map(tc, 0.2 + i * 0.1, 0.8 + i * 0.1));
      const from = a0 + 0.15, to = a0 + len - 0.15;
      if (p > 0.001) { c.strokeStyle = s[2]; c.beginPath(); c.arc(250, 330, 148, from, from + (to - from) * p); c.stroke(); }
      a0 += len;
    });
    c.fillStyle = S5_INK; c.textAlign = 'center';
    c.font = '84px "Archivo Black"'; c.fillText(Math.round(78 * E.outExp(map(tc, 0.25, 1.1))) + '%', 250, 358);
    c.textAlign = 'left';
    segs.forEach((s, i) => {
      const a = E.outExp(map(tc, 0.5 + i * 0.07, 0.95 + i * 0.07));
      c.save(); c.globalAlpha *= a; c.translate((1 - a) * -24, 0);
      c.fillStyle = s[2]; c.beginPath(); c.arc(58, 548 + i * 24 - 6, 8, 0, TAU); c.fill();
      c.fillStyle = S5_INK; c.font = '600 24px "Space Grotesk"'; c.fillText(s[0], 82, 548 + i * 24);
      c.textAlign = 'right'; c.font = '500 20px "JetBrains Mono"'; c.fillText(Math.round(s[1] * a) + '%', 456, 548 + i * 24); c.textAlign = 'left';
      c.restore();
    });
    c.restore();
  }

  // ----- card 2 : line chart -----------------------------------------
  {
    const e = enter(1), tc = t - 0.23;
    c.save(); uiCard(c, cards[1].x, cardY, cards[1].w, cardH, e);
    c.fillStyle = S5_INK; c.font = '700 40px "Space Grotesk"'; c.fillText('Growth', 44, 86);
    c.font = '500 18px "JetBrains Mono"'; c.letterSpacing = '3px'; c.fillStyle = 'rgba(21,19,26,.5)'; c.fillText('REVENUE / WEEKLY', 46, 120); c.letterSpacing = '0px';
    c.fillStyle = S5_INK; c.font = '112px "Archivo Black"';
    c.fillText('+' + Math.round(312 * E.outExp(map(tc, 0.25, 1.15))) + '%', 40, 236);
    const pa = E.outBack(map(tc, 0.7, 1.15), 2.4);
    c.save(); c.translate(512, 118); c.scale(pa, pa);
    c.fillStyle = C.lime; rrect(c, -86, -26, 172, 52, 26); c.fill();
    c.fillStyle = S5_INK; c.font = '600 22px "JetBrains Mono"'; c.textAlign = 'center'; c.fillText('▲ 24.8%', 0, 8); c.textAlign = 'left';
    c.restore();

    const gx0 = 44, gx1 = 596, gy0 = 300, gy1 = 560;
    c.strokeStyle = 'rgba(21,19,26,0.10)'; c.lineWidth = 2; c.setLineDash([4, 10]);
    for (let g = 0; g <= 4; g++) { const y = lerp(gy0, gy1, g / 4); c.beginPath(); c.moveTo(gx0, y); c.lineTo(gx1, y); c.stroke(); }
    c.setLineDash([]);
    c.fillStyle = 'rgba(21,19,26,.45)'; c.font = '500 16px "JetBrains Mono"';
    ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'MON'].forEach((d, i) => c.fillText(d, gx0 + i * (gx1 - gx0) / 7 - 14, 600));

    const data = [0.12, 0.3, 0.22, 0.46, 0.4, 0.66, 0.58, 0.94];
    const pts = data.map((v, i) => [gx0 + i * (gx1 - gx0) / 7, lerp(gy1, gy0, v)]);
    const prog = E.ioC(map(tc, 0.3, 1.3)) * 7;
    const poly = [];
    for (let s = 0; s <= prog + 1e-6; s += 0.04) poly.push(bezPt(pts, Math.min(s, 7)));
    poly.push(bezPt(pts, Math.min(prog, 7)));
    if (poly.length > 1) {
      const head = poly[poly.length - 1];
      const gr = c.createLinearGradient(0, gy0, 0, gy1);
      gr.addColorStop(0, withA(C.orange, 0.38)); gr.addColorStop(1, withA(C.orange, 0));
      c.beginPath(); c.moveTo(poly[0][0], gy1); poly.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(head[0], gy1); c.closePath();
      c.fillStyle = gr; c.fill();
      c.beginPath(); poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.strokeStyle = C.orange; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
      // head dot + ripple
      const rp = fract(tc * 1.6);
      c.strokeStyle = withA(C.orange, 0.5 * (1 - rp)); c.lineWidth = 4;
      c.beginPath(); c.arc(head[0], head[1], 14 + rp * 30, 0, TAU); c.stroke();
      c.fillStyle = '#fff'; c.strokeStyle = C.orange; c.lineWidth = 6;
      c.beginPath(); c.arc(head[0], head[1], 12, 0, TAU); c.fill(); c.stroke();
      // tooltip
      const tp = E.outBack(map(tc, 1.25, 1.6), 2.6);
      if (tp > 0.01) {
        c.save(); c.translate(head[0] - 20, head[1] - 52); c.scale(tp, tp);
        c.fillStyle = S5_INK; rrect(c, -62, -26, 124, 46, 14); c.fill();
        c.beginPath(); c.moveTo(-8, 19); c.lineTo(0, 30); c.lineTo(8, 19); c.fill();
        c.fillStyle = C.cream; c.font = '600 22px "JetBrains Mono"'; c.textAlign = 'center'; c.fillText('$94.2K', 0, 7); c.textAlign = 'left';
        c.restore();
      }
    }
    c.restore();
  }

  // ----- card 3 : bars -----------------------------------------------
  const HI = 5, bw = 40, bgap = 22, bx0 = 44, byB = 560, bmax = 280;
  const hl = E.spring(map(t, S5_CLICK, S5_CLICK + 0.7), 1.8, 7);
  {
    const e = enter(2), tc = t - 0.31;
    c.save(); uiCard(c, cards[2].x, cardY, cards[2].w, cardH, e);
    c.fillStyle = S5_INK; c.font = '700 40px "Space Grotesk"'; c.fillText('Weekly', 44, 86);
    c.font = '500 18px "JetBrains Mono"'; c.letterSpacing = '3px'; c.fillStyle = 'rgba(21,19,26,.5)'; c.fillText('ACTIVE USERS', 46, 120); c.letterSpacing = '0px';
    c.fillStyle = S5_INK; c.font = '112px "Archivo Black"';
    c.fillText(fmtInt(8420 * E.outExp(map(tc, 0.25, 1.15))), 40, 236);
    const vals = [0.42, 0.58, 0.36, 0.72, 0.55, 0.95, 0.68];
    c.fillStyle = 'rgba(21,19,26,.45)'; c.font = '500 18px "JetBrains Mono"';
    vals.forEach((v, i) => {
      const x = bx0 + i * (bw + bgap);
      const g = E.outBack(map(tc, 0.3 + i * 0.06, 0.85 + i * 0.06), 2.2);
      const pop = i === HI ? 1 + 0.06 * Math.max(0, hl - 0.2) : 1;
      const h = vals[i] * bmax * g * pop;
      c.fillStyle = i === HI ? mixc('#d9d2c6', C.orange, clamp(hl)) : '#d9d2c6';
      rrect(c, x, byB - h, bw, h, 14); c.fill();
      c.fillStyle = 'rgba(21,19,26,.5)'; c.fillText('MTWTFSS'[i], x + 12, 600);
    });
    // tooltip on the clicked bar
    const tp = E.outBack(map(t, S5_CLICK + 0.05, S5_CLICK + 0.4), 2.8);
    if (tp > 0.01) {
      const x = bx0 + HI * (bw + bgap) + bw / 2, y = byB - 0.95 * bmax - 22;
      c.save(); c.translate(x, y); c.scale(tp, tp);
      c.fillStyle = S5_INK; rrect(c, -50, -52, 100, 44, 14); c.fill();
      c.beginPath(); c.moveTo(-8, -9); c.lineTo(0, 2); c.lineTo(8, -9); c.fill();
      c.fillStyle = C.cream; c.font = '600 22px "JetBrains Mono"'; c.textAlign = 'center'; c.fillText('8.4K', 0, -22); c.textAlign = 'left';
      c.restore();
    }
    c.restore();
  }

  // ----- cursor ----------------------------------------------------
  {
    const tx = cards[2].x + bx0 + HI * (bw + bgap) + bw / 2 + 4, ty = cardY + byB - 150;
    const sx = 1000, sy = 1010;
    const q = E.ioC(map(t, 0.62, S5_CLICK - 0.05));
    const ex = map(t, S5_CLICK + 0.45, 1.88);
    let cxp = lerp(sx, tx, q) + Math.sin(q * Math.PI) * -60;
    let cyp = lerp(sy, ty, q) + Math.sin(q * Math.PI) * 40;
    cxp += E.inQ(ex) * 120; cyp += E.inQ(ex) * 90;
    const press = 1 - 0.16 * (smooth(S5_CLICK - 0.03, S5_CLICK + 0.02, t) - smooth(S5_CLICK + 0.1, S5_CLICK + 0.2, t));
    const ca = smooth(0.55, 0.7, t);
    // click ripple
    const rp = map(t, S5_CLICK, S5_CLICK + 0.55);
    if (rp > 0 && rp < 1) {
      c.strokeStyle = withA(C.orange, 0.7 * (1 - rp)); c.lineWidth = 5 * (1 - rp) + 1;
      c.beginPath(); c.arc(tx, ty, 12 + E.outExp(rp) * 70, 0, TAU); c.stroke();
    }
    c.save(); c.globalAlpha = ca;
    c.translate(cxp, cyp); c.scale(1.35 * press, 1.35 * press);
    c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 14; c.shadowOffsetY = 5;
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(0, 27); c.lineTo(7, 21); c.lineTo(12, 33); c.lineTo(17, 31); c.lineTo(12, 19); c.lineTo(21, 19); c.closePath();
    c.fillStyle = S5_INK; c.fill();
    c.shadowColor = 'transparent'; c.lineWidth = 2; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.stroke();
    c.restore();
  }
}

/* ---------------------------------------------------------------- *
 *  S6 — DIMENSION : additive 3-D torus knot with travelling pulse
 * ---------------------------------------------------------------- */
const KNOT_COLS = Array.from({ length: 28 }, (_, i) => {
  const v = rampRGB([C.cyan, C.violet, C.pink, C.orange, C.yellow, C.cyan], i / 27);
  return '#' + v.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
});
const knotP = u => { const r = Math.cos(3 * u) + 2; return [r * Math.cos(2 * u), r * Math.sin(2 * u), -Math.sin(3 * u)]; };
const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v3norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rot3(p, ax, ay, az) {
  const c1 = Math.cos(ay), s1 = Math.sin(ay), x1 = p[0] * c1 + p[2] * s1, z1 = -p[0] * s1 + p[2] * c1;
  const c2 = Math.cos(ax), s2 = Math.sin(ax), y2 = p[1] * c2 - z1 * s2, z2 = p[1] * s2 + z1 * c2;
  const c3 = Math.cos(az), s3 = Math.sin(az);
  return [x1 * c3 - y2 * s3, x1 * s3 + y2 * c3, z2];
}

function S6(c, t) {
  const tt = Math.max(t, -0.2), K = kickEnv(t, 5);
  c.fillStyle = '#07060f'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(CX + 120, CY - 20, 0, CX + 120, CY - 20, 900);
  g.addColorStop(0, 'rgba(110,60,255,0.32)'); g.addColorStop(0.5, 'rgba(255,61,139,0.07)'); g.addColorStop(1, 'rgba(7,6,15,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // outlined word behind, parallax
  c.save();
  c.font = '450px "Anton"'; c.textBaseline = 'alphabetic';
  c.strokeStyle = 'rgba(244,239,230,0.22)'; c.lineWidth = 2.5;
  const wa = E.outExp(map(t, -0.1, 0.8));
  c.translate(-50 - tt * 55, 0); c.globalAlpha = wa;
  c.strokeText('DIMENSION', 130, 740 + (1 - wa) * 120);
  c.restore();

  // star dust
  for (let i = 0; i < 150; i++) {
    const x = mod(hash(i) * W - tt * (20 + hash(i + 9) * 60), W), y = hash(i + 33) * H;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(tt * 2 + i));
    c.fillStyle = `rgba(244,239,230,${0.5 * tw * hash(i + 5)})`;
    c.fillRect(x, y, 2, 2);
  }

  const intro = E.outBack(map(t, -0.2, 0.7), 1.6);
  const ay = tt * 0.95 + 0.6 + (1 - E.outExp(map(t, -0.2, 1.1))) * 3.2;
  const ax = 0.62 + 0.25 * Math.sin(tt * 0.8), az = tt * 0.22;
  const camZ = 9, focal = 1130 * intro, ox = CX + 110, oy = CY - 20;
  const proj = p => { const s = focal / (camZ + p[2]); return [ox + p[0] * s, oy + p[1] * s, s]; };

  c.globalCompositeOperation = 'lighter';

  // orbit rings
  for (let r = 0; r < 3; r++) {
    c.strokeStyle = withA(r === 1 ? C.cyan : C.cream, 0.28);
    c.lineWidth = 1.5; c.beginPath();
    const R = 4.5 + r * 0.7;
    for (let s = 0; s <= 120; s++) {
      const a = s / 120 * TAU;
      const p = proj(rot3(rot3([Math.cos(a) * R, Math.sin(a) * R, 0], 0.9 + r * 0.55, tt * (0.4 + r * 0.2) + r, 0), ax * 0.5, ay * 0.3, az));
      s ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
    }
    c.stroke();
    const sa = tt * (1.4 - r * 0.3) + r * 2;
    const sp = proj(rot3(rot3([Math.cos(sa) * R, Math.sin(sa) * R, 0], 0.9 + r * 0.55, tt * (0.4 + r * 0.2) + r, 0), ax * 0.5, ay * 0.3, az));
    c.globalAlpha = 0.9; c.drawImage(glowSprite(C.cream), sp[0] - 22, sp[1] - 22, 44, 44); c.globalAlpha = 1;
  }

  // knot : cross-section rings + glowing dots
  const NU = 360, NV = 9, light = v3norm([-0.4, -0.5, 0.77]);
  const A0 = [0, 0, 1];
  for (let iu = 0; iu < NU; iu++) {
    const u = iu / NU * TAU;
    const P = knotP(u), T = v3norm(v3sub(knotP(u + 0.002), knotP(u - 0.002)));
    let B = v3cross(T, A0);
    if (Math.hypot(B[0], B[1], B[2]) < 0.25) B = v3cross(T, [1, 0, 0]);
    B = v3norm(B);
    const N = v3cross(B, T);
    const wave = Math.sin(u * 5 - tt * 6);
    const rho = (0.27 + 0.1 * wave) * (1 + 0.3 * K);
    const col = KNOT_COLS[Math.floor(mod(iu / NU + tt * 0.12, 1) * 27.99)];
    const ring = iu % 5 === 0;
    if (ring) { c.strokeStyle = withA(col, 0.7); c.lineWidth = 2; c.beginPath(); }
    for (let iv = 0; iv <= NV; iv++) {
      const th = iv / NV * TAU + u * 1.5;
      const cs = Math.cos(th), sn = Math.sin(th);
      const nx = N[0] * cs + B[0] * sn, ny = N[1] * cs + B[1] * sn, nz = N[2] * cs + B[2] * sn;
      const pw = rot3([P[0] + nx * rho, P[1] + ny * rho, P[2] + nz * rho], ax, ay, az);
      const pr = proj(pw);
      if (ring) { iv ? c.lineTo(pr[0], pr[1]) : c.moveTo(pr[0], pr[1]); }
      if (iv === NV) continue;
      const nr = rot3([nx, ny, nz], ax, ay, az);
      const lam = Math.max(0, nr[0] * light[0] + nr[1] * light[1] + nr[2] * light[2]);
      const dep = clamp(0.5 - pw[2] * 0.12);
      const br = 0.18 + 0.82 * lam * 0.8 + 0.25 * dep;
      const sz = pr[2] * 0.09 * (0.7 + 0.5 * br);
      c.globalAlpha = clamp(br * 0.9);
      c.drawImage(glowSprite(col), pr[0] - sz, pr[1] - sz, sz * 2, sz * 2);
      if (iv === 0 && iu % 3 === 0) { // soft halo
        const hz = pr[2] * 0.42; c.globalAlpha = 0.07 + 0.1 * lam;
        c.drawImage(glowSprite(col), pr[0] - hz, pr[1] - hz, hz * 2, hz * 2);
      }
    }
    if (ring) { c.globalAlpha = 1; c.stroke(); }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

  // readout text
  const tx = map(t, 0.2, 0.9);
  c.fillStyle = C.cream;
  c.font = '700 60px "Space Grotesk"';
  c.save(); c.globalAlpha = E.outExp(tx); c.translate(0, (1 - E.outExp(tx)) * 30);
  c.fillText('Three dimensions.', 110, 860); c.fillText('One source of light.', 110, 930);
  c.restore();
  c.font = '500 20px "JetBrains Mono"'; c.letterSpacing = '3px'; c.fillStyle = 'rgba(244,239,230,0.6)';
  const rd = map(t, 0.3, 1.0);
  c.textAlign = 'right';
  c.fillText(scramble(`ROT X ${(ax * 57.3).toFixed(1).padStart(6, ' ')}`, rd, 3, t), 1810, 840);
  c.fillText(scramble(`ROT Y ${mod(ay * 57.3, 360).toFixed(1).padStart(6, ' ')}`, rd, 4, t), 1810, 872);
  c.fillText(scramble(`ROT Z ${mod(az * 57.3, 360).toFixed(1).padStart(6, ' ')}`, rd, 5, t), 1810, 904);
  c.fillText(scramble(`PTS ${fmtInt(NU * NV)}`, rd, 6, t), 1810, 936);
  c.textAlign = 'left'; c.letterSpacing = '0px';
}

/* ---------------------------------------------------------------- *
 *  S7 — TYPE MONTAGE : four hard cuts, one per beat, four techniques
 * ---------------------------------------------------------------- */
function S7a(c, ts) { // TYPE — stacked marquee rows
  c.fillStyle = C.cream; c.fillRect(0, 0, W, H);
  const fs = 282, rowH = 216;
  c.font = `${fs}px "Archivo Black"`; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  const unit = c.measureText('TYPE').width + 130;
  for (let r = 0; r < 5; r++) {
    const dir = r % 2 ? 1 : -1;
    const slide = (1 - E.outExp(map(ts, r * 0.018, r * 0.018 + 0.3))) * 1500 * -dir;
    const drift = dir * Math.max(0, ts) * 170;
    const by = r * rowH + 212;
    const grow = E.outExp(map(ts, r * 0.018, r * 0.018 + 0.25));
    c.fillStyle = C.ink; c.fillRect(0, r * rowH + rowH - 2, W * grow, 4);
    for (let n = -4; n <= 4; n++) {
      const x = CX - c.measureText('TYPE').width / 2 + n * unit + slide + mod(drift, unit);
      if (r === 2) { c.fillStyle = C.ink; c.fillText('TYPE', x, by); }
      else if (r === 1 || r === 3) { c.fillStyle = C.orange; c.fillText('TYPE', x, by); }
      else { c.strokeStyle = C.ink; c.lineWidth = 3.5; c.strokeText('TYPE', x, by); }
      sparkle(c, x + c.measureText('TYPE').width + 65, by - 100, 36, r === 2 ? C.orange : C.ink, ts * 2 + n);
    }
  }
}

function S7b(c, ts) { // SHAPE — morphing primitives + popping letters
  c.fillStyle = C.orange; c.fillRect(0, 0, W, H);
  // plus-sign field
  c.fillStyle = 'rgba(11,11,16,0.22)';
  for (let y = 60; y < H; y += 120) for (let x = 60; x < W; x += 120) { c.fillRect(x - 12, y - 2, 24, 4); c.fillRect(x - 2, y - 12, 4, 24); }
  const a = E.outBack(map(ts, 0, 0.22), 2.2);
  const m = E.ioC(map(ts, 0.06, 0.34));
  c.save(); c.translate(CX, CY - 10); c.rotate(m * Math.PI / 2 + 0.2 * (1 - a));
  const R = 330 * a;
  c.fillStyle = C.ink;
  rrect(c, -R, -R, R * 2, R * 2, lerp(R, R * 0.16, m)); c.fill();
  c.restore();
  // orbiting satellites
  for (let k = 0; k < 4; k++) {
    const ang = ts * 3.4 + k * TAU / 4, rr = 470 + 30 * Math.sin(ts * 9 + k);
    const x = CX + Math.cos(ang) * rr * 1.25, y = CY - 10 + Math.sin(ang) * rr * 0.78;
    const s = 44 * E.outBack(map(ts, 0.04 + k * 0.03, 0.26 + k * 0.03), 2.4);
    c.save(); c.translate(x, y); c.rotate(ang * 2); c.fillStyle = C.cream; c.strokeStyle = C.cream; c.lineWidth = 8;
    if (k === 0) { c.beginPath(); c.arc(0, 0, s, 0, TAU); c.fill(); }
    else if (k === 1) { c.beginPath(); for (let i = 0; i < 3; i++) { const q = i * TAU / 3 - Math.PI / 2; c.lineTo(Math.cos(q) * s * 1.2, Math.sin(q) * s * 1.2); } c.closePath(); c.fill(); }
    else if (k === 2) { c.fillRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); }
    else { c.beginPath(); c.arc(0, 0, s, 0, TAU); c.stroke(); }
    c.restore();
  }
  c.font = '372px "Archivo Black"'; c.textBaseline = 'alphabetic';
  const g = glyphs(c, 'SHAPE', -8), x0 = CX - g.total / 2;
  g.g.forEach(q => {
    const s = E.outBack(map(ts, 0.03 + q.i * 0.03, 0.24 + q.i * 0.03), 2.6);
    if (s <= 0.001) return;
    c.save(); c.translate(x0 + q.x + q.w / 2, 700); c.scale(s, s);
    c.fillStyle = C.cream; c.fillText(q.ch, -q.w / 2, 0); c.restore();
  });
}

function S7c(c, ts) { // LIGHT — beams, bokeh, neon with flicker
  c.fillStyle = '#050509'; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 11; k++) {
    const ang = ts * 0.9 + k * TAU / 11, hw = 0.045 + 0.02 * Math.sin(k * 3.1);
    const gr = c.createRadialGradient(CX, CY, 0, CX, CY, 1500);
    gr.addColorStop(0, 'rgba(255,214,150,0.5)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(CX, CY);
    c.lineTo(CX + Math.cos(ang - hw) * 1800, CY + Math.sin(ang - hw) * 1800);
    c.lineTo(CX + Math.cos(ang + hw) * 1800, CY + Math.sin(ang + hw) * 1800); c.closePath(); c.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = hash(i) * W, y = mod(hash(i + 7) * H - ts * (40 + 90 * hash(i + 3)), H), r = 24 + 70 * hash(i + 11);
    c.globalAlpha = 0.16 * (0.5 + hash(i + 2)); const sp = glowSprite(i % 2 ? C.amber : C.cyan);
    c.drawImage(sp, x - r, y - r, r * 2, r * 2);
  }
  c.globalAlpha = 1;
  const gl = c.createRadialGradient(CX, CY, 0, CX, CY, 600);
  gl.addColorStop(0, `rgba(255,170,90,${0.35 * E.outExp(map(ts, 0, 0.25))})`); gl.addColorStop(1, 'rgba(255,170,90,0)');
  c.fillStyle = gl; c.fillRect(0, 0, W, H);
  // streak
  const sw = E.outExp(map(ts, 0, 0.18));
  const sg = c.createLinearGradient(CX - 900, 0, CX + 900, 0);
  sg.addColorStop(0, 'rgba(255,240,210,0)'); sg.addColorStop(0.5, 'rgba(255,240,210,0.9)'); sg.addColorStop(1, 'rgba(255,240,210,0)');
  c.fillStyle = sg; c.fillRect(CX - 900 * sw, CY - 3, 1800 * sw, 6);
  c.globalCompositeOperation = 'source-over';

  const flick = ts < 0.14 ? (hash(Math.floor(ts * 90) + 4) > 0.4 ? 1 : 0.12) : 1;
  c.font = '372px "Archivo Black"'; c.textBaseline = 'alphabetic';
  const g = glyphs(c, 'LIGHT', -4), x0 = CX - g.total / 2;
  const sweepX = lerp(x0 - 200, x0 + g.total + 200, E.ioC(map(ts, 0.06, 0.42)));
  g.g.forEach(q => {
    const near = 1 - clamp(Math.abs(x0 + q.x + q.w / 2 - sweepX) / 260);
    c.shadowColor = near > 0.2 ? '#ffffff' : C.amber; c.shadowBlur = 40 + 90 * near;
    c.globalAlpha = flick;
    c.fillStyle = mixc('#ffb86b', '#ffffff', near);
    c.fillText(q.ch, x0 + q.x, 700);
    c.fillText(q.ch, x0 + q.x, 700);
  });
  c.shadowBlur = 0; c.shadowColor = 'transparent'; c.globalAlpha = 1;
}

function S7d(c, ts) { // RHYTHM — squash & stretch letters over an EQ
  const gr = c.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#6a3dff'); gr.addColorStop(1, '#1a0b5c');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  // EQ bars
  for (let i = 0; i < 48; i++) {
    const h = 90 + 380 * Math.pow(0.5 + 0.5 * Math.sin(i * 0.9 + ts * 24 + Math.sin(i * 0.3) * 3), 2) * (0.5 + 0.5 * Math.exp(-ts * 4));
    c.fillStyle = withA(C.cream, 0.13); c.fillRect(i * 40 + 6, H - h, 28, h);
  }
  const base = 790, fs = 318;
  c.font = `${fs}px "Archivo Black"`; c.textBaseline = 'alphabetic';
  const g = glyphs(c, 'RHYTHM', -6), x0 = CX - g.total / 2;
  const cols = [C.cream, C.yellow, C.cream, C.pink, C.cream, C.yellow];
  g.g.forEach(q => {
    const cyc = ts / (BEAT / 2) - q.i * 0.09;
    const f = fract(cyc), y = 4 * f * (1 - f);
    const sq = Math.max(0, 1 - Math.min(f, 1 - f) / 0.13);
    const sy = 1 - 0.24 * sq + 0.1 * (1 - y) * (1 - sq), sx = 1 + 0.2 * sq - 0.05 * (1 - y) * (1 - sq);
    const lift = y * 190;
    const enter = E.outExp(map(ts, q.i * 0.012, 0.16 + q.i * 0.012));
    // shadow
    c.fillStyle = `rgba(0,0,0,${0.32 * (1 - y * 0.6) * enter})`;
    c.beginPath(); c.ellipse(x0 + q.x + q.w / 2, base + 20, q.w * 0.5 * (1 - 0.3 * y) * sx, 15, 0, 0, TAU); c.fill();
    c.save(); c.translate(x0 + q.x + q.w / 2, base - lift + (1 - enter) * -500);
    c.scale(sx, sy); c.fillStyle = cols[q.i % cols.length]; c.fillText(q.ch, -q.w / 2, 0); c.restore();
  });
}

function S7(c, t) {
  const u = t / BEAT, k = clamp(Math.floor(u), 0, 3), ts = t - k * BEAT;
  [S7a, S7b, S7c, S7d][k](c, ts);
  if (ts >= 0) { c.fillStyle = `rgba(255,255,255,${0.75 * (1 - smooth(0, 0.085, ts))})`; c.fillRect(0, 0, W, H); }
}

/* ---------------------------------------------------------------- *
 *  S8 — FINALE : burst, spark flies into lockup, wordmark, tagline
 * ---------------------------------------------------------------- */
function S8(c, t) {
  const tt = Math.max(t, 0), K = kickEnv(t, 5);
  c.fillStyle = C.ink; c.fillRect(0, 0, W, H);

  // lockup geometry
  c.font = '210px "Archivo Black"';
  const gw = glyphs(c, 'CLAUDE', -4);
  const sparkD = 226, gap = 44, total = sparkD + gap + gw.total, lx = CX - total / 2, ly = 470;
  const sparkRest = [lx + sparkD / 2, ly - 70], sparkR = 112;

  // glow
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = (0.26 + 0.16 * K) * E.outExp(map(t, -0.05, 0.4));
  c.drawImage(glowSprite(C.orange), CX - 850, CY - 700, 1700, 1400);
  c.globalAlpha = 1;

  // burst rings + rays
  const ringCols = [C.orange, C.cream, C.cyan, C.violet, C.pink];
  ringCols.forEach((col, k) => {
    const p = map(tt, k * 0.04, 0.95 + k * 0.04);
    if (p <= 0 || p >= 1) return;
    c.strokeStyle = withA(col, (1 - p) * 0.9); c.lineWidth = 2 + 26 * (1 - p) * (1 - p);
    c.beginPath(); c.arc(CX, CY, E.outExp(p) * 1500, 0, TAU); c.stroke();
  });
  c.lineCap = 'round';
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU + hash(i) * 0.06, p = map(tt, 0.0 + hash(i + 4) * 0.08, 0.75 + hash(i + 4) * 0.1);
    if (p <= 0 || p >= 1) continue;
    const r1 = 120 + E.outExp(p) * (700 + 800 * hash(i + 2)), r0 = r1 - (30 + 220 * hash(i + 6)) * (1 - p);
    c.strokeStyle = withA(i % 3 ? C.cream : C.orange, 0.8 * (1 - p)); c.lineWidth = 2 + 3 * hash(i + 8);
    c.beginPath(); c.moveTo(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0); c.lineTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1); c.stroke();
  }
  // confetti
  for (let i = 0; i < 46; i++) {
    const a = hash(i + 100) * TAU, v = 260 + 780 * hash(i + 101), p = E.outExp(map(tt, 0.02, 1.3));
    const x = CX + Math.cos(a) * v * p, y = CY + Math.sin(a) * v * p + 70 * Math.pow(map(tt, 0.2, 1.8), 2);
    const sz = 5 + 11 * hash(i + 102), al = 1 - smooth(1.0, 1.8, tt);
    c.save(); c.translate(x, y); c.rotate(tt * (2 + hash(i) * 4)); c.fillStyle = withA([C.orange, C.cream, C.cyan, C.pink, C.yellow][i % 5], al * (0.5 + 0.5 * hash(i + 103)));
    if (i % 2) c.fillRect(-sz / 2, -sz / 2, sz, sz); else { c.beginPath(); c.arc(0, 0, sz / 2, 0, TAU); c.fill(); }
    c.restore();
  }
  c.globalCompositeOperation = 'source-over';

  // spark: scales in at centre, then glides into the lockup
  const sIn = E.outBack(map(tt, 0.0, 0.5), 2.6);
  const fly = E.ioExp(map(tt, 0.5, 1.0));
  const spX = lerp(CX, sparkRest[0], fly), spY = lerp(CY, sparkRest[1], fly);
  const spR = lerp(190, sparkR, fly) * sIn * (1 + 0.04 * K);
  const spRot = (1 - E.outExp(map(tt, 0.0, 1.2))) * TAU * 1.4 + tt * 0.35;
  if (spR > 0.5) sparkle(c, spX, spY, spR, C.orange, spRot, 12);

  // wordmark : slides out from behind the spark
  const wx = lx + sparkD + gap;
  c.save();
  c.beginPath(); c.rect(wx - 6, ly - 240, gw.total + 40, 300); c.clip();
  gw.g.forEach(q => {
    const a = E.outExp(map(tt, 0.62 + q.i * 0.045, 1.12 + q.i * 0.045));
    c.save(); c.translate(wx + q.x - (1 - a) * 260, ly); c.globalAlpha = clamp(a * 2);
    c.fillStyle = C.cream; c.fillText(q.ch, 0, 0); c.restore();
  });
  c.restore();

  // rule
  const ru = E.outExp(map(tt, 0.85, 1.25));
  c.fillStyle = C.cream; c.fillRect(lx, 552, total * ru, 4);

  // subtitle with tracking collapse
  const sp = E.outExp(map(tt, 0.9, 1.45));
  if (sp > 0.001) {
    c.save(); c.globalAlpha = sp; c.fillStyle = C.orange;
    c.font = '500 34px "JetBrains Mono"'; c.letterSpacing = `${lerp(36, 9, sp)}px`; c.textAlign = 'center';
    c.fillText('MOTION DESIGN  —  SHOWREEL 2026', CX + lerp(36, 9, sp) / 2, 646);
    c.restore();
  }

  // tagline, word by word
  c.font = 'italic 92px "Instrument Serif"'; c.textBaseline = 'alphabetic';
  const words = ['Let’s', 'make', 'something', 'move.'];
  const widths = words.map(w => c.measureText(w + ' ').width);
  const tw = widths.reduce((a, b) => a + b, 0) - c.measureText(' ').width;
  let wxp = CX - tw / 2;
  words.forEach((w, i) => {
    const a = E.outExp(map(tt, 1.05 + i * 0.07, 1.5 + i * 0.07));
    c.save(); c.globalAlpha = a; c.translate(0, (1 - a) * 36);
    c.fillStyle = i === 3 ? C.orange : C.cream; c.fillText(w, wxp, 790); c.restore();
    wxp += widths[i];
  });

  // fade out
  const fo = smooth(BAR - 0.26, BAR - 0.01, t);
  if (fo > 0) { c.fillStyle = `rgba(11,11,16,${fo})`; c.fillRect(0, 0, W, H); }
}

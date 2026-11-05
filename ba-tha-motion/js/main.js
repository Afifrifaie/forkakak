'use strict';
/* ب -> بث : every frame is a pure function of t:  window.renderFrame(t)  */
(() => {
  const W = 1080, H = 1350;
  const cv = document.getElementById('cv'); const ctx = cv.getContext('2d');
  const TL = window.TL, A = window.ASSETS, MAN = A.manifest;
  const SS = 3;                                  // hi-res scale of the big letter layers

  // ---------- palette (sampled from the reference) ----------
  const CREAM = [246, 242, 235], PANEL = [247, 242, 232], BLUE = [150, 168, 189], GOLD = [243, 198, 129], CORAL = [217, 126, 105];
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const WET_BLUE = [86, 112, 146], WET_GOLD = [231, 164, 70];

  // ---------- geometry (measured) ----------
  const CARD = { x: 152.5, y: 175.5, w: 775.3, h: 998.2, r: 52, bw: 9.7 };
  const PNL = { x: 205.5, y: 220.3, w: 655.2, h: 639.7, r: 60, bw: 10 };

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const eOut3 = u => 1 - Math.pow(1 - u, 3);
  const eIO3 = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const eIO2 = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const pop = u => u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(10 * u);
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------- assets ----------
  const IMG = {};
  const loadAll = () => Promise.all(Object.entries(A.img).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.src = src; })));
  const lay = n => MAN[n];

  // ---------- pen paths ----------
  // centre-line of the isolated ba (written right -> left): measured against the glyph, same stroke as the tha' card
  const BA_CTRL = [[706, 435], [711, 467], [716, 504], [715, 539], [706, 569], [684, 585], [644, 593], [594, 599], [544, 602], [494, 604], [444, 599], [404, 585], [372, 565], [349, 537], [337, 504], [338, 467], [346, 431]];
  const SEAM_X = 640, EXT = 84;                      // where the isolated bowl is cut, and how far the joining stroke reaches

  function catmull(P, step = 2.5) {
    const out = []; const pts = [P[0], ...P, P[P.length - 1]];
    for (let i = 1; i < pts.length - 2; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                  0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    out.push(P[P.length - 1]);
    const cum = [0]; for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
    return { pts: out, cum, total: cum[cum.length - 1] };
  }
  const pathAt = (P, s) => {
    s = clamp(s, 0, P.total); let lo = 0, hi = P.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.cum[m] <= s) lo = m; else hi = m; }
    const f = (s - P.cum[lo]) / Math.max(1e-6, P.cum[hi] - P.cum[lo]);
    return [lerp(P.pts[lo][0], P.pts[hi][0], f), lerp(P.pts[lo][1], P.pts[hi][1], f)];
  };

  // ---------- progressive "ink" reveal along a pen path (works on hi-res canvases) ----------
  const FEATHER = 9;
  function buildReveal(cvs, rect, ctrl, wet, base, wetLen) {
    const { x, y, w, h } = rect; const pw = w * SS, ph = h * SS;
    const x2 = cvs.getContext('2d'); const id = x2.getImageData(0, 0, pw, ph);
    const n = pw * ph; const a = new Uint8Array(n), s = new Float32Array(n);
    const P = catmull(ctrl, 2.5);
    const px = Float32Array.from(P.pts, p => (p[0] - x) * SS), py = Float32Array.from(P.pts, p => (p[1] - y) * SS), cum = Float32Array.from(P.cum);
    for (let i = 0; i < n; i++) {
      const al = id.data[i * 4 + 3]; a[i] = al; if (!al) continue;
      const X = i % pw, Y = (i / pw) | 0; let best = 1e12, bi = 0;
      for (let k = 0; k < px.length; k++) { const dx = X - px[k], dy = Y - py[k], d = dx * dx + dy * dy; if (d < best) { best = d; bi = k; } }
      s[i] = cum[bi];
    }
    const out = document.createElement('canvas'); out.width = pw; out.height = ph;
    return { rect, cvs, c: out, x: out.getContext('2d'), id, a, s, P, wet, base, wetLen };
  }
  function drawReveal(g, R, front, wetOn = true) {
    const { x, y, w, h } = R.rect;
    if (front >= R.P.total + FEATHER + R.wetLen) { g.drawImage(R.cvs, x, y, w, h); return; }
    if (front <= -FEATHER) return;
    const d = R.id.data, { a, s, wet, base, wetLen } = R; const n = a.length;
    for (let i = 0; i < n; i++) {
      const al = a[i]; if (!al) { d[i * 4 + 3] = 0; continue; }
      const dd = front - s[i]; const k = clamp(dd / FEATHER);
      if (k <= 0) { d[i * 4 + 3] = 0; continue; }
      const wv = wetOn && dd < wetLen ? Math.pow(1 - dd / wetLen, 1.5) : 0;
      d[i * 4] = base[0] + (wet[0] - base[0]) * wv; d[i * 4 + 1] = base[1] + (wet[1] - base[1]) * wv; d[i * 4 + 2] = base[2] + (wet[2] - base[2]) * wv;
      d[i * 4 + 3] = al * (k * k * (3 - 2 * k));
    }
    R.x.putImageData(R.id, 0, 0); g.drawImage(R.c, x, y, w, h);
  }

  // ---------- shapes ----------
  function rrPath(g, x, y, w, h, r, fromTop) {
    if (fromTop) { g.moveTo(x + w / 2, y); g.lineTo(x + w - r, y); } else g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + r, r); g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r); g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r); g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    if (fromTop) g.lineTo(x + w / 2, y); else g.closePath();
  }
  const perim = (w, h, r) => 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
  function drawFrame(g, R, fill, p, bw, borderCol, alpha) {
    g.save(); g.globalAlpha = alpha;
    if (fill) { g.beginPath(); rrPath(g, R.x, R.y, R.w, R.h, R.r, false); g.fillStyle = fill; g.fill(); }
    const ix = R.x + bw / 2, iy = R.y + bw / 2, iw = R.w - bw, ih = R.h - bw, ir = R.r - bw / 2;
    g.strokeStyle = borderCol; g.lineWidth = bw; g.lineCap = 'butt';
    if (p >= 1) { g.beginPath(); rrPath(g, ix, iy, iw, ih, ir, false); g.stroke(); }
    else if (p > 0) {
      const P = perim(iw, ih, ir);
      for (const mirror of [false, true]) {
        g.save(); if (mirror) { g.translate(ix + iw / 2, 0); g.scale(-1, 1); g.translate(-(ix + iw / 2), 0); }
        g.beginPath(); rrPath(g, ix, iy, iw, ih, ir, true); g.setLineDash([P / 2 * p, P]); g.stroke(); g.restore();
      }
    }
    g.restore();
  }

  // ---------- reed pen (same pen as the tha' video) ----------
  function drawPen(g, x, y, sc, alpha, lift) {
    if (alpha <= 0.01) return;
    g.save(); g.translate(x, y); g.rotate(0.62); g.scale(sc, sc); g.globalAlpha = alpha;
    g.save(); g.globalAlpha = alpha * (0.22 - lift * 0.1); g.fillStyle = '#31465f'; g.beginPath(); g.ellipse(8 + lift * 14, 4 + lift * 10, 16 + lift * 6, 5 + lift * 3, -0.3, 0, 7); g.fill(); g.restore();
    g.translate(0, -lift * 22);
    const grd = g.createLinearGradient(-14, 0, 14, 0); grd.addColorStop(0, 'rgb(252,222,160)'); grd.addColorStop(0.55, 'rgb(243,198,129)'); grd.addColorStop(1, 'rgb(196,140,82)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(-7, -34); g.lineTo(7.5, -30); g.lineTo(13, -214); g.quadraticCurveTo(0, -226, -13, -214); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-4, -40); g.lineTo(-2, -40); g.lineTo(-5, -208); g.lineTo(-8, -206); g.closePath(); g.fill();
    g.fillStyle = rgb(CORAL, 0.95); g.beginPath(); g.moveTo(-9.5, -150); g.lineTo(10.5, -146); g.lineTo(11, -132); g.lineTo(-9, -136); g.closePath(); g.fill();
    g.fillStyle = 'rgb(66,84,110)'; g.beginPath(); g.moveTo(-6, 1); g.lineTo(5, -3); g.lineTo(8, -32); g.lineTo(-8, -35); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(243,198,129,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-0.5, -2); g.lineTo(0.5, -26); g.stroke();
    g.restore();
  }

  // ---------- layer helpers ----------
  const drawLayer = (g, name, dx = 0, dy = 0) => { const l = lay(name); g.drawImage(IMG[name], l.x + dx, l.y + dy, l.w, l.h); };
  const centre = n => { const l = lay(n); return [l.x + l.w / 2, l.y + l.h / 2]; };
  function popAt(g, name, cx, cy, u, rot0, dy0 = 0) {
    if (u <= 0) return; const l = lay(name); const k = pop(u), al = clamp(u * 7);
    g.save(); g.globalAlpha *= al; g.translate(cx, cy + dy0 * (1 - eOut3(clamp(u * 1.4)))); g.rotate(rot0 * (1 - eOut3(clamp(u * 1.2)))); g.scale(k, k);
    g.drawImage(IMG[name], -l.w / 2, -l.h / 2, l.w, l.h); g.restore();
  }
  const wipeCv = document.createElement('canvas'); wipeCv.width = 400; wipeCv.height = 200; const wipeX = wipeCv.getContext('2d');
  function drawWipe(g, name, u, rise = 10, at, sc = 1) {
    if (u <= 0) return; const l = lay(name); const e = eIO2(u); const pw = l.w * l.scale, ph = l.h * l.scale;
    wipeCv.width = Math.max(wipeCv.width, pw); wipeCv.height = Math.max(wipeCv.height, ph);
    wipeX.setTransform(1, 0, 0, 1, 0, 0); wipeX.clearRect(0, 0, wipeCv.width, wipeCv.height); wipeX.globalCompositeOperation = 'source-over'; wipeX.drawImage(IMG[name], 0, 0);
    wipeX.globalCompositeOperation = 'destination-in';
    const edge = e * (pw + 30 * l.scale) - 15 * l.scale; const gr = wipeX.createLinearGradient(edge - 18 * l.scale, 0, edge + 18 * l.scale, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); wipeX.fillStyle = gr; wipeX.fillRect(0, 0, pw, ph);
    const X = at ? at[0] : l.x, Y = at ? at[1] : l.y;
    g.save(); g.globalAlpha *= clamp(u * 5); g.drawImage(wipeCv, 0, 0, pw, ph, X, Y + rise * (1 - eOut3(u)), l.w * sc, l.h * sc); g.restore();
  }
  function diamond(g, x, y, r, rot, col, a) {
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = rgb(col, a); g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, 0); g.lineTo(0, r); g.lineTo(-r * 0.7, 0); g.closePath(); g.fill(); g.restore();
  }
  function ring(g, x, y, t0, t, col, r0, r1, w = 3) {
    const u = seg(t, t0, t0 + 0.55); if (u <= 0 || u >= 1) return;
    g.save(); g.strokeStyle = rgb(col, 0.55 * (1 - u)); g.lineWidth = w * (1 - u * 0.6); g.beginPath(); g.arc(x, y, lerp(r0, r1, eOut3(u)), 0, 7); g.stroke(); g.restore();
  }
  function burst(g, x, y, t0, t, col, n, dist, size, seed) {
    const age = t - t0; if (age < 0 || age > 0.7) return; const u = age / 0.7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + hash(seed + i) * 0.8, d = dist * (0.6 + hash(seed + 50 + i) * 0.6) * eOut3(u);
      diamond(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d + u * u * 10, size * (1 - u * 0.7) * (0.7 + hash(seed + 80 + i) * 0.6), ang + u * 2, col, (1 - u) * 0.9);
    }
  }

  // blur + re-threshold the alpha around a seam so the slid bowl and the joining band meet without a step
  function smoothSeam(cvs, rect, xc, half) {
    const pw = cvs.width, ph = cvs.height, cx = cvs.getContext('2d'), id = cx.getImageData(0, 0, pw, ph);
    const c0 = Math.round((xc - rect.x) * SS), hw = half * SS, x0 = Math.max(0, c0 - hw - 12), x1 = Math.min(pw, c0 + hw + 12), w = x1 - x0;
    let A = new Float32Array(w * ph), T = new Float32Array(w * ph);
    for (let r = 0; r < ph; r++) for (let c = 0; c < w; c++) A[r * w + c] = id.data[(r * pw + x0 + c) * 4 + 3] / 255;
    const R = 5;
    for (let pass = 0; pass < 2; pass++) {
      for (let r = 0; r < ph; r++) for (let c = 0; c < w; c++) { let sum = 0, n = 0; for (let k = -R; k <= R; k++) { const cc = c + k; if (cc >= 0 && cc < w) { sum += A[r * w + cc]; n++; } } T[r * w + c] = sum / n; }
      for (let r = 0; r < ph; r++) for (let c = 0; c < w; c++) { let sum = 0, n = 0; for (let k = -R; k <= R; k++) { const rr = r + k; if (rr >= 0 && rr < ph) { sum += T[rr * w + c]; n++; } } A[r * w + c] = sum / n; }
    }
    for (let r = 0; r < ph; r++) for (let c = 0; c < w; c++) {
      const i = (r * pw + x0 + c) * 4, o = id.data[i + 3] / 255, sm = clamp((A[r * w + c] - 0.5) * 3 + 0.5);
      const wgt = clamp((hw - Math.abs(x0 + c - c0)) / 12 + 0.0); const v = lerp(o, sm, wgt);
      id.data[i] = BLUE[0]; id.data[i + 1] = BLUE[1]; id.data[i + 2] = BLUE[2]; id.data[i + 3] = Math.round(v * 255);
    }
    cx.putImageData(id, 0, 0);
  }

  // ---------- build everything once ----------
  const G = {};                                  // derived geometry
  let R_ba, R_wB, bigCv, bigX;
  function setup() {
    // isolated ba, reveal-able
    const l = lay('ba_body'); const c1 = document.createElement('canvas'); c1.width = l.w * SS; c1.height = l.h * SS; c1.getContext('2d').drawImage(IMG.ba_body, 0, 0);
    R_ba = buildReveal(c1, l, BA_CTRL, WET_BLUE, BLUE, 70);
    // silhouette edges of the band at a given card-x (top / bottom y of the stroke)
    const edges = xc => { const col = Math.round((xc - l.x) * SS); let top = null, bot = null;
      for (let r = 0; r < l.h * SS; r++) { let a = 0; for (let k = -1; k <= 1; k++) a += R_ba.a[r * l.w * SS + col + k]; a /= 3; if (a > 128) { if (top === null) top = r; bot = r; } }
      // the isolated ba also has the spike on the far right; at x < 700 the first run is the band itself
      return [l.y + top / SS, l.y + bot / SS]; };
    const e640 = edges(SEAM_X), e600 = edges(SEAM_X - 40);
    const slope = ((e640[0] - e600[0]) + (e640[1] - e600[1])) / 80;   // band rises to the right (slope < 0)
    G.dy = -slope * EXT; G.e640 = e640;
    // word: the final tha = the same bowl, slid left by EXT and down by dy, with a straight band bridging to the ba's tooth
    const bw = { x: l.x - EXT - 4, y: l.y, w: l.w + EXT + 8, h: l.h + Math.ceil(G.dy) + 2 };
    const c2 = document.createElement('canvas'); c2.width = Math.ceil(bw.w) * SS; c2.height = Math.ceil(bw.h) * SS; bw.w = c2.width / SS; bw.h = c2.height / SS;
    const x2 = c2.getContext('2d'); x2.scale(SS, SS); x2.translate(-bw.x, -bw.y);
    x2.save(); x2.translate(-EXT, G.dy); x2.beginPath(); x2.rect(0, 0, SEAM_X, 4000); x2.clip(); x2.drawImage(IMG.ba_body, l.x, l.y, l.w, l.h); x2.restore();   // cut in the glyph's own coordinates, then slide
    x2.fillStyle = rgb(BLUE); x2.beginPath();
    x2.moveTo(SEAM_X - EXT - 1.5, e640[0] + G.dy - 0.15); x2.lineTo(SEAM_X + 1.2, e640[0] - 0.15); x2.lineTo(SEAM_X + 1.2, e640[1] + 0.15); x2.lineTo(SEAM_X - EXT - 1.5, e640[1] + G.dy + 0.15); x2.closePath(); x2.fill();
    smoothSeam(c2, bw, SEAM_X - EXT, 16);
    const mid0 = (e640[0] + e640[1]) / 2;
    const bPts = BA_CTRL.filter(p => p[0] < SEAM_X - 20).map(p => [p[0] - EXT, p[1] + G.dy]);
    const P2ctrl = [[SEAM_X, mid0], [SEAM_X - EXT / 2, mid0 + G.dy / 2], ...bPts];
    R_wB = buildReveal(c2, bw, P2ctrl, WET_BLUE, BLUE, 70);
    // retract target: the point of the ba path where the band reaches the seam
    const pts = R_ba.P.pts; let sc = 0; for (let i = 0; i < pts.length; i++) if (pts[i][1] > 560 && pts[i][0] <= SEAM_X) { sc = R_ba.P.cum[i]; break; }
    G.sCut = sc;
    // dots
    const dc = centre('ba_dot'); G.dotHome = dc;
    G.dotTarget = [696, e640[1] + 14 + lay('ba_dot').h / 2 - 6];
    G.thaDots = MAN.tha_dots.map(d => [d.cx - EXT, d.cy + G.dy]);
    bigCv = document.createElement('canvas'); bigCv.width = W; bigCv.height = H; bigX = bigCv.getContext('2d');
    // word bounding box (for the pulse) in card space
    G.wordC = [487, 560];
  }

  // ---------- pen choreography ----------
  function penState(t) {
    const segs = [];
    const P = R_ba.P, P2 = R_wB.P; const baStart = pathAt(P, 0), baEnd = pathAt(P, P.total), seamPt = pathAt(P, G.sCut);
    const park = [850, 330];
    segs.push({ t0: TL.penIn[0], t1: TL.baBody[0], from: [park[0] + 60, park[1] - 60], to: baStart, lift: [1, 0.15], a: [0, 1] });
    segs.push({ t0: TL.baBody[0], t1: TL.baBody[1], path: P, prog: u => TL.prog(u) });
    segs.push({ t0: TL.baBody[1], t1: TL.baDot - 0.02, from: baEnd, to: G.dotHome, lift: [0.5, 0], arc: 46 });
    segs.push({ t0: TL.baDot - 0.02, t1: TL.baDot + 0.18, hold: G.dotHome, lift: [0, 0.35] });
    segs.push({ t0: TL.baDot + 0.18, t1: TL.penExit[1], from: G.dotHome, to: [park[0] + 90, park[1] - 80], lift: [0.3, 1], a: [1, 0] });
    // retract: pen appears at the left tip and pulls the ink back to the tooth
    segs.push({ t0: TL.penBack[0], t1: TL.penBack[1], hold: baEnd, lift: [1, 0.2], a: [0, 1] });
    segs.push({ t0: TL.retract[0], t1: TL.retract[1], path: P, prog: u => 1 - (1 - G.sCut / P.total) * eIO3(u) });
    segs.push({ t0: TL.retract[1], t1: TL.wordWrite[0], hold: seamPt, lift: [0.1, 0.05] });
    segs.push({ t0: TL.wordWrite[0], t1: TL.wordWrite[1], path: P2, prog: u => TL.prog(u) });
    // ث dots
    const td = G.thaDots; let prev = pathAt(P2, P2.total), pt = TL.wordWrite[1];
    TL.thaDots.forEach((ts, i) => { segs.push({ t0: pt, t1: ts - 0.02, from: prev, to: td[i], lift: [0.5, 0], arc: 40 }); segs.push({ t0: ts - 0.02, t1: ts + 0.18, hold: td[i], lift: [0, 0.35] }); prev = td[i]; pt = ts + 0.18; });
    segs.push({ t0: pt, t1: TL.penExit2[1], from: prev, to: [prev[0] + 150, prev[1] - 190], lift: [0.3, 1], a: [1, 0] });
    for (const s of segs) {
      if (t < s.t0 || t > s.t1) continue;
      const u = (t - s.t0) / (s.t1 - s.t0); let p, lift = 0, a = 1;
      if (s.path) { p = pathAt(s.path, s.path.total * s.prog(u)); p = [p[0] + Math.sin(t * 31) * 0.4, p[1] + Math.cos(t * 27) * 0.4]; }
      else if (s.hold) { p = s.hold; lift = lerp(s.lift[0], s.lift[1], u); }
      else { const e = eIO3(u); p = [lerp(s.from[0], s.to[0], e), lerp(s.from[1], s.to[1], e) - (s.arc || 0) * Math.sin(Math.PI * e)]; lift = lerp(s.lift[0], s.lift[1], e); }
      if (s.a) a = lerp(s.a[0], s.a[1], eIO2(u));
      return { x: p[0], y: p[1], alpha: a, lift };
    }
    return null;
  }

  // ---------- camera ----------
  const Z_END = 1.5, C_END = [487, 597];
  const CAM = [
    { t: 0, s: 1, x: 540, y: 675 }, { t: 5.95, s: 1, x: 540, y: 675 },
    { t: 7.4, s: 2.4, x: 528, y: 535 }, { t: 7.8, s: 2.4, x: 528, y: 535 },
    { t: 9.0, s: Z_END, x: C_END[0], y: C_END[1] }, { t: 99, s: Z_END, x: C_END[0], y: C_END[1] },
  ];
  function camAt(t) {
    let i = 0; while (i < CAM.length - 2 && t > CAM[i + 1].t) i++;
    const a = CAM[i], b = CAM[i + 1], u = eIO3(seg(t, a.t, b.t));
    return { s: lerp(a.s, b.s, u), x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  }

  // ---------- sparkles + caption (screen space) ----------
  function sparkles(g, t) {
    const [a, b] = TL.sparkles; if (t < a || t > b) return;
    const env = Math.min(seg(t, a, a + 0.5), 1 - seg(t, b - 0.6, b));
    for (let i = 0; i < 52; i++) {
      const ph = (t - a) * (0.14 + hash(i) * 0.2) + hash(i + 9);
      const x = 120 + hash(i + 1) * 840, y = 1000 - ((ph % 1) * 820) + hash(i + 3) * 40;
      const tw = 0.5 + 0.5 * Math.sin(t * (3 + hash(i + 4) * 4) + i);
      diamond(g, x, y, 3 + hash(i + 5) * 5, hash(i + 6) * 3 + t, hash(i + 7) > 0.5 ? GOLD : [236, 236, 244], env * tw * 0.8);
    }
  }
  function caption(g, t) {
    const c = TL.cap; if (t < c.ba[0]) return;
    const cs = 1.8, gap = 16, lb = lay('cap_ba'), lt = lay('cap_tha'); const plusW = 26;
    const total = (lb.w + gap + plusW + gap - 9 + lt.w) * cs; let x = 540 - total / 2; const base = 985;       // bottom of the letters
    g.save();
    drawWipe(g, 'cap_ba', seg(t, c.ba[0], c.ba[1]), 12, [x, base - lb.h * cs], cs); x += (lb.w + gap) * cs;
    const pu = seg(t, c.plus, c.plus + 0.4);
    if (pu > 0) { g.save(); g.translate(x + plusW * cs / 2, base - 24 * cs); const k = pop(pu); g.scale(k * cs, k * cs); g.globalAlpha = clamp(pu * 6);
      g.fillStyle = rgb(CORAL); g.beginPath(); g.roundRect(-13, -3.4, 26, 6.8, 2.2); g.fill(); g.beginPath(); g.roundRect(-3.4, -13, 6.8, 26, 2.2); g.fill(); g.restore(); }
    x += (plusW + gap - 9) * cs;
    drawWipe(g, 'cap_tha', seg(t, c.tha[0], c.tha[1]), 12, [x, base - lt.h * cs], cs);
    g.restore();
  }

  function inkFlecks(g, t, z) {
    const jobs = [{ P: R_ba.P, t0: TL.baBody[0], t1: TL.baBody[1], col: WET_BLUE }, { P: R_wB.P, t0: TL.wordWrite[0], t1: TL.wordWrite[1], col: WET_BLUE }];
    for (const j of jobs) {
      if (t < j.t0 || t > j.t1 + 0.6) continue;
      const dt = 0.016, i1 = Math.floor((Math.min(t, j.t1) - j.t0) / dt);
      for (let i = Math.max(0, i1 - 40); i <= i1; i++) {
        const tb = j.t0 + i * dt, age = t - tb; if (age < 0 || age > 0.6) continue;
        if (hash(i * 5 + j.t0) < 0.55) continue;
        const u = (tb - j.t0) / (j.t1 - j.t0); const pos = pathAt(j.P, j.P.total * TL.prog(u));
        const vx = (hash(i * 3 + j.t0 * 10) - 0.5) * 120, vy = (hash(i * 3 + 1 + j.t0 * 10) - 0.9) * 90;
        const k = age / 0.6, r = (1.0 + hash(i + 7) * 1.8) * (1 - k * 0.6) / z;
        g.fillStyle = rgb(j.col, (1 - k) * 0.8); g.beginPath(); g.arc(pos[0] + vx * age / z, pos[1] + vy * age / z + 44 * age * age / z, r, 0, 7); g.fill();
      }
    }
  }

  // ---------- one frame ----------
  let sweepCv, sweepX;
  function frame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const cam = camAt(t); const z = cam.s;
    // shake on dot stamps (screen px, decaying)
    let shx = 0, shy = 0;
    for (const ts of [TL.baDot, ...TL.thaDots]) { const a = t - ts; if (a > 0 && a < 0.28) { const d = Math.exp(-a * 16) * 1.7; shx += Math.sin(a * 90) * d; shy += Math.cos(a * 76) * d; } }
    // page background: static grid plate, fades in
    const gi = eOut3(seg(t, TL.gridIn[0], TL.gridIn[1]));
    ctx.fillStyle = rgb(CREAM); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = gi; ctx.drawImage(IMG.bg_plate, 0, 0); ctx.globalAlpha = 1;

    ctx.save(); ctx.translate(540 + shx, 675 + shy); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);

    // ===== card group (fades away during the zoom) =====
    const cardA = 1 - eIO2(seg(t, TL.cardFade[0], TL.cardFade[1]));
    if (cardA > 0.002) {
      ctx.save(); ctx.globalAlpha = cardA;
      const cu = seg(t, TL.card[0], TL.card[1]); const land = pop(cu);
      const cs = lerp(0.88, 1, land), cty = (1 - eOut3(cu)) * 70;
      ctx.translate(540, 675 + cty); ctx.scale(cs, cs); ctx.translate(-540, -675);
      const cAlpha = clamp(cu * 4);
      if (cu < 1) { ctx.save(); ctx.shadowColor = `rgba(60,80,110,${0.30 * (1 - cu)})`; ctx.shadowBlur = 50; ctx.shadowOffsetY = 28 * (1 - cu); ctx.beginPath(); rrPath(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r, false); ctx.fillStyle = rgb(BLUE, 1); ctx.globalAlpha = cardA * cAlpha; ctx.fill(); ctx.restore(); }
      drawFrame(ctx, CARD, rgb(BLUE), eIO2(seg(t, TL.cardBorder[0], TL.cardBorder[1])), CARD.bw, rgb(GOLD), cAlpha);
      const pf = eOut3(seg(t, TL.panelFill[0], TL.panelFill[1]));
      if (pf > 0) { ctx.save(); ctx.globalAlpha *= pf; ctx.translate(540, 540); const ps = lerp(0.96, 1, pf); ctx.scale(ps, ps); ctx.translate(-540, -540);
        drawFrame(ctx, PNL, rgb(PANEL), eIO2(seg(t, TL.panelBorder[0], TL.panelBorder[1])), PNL.bw, rgb(GOLD), 1); ctx.restore(); }
      else drawFrame(ctx, PNL, null, eIO2(seg(t, TL.panelBorder[0], TL.panelBorder[1])), PNL.bw, rgb(GOLD), 1);
      drawWipe(ctx, 'label_ba', seg(t, TL.labelBa[0], TL.labelBa[1]), 12);
      // small row pops in, right to left: ba, bi, bu
      for (const id of ['ba', 'bi', 'bu']) {
        const T0 = TL.row[id], pd = TL.popDur; if (t < T0) continue;
        const [bx, by] = centre(`s_${id}_body`); popAt(ctx, `s_${id}_body`, bx, by, seg(t, T0, T0 + pd), 0.0);
        const [dx_, dy_] = centre(`s_${id}_dot`); const dt0 = T0 + TL.rowDot; popAt(ctx, `s_${id}_dot`, dx_, dy_, seg(t, dt0, dt0 + pd), -0.6);
        ring(ctx, dx_, dy_, dt0 + 0.03, t, GOLD, 12, 36, 2.2); burst(ctx, dx_, dy_, dt0 + 0.02, t, GOLD, 5, 26, 4.2, id.charCodeAt(1) * 7);
        const [mx, my] = centre(`s_${id}_mark`); const mt0 = T0 + TL.rowMark; popAt(ctx, `s_${id}_mark`, mx, my, seg(t, mt0, mt0 + pd), id === 'bu' ? -0.8 : 0.3, id === 'bi' ? 22 : -26);
        drawWipe(ctx, `lab_${id}`, seg(t, T0 + TL.rowLabel[0], T0 + TL.rowLabel[1]), 14);
      }
      ctx.restore();
    }

    // ===== the big letter / the word =====
    const pu = seg(t, TL.pulse, TL.pulse + 0.8); const pls = 1 + (pu > 0 && pu < 1 ? 0.016 * Math.sin(pu * Math.PI) * Math.exp(-pu * 2.5) * 2.6 : 0);
    const sw = seg(t, TL.sweep[0], TL.sweep[1]); const sweeping = sw > 0 && sw < 1;
    let g = ctx;
    if (sweeping) { g = sweepX; sweepX.setTransform(1, 0, 0, 1, 0, 0); sweepX.clearRect(0, 0, W, H); sweepX.imageSmoothingQuality = 'high'; sweepX.translate(540 + shx, 675 + shy); sweepX.scale(z, z); sweepX.translate(-cam.x, -cam.y); }
    g.save(); if (pls !== 1) { g.translate(G.wordC[0], G.wordC[1]); g.scale(pls, pls); g.translate(-G.wordC[0], -G.wordC[1]); }
    const retracting = t >= TL.retract[0];
    if (!retracting) {
      const writing = t > TL.baBody[0] && t < TL.baBody[1];
      const fr = t >= TL.baBody[1] ? 1e4 : (writing ? lerp(-FEATHER, R_ba.P.total + FEATHER, TL.prog(seg(t, TL.baBody[0], TL.baBody[1]))) : -1e4);
      drawReveal(g, R_ba, fr);
    } else {
      const u = seg(t, TL.retract[0], TL.retract[1]);
      if (u < 1) drawReveal(g, R_ba, lerp(R_ba.P.total + FEATHER + 70, G.sCut, eIO3(u)), false);
      else { g.save(); g.beginPath(); g.rect(SEAM_X, 0, 400, 4000); g.clip(); g.drawImage(R_ba.cvs, R_ba.rect.x, R_ba.rect.y, R_ba.rect.w, R_ba.rect.h); g.restore(); }
    }
    // the dot: stamped under the isolated ba, then slides under the tooth
    {
      const l = lay('ba_dot'); const su = seg(t, TL.dotSlide[0], TL.dotSlide[1]); const e = eIO3(su);
      const cx = lerp(G.dotHome[0], G.dotTarget[0], e), cy = lerp(G.dotHome[1], G.dotTarget[1], e) - Math.sin(Math.PI * e) * 14;
      popAt(g, 'ba_dot', cx, cy, seg(t, TL.baDot, TL.baDot + TL.dotDur), -0.7);
      if (t < TL.dotSlide[0] + 0.01 || true) { ring(g, G.dotHome[0], G.dotHome[1], TL.baDot + 0.04, t, BLUE, 30, 88, 3.5); burst(g, G.dotHome[0], G.dotHome[1], TL.baDot + 0.03, t, BLUE, 7, 62, 7, 3); }
    }
    // the joined tha
    if (t >= TL.wordWrite[0]) {
      const u = seg(t, TL.wordWrite[0], TL.wordWrite[1]);
      drawReveal(g, R_wB, t >= TL.wordWrite[1] ? 1e4 : lerp(-FEATHER, R_wB.P.total + FEATHER, TL.prog(u)));
    }
    G.thaDots.forEach((d, i) => { const t0 = TL.thaDots[i]; popAt(g, 'ba_dot', d[0], d[1], seg(t, t0, t0 + TL.dotDur), [-0.6, 0.6, -0.4][i]); ring(g, d[0], d[1], t0 + 0.04, t, BLUE, 30, 88, 3.5); burst(g, d[0], d[1], t0 + 0.03, t, BLUE, 7, 62, 7, i * 13 + 1); });
    g.restore();
    if (sweeping) {
      sweepX.setTransform(1, 0, 0, 1, 0, 0); sweepX.globalCompositeOperation = 'source-atop';
      const cx = lerp(-250, W + 250, eIO2(sw)); const gr = sweepX.createLinearGradient(cx - 150, 300, cx + 150, 800);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      sweepX.fillStyle = gr; sweepX.fillRect(0, 0, W, H); sweepX.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(sweepCv, 0, 0); ctx.restore();
    }

    inkFlecks(ctx, t, z);
    const p = penState(t);
    if (p) drawPen(ctx, p.x, p.y, 1 / z, p.alpha, p.lift);
    ctx.restore();

    // ===== screen space =====
    sparkles(ctx, t);
    caption(ctx, t);
  }

  window.renderFrame = t => { frame(t); };
  window.__debug = { BA_CTRL, get R_ba() { return R_ba; }, get R_wB() { return R_wB; }, G, lay, IMG, pathAt };
  window.__ready = loadAll().then(() => { sweepCv = document.createElement('canvas'); sweepCv.width = W; sweepCv.height = H; sweepX = sweepCv.getContext('2d'); const t0 = performance.now(); setup(); console.log('setup ms', Math.round(performance.now() - t0)); frame(0); return true; });
})();

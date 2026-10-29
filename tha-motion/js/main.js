'use strict';
/* ث (tha') writing animation — every frame is a pure function of t:  window.renderFrame(t)  */
(() => {
  const W = 1080, H = 1350;
  const cv = document.getElementById('cv'); const ctx = cv.getContext('2d');
  const TL = window.TL, A = window.ASSETS, M = A.manifest;

  // ---------- palette (sampled from the reference) ----------
  const CREAM = [246, 241, 235], PANEL = [247, 242, 232], BLUE = [150, 168, 189], GOLD = [243, 198, 129], CORAL = [217, 126, 105];
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
  const pop = u => u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(10 * u);     // damped spring, ~10% overshoot
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------- assets ----------
  const IMG = {}; const L = M;
  const loadAll = () => Promise.all(Object.entries(A.img).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.src = src; })));

  // ---------- pen paths (centre-lines, written right -> left) ----------
  const BIG_CTRL = [[712, 476], [717, 508], [722, 545], [721, 580], [712, 610], [690, 626], [650, 634], [600, 640], [550, 643], [500, 645], [450, 640], [410, 626], [378, 606], [355, 578], [343, 545], [344, 508], [352, 472]];

  function catmull(P, step = 2) {
    const out = [];
    const pts = [P[0], ...P, P[P.length - 1]];
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
    s = clamp(s, 0, P.total);
    let lo = 0, hi = P.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.cum[m] <= s) lo = m; else hi = m; }
    const f = (s - P.cum[lo]) / Math.max(1e-6, P.cum[hi] - P.cum[lo]);
    return [lerp(P.pts[lo][0], P.pts[hi][0], f), lerp(P.pts[lo][1], P.pts[hi][1], f)];
  };
  // small letters share the big letter's shape: map between tight glyph boxes
  const tight = l => ({ x: l.x + 6, y: l.y + 6, w: l.w - 12, h: l.h - 12 });
  function mapCtrl(from, to) { const a = tight(from), b = tight(to); return BIG_CTRL.map(p => [b.x + (p[0] - a.x) / a.w * b.w, b.y + (p[1] - a.y) / a.h * b.h]); }

  // ---------- progressive "ink" reveal along a pen path ----------
  const FEATHER = 9;
  function buildReveal(name, ctrl, wet, base, wetLen) {
    const l = L[name]; const img = IMG[name];
    const c = document.createElement('canvas'); c.width = l.w; c.height = l.h; const x = c.getContext('2d');
    x.drawImage(img, 0, 0); const id = x.getImageData(0, 0, l.w, l.h);
    const n = l.w * l.h; const a = new Uint8Array(n), s = new Float32Array(n);
    const P = catmull(ctrl, 2);
    const px = Float32Array.from(P.pts, p => p[0] - l.x), py = Float32Array.from(P.pts, p => p[1] - l.y), cum = Float32Array.from(P.cum);
    for (let i = 0; i < n; i++) {
      const al = id.data[i * 4 + 3]; a[i] = al; if (!al) continue;
      const X = i % l.w, Y = (i / l.w) | 0; let best = 1e9, bi = 0;
      for (let k = 0; k < px.length; k++) { const dx = X - px[k], dy = Y - py[k], d = dx * dx + dy * dy; if (d < best) { best = d; bi = k; } }
      s[i] = cum[bi];
    }
    return { name, l, img, c, x, id, a, s, P, wet, base, wetLen };
  }
  function drawReveal(g, R, front) {
    const { l } = R;
    if (front >= R.P.total + FEATHER + R.wetLen) { g.drawImage(R.img, l.x, l.y); return; }
    if (front <= -FEATHER) return;
    const d = R.id.data, { a, s, wet, base, wetLen } = R; const n = a.length;
    for (let i = 0; i < n; i++) {
      const al = a[i]; if (!al) { d[i * 4 + 3] = 0; continue; }
      const dd = front - s[i]; const k = clamp(dd / FEATHER);
      if (k <= 0) { d[i * 4 + 3] = 0; continue; }
      const w = dd < wetLen ? Math.pow(1 - dd / wetLen, 1.5) : 0;
      d[i * 4] = base[0] + (wet[0] - base[0]) * w; d[i * 4 + 1] = base[1] + (wet[1] - base[1]) * w; d[i * 4 + 2] = base[2] + (wet[2] - base[2]) * w;
      d[i * 4 + 3] = al * (k * k * (3 - 2 * k));
    }
    R.x.putImageData(R.id, 0, 0); g.drawImage(R.c, l.x, l.y);
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

  // ---------- reed pen ----------
  function drawPen(g, x, y, sc, alpha, lift, t) {
    if (alpha <= 0.01) return;
    g.save(); g.translate(x, y); g.rotate(0.62); g.scale(sc, sc); g.globalAlpha = alpha;
    // contact shadow on the page
    g.save(); g.globalAlpha = alpha * (0.22 - lift * 0.1); g.fillStyle = '#31465f'; g.beginPath(); g.ellipse(8 + lift * 14, 4 + lift * 10, 16 + lift * 6, 5 + lift * 3, -0.3, 0, 7); g.fill(); g.restore();
    g.translate(0, -lift * 22);
    // reed body
    const grd = g.createLinearGradient(-14, 0, 14, 0); grd.addColorStop(0, 'rgb(252,222,160)'); grd.addColorStop(0.55, 'rgb(243,198,129)'); grd.addColorStop(1, 'rgb(196,140,82)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(-7, -34); g.lineTo(7.5, -30); g.lineTo(13, -214); g.quadraticCurveTo(0, -226, -13, -214); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-4, -40); g.lineTo(-2, -40); g.lineTo(-5, -208); g.lineTo(-8, -206); g.closePath(); g.fill();
    // coral ring
    g.fillStyle = rgb(CORAL, 0.95); g.beginPath(); g.moveTo(-9.5, -150); g.lineTo(10.5, -146); g.lineTo(11, -132); g.lineTo(-9, -136); g.closePath(); g.fill();
    // slate nib
    g.fillStyle = 'rgb(66,84,110)'; g.beginPath(); g.moveTo(-6, 1); g.lineTo(5, -3); g.lineTo(8, -32); g.lineTo(-8, -35); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(243,198,129,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-0.5, -2); g.lineTo(0.5, -26); g.stroke();
    g.restore();
  }

  // ---------- small helpers for layers ----------
  const drawImgAt = (g, name) => g.drawImage(IMG[name], L[name].x, L[name].y);
  function drawPopped(g, name, u, rot0, dy0 = 0, spark) {
    if (u <= 0) return;
    const l = L[name]; const cx = l.cx !== undefined ? l.cx : l.x + l.w / 2, cy = l.cy !== undefined ? l.cy : l.y + l.h / 2;
    const k = pop(u), al = clamp(u * 7);
    g.save(); g.globalAlpha = al; g.translate(cx, cy + dy0 * (1 - eOut3(clamp(u * 1.4)))); g.rotate(rot0 * (1 - eOut3(clamp(u * 1.2)))); g.scale(k, k); g.translate(-cx, -cy);
    drawImgAt(g, name); g.restore();
  }
  const wipeCv = document.createElement('canvas'); wipeCv.width = 200; wipeCv.height = 90; const wipeX = wipeCv.getContext('2d');
  function drawWipe(g, name, u, rise = 10) {
    if (u <= 0) return;
    const l = L[name]; const e = eIO2(u);
    wipeX.clearRect(0, 0, 200, 90); wipeX.globalCompositeOperation = 'source-over'; wipeX.drawImage(IMG[name], 0, 0);
    wipeX.globalCompositeOperation = 'destination-in';
    const edge = e * (l.w + 30) - 15; const gr = wipeX.createLinearGradient(edge - 18, 0, edge + 18, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); wipeX.fillStyle = gr; wipeX.fillRect(0, 0, l.w, l.h);
    g.save(); g.globalAlpha = clamp(u * 5); g.drawImage(wipeCv, 0, 0, l.w, l.h, l.x, l.y + rise * (1 - eOut3(u)), l.w, l.h); g.restore();
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

  // ---------- build everything once ----------
  let BIG, SM = {}, bigCv, bigX;
  const BIGBOX = { x: 318, y: 366, w: 432, h: 320 };
  function setup() {
    BIG = buildReveal('big_body', BIG_CTRL, WET_BLUE, BLUE, 70);
    for (const s of TL.small) SM[s.id] = buildReveal('s_' + s.id + '_body', mapCtrl(L.big_body, L['s_' + s.id + '_body']), WET_GOLD, GOLD, 34);
    bigCv = document.createElement('canvas'); bigCv.width = BIGBOX.w; bigCv.height = BIGBOX.h; bigX = bigCv.getContext('2d');
  }

  // ---------- pen choreography ----------
  // returns {x,y,sc,alpha,lift} for time t
  function penState(t) {
    const segs = [];
    const bigDots = ['big_dot0', 'big_dot1', 'big_dot2'].map(n => [L[n].cx, L[n].cy]);
    const bigStart = pathAt(BIG.P, 0), bigEnd = pathAt(BIG.P, BIG.P.total);
    const park = [820, 330];
    // approach to start of the big letter
    segs.push({ t0: TL.penIn[0], t1: TL.bigBody[0], from: [park[0] + 60, park[1] - 60], to: bigStart, sc: 1, lift: [1, 0.15], a: [0, 1] });
    segs.push({ t0: TL.bigBody[0], t1: TL.bigBody[1], path: BIG.P, sc: 1, prog: u => TL.prog(u) });
    // hops between dots (nib "taps")
    let prev = bigEnd, pt = TL.bigBody[1];
    TL.bigDots.forEach((td, i) => { segs.push({ t0: pt, t1: td - 0.02, from: prev, to: bigDots[i], sc: 1, lift: [0.5, 0], arc: 46 }); segs.push({ t0: td - 0.02, t1: td + 0.18, hold: bigDots[i], sc: 1, lift: [0, 0.35] }); prev = bigDots[i]; pt = td + 0.18; });
    segs.push({ t0: pt, t1: TL.penOut[1], from: prev, to: [park[0] + 90, park[1] - 80], sc: 1, lift: [0.3, 1], a: [1, 0] });
    // small letters
    let last = null;
    TL.small.forEach((s, idx) => {
      const R = SM[s.id], T0 = s.T; const st = pathAt(R.P, 0), en = pathAt(R.P, R.P.total);
      const dots = [0, 1, 2].map(i => [L[`s_${s.id}_dot${i}`].cx, L[`s_${s.id}_dot${i}`].cy]);
      const mk = L[`s_${s.id}_mark`]; const mp = [mk.x + mk.w / 2, mk.y + mk.h / 2];
      if (idx === 0) segs.push({ t0: T0 - 0.42, t1: T0, from: [st[0] + 70, st[1] - 90], to: st, sc: 0.5, lift: [1, 0.15], a: [0, 1] });
      else segs.push({ t0: last.t, t1: T0, from: last.p, to: st, sc: 0.5, lift: [0.5, 0.1], arc: 34 });
      segs.push({ t0: T0, t1: T0 + TL.sBody[1], path: R.P, sc: 0.5, prog: u => TL.prog(u) });
      let pv = en, ptt = T0 + TL.sBody[1];
      TL.sDots.forEach((od, i) => { segs.push({ t0: ptt, t1: T0 + od - 0.015, from: pv, to: dots[i], sc: 0.5, lift: [0.4, 0], arc: 20 }); segs.push({ t0: T0 + od - 0.015, t1: T0 + od + 0.08, hold: dots[i], sc: 0.5, lift: [0, 0.3] }); pv = dots[i]; ptt = T0 + od + 0.08; });
      segs.push({ t0: ptt, t1: T0 + TL.sMark - 0.02, from: pv, to: mp, sc: 0.5, lift: [0.4, 0.1], arc: 22 });
      segs.push({ t0: T0 + TL.sMark - 0.02, t1: T0 + TL.sMark + 0.12, hold: mp, sc: 0.5, lift: [0.1, 0.3] });
      last = { t: T0 + TL.sMark + 0.12, p: mp };
    });
    segs.push({ t0: last.t, t1: TL.penOutEnd[1], from: last.p, to: [last.p[0] + 120, last.p[1] - 160], sc: 0.5, lift: [0.3, 1], a: [1, 0] });

    for (const s of segs) {
      if (t < s.t0 || t > s.t1) continue;
      const u = (t - s.t0) / (s.t1 - s.t0); let p, lift = 0, a = 1;
      if (s.path) { p = pathAt(s.path, s.path.total * s.prog(u)); lift = 0; p = [p[0] + Math.sin(t * 31) * 0.4, p[1] + Math.cos(t * 27) * 0.4]; }
      else if (s.hold) { p = s.hold; lift = lerp(s.lift[0], s.lift[1], u); }
      else { const e = eIO3(u); p = [lerp(s.from[0], s.to[0], e), lerp(s.from[1], s.to[1], e) - (s.arc || 0) * Math.sin(Math.PI * e)]; lift = lerp(s.lift[0], s.lift[1], e); }
      if (s.a) a = lerp(s.a[0], s.a[1], eIO2(u));
      return { x: p[0], y: p[1], sc: s.sc, alpha: a, lift };
    }
    return null;
  }

  // ---------- camera ----------
  const CAM = [
    { t: 0, s: 1, x: 540, y: 675 }, { t: 2.3, s: 1, x: 540, y: 675 },
    { t: 5.6, s: 1.08, x: 540, y: 600 }, { t: 7.0, s: 1.05, x: 540, y: 640 },
    { t: 7.9, s: 1.0, x: 540, y: 675 },
    { t: 8.3, s: 1.0, x: 540, y: 675 }, { t: 9.1, s: 1.06, x: 620, y: 850 },
    { t: 10.6, s: 1.06, x: 540, y: 850 }, { t: 12.1, s: 1.06, x: 460, y: 850 },
    { t: 13.0, s: 1.0, x: 540, y: 675 }, { t: 99, s: 1, x: 540, y: 675 },
  ];
  function camAt(t) {
    let i = 0; while (i < CAM.length - 2 && t > CAM[i + 1].t) i++;
    const a = CAM[i], b = CAM[i + 1], u = eIO3(seg(t, a.t, b.t));
    return { s: lerp(a.s, b.s, u), x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  }

  // ---------- extended grid so the camera never reveals an edge ----------
  function drawBg(g, t) {
    const gi = eOut3(seg(t, TL.gridIn[0], TL.gridIn[1]));
    g.fillStyle = rgb(CREAM); g.fillRect(-300, -300, W + 600, H + 600);
    g.save(); g.globalAlpha = gi; g.fillStyle = 'rgba(208,198,186,1)';
    for (let k = -4; k < 15; k++) g.fillRect(79.2 + 106 * k, -300, 2.2, H + 600);
    for (let k = -5; k < 16; k++) g.fillRect(-300, 105.2 + 106.05 * k, W + 600, 2.2);
    g.drawImage(IMG.bg_plate, 0, 0); g.restore();
  }

  // ---------- sparkles (finale) ----------
  function sparkles(g, t) {
    const [a, b] = TL.sparkles; if (t < a || t > b) return;
    const env = Math.min(seg(t, a, a + 0.5), 1 - seg(t, b - 0.6, b));
    for (let i = 0; i < 46; i++) {
      const ph = (t - a) * (0.14 + hash(i) * 0.2) + hash(i + 9);
      const x = 190 + hash(i + 1) * 700, y = 1120 - ((ph % 1) * 880) + hash(i + 3) * 40;
      const tw = 0.5 + 0.5 * Math.sin(t * (3 + hash(i + 4) * 4) + i);
      diamond(g, x, y, 3 + hash(i + 5) * 5, hash(i + 6) * 3 + t, hash(i + 7) > 0.5 ? GOLD : [236, 236, 244], env * tw * 0.8);
    }
  }

  // ---------- one frame ----------
  function frame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    const cam = camAt(t);
    // shake on the dot stamps (tiny, decaying)
    let shx = 0, shy = 0;
    const stamps = [...TL.bigDots, ...TL.small.flatMap(s => TL.sDots.map(o => s.T + o))];
    for (const ts of stamps) { const a = t - ts; if (a > 0 && a < 0.28) { const d = Math.exp(-a * 16) * 1.7; shx += Math.sin(a * 90) * d; shy += Math.cos(a * 76) * d; } }
    // background with half-strength parallax
    ctx.save(); const bs = 1 + (cam.s - 1) * 0.45; ctx.translate(540, 675); ctx.scale(bs, bs); ctx.translate(-lerp(540, cam.x, 0.45) + shx * 0.4, -lerp(675, cam.y, 0.45) + shy * 0.4); drawBg(ctx, t); ctx.restore();

    ctx.save(); ctx.translate(540 + shx, 675 + shy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.x, -cam.y);

    // card landing: spring scale + rise, soft shadow that thins as it lands
    const cu = seg(t, TL.card[0], TL.card[1]); const land = pop(cu);
    const cs = lerp(0.88, 1, land), cty = (1 - eOut3(cu)) * 70;
    // finale pulse
    const pu = seg(t, TL.pulse, TL.pulse + 0.8); const pls = 1 + (pu > 0 && pu < 1 ? 0.014 * Math.sin(pu * Math.PI) * Math.exp(-pu * 2.5) * 2.6 : 0);
    ctx.translate(540, 675 + cty); ctx.scale(cs * pls, cs * pls); ctx.translate(-540, -675);
    const cAlpha = clamp(cu * 4);
    if (cu < 1) { ctx.save(); ctx.shadowColor = `rgba(60,80,110,${0.30 * (1 - cu)})`; ctx.shadowBlur = 50; ctx.shadowOffsetY = 28 * (1 - cu); ctx.beginPath(); rrPath(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r, false); ctx.fillStyle = rgb(BLUE, 1); ctx.globalAlpha = cAlpha; ctx.fill(); ctx.restore(); }
    drawFrame(ctx, CARD, rgb(BLUE), eIO2(seg(t, TL.cardBorder[0], TL.cardBorder[1])), CARD.bw, rgb(GOLD), cAlpha);
    // inner panel
    const pf = eOut3(seg(t, TL.panelFill[0], TL.panelFill[1]));
    if (pf > 0) {
      ctx.save(); ctx.globalAlpha = pf; ctx.translate(540, 540); const ps = lerp(0.96, 1, pf); ctx.scale(ps, ps); ctx.translate(-540, -540);
      drawFrame(ctx, PNL, rgb(PANEL), eIO2(seg(t, TL.panelBorder[0], TL.panelBorder[1])), PNL.bw, rgb(GOLD), 1); ctx.restore();
    } else drawFrame(ctx, PNL, null, eIO2(seg(t, TL.panelBorder[0], TL.panelBorder[1])), PNL.bw, rgb(GOLD), 1);

    // ===== big letter =====
    {
      bigX.setTransform(1, 0, 0, 1, -BIGBOX.x, -BIGBOX.y); bigX.clearRect(BIGBOX.x, BIGBOX.y, BIGBOX.w, BIGBOX.h);
      const front = BIG.P.total * TL.prog(seg(t, TL.bigBody[0], TL.bigBody[1])) * 1.0 + (t >= TL.bigBody[1] ? 1e4 : -FEATHER - 1 + 0) ;
      const writing = t > TL.bigBody[0] && t < TL.bigBody[1];
      const fr = t >= TL.bigBody[1] ? 1e4 : (writing ? lerp(-FEATHER, BIG.P.total + FEATHER, TL.prog(seg(t, TL.bigBody[0], TL.bigBody[1]))) : -1e4);
      drawReveal(bigX, BIG, fr);
      ['big_dot0', 'big_dot1', 'big_dot2'].forEach((n, i) => drawPopped(bigX, n, seg(t, TL.bigDots[i], TL.bigDots[i] + TL.dotDur), [-0.7, 0.6, -0.4][i]));
      // light sweep, clipped to the ink
      const sw = seg(t, TL.sweep[0], TL.sweep[1]);
      if (sw > 0 && sw < 1) {
        bigX.save(); bigX.globalCompositeOperation = 'source-atop'; const cx = lerp(BIGBOX.x - 120, BIGBOX.x + BIGBOX.w + 120, eIO2(sw));
        const gr = bigX.createLinearGradient(cx - 70, BIGBOX.y, cx + 70, BIGBOX.y + BIGBOX.h * 0.5); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        bigX.fillStyle = gr; bigX.fillRect(BIGBOX.x, BIGBOX.y, BIGBOX.w, BIGBOX.h); bigX.restore();
      }
      ctx.drawImage(bigCv, BIGBOX.x, BIGBOX.y);
      // ripples + sparks at each dot
      ['big_dot0', 'big_dot1', 'big_dot2'].forEach((n, i) => { const l = L[n]; ring(ctx, l.cx, l.cy, TL.bigDots[i] + 0.04, t, BLUE, 30, 88, 3.5); burst(ctx, l.cx, l.cy, TL.bigDots[i] + 0.03, t, BLUE, 7, 62, 7, i * 13 + 1); });
    }
    drawWipe(ctx, 'label_main', seg(t, TL.labelMain[0], TL.labelMain[1]), 12);

    // ===== small letters =====
    for (const s of TL.small) {
      const T0 = s.T, id = s.id;
      const R = SM[id];
      const wr = seg(t, T0 + TL.sBody[0], T0 + TL.sBody[1]);
      const fr = t >= T0 + TL.sBody[1] ? 1e4 : (t > T0 ? lerp(-FEATHER, R.P.total + FEATHER, TL.prog(wr)) : -1e4);
      drawReveal(ctx, R, fr);
      [0, 1, 2].forEach(i => { const n = `s_${id}_dot${i}`, l = L[n], t0 = T0 + TL.sDots[i]; drawPopped(ctx, n, seg(t, t0, t0 + TL.sDotDur), [-0.6, 0.6, -0.4][i]); ring(ctx, l.cx, l.cy, t0 + 0.03, t, GOLD, 12, 36, 2.2); burst(ctx, l.cx, l.cy, t0 + 0.02, t, GOLD, 5, 26, 4.2, i * 7 + (id.charCodeAt(2) % 7) * 31); });
      const mdy = id === 'thi' ? 22 : -26, mrot = id === 'thu' ? -0.8 : (id === 'tha' ? 0.35 : 0);
      const mt0 = T0 + TL.sMark; drawPopped(ctx, `s_${id}_mark`, seg(t, mt0, mt0 + TL.sMarkDur), mrot, mdy);
      const ml = L[`s_${id}_mark`]; ring(ctx, ml.x + ml.w / 2, ml.y + ml.h / 2, mt0 + 0.05, t, GOLD, 10, 40, 2);
      drawWipe(ctx, 'lab_' + id, seg(t, T0 + TL.sLabel[0], T0 + TL.sLabel[1]), 14);
    }

    // ===== ink flecks while the pen travels =====
    inkFlecks(ctx, t);

    // ===== pen =====
    const p = penState(t);
    if (p) { const ps = p.alpha; drawPen(ctx, p.x, p.y, p.sc, ps, p.lift, t); }

    sparkles(ctx, t);

    // gold shimmer running round the card border
    const sh = seg(t, TL.shimmer[0], TL.shimmer[1]);
    if (sh > 0 && sh < 1) {
      const ang = eIO2(sh) * Math.PI * 2 - Math.PI / 2; const g = ctx.createConicGradient(0, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2);
      const c = ((ang / (Math.PI * 2)) % 1 + 1) % 1; const stops = [[-0.09, 0], [-0.025, 0.55], [0, 1], [0.025, 0.55], [0.09, 0]];
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      const arr = stops.map(([o, a]) => [((c + o) % 1 + 1) % 1, a]).sort((a, b) => a[0] - b[0]);
      for (const [o, a] of arr) g.addColorStop(clamp(o), `rgba(255,252,236,${a * 0.95})`);
      ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = CARD.bw - 1.5; ctx.beginPath(); rrPath(ctx, CARD.x + CARD.bw / 2, CARD.y + CARD.bw / 2, CARD.w - CARD.bw, CARD.h - CARD.bw, CARD.r - CARD.bw / 2, false); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }

  function inkFlecks(g, t) {
    const jobs = [{ P: BIG.P, t0: TL.bigBody[0], t1: TL.bigBody[1], col: BLUE, sc: 1 }, ...TL.small.map(s => ({ P: SM[s.id].P, t0: s.T, t1: s.T + TL.sBody[1], col: GOLD, sc: 0.5 }))];
    for (const j of jobs) {
      if (t < j.t0 || t > j.t1 + 0.6) continue;
      const dt = 0.016, i1 = Math.floor((Math.min(t, j.t1) - j.t0) / dt);
      for (let i = Math.max(0, i1 - 40); i <= i1; i++) {
        const tb = j.t0 + i * dt, age = t - tb; if (age < 0 || age > 0.6) continue;
        const u = (tb - j.t0) / (j.t1 - j.t0); const pos = pathAt(j.P, j.P.total * TL.prog(u));
        const vx = (hash(i * 3 + j.t0 * 10) - 0.5) * 120 * j.sc, vy = (hash(i * 3 + 1 + j.t0 * 10) - 0.9) * 90 * j.sc;
        const k = age / 0.6, r = (1.0 + hash(i + 7) * 1.8) * (0.4 + j.sc * 0.6) * (1 - k * 0.6);
        if (hash(i * 5 + j.t0) < 0.55) continue;
        g.fillStyle = rgb(j.col === BLUE ? WET_BLUE : WET_GOLD, (1 - k) * 0.8); g.beginPath(); g.arc(pos[0] + vx * age, pos[1] + vy * age + 220 * age * age * j.sc * 0.2, r, 0, 7); g.fill();
      }
    }
  }

  window.renderFrame = t => { frame(t); };
  window.__debug = { BIG_CTRL, get BIG() { return BIG; }, SM: () => SM, catmull, pathAt, L, IMG };
  window.__ready = loadAll().then(() => { setup(); frame(0); return true; });
})();

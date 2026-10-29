/* Shared by the renderer (browser) and the soundtrack generator (node): one source of truth for timing. */
(function () {
  const TL = {
    DUR: 15, FPS: 60,
    gridIn: [0.0, 0.9],
    card: [0.35, 1.4], cardBorder: [0.5, 1.3], panelBorder: [1.05, 1.75], panelFill: [1.2, 1.8],
    penIn: [1.85, 2.5],
    bigBody: [2.6, 5.4],
    bigDots: [5.7, 6.12, 6.54], dotDur: 0.5,
    penOut: [6.95, 7.5],
    sweep: [7.15, 8.0], labelMain: [7.3, 8.1],
    smallDur: 1.5,
    small: [{ id: 'tha', T: 8.3 }, { id: 'thi', T: 9.8 }, { id: 'thu', T: 11.3 }],
    // offsets inside a small-letter slot
    sBody: [0.0, 0.5], sDots: [0.62, 0.74, 0.86], sDotDur: 0.32, sMark: 1.0, sMarkDur: 0.45, sLabel: [1.08, 1.5],
    penOutEnd: [12.2, 12.75],
    pulse: 12.85, shimmer: [13.0, 14.4], sparkles: [12.85, 14.7],
    // writing speed profile: gentle start, steady middle, soft landing
    prog(u) { u = Math.min(1, Math.max(0, u)); return 0.6 * 0.5 * (1 - Math.cos(Math.PI * u)) + 0.4 * u; },
  };
  if (typeof module !== 'undefined') module.exports = TL; else window.TL = TL;
})();

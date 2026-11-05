/* Shared by the renderer (browser) and the soundtrack generator (node): one source of truth for timing. */
(function () {
  const TL = {
    DUR: 15, FPS: 60,
    gridIn: [0.0, 0.9],
    card: [0.3, 1.3], cardBorder: [0.45, 1.2], panelBorder: [0.95, 1.6], panelFill: [1.1, 1.65],
    penIn: [1.5, 1.95],
    baBody: [1.95, 3.75],
    baDot: 3.95, dotDur: 0.5,
    penExit: [4.15, 4.6],
    labelBa: [4.15, 4.8],
    row: { ba: 5.0, bi: 5.22, bu: 5.44 }, rowDot: 0.07, rowMark: 0.13, rowLabel: [0.2, 0.5], popDur: 0.42,
    zoom: [6.0, 7.4], cardFade: [6.2, 7.2],
    eraserIn: [7.68, 7.85], retract: [7.85, 8.6], eraserOut: [8.6, 8.95], penReturn: [8.78, 8.95], zoomOut: [7.8, 9.0], dotSlide: [8.2, 8.9],
    wordWrite: [8.95, 10.9], wordBase: [8.95, 9.3], peak: [9.38, 9.5], thWrite: [9.5, 10.9], seamT: 9.38,
    thaDots: [11.1, 11.45, 11.8],
    penExit2: [12.15, 12.65],
    cap: { ba: [12.25, 12.65], plus: 12.68, tha: [12.78, 13.25] },
    sweep: [12.3, 13.3], pulse: 12.7, sparkles: [12.3, 14.7],
    // writing speed profile: gentle start, steady middle, soft landing
    prog(u) { u = Math.min(1, Math.max(0, u)); return 0.6 * 0.5 * (1 - Math.cos(Math.PI * u)) + 0.4 * u; },
  };
  if (typeof module !== 'undefined') module.exports = TL; else window.TL = TL;
})();

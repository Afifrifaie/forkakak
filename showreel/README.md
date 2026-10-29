# Motion Design Showreel — 15 s, 1920×1080 @ 60 fps

`showreel.mp4` is generated entirely from code: no stock footage, no editor.

| beats | scene | technique |
|---|---|---|
| 0–4   | Intro      | slit reveal, masked kinetic type, spinning spark, ruler |
| 4–8   | Geometry   | 144 shapes, radial stagger, circle → square → pinwheel |
| 8–12  | Depth      | twisting light tunnel, speed streaks, word fly-through |
| 12–16 | Fluid      | per-pixel metaballs, analytic normals, text refracted by the liquid |
| 16–20 | Data / UI  | cards, donut, line & bar charts, toggle, cursor click |
| 20–24 | Dimension  | additive 3-D torus knot, travelling pulse, orbit rings |
| 24–28 | Type       | four hard cuts: marquee stack, morphing shapes, neon light, squash & stretch |
| 28–32 | Finale     | burst, spark flies into the lockup, wordmark, tagline |

128 BPM → 32 beats = exactly 15.000 s, so every cut, hit and transition lands on the grid.
Transitions: iris, slice wipe, zoom-through, whip-pan (sampled blur), glitch diagonal, pixel blocks, iris-close.
Post: 5-sub-frame motion blur, chromatic aberration on kicks/transitions, grain, vignette, HUD.

## Rebuild
```bash
./build.sh        # needs node + playwright (Chromium), python3 + numpy, ffmpeg
```
`node render.cjs preview <dir> <t> ...` renders single frames (seconds) for quick iteration.
The animation is a pure function of time (`renderFrame(t)` in `js/main.js`), so frames render in parallel.
`synth.py` builds the soundtrack (kick/clap/hats, side-chained bass, pads, arps, risers, UI foley,
bell run on the wordmark) and measures itself to -14 LUFS / < -1 dBTP.
Fonts: Archivo Black, Anton, Instrument Serif, Space Grotesk (OFL, via Fontsource) and JetBrains Mono.

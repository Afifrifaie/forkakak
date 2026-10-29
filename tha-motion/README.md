# ث (tha') — 15 s writing animation

`tha-writing.mp4` — 1080×1350, 60 fps, H.264 + AAC. Rebuild with `./build.sh` (needs node + playwright, python3 + Pillow/numpy, ffmpeg).

- `tools/extract.py` cuts each element out of `assets/reference.jpg`; `tools/make_bg.py` rebuilds a card-free grid plate; `tools/pack_assets.py` embeds them in `js/assets.js`.
- `js/timeline.js` is the single source of timing for both picture and sound.
- `js/main.js` renders any frame as a pure function of time (`renderFrame(t)`); `render.cjs` steps it through Playwright.
- `synth.js` generates the soundtrack from scratch (pad, pen/ink textures, kalimba plucks, FM bells, reverb) — no samples.

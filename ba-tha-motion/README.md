# ب + ث — 15 s writing animation

`ba-tha-writing.mp4` — 1080×1350, 60 fps, H.264 + AAC (48 kHz). Rebuild with `./build.sh` (node + playwright, python3 + Pillow/numpy, ffmpeg).

- `tools/extract.py` cuts each element out of the two reference cards (3× smooth up-sampled for the big letter); `tools/make_bg.py` rebuilds a card-free grid plate; `tools/pack_assets.py` embeds everything in `js/assets.js`.
- The joined word is built from the card's own ب silhouette: the tooth + band (ب, cut at x=640), a straight bridging band, then the same bowl slid left (ث). Nothing is typeset from a font.
- `js/timeline.js` is the single source of timing for both picture and sound; `js/main.js` renders any frame as a pure function of time; `synth.js` generates the soundtrack (no samples).

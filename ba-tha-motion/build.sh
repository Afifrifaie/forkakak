#!/usr/bin/env bash
# Rebuilds ba-tha-writing.mp4: frames (Playwright/Chromium canvas) + soundtrack (pure JS synth) -> ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
WORK="${WORK:-$(mktemp -d)}"; echo "work dir: $WORK"
python3 tools/pack_assets.py                      # only needed if assets/ changed
node render.cjs frames "$WORK/frames" "${WORKERS:-4}"
node synth.js "$WORK/soundtrack.wav"
ffmpeg -y -loglevel error -framerate 60 -i "$WORK/frames/f%04d.jpg" -i "$WORK/soundtrack.wav" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 -r 60 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -t 15 ba-tha-writing.mp4
echo "done -> $(pwd)/ba-tha-writing.mp4"

#!/usr/bin/env bash
# Rebuilds showreel.mp4 from source: frames (Playwright/Chromium) + soundtrack (numpy) -> ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
WORK="${WORK:-$(mktemp -d)}"
echo "work dir: $WORK"
node render.cjs frames "$WORK/frames" "${WORKERS:-4}"     # 900 frames, 5-sub-frame motion blur
python3 synth.py "$WORK/soundtrack.wav"                    # 128 BPM score, -14 LUFS
ffmpeg -y -loglevel error -framerate 60 -i "$WORK/frames/f%04d.jpg" -i "$WORK/soundtrack.wav" \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -profile:v high -level 4.2 -r 60 \
  -c:a aac -b:a 256k -ar 44100 -movflags +faststart -t 15 showreel.mp4
echo "done -> $(pwd)/showreel.mp4"

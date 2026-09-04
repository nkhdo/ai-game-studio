#!/usr/bin/env bash
set -euo pipefail

in="${1:?usage: $0 input.mp4 [output_dir]}"
dir="${2:-frames}"
mkdir -p "$dir"

ffmpeg -hide_banner -y \
  -i "$in" \
  -vf "chromakey=0x00b140:0.15:0.02,format=rgba" \
  -start_number 1 \
  "$dir/frame-%05d.png"

echo "Wrote frames to: $dir"

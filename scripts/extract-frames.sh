#!/usr/bin/env bash
set -euo pipefail

in="${1:?usage: $0 input.mp4 [output_dir] [frame_size]}"
dir="${2:-frames}"
size="${3:?frame size is required}"

mkdir -p "$dir"

ffmpeg -hide_banner -y \
  -i "$in" \
  -vf "chromakey=0x00b140:0.15:0.02,scale=$size:$size:force_original_aspect_ratio=decrease:flags=neighbor,pad=$size:$size:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba" \
  -start_number 1 \
  "$dir/frame-%05d.png"

echo "Wrote frames to: $dir"

#!/usr/bin/env bash
# Launch the release binary 3x and grab rapid grim frames to check for launch flicker.
export WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-wayland-1} XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)} HYPRLAND_INSTANCE_SIGNATURE=${HYPRLAND_INSTANCE_SIGNATURE:?run inside Hyprland}
ART=$HOME/linux-e2e/flicker; mkdir -p $ART
for run in 1 2 3; do
  d=$ART/run$run; rm -rf $d; mkdir -p $d
  "$(cd "$(dirname "$0")/.." && pwd)"/src-tauri/target/release/excalidraw-offline > $d/app.log 2>&1 & pid=$!
  end=$((SECONDS+7)); i=0
  while (( SECONDS < end )); do grim -t ppm -s 0.25 $d/f$(printf %04d $i).ppm 2>/dev/null; i=$((i+1)); done
  hyprctl clients | rg -A3 "title: Excalidraw Offline" | rg 'at:|size:' > $d/geom.txt
  hyprctl clients -j > $d/clients.json
  kill $pid; wait $pid 2>/dev/null; sleep 1
  echo "run$run frames=$i"
done

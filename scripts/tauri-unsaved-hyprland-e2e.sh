#!/usr/bin/env bash
# Live Hyprland E2E for the GTK unsaved-changes prompt (real key presses via hyprctl send_shortcut).
# usage: tauri-unsaved-hyprland-e2e.sh <flow:close|quit|open> <choice:save|discard|cancel>
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; ART=${ART:-$HOME/linux-e2e}; mkdir -p "$ART"; APP=$ROOT/src-tauri/target/release/excalidraw-offline
flow=$1; choice=$2; tag=$flow-$choice; log=$ART/app-$tag.log
export WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-wayland-1} XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)} HYPRLAND_INSTANCE_SIGNATURE=${HYPRLAND_INSTANCE_SIGNATURE:?run inside Hyprland} EXCALIDRAW_E2E=1 RUST_BACKTRACE=1
export EXCALIDRAW_FORCE_SAVE_PATH=$ART/saved-$tag.excalidraw EXCALIDRAW_FORCE_OPEN_PATH=$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw
rm -f "$EXCALIDRAW_FORCE_SAVE_PATH"; : > $log
setsid "$APP" >>$log 2>&1 & pid=$!
for _ in $(seq 80); do P=$(rg -o '127\.0\.0\.1:[0-9]+' $log | tail -1 | cut -d: -f2); [ -n "$P" ] && curl -sf localhost:$P/api/health >/dev/null && break; sleep .25; done
for _ in $(seq 60); do rg -q "frontend reported ready" $log && break; sleep .5; done; sleep 4
post(){ curl -s -m 3 -XPOST localhost:$P$1 -H 'content-type: application/json' -d "$2"; }
post /api/e2e/ui-command '{"type":"new"}' >/dev/null; sleep 2.5
post /api/e2e/edit-marker '{"marker":"HYPR_E2E"}' >/dev/null; sleep 1
case $flow in close|quit) post /api/e2e/ui-command "{\"type\":\"$flow\"}";; open) post /api/e2e/menu-click '{"id":"open"}';; esac >/dev/null
sleep 2; hyprctl clients > $ART/$tag-clients.txt; rg -q "title: Unsaved changes" $ART/$tag-clients.txt && dlg=yes || dlg=no
grim $ART/$tag-dialog.png
k(){ hyprctl dispatch "hl.dsp.send_shortcut({ mods = \"\", key = \"$1\", window = \"title:Unsaved changes\" })" >/dev/null; sleep .3; }
case $choice in save) k Return;; cancel) k Tab; k Return;; discard) k Tab; k Tab; k Return;; esac
sleep 3; grim $ART/$tag-after.png
kill -0 $pid 2>/dev/null && alive=yes || alive=no
saved=no; [ -s "$EXCALIDRAW_FORCE_SAVE_PATH" ] && rg -q HYPR_E2E "$EXCALIDRAW_FORCE_SAVE_PATH" && saved=yes
title=$(hyprctl clients | rg -B1 -A6 "pid: $pid" | rg '^\s*title:' | head -1)
lf=$(rg -c 'Load failed|panicked|unsaved dialog failed' $log); 
echo "$tag dialog=$dlg alive=$alive saved=$saved loadfail/panic=${lf:-0} $title"
kill $pid 2>/dev/null; sleep 1

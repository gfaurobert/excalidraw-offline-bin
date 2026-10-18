#!/usr/bin/env bash
# Verify a macOS Tauri .app: ad-hoc signature, architectures, and /api/health on launch.
set -euo pipefail
APP="${1:?usage: verify-tauri-macos.sh <path/to/App.app> [expected-archs]}"
EXPECT="${2:-arm64}"
BIN="$APP/Contents/MacOS/excalidraw-offline"

codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dv "$APP" 2>&1 | grep -E 'Signature=adhoc|flags=' || true
INFO=$(lipo -info "$BIN"); echo "$INFO"
for a in $EXPECT; do grep -qw "$a" <<<"$INFO" || { echo "missing arch $a"; exit 1; }; done

LOG=$(mktemp); "$BIN" >"$LOG" 2>&1 & PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
PORT=""
for _ in $(seq 120); do
  PORT=$(grep -oE 'app url http://127\.0\.0\.1:[0-9]+' "$LOG" | head -1 | sed 's/.*://') || true
  [ -n "$PORT" ] && break
  kill -0 $PID 2>/dev/null || { cat "$LOG"; echo "app exited early"; exit 1; }
  sleep 0.5
done
[ -n "$PORT" ] || { cat "$LOG"; echo "no app url in log"; exit 1; }
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/health")
echo "health=$CODE port=$PORT"
curl -sf "http://127.0.0.1:$PORT/" | grep -q Excalidraw
kill $PID; wait $PID 2>/dev/null || true; trap - EXIT
if grep -qi panick "$LOG"; then cat "$LOG"; exit 1; fi
[ "$CODE" = 200 ]

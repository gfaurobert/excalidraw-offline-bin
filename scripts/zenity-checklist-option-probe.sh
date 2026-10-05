#!/usr/bin/env bash
# Probe zenity checklist flags; writes logs under ARTIFACTS/zenity-probes/.
set -euo pipefail

ARTIFACTS="${ARTIFACTS:-/opt/cursor/artifacts/zenity-probes}"
mkdir -p "$ARTIFACTS"

ZVER=$(zenity --version 2>/dev/null | tr -d '\n' || true)
echo "zenity version: ${ZVER:-unknown}" | tee "$ARTIFACTS/version.txt"

probe() {
  local name="$1"
  shift
  local log="$ARTIFACTS/${name}.log"
  {
    echo "=== $* ==="
    if command -v xvfb-run >/dev/null 2>&1; then
      timeout 1 xvfb-run -a "$@" 2>&1 || true
    else
      "$@" 2>&1 || true
    fi
  } | tee "$log"
  if grep -qi "not available" "$log"; then
    echo "FAIL $name" | tee -a "$ARTIFACTS/summary.txt"
  else
    echo "OK $name (no unsupported-option error in 1s window)" | tee -a "$ARTIFACTS/summary.txt"
  fi
}

: >"$ARTIFACTS/summary.txt"
BASE=(zenity --list --checklist --title=T --text=T --column=Select --column=ID --column=Target --hide-header --hide-column=2 --print-column=2 FALSE id1 label1)

probe legacy-sized "${BASE[@]}" --width=920 --height=500
probe no-size "${BASE[@]}"
probe width-only "${BASE[@]}" --width=920
probe height-only "${BASE[@]}" --height=500
probe label-only zenity --list --checklist --title=T --text=T --column=Select --column=Target --hide-header --print-column=2 FALSE label1

echo "Probe complete: $ARTIFACTS"

#!/usr/bin/env bash
# Skill-install E2E inside podman images (Arch + Ubuntu) using system zenity.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS_ROOT="${ARTIFACTS_ROOT:-/opt/cursor/artifacts/skill-install-matrix}"
mkdir -p "$ARTIFACTS_ROOT"

run_one() {
  local image="$1"
  local label="$2"
  local setup="$3"
  local dest="$ARTIFACTS_ROOT/$label"
  mkdir -p "$dest"
  echo "========== $label ($image) =========="
  podman run --rm \
    -v "$ROOT:/work:rw" \
    -v "$dest:/artifacts:rw" \
    "$image" \
    bash -lc "
      set -euo pipefail
      $setup
      cd /work
      export PATH=\"/root/.deno/bin:\${PATH:-}:/work/frontend/node_modules/.bin\"
      if ! command -v deno >/dev/null; then
        curl -fsSL https://deno.land/install.sh | sh -s -- -y
        export PATH=\"/root/.deno/bin:\$PATH\"
      fi
      chmod +x scripts/e2e-app-launcher.sh scripts/e2e-skill-install-driver.sh scripts/zenity-checklist-option-probe.sh
      xvfb-run -a zenity --version 2>/dev/null | tr -d '\n' | tee /artifacts/zenity-version.txt
      ARTIFACTS=/artifacts/zenity-probes bash scripts/zenity-checklist-option-probe.sh
      LAUNCHER=/work/scripts/e2e-app-launcher.sh ARTIFACTS=/artifacts bash scripts/e2e-skill-install.sh
    "
  echo "Saved $dest"
}

ARCH_SETUP='pacman -Sy --noconfirm zenity xorg-server-xvfb xdotool scrot openbox webkit2gtk-4.1 gtk3 curl ca-certificates unzip >/dev/null'
UBUNTU_SETUP='export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -qq -y zenity xvfb xdotool scrot openbox libwebkit2gtk-4.1-0 libgtk-3-0 curl ca-certificates unzip >/dev/null'

run_one "docker.io/archlinux/archlinux:latest" "arch-zenity" "$ARCH_SETUP"
run_one "docker.io/ubuntu:22.04" "ubuntu-2204-zenity" "$UBUNTU_SETUP"
run_one "docker.io/ubuntu:24.04" "ubuntu-2404-zenity" "$UBUNTU_SETUP"

echo "All matrix runs under $ARTIFACTS_ROOT"

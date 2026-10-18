#!/usr/bin/env bash
# Print the app version after checking tauri.conf.json, Cargo.toml and both PKGBUILDs agree.
# With RELEASE_TAG (e.g. v0.8.0) set, also require the tag to match.
set -euo pipefail
cd "$(dirname "$0")/.."
conf=$(sed -nE 's/^[[:space:]]*"version":[[:space:]]*"([^"]+)".*/\1/p' src-tauri/tauri.conf.json | head -1)
for other in \
  "$(sed -nE 's/^version[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' src-tauri/Cargo.toml | head -1)" \
  "$(sed -nE 's/^pkgver=(.+)$/\1/p' packaging/PKGBUILD)" \
  "$(sed -nE 's/^pkgver=(.+)$/\1/p' packaging/PKGBUILD.local)" \
  "$(sed -nE 's/^pkgver=(.+)$/\1/p' packaging/PKGBUILD-bin)"; do
  if [[ "$other" != "$conf" ]]; then
    echo "error: version mismatch: tauri.conf.json=$conf vs $other (Cargo.toml / PKGBUILD*)" >&2
    exit 1
  fi
done
if [[ -n "${RELEASE_TAG:-}" && "${RELEASE_TAG#v}" != "$conf" ]]; then
  echo "error: tag $RELEASE_TAG does not match app version $conf" >&2
  exit 1
fi
echo "$conf"

#!/usr/bin/env bash
# Patch an AppImage so its embedded .desktop passes file paths (%F) and
# declares application/x-excalidraw. Optionally embeds shared-mime-info XML.
# Usage: patch-appimage-mime.sh <appimage> <mime-xml> [appimagetool]
set -euo pipefail

APPIMAGE="${1:?appimage path}"
MIME_XML="${2:?mime xml path}"
APPIMAGETOOL="${3:-}"

if [[ ! -f "$APPIMAGE" ]]; then
  echo "error: AppImage not found: $APPIMAGE" >&2
  exit 1
fi
if [[ ! -f "$MIME_XML" ]]; then
  echo "error: MIME xml not found: $MIME_XML" >&2
  exit 1
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/exo-appimage-XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

cp -a "$APPIMAGE" "$WORK/in.AppImage"
chmod +x "$WORK/in.AppImage"
(
  cd "$WORK"
  ./in.AppImage --appimage-extract >/dev/null
)

ROOT="$WORK/squashfs-root"
if [[ ! -d "$ROOT" ]]; then
  echo "error: --appimage-extract did not produce squashfs-root" >&2
  exit 1
fi

patch_desktop() {
  local f="$1"
  local tmp
  tmp="$(mktemp)"
  # Ensure MimeType includes application/x-excalidraw
  if grep -q '^MimeType=' "$f"; then
    if ! grep -q 'application/x-excalidraw' "$f"; then
      sed -i 's|^MimeType=.*|&application/x-excalidraw;|' "$f"
    fi
  else
    printf '%s\n' 'MimeType=application/x-excalidraw;' >>"$f"
  fi
  # Ensure Exec passes file path(s)
  if grep -q '^Exec=' "$f"; then
    if ! grep -qE '^Exec=.*%[fFuU]' "$f"; then
      sed -i 's|^Exec=\(.*\)|Exec=\1 %F|' "$f"
      # collapse accidental double spaces
      sed -i 's|^Exec=\(.*\)  %F|Exec=\1 %F|' "$f"
    fi
  fi
  rm -f "$tmp"
}

while IFS= read -r -d '' desk; do
  patch_desktop "$desk"
done < <(find "$ROOT" -type f -name '*.desktop' -print0)

mkdir -p "$ROOT/usr/share/mime/packages"
cp -a "$MIME_XML" "$ROOT/usr/share/mime/packages/application-x-excalidraw.xml"

repack() {
  local tool="$1"
  if [[ -x "$tool" ]] || command -v "$tool" >/dev/null 2>&1; then
    (
      cd "$WORK"
      "$tool" squashfs-root out.AppImage
    )
    mv -f "$WORK/out.AppImage" "$APPIMAGE"
    chmod +x "$APPIMAGE"
    echo "Patched and repacked AppImage: $APPIMAGE"
    return 0
  fi
  return 1
}

if [[ -n "$APPIMAGETOOL" ]] && repack "$APPIMAGETOOL"; then
  exit 0
fi
if command -v appimagetool >/dev/null 2>&1 && repack appimagetool; then
  exit 0
fi

echo "warning: appimagetool not found; AppImage left unpatched ($APPIMAGE)." >&2
echo "warning: extracted desktop/mime were prepared but not repacked." >&2
exit 0

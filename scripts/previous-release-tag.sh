#!/usr/bin/env bash
# Print the semver tag immediately before CURRENT (remaining args are all v* tags).
# With no extra args, reads tags from git.
set -euo pipefail

current="${1:?usage: previous-release-tag.sh <current-tag> [other-tags...]}"
shift || true

if (($# > 0)); then
  mapfile -t tags < <(printf '%s\n' "$@" | grep -E '^v[0-9]' || true)
else
  mapfile -t tags < <(git tag -l 'v*' | grep -E '^v[0-9]' || true)
fi

if ((${#tags[@]} == 0)); then
  exit 0
fi

# Sort by semver (major.minor.patch) then tag name.
mapfile -t sorted < <(
  for t in "${tags[@]}"; do
    raw="${t#v}"
    IFS=. read -r maj min patch_rest <<<"$raw"
    patch="${patch_rest%%[^0-9]*}"
    printf '%04d.%04d.%04d %s\n' "${maj:-0}" "${min:-0}" "${patch:-0}" "$t"
  done | sort -k1,1n -k2,2n -k3,3n -k4,4 | awk '{print $2}'
)

idx=-1
for i in "${!sorted[@]}"; do
  if [[ "${sorted[$i]}" == "$current" ]]; then
    idx=$i
    break
  fi
done

if ((idx <= 0)); then
  exit 0
fi

echo "${sorted[$((idx - 1))]}"

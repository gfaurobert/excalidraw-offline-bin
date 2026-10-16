#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
prev="$ROOT/scripts/previous-release-tag.sh"

assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "$got" != "$want" ]]; then
    echo "FAIL $label: got '$got' want '$want'" >&2
    exit 1
  fi
}

out=$("$prev" v0.5.0 v0.3.0 v0.3.1 v0.4.0 v0.5.0)
assert_eq "$out" v0.4.0 "predecessor of v0.5.0"

out=$("$prev" v0.4.0 v0.3.0 v0.3.1 v0.4.0 v0.5.0)
assert_eq "$out" v0.3.1 "predecessor of v0.4.0"

out=$("$prev" v0.3.0 v0.3.0 v0.3.1 v0.4.0 v0.5.0 || true)
assert_eq "$out" "" "first tag has no predecessor"

echo "previous-release-tag_test.sh: ok"

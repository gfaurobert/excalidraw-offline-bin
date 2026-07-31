# Linux Release (AppImage + tarball) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On tag `v*`, GitHub Actions builds Linux x86_64 AppImage + binary `.tar.xz` + `SHA256SUMS` and uploads them to the GitHub Release, while makepkg/AUR stay source-based.

**Architecture:** A shared `scripts/package-linux-release.sh` builds canonical artifacts under `dist/release/`. Pure naming/version helpers live in a tiny Deno module with unit tests. CI installs Deno, runs the script, and publishes only on real version tags (`workflow_dispatch` uploads workflow artifacts only).

**Tech Stack:** Deno ≥ 2.9 (`deno desktop`), bash, GitHub Actions (`ubuntu-latest`), `softprops/action-gh-release`, `denoland/setup-deno`.

## Global Constraints

- Linux **x86_64** only for release binaries
- Artifact names: `excalidraw-offline-<version>-linux-x86_64.AppImage`, `excalidraw-offline-<version>-linux-x86_64.tar.xz`, `SHA256SUMS`
- Tag `vX.Y.Z` must match `deno.json` `"version": "X.Y.Z"` or the job fails
- Do **not** change `packaging/PKGBUILD` or `packaging/PKGBUILD.local` build model (source / local checkout)
- Reuse existing `deno desktop` flags: `-A --backend=webview --compress=xz --include=./frontend/dist --include=./icons --include=./skills`
- Out of scope: macOS, Windows, aarch64, Homebrew, Winget, AUR binary package, signing

## File map

| Path | Responsibility |
|------|----------------|
| `scripts/release-names.ts` | Pure version + artifact path helpers (testable) |
| `scripts/release-names_test.ts` | Unit tests for helpers |
| `scripts/package-linux-release.sh` | Build AppImage + tarball + SHA256SUMS into `dist/release/` |
| `.github/workflows/release-linux.yml` | Tag / dispatch CI → package → publish or upload-artifact |
| `deno.json` | Add `package:release` task; keep existing `package:linux` / `package:appimage` |
| `README.md` | Document Releases download + Arch makepkg |
| `packaging/README.md` | Note Release binaries vs makepkg |

---

### Task 1: Release naming helpers + tests

**Files:**
- Create: `scripts/release-names.ts`
- Create: `scripts/release-names_test.ts`
- Modify: `deno.json` (add test path to `test:file-format` or a new `test:release` task)

**Interfaces:**
- Produces:
  - `readDenoJsonVersion(text: string): string`
  - `stripVPrefix(tagOrVersion: string): string`
  - `assertVersionMatchesTag(version: string, gitRef: string): void` — throws if `gitRef` is `refs/tags/v…` and versions diverge; no-op if not a version tag ref
  - `artifactBasenames(version: string): { appImage: string; tarball: string; sums: string; stagingDir: string }`

- [ ] **Step 1: Write the failing tests**

Create `scripts/release-names_test.ts`:

```ts
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  artifactBasenames,
  assertVersionMatchesTag,
  readDenoJsonVersion,
  stripVPrefix,
} from "./release-names.ts";

Deno.test("readDenoJsonVersion parses version field", () => {
  assertEquals(
    readDenoJsonVersion(`{\n  "name": "excalidraw-offline",\n  "version": "0.1.0"\n}`),
    "0.1.0",
  );
});

Deno.test("stripVPrefix", () => {
  assertEquals(stripVPrefix("v0.1.0"), "0.1.0");
  assertEquals(stripVPrefix("0.1.0"), "0.1.0");
});

Deno.test("assertVersionMatchesTag accepts matching tag", () => {
  assertVersionMatchesTag("0.1.0", "refs/tags/v0.1.0");
});

Deno.test("assertVersionMatchesTag rejects mismatch", () => {
  assertThrows(() => assertVersionMatchesTag("0.1.0", "refs/tags/v0.2.0"));
});

Deno.test("assertVersionMatchesTag ignores non-tag refs", () => {
  assertVersionMatchesTag("0.1.0", "refs/heads/main");
});

Deno.test("artifactBasenames", () => {
  assertEquals(artifactBasenames("0.1.0"), {
    appImage: "excalidraw-offline-0.1.0-linux-x86_64.AppImage",
    tarball: "excalidraw-offline-0.1.0-linux-x86_64.tar.xz",
    sums: "SHA256SUMS",
    stagingDir: "excalidraw-offline-0.1.0-linux-x86_64",
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `deno test -A scripts/release-names_test.ts`

Expected: FAIL (module / exports missing)

- [ ] **Step 3: Implement helpers**

Create `scripts/release-names.ts`:

```ts
export function readDenoJsonVersion(text: string): string {
  const data = JSON.parse(text) as { version?: unknown };
  if (typeof data.version !== "string" || data.version.length === 0) {
    throw new Error("deno.json missing string version");
  }
  return data.version;
}

export function stripVPrefix(tagOrVersion: string): string {
  return tagOrVersion.startsWith("v") ? tagOrVersion.slice(1) : tagOrVersion;
}

export function assertVersionMatchesTag(version: string, gitRef: string): void {
  const prefix = "refs/tags/v";
  if (!gitRef.startsWith(prefix)) return;
  const tagVersion = gitRef.slice(prefix.length);
  if (tagVersion !== version) {
    throw new Error(
      `version mismatch: deno.json=${version} tag=${tagVersion} (ref=${gitRef})`,
    );
  }
}

export function artifactBasenames(version: string): {
  appImage: string;
  tarball: string;
  sums: string;
  stagingDir: string;
} {
  const base = `excalidraw-offline-${version}-linux-x86_64`;
  return {
    appImage: `${base}.AppImage`,
    tarball: `${base}.tar.xz`,
    sums: "SHA256SUMS",
    stagingDir: base,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `deno test -A scripts/release-names_test.ts`

Expected: all PASS

- [ ] **Step 5: Wire into deno tasks**

In `deno.json`, add:

```json
"test:release": "deno test -A scripts/release-names_test.ts",
"package:release": "bash ./scripts/package-linux-release.sh"
```

(Keep existing `test:file-format` unchanged; `package:release` will fail until Task 2.)

- [ ] **Step 6: Commit**

```bash
git add scripts/release-names.ts scripts/release-names_test.ts deno.json
git commit -m "$(cat <<'EOF'
feat: add Linux release artifact naming helpers

EOF
)"
```

---

### Task 2: `package-linux-release.sh`

**Files:**
- Create: `scripts/package-linux-release.sh` (executable)
- Modify: none required beyond Task 1’s `package:release` task

**Interfaces:**
- Consumes: `artifactBasenames`, `readDenoJsonVersion`, `stripVPrefix`, `assertVersionMatchesTag` via `deno eval` / small CLI invocation
- Produces: under `dist/release/`:
  - `excalidraw-offline-<ver>-linux-x86_64.AppImage`
  - `excalidraw-offline-<ver>-linux-x86_64.tar.xz` (top-level dir = staging name)
  - `SHA256SUMS`
- Env: `RELEASE_VERSION` optional; `GITHUB_REF` optional (CI version check)

- [ ] **Step 1: Write the script**

Create `scripts/package-linux-release.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DENO_JSON_VERSION="$(deno eval -A --quiet '
import { readDenoJsonVersion } from "./scripts/release-names.ts";
console.log(readDenoJsonVersion(await Deno.readTextFile("deno.json")));
')"

if [[ -n "${RELEASE_VERSION:-}" ]]; then
  VERSION="$(deno eval -A --quiet '
import { stripVPrefix } from "./scripts/release-names.ts";
console.log(stripVPrefix(Deno.args[0]));
' "$RELEASE_VERSION")"
else
  VERSION="$DENO_JSON_VERSION"
fi

deno eval -A --quiet '
import { assertVersionMatchesTag } from "./scripts/release-names.ts";
assertVersionMatchesTag(Deno.args[0], Deno.args[1] ?? "");
' "$VERSION" "${GITHUB_REF:-}"

if [[ "$VERSION" != "$DENO_JSON_VERSION" ]]; then
  echo "error: RELEASE_VERSION=$VERSION does not match deno.json version=$DENO_JSON_VERSION" >&2
  exit 1
fi

NAMES_JSON="$(deno eval -A --quiet '
import { artifactBasenames } from "./scripts/release-names.ts";
console.log(JSON.stringify(artifactBasenames(Deno.args[0])));
' "$VERSION")"

APPIMAGE_NAME="$(deno eval -A --quiet 'console.log(JSON.parse(Deno.args[0]).appImage)' "$NAMES_JSON")"
TARBALL_NAME="$(deno eval -A --quiet 'console.log(JSON.parse(Deno.args[0]).tarball)' "$NAMES_JSON")"
STAGING_NAME="$(deno eval -A --quiet 'console.log(JSON.parse(Deno.args[0]).stagingDir)' "$NAMES_JSON")"
SUMS_NAME="$(deno eval -A --quiet 'console.log(JSON.parse(Deno.args[0]).sums)' "$NAMES_JSON")"

OUT="$ROOT/dist/release"
STAGING="$OUT/staging/$STAGING_NAME"
rm -rf "$OUT"
mkdir -p "$OUT" "$STAGING"

echo "==> building frontend"
deno task build:frontend

COMMON=(deno desktop -A --backend=webview --compress=xz
  --include=./frontend/dist --include=./icons --include=./skills)

echo "==> AppImage → $APPIMAGE_NAME"
"${COMMON[@]}" --output="$OUT/$APPIMAGE_NAME" ./desktop/main.ts

echo "==> directory bundle → staging"
"${COMMON[@]}" --output="$STAGING/excalidraw-offline" ./desktop/main.ts

# deno desktop may create STAGING/excalidraw-offline/ as a directory; flatten into STAGING
if [[ -d "$STAGING/excalidraw-offline" ]]; then
  # move contents up one level
  shopt -s dotglob
  mv "$STAGING/excalidraw-offline"/* "$STAGING/"
  rmdir "$STAGING/excalidraw-offline"
  shopt -u dotglob
fi

echo "==> tarball → $TARBALL_NAME"
tar -C "$OUT/staging" -cJf "$OUT/$TARBALL_NAME" "$STAGING_NAME"

echo "==> checksums"
(
  cd "$OUT"
  sha256sum "$APPIMAGE_NAME" "$TARBALL_NAME" > "$SUMS_NAME"
)

rm -rf "$OUT/staging"

echo "Artifacts in $OUT:"
ls -la "$OUT"
```

Make executable: `chmod +x scripts/package-linux-release.sh`

**Note:** If `deno desktop --output=…/excalidraw-offline` writes a **directory** named `excalidraw-offline` (current local behavior), the flatten block is required so the tarball root is `excalidraw-offline-<ver>-linux-x86_64/` containing the binary at `./excalidraw-offline`. If it writes a single file instead, skip flatten and place that file as `$STAGING/excalidraw-offline`.

- [ ] **Step 2: Local smoke build**

Run: `deno task package:release`

Expected:
- Exit 0
- `dist/release/excalidraw-offline-0.1.0-linux-x86_64.AppImage` exists and is executable
- `dist/release/excalidraw-offline-0.1.0-linux-x86_64.tar.xz` exists
- `dist/release/SHA256SUMS` lists both files
- `tar -tJf dist/release/…tar.xz | head` shows paths under `excalidraw-offline-0.1.0-linux-x86_64/`

Optional: `GITHUB_REF=refs/tags/v0.2.0 deno task package:release` → exit non-zero with version mismatch.

- [ ] **Step 3: Commit**

```bash
git add scripts/package-linux-release.sh
git commit -m "$(cat <<'EOF'
feat: add Linux AppImage/tarball release packaging script

EOF
)"
```

---

### Task 3: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/release-linux.yml`

**Interfaces:**
- Consumes: `scripts/package-linux-release.sh`, `deno.json` version
- Produces: GitHub Release assets on tag push; workflow artifacts on `workflow_dispatch`

- [ ] **Step 1: Add workflow**

Create `.github/workflows/release-linux.yml`:

```yaml
name: Release Linux

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  linux-x86_64:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.9.4

      - name: Resolve version
        id: ver
        run: |
          if [[ "${GITHUB_REF_TYPE}" == "tag" ]]; then
            V="${GITHUB_REF_NAME#v}"
          else
            V="$(deno eval -A --quiet 'import { readDenoJsonVersion } from "./scripts/release-names.ts"; console.log(readDenoJsonVersion(await Deno.readTextFile("deno.json")));')"
          fi
          echo "version=$V" >> "$GITHUB_OUTPUT"
          echo "RELEASE_VERSION=$V" >> "$GITHUB_ENV"

      - name: Package Linux release artifacts
        run: bash ./scripts/package-linux-release.sh
        env:
          RELEASE_VERSION: ${{ env.RELEASE_VERSION }}
          GITHUB_REF: ${{ github.ref }}

      - name: Upload workflow artifacts (dispatch / always retain)
        uses: actions/upload-artifact@v4
        with:
          name: linux-x86_64-${{ steps.ver.outputs.version }}
          path: |
            dist/release/*.AppImage
            dist/release/*.tar.xz
            dist/release/SHA256SUMS

      - name: Publish GitHub Release (tags only)
        if: github.ref_type == 'tag'
        uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/release/*.AppImage
            dist/release/*.tar.xz
            dist/release/SHA256SUMS
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**CI deps note:** Do **not** pre-install `webkit2gtk` unless the package step fails. Deno Desktop downloads prebuilt backends for packaging. If the job fails for missing shared libraries at **build** time, add a follow-up commit:

```yaml
- name: Install packaging OS deps
  run: |
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev
```

(only if proven necessary).

- [ ] **Step 2: Sanity-check YAML locally (optional)**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/release-linux.yml'))"`  
or open the file in the editor and confirm indentation.

If `actionlint` is installed: `actionlint .github/workflows/release-linux.yml`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-linux.yml
git commit -m "$(cat <<'EOF'
ci: add Linux x86_64 AppImage/tarball release workflow

EOF
)"
```

---

### Task 4: README + packaging docs

**Files:**
- Modify: `README.md`
- Modify: `packaging/README.md`

**Interfaces:**
- Consumes: artifact naming from Task 1; workflow path from Task 3
- Produces: user-facing install instructions for Releases vs makepkg

- [ ] **Step 1: Update root README**

Replace the opening “for Arch Linux” framing lightly and add a **Install** section before **Develop**:

```markdown
## Install

### Linux (GitHub Releases)

Download from [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases):

- **AppImage** — `excalidraw-offline-<version>-linux-x86_64.AppImage` (chmod +x, then run)
- **Binary tarball** — `excalidraw-offline-<version>-linux-x86_64.tar.xz` (extract and run `./excalidraw-offline`)

Runtime deps: `webkit2gtk-4.1`, `gtk3`, and `zenity` (or `kdialog`).

Maintainers: tagging `vX.Y.Z` (matching `deno.json` version) runs [`.github/workflows/release-linux.yml`](.github/workflows/release-linux.yml). Local dry-run: `deno task package:release`.

### Arch Linux (makepkg)

Install from a local git checkout with [`packaging/PKGBUILD.local`](packaging/PKGBUILD.local):
```

Keep the existing makepkg commands/block. Keep the AUR `PKGBUILD` note. In **Project layout**, add rows for `scripts/` and `.github/workflows/` if useful.

Also add `deno task package:release` and `deno task test:release` to the task list under Develop.

- [ ] **Step 2: Update packaging/README.md**

Append:

```markdown
## GitHub Release binaries

Tagged releases publish an AppImage and a binary `.tar.xz` (plus `SHA256SUMS`) via CI.
Those are for direct download / portable use.

makepkg and the AUR `PKGBUILD` still **build from source** (git checkout or GitHub source archive for `v$pkgver`). They do not install the Release AppImage.

Local release-shaped artifacts (same names as CI):

```bash
deno task package:release
# → dist/release/
```
```

- [ ] **Step 3: Commit**

```bash
git add README.md packaging/README.md
git commit -m "$(cat <<'EOF'
docs: document Linux Releases AppImage/tarball install path

EOF
)"
```

---

### Task 5: End-to-end verification checklist

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `deno task test:release`  
Expected: PASS

- [ ] **Step 2: Local package**

Run: `deno task package:release`  
Expected: three artifacts under `dist/release/` with correct names for current `deno.json` version

- [ ] **Step 3: Version gate**

Run: `GITHUB_REF=refs/tags/v9.9.9 bash ./scripts/package-linux-release.sh`  
Expected: non-zero exit, mismatch message (should fail before or during version assert — may still need frontend build depending on assert order; assert is early in the script)

- [ ] **Step 4: Confirm makepkg untouched**

Run: `git diff -- packaging/PKGBUILD packaging/PKGBUILD.local`  
Expected: empty (no changes in this feature)

- [ ] **Step 5: Manual release dry-run on GitHub (after merge)**

1. Merge to `main`
2. Actions → **Release Linux** → **Run workflow** (`workflow_dispatch`)
3. Confirm job succeeds and artifacts downloadable from the run
4. When ready to publish: ensure `deno.json` version is `X.Y.Z`, then:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

5. Confirm the GitHub Release has AppImage, `.tar.xz`, `SHA256SUMS`, and automatic source archives

Do **not** push a tag from the agent unless the user explicitly asks.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Tag `v*` + workflow_dispatch | Task 3 |
| ubuntu-latest + Deno ≥ 2.9 | Task 3 |
| x86_64 AppImage + tar.xz + SHA256SUMS | Tasks 1–2 |
| Shared packaging script | Task 2 |
| Version sync tag ↔ deno.json | Tasks 1–2 |
| Publish on tag only; dispatch = artifacts | Task 3 |
| makepkg/AUR unchanged | Task 5 checklist + Global Constraints |
| README + packaging docs | Task 4 |
| Out of scope platforms | Not in any task |

No placeholders remain. Artifact basename fields are consistent across Tasks 1–3 (`appImage`, `tarball`, `sums`, `stagingDir`).

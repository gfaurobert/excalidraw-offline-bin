# Linux Release Design (AppImage + binary tarball)

## Goal

Publish Linux **x86_64** release assets on GitHub when a version tag is pushed, while keeping **makepkg** (local + AUR source build) unchanged.

GitHub Releases remain the download hub. AUR/makepkg continue to build from the automatic source tarball for the tag.

## Decisions

| Decision | Choice |
|----------|--------|
| Trigger | Push tag `v*` (+ optional `workflow_dispatch` for dry runs) |
| Automation | GitHub Actions on `ubuntu-latest` |
| Architectures | `x86_64` only (arm64 later) |
| Release assets | AppImage + binary `.tar.xz` + `SHA256SUMS` |
| Source tarball | GitHub automatic tag archive — used by AUR `PKGBUILD` |
| makepkg | Keep `PKGBUILD.local` and source-building `PKGBUILD` |
| Build entrypoint | Shared `scripts/package-linux-release.sh` (CI + local dry-run) |
| Version sync | Tag `vX.Y.Z` must match `deno.json` `"version"` or the job fails |

## Artifacts

For version `0.1.0` (tag `v0.1.0`):

| File | Contents |
|------|----------|
| `excalidraw-offline-0.1.0-linux-x86_64.AppImage` | Portable AppImage from `deno desktop … --output=….AppImage` |
| `excalidraw-offline-0.1.0-linux-x86_64.tar.xz` | Directory tree equivalent to `dist/linux/excalidraw-offline/` |
| `SHA256SUMS` | Checksums for the two binaries above |

Not uploaded by our workflow: `Source code (tar.gz|zip)` — GitHub attaches those automatically.

## Pipeline

```
git tag vX.Y.Z && push
  → release-linux.yml
      → install Deno ≥ 2.9
      → scripts/package-linux-release.sh
          → build frontend
          → AppImage + directory bundle → tar.xz
          → SHA256SUMS
      → create/update GitHub Release for the tag
      → upload the three assets
```

makepkg / AUR (unchanged path):

```
tag vX.Y.Z
  → GitHub source archive
  → PKGBUILD downloads archive, builds with deno desktop
  → pacman package
```

`PKGBUILD.local` still builds from a git checkout with no remote tarball.

## Script responsibilities

`scripts/package-linux-release.sh`:

1. Resolve version from env (`RELEASE_VERSION`) or `deno.json`.
2. In CI, assert `refs/tags/v$VERSION` matches that version.
3. Build frontend (`deno task build:frontend`).
4. Produce AppImage and directory output under `dist/release/` with the canonical names above (reuse the same `--backend=webview --compress=xz --include=…` flags as existing `deno.json` tasks).
5. Pack the directory into the `.tar.xz`.
6. Write `SHA256SUMS`.

## Workflow responsibilities

`.github/workflows/release-linux.yml`:

1. Trigger on `push` tags `v*` and `workflow_dispatch`.
2. Checkout repository.
3. Install Deno ≥ 2.9.
4. Install OS packages only if the first CI run proves they are required for `deno desktop` packaging (prefer minimal deps; Deno Desktop downloads prebuilt backends).
5. Run the packaging script with `RELEASE_VERSION` derived from the tag (strip leading `v`).
6. Publish assets to the GitHub Release for that tag (`softprops/action-gh-release` or `gh release upload`), using `GITHUB_TOKEN`.

Dry-run via `workflow_dispatch` may skip publishing or upload to a draft release — prefer **draft=false only on real tags**; on `workflow_dispatch` without a tag, build artifacts as workflow uploads only (no Release).

## Docs

README updates:

- Arch: keep makepkg / AUR instructions.
- Other Linux: download AppImage or binary tarball from Releases; list runtime deps (`webkit2gtk-4.1`, `gtk3`, `zenity` or `kdialog`).
- Point maintainers at the release workflow + packaging script.

`packaging/README.md`: note that GitHub Release binaries are separate from makepkg; AUR still builds from source.

## Out of scope

- macOS / Windows releases
- `aarch64` Linux artifacts
- Homebrew / Winget
- Switching AUR to a binary package that downloads the AppImage/tarball
- Code signing / notarization

## Success criteria

1. Pushing `vX.Y.Z` (with matching `deno.json` version) produces a Release with AppImage, `.tar.xz`, and `SHA256SUMS`.
2. Local `./scripts/package-linux-release.sh` produces the same artifact names under `dist/release/`.
3. `makepkg -p PKGBUILD.local` still works from a checkout.
4. AUR-oriented `PKGBUILD` still targets the GitHub source archive for `v$pkgver`.

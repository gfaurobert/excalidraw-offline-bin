# GitHub Pages Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a Just the Docs site from `docs/site/` via the existing Jekyll GitHub Pages workflow, with Home / Install / Usage / File layout / FAQ adapted from the README.

**Architecture:** Jekyll source lives only under `docs/site/`. CI uses `actions/jekyll-build-pages` with `source: ./docs/site`. Theme is Just the Docs via `remote_theme` (no Gemfile in CI). Internal trees under `docs/superpowers/`, `docs/research/`, and `docs/handoffs/` remain outside the Jekyll source root.

**Tech Stack:** Jekyll (GitHub Pages), Just the Docs (`remote_theme`), GitHub Actions (`jekyll-gh-pages.yml`)

## Global Constraints

- Source root: `docs/site/` only
- Theme: `remote_theme: just-the-docs/just-the-docs` (no vendored theme, no custom CSS in v1)
- CI: keep `actions/jekyll-build-pages@v1`; change only `source` to `./docs/site`
- No Gemfile required for CI
- Content must come from `README.md` / `use-cases.md` — do not invent features or platforms
- Pages URL: `https://gfaurobert.github.io/excalidraw-offline-bin/` (`url` + `baseurl` below)
- Do not publish or move `docs/superpowers/`, `docs/research/`, `docs/handoffs/`

## File map

| Path | Responsibility |
|------|----------------|
| `docs/site/_config.yml` | Site title, url/baseurl, remote_theme, plugins |
| `docs/site/index.md` | Home (nav_order 1) |
| `docs/site/install.md` | Install (nav_order 2) |
| `docs/site/usage.md` | Usage (nav_order 3) |
| `docs/site/file-layout.md` | File layout & assets (nav_order 4) |
| `docs/site/faq.md` | FAQ (nav_order 5) |
| `.github/workflows/jekyll-gh-pages.yml` | Set `source: ./docs/site` |
| `README.md` | One-line Docs link + note `docs/site/` in project layout |

---

### Task 1: Jekyll config + workflow source

**Files:**
- Create: `docs/site/_config.yml`
- Modify: `.github/workflows/jekyll-gh-pages.yml` (Build with Jekyll step `with.source`)

**Interfaces:**
- Produces: Jekyll site config with `baseurl: "/excalidraw-offline-bin"` and workflow building from `./docs/site`

- [ ] **Step 1: Create `docs/site/_config.yml`**

```yaml
title: Excalidraw Offline
description: Offline Excalidraw desktop app for Linux — install, usage, and file layout docs.
remote_theme: just-the-docs/just-the-docs

url: https://gfaurobert.github.io
baseurl: /excalidraw-offline-bin

plugins:
  - jekyll-remote-theme

search_enabled: true

aux_links:
  "GitHub":
    - https://github.com/gfaurobert/excalidraw-offline-bin
  "Releases":
    - https://github.com/gfaurobert/excalidraw-offline-bin/releases
```

- [ ] **Step 2: Point the workflow at `docs/site`**

In `.github/workflows/jekyll-gh-pages.yml`, change the Build with Jekyll step to:

```yaml
      - name: Build with Jekyll
        uses: actions/jekyll-build-pages@v1
        with:
          source: ./docs/site
          destination: ./_site
```

Leave triggers, permissions, concurrency, upload, and deploy jobs unchanged.

- [ ] **Step 3: Verify config + workflow locally**

Run:

```bash
test -f docs/site/_config.yml
grep -q 'remote_theme: just-the-docs/just-the-docs' docs/site/_config.yml
grep -q 'baseurl: /excalidraw-offline-bin' docs/site/_config.yml
grep -q 'source: ./docs/site' .github/workflows/jekyll-gh-pages.yml
```

Expected: all commands exit 0

- [ ] **Step 4: Commit**

```bash
git add docs/site/_config.yml .github/workflows/jekyll-gh-pages.yml
git commit -m "$(cat <<'EOF'
ci: build GitHub Pages from docs/site

EOF
)"
```

---

### Task 2: Home + Install pages

**Files:**
- Create: `docs/site/index.md`
- Create: `docs/site/install.md`

**Interfaces:**
- Consumes: site `baseurl` from Task 1 (relative links like `install.html` work under Just the Docs)
- Produces: nav items order 1–2

- [ ] **Step 1: Create `docs/site/index.md`**

```markdown
---
title: Home
nav_order: 1
description: Offline Excalidraw desktop wrapper for Linux
permalink: /
---

# Excalidraw Offline

Thin Deno Desktop wrapper around [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) for offline desktop use on Linux. It does **not** rebuild Excalidraw — it packages the upstream React component and adds local file open/save/autosave plus durable `assets/` attachments.

## Features (MVP)

- Launch an offline Excalidraw desktop app
- Start screen on launch (New / Open / Recent); canvas opens after a choice
- File → Close returns to the start screen; Quit exits
- Native zenity/kdialog for open/save and unsaved Cancel/Save/Discard
- Open / Save / Save As `.excalidraw` files anywhere on disk
- File → Open Recent (up to 10 paths, persisted locally)
- Autosave once a file path exists
- Image attachments copied into a sibling `assets/` folder with relative paths so reopen never loses them
- Info menu: Runtime, Assets tip, About Excalidraw Offline, About Excalidraw (native dialogs)
- Skills menu: install the bundled `excalidraw-sketching` Agent Skill (Global / Project / Custom → `.agents/skills`)
- Transient open/save status appears in the header (not a footer)

[Get started with Install]({% link install.md %}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
```

- [ ] **Step 2: Create `docs/site/install.md`**

````markdown
---
title: Install
nav_order: 2
---

# Install

## Requirements

- Deno **≥ 2.9** (`deno desktop`) for development and packaging
- Runtime: `webkit2gtk-4.1`, `gtk3`, `zenity` (or `kdialog`)

## Linux (GitHub Releases)

Download from [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases):

- **AppImage** — `excalidraw-offline-<version>-linux-x86_64.AppImage` (`chmod +x`, then run)
- **Binary tarball** — `excalidraw-offline-<version>-linux-x86_64.tar.xz` (extract and run `./excalidraw-offline`; built with `--compress=xz`, so the archive contains the launcher plus `payload.tar.xz` — a Deno Desktop self-extracting layout — not an expanded `.so`/icons tree)

Runtime deps: `webkit2gtk-4.1`, `gtk3`, and `zenity` (or `kdialog`).

Maintainers: tagging `vX.Y.Z` (matching `deno.json` version) runs `.github/workflows/release-linux.yml`. Local dry-run: `deno task package:release`.

## Arch Linux (makepkg)

Install from a local git checkout with `packaging/PKGBUILD.local`:

```bash
# Prereqs: base-devel, deno ≥ 2.9
cd packaging
makepkg -si -f -p PKGBUILD.local
```

`-s` pulls runtime/build deps, `-i` installs the package. No GitHub release or AUR account needed.

Installs:

- `/usr/bin/excalidraw-offline`
- `/usr/lib/excalidraw-offline/` (bundled binary + payload)
- `/usr/share/applications/excalidraw-offline.desktop`
- `/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png`

Uninstall: `sudo pacman -Rns excalidraw-offline`.

`packaging/PKGBUILD` is an optional AUR/release-tarball template for later; skip it until you publish.
````

- [ ] **Step 3: Verify front matter**

Run:

```bash
grep -A2 '^---' docs/site/index.md | head -5
grep -E 'nav_order: 1' docs/site/index.md
grep -E 'nav_order: 2' docs/site/install.md
grep -q 'AppImage' docs/site/install.md
grep -q 'PKGBUILD.local' docs/site/install.md
```

Expected: exit 0; Home has `nav_order: 1`, Install has `nav_order: 2`

- [ ] **Step 4: Commit**

```bash
git add docs/site/index.md docs/site/install.md
git commit -m "$(cat <<'EOF'
docs(site): add Home and Install pages

EOF
)"
```

---

### Task 3: Usage + File layout pages

**Files:**
- Create: `docs/site/usage.md`
- Create: `docs/site/file-layout.md`

**Interfaces:**
- Produces: nav items order 3–4

- [ ] **Step 1: Create `docs/site/usage.md`**

```markdown
---
title: Usage
nav_order: 3
---

# Usage

## Start screen

On cold start the app shows a start screen (New / Open / Recent). The Excalidraw canvas mounts only after you choose an action. The app does not auto-open the last file.

## Files

- **New** — blank Untitled drawing on the canvas
- **Open** / **Save** / **Save As** — native zenity or kdialog file pickers for `.excalidraw` files anywhere on disk
- **Open Recent** — up to 10 recently opened or saved paths (persisted under XDG config). Missing or unreadable paths are removed when selected
- **Close** (File → Close / Ctrl+W) — returns to the start screen (after unsaved prompts if needed)
- **Quit** — exits the app

### Unsaved changes

- Dirty drawing with a path: flush/autosave write, then continue
- Dirty Untitled: native **Cancel / Save / Discard** dialog
- If zenity/kdialog is unavailable: status error; there is no typed-path fallback

## Autosave

Once a drawing has a file path, autosave writes back to that `.excalidraw` file. Brand-new Untitled drawings need Save / Save As before autosave can write. Crash recovery from a separate temp location is not part of the first version.

## Menus

- **Info** (native dialogs): Runtime backend, Assets tip, About Excalidraw Offline (wrapper version), About Excalidraw (upstream package version)
- **Skills**: install the bundled `excalidraw-sketching` Agent Skill to Global (`~/.agents/skills`), Project (`<root>/.agents/skills`), or Custom (folder as-is)

Transient open/save status appears in the app header (not a footer).
```

- [ ] **Step 2: Create `docs/site/file-layout.md`**

````markdown
---
title: File layout
nav_order: 4
---

# File layout

Drawings on disk use a portable pair: the `.excalidraw` JSON file plus a sibling `assets/` folder for attachments.

```text
drawing.excalidraw
assets/
  <fileId>.png
```

## How attachments work

- On image import, the wrapper copies the file into the sibling `assets/` folder next to the `.excalidraw` file
- The `.excalidraw` JSON stores relative `assets/...` references (not absolute paths to the original file)
- On open, the wrapper rehydrates Excalidraw `BinaryFiles` from that folder so reopen never loses attachments
- Moving or copying the drawing: keep the `.excalidraw` file and its `assets/` folder together

This applies to attachment types upstream Excalidraw supports (images first).
````

- [ ] **Step 3: Verify**

Run:

```bash
grep -E 'nav_order: 3' docs/site/usage.md
grep -E 'nav_order: 4' docs/site/file-layout.md
grep -q 'start screen' docs/site/usage.md
grep -q 'assets/' docs/site/file-layout.md
```

Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add docs/site/usage.md docs/site/file-layout.md
git commit -m "$(cat <<'EOF'
docs(site): add Usage and File layout pages

EOF
)"
```

---

### Task 4: FAQ page

**Files:**
- Create: `docs/site/faq.md`

**Interfaces:**
- Produces: nav item order 5; answers only from README / use-cases clarifications

- [ ] **Step 1: Create `docs/site/faq.md`**

```markdown
---
title: FAQ
nav_order: 5
---

# FAQ

## Is this a fork of Excalidraw?

No. It embeds the upstream `@excalidraw/excalidraw` React package in a thin Deno Desktop wrapper. Drawing UX stays upstream Excalidraw.

## Does it need a network connection?

No for core drawing. There is no account, sync, or collaboration in the first version.

## Which platforms are supported?

The first version targets Linux (x86_64 releases; Arch `makepkg` from a local checkout). macOS and Windows are out of scope for now.

## Why do I need zenity or kdialog?

Open/save pickers and the unsaved Cancel / Save / Discard dialog use native zenity or kdialog. If neither is available, the app reports a status error rather than falling back to typed paths.

## Where are recent files stored?

Up to 10 recent paths are persisted under XDG config on the local machine.

## Why is there an `assets/` folder next to my drawing?

Imported images are copied there with relative paths so the drawing stays portable and reopen does not depend on the original absolute path of the imported file.

## Can I export to PNG or SVG?

Not in the first version (explicit non-goal). Use upstream Excalidraw export later if/when the wrapper adds it, or export from other Excalidraw clients if you open the same file there.

## Is there git integration?

No. You can save into a folder that happens to be a git repo; the app is not git-aware.

## How do I install the sketching Agent Skill?

Use the Skills menu: Global (`~/.agents/skills`), Project (`<root>/.agents/skills`), or Custom folder. The bundled skill is `excalidraw-sketching`.
```

- [ ] **Step 2: Verify FAQ coverage**

Run:

```bash
grep -E 'nav_order: 5' docs/site/faq.md
grep -q 'Does it need a network' docs/site/faq.md
grep -q 'zenity' docs/site/faq.md
grep -q 'assets/' docs/site/faq.md
test "$(ls docs/site/*.md | wc -l)" -eq 5
```

Expected: exit 0; exactly five markdown pages under `docs/site/`

- [ ] **Step 3: Commit**

```bash
git add docs/site/faq.md
git commit -m "$(cat <<'EOF'
docs(site): add FAQ page

EOF
)"
```

---

### Task 5: README link + deploy check

**Files:**
- Modify: `README.md` (intro Docs link; project layout row for `docs/site/`)

**Interfaces:**
- Consumes: live Pages URL `https://gfaurobert.github.io/excalidraw-offline-bin/`

- [ ] **Step 1: Add Docs link near the top of `README.md`**

Immediately after the first paragraph (before `## Features (MVP)`), insert:

```markdown
**Docs:** [https://gfaurobert.github.io/excalidraw-offline-bin/](https://gfaurobert.github.io/excalidraw-offline-bin/)
```

- [ ] **Step 2: Update the Project layout table**

Add a row (and optionally clarify workflows):

```markdown
| `docs/site/` | Public GitHub Pages docs (Jekyll + Just the Docs) |
| `.github/workflows/` | CI: `release-linux.yml`, `jekyll-gh-pages.yml` |
```

Replace the existing `.github/workflows/` row if it only mentions `release-linux.yml`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: link README to GitHub Pages site

EOF
)"
```

- [ ] **Step 4: Push and verify GitHub Actions**

```bash
git push origin HEAD
gh run list --workflow=jekyll-gh-pages.yml --limit 3
```

Wait for the latest run to finish:

```bash
gh run watch
```

Expected: workflow conclusion `success`

- [ ] **Step 5: Spot-check the published site**

Open `https://gfaurobert.github.io/excalidraw-offline-bin/` and confirm:

1. Home loads with Just the Docs sidebar
2. Sidebar links: Home, Install, Usage, File layout, FAQ
3. Install shows AppImage / tarball / Arch sections
4. No `superpowers` / internal spec content in the nav or pages

Optional artifact sanity (from the successful run):

```bash
gh run download --name github-pages --dir /tmp/excalidraw-pages-artifact
# or inspect the Actions “Upload artifact” output; published tree should only reflect docs/site
```

Expected: no `docs/superpowers` paths in the published site contents

---

## Plan self-review

1. **Spec coverage:** `docs/site/` source, remote_theme, workflow `source` change, five pages, README link, verification — each has a task. Out-of-scope items are not tasked.
2. **Placeholders:** none; full page bodies and config included.
3. **Consistency:** `baseurl` / URL / nav_order 1–5 match the design spec throughout.

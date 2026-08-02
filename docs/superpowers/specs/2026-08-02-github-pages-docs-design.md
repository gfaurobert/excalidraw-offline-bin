# GitHub Pages Documentation Site Design

## Goal

Ship a small **user-facing** documentation site on GitHub Pages for Excalidraw Offline: install, usage, file layout, and FAQ. Build with Jekyll from a dedicated subfolder so internal agent docs under `docs/` stay out of the published site.

## Decisions

| Decision | Choice |
|----------|--------|
| Audience | End users (install / use the app), not internal design specs |
| Source root | `docs/site/` |
| Theme | Just the Docs via `remote_theme` |
| CI | Keep stock `jekyll-build-pages`; set `source: ./docs/site` |
| Gemfile in CI | No — rely on GitHub Pages preinstalled deps |
| Custom CSS / branding | Out of scope for v1 |
| Custom domain | Out of scope for v1 |
| Publish `docs/superpowers/`, `research/`, `handoffs/` | No |

## Architecture

```text
docs/
  superpowers/ ...     # internal; not Jekyll source
  research/ ...
  handoffs/ ...
  site/                # public Jekyll source
    _config.yml
    index.md
    install.md
    usage.md
    file-layout.md
    faq.md

.github/workflows/jekyll-gh-pages.yml
  source: ./docs/site → destination: ./_site → deploy-pages
```

- GitHub Pages project site URL shape: `https://<user>.github.io/excalidraw-offline-bin/`
- `_config.yml` sets `baseurl: /excalidraw-offline-bin` and matching `url`
- Theme: `remote_theme: just-the-docs/just-the-docs`
- Local preview (optional, later): a small Gemfile under `docs/site/` for `bundle exec jekyll serve` — not required for CI

## Pages & navigation

Just the Docs sidebar via front matter `nav_order` / `title`:

| Order | File | Purpose |
|------:|------|---------|
| 1 | `index.md` | Home: what it is, MVP bullets, CTA to Install |
| 2 | `install.md` | Requirements; AppImage; tarball; Arch `makepkg` |
| 3 | `usage.md` | Start screen, open/save/autosave, recent, Info/Skills menus |
| 4 | `file-layout.md` | `.excalidraw` + sibling `assets/`, relative paths |
| 5 | `faq.md` | Short Q&A from known product decisions |

Content is adapted from `README.md` and `use-cases.md` clarifications. Do not invent features or claim platforms/capabilities outside those sources.

After the site is live, add a one-line Docs link in the root `README.md` pointing at the Pages URL.

## Workflow change

In `.github/workflows/jekyll-gh-pages.yml`, change only:

```yaml
with:
  source: ./docs/site
  destination: ./_site
```

Keep existing triggers (`push` to `main`, `workflow_dispatch`), permissions, concurrency, and deploy job.

## Out of scope (v1)

- Custom theme CSS beyond Just the Docs defaults
- Extra search/config tuning beyond theme defaults
- Custom domain
- Gemfile-based Ruby CI (approach 2)
- Vendored/submodule theme (approach 3)
- Publishing internal specs/plans/research/handoffs

## Verification

1. Push or `workflow_dispatch` → workflow green
2. Pages URL serves Home with working sidebar links to all five pages
3. Spot-check Install / Usage / File layout / FAQ against README
4. Confirm published artifact does not include `docs/superpowers/` (or other non-`site/` trees)

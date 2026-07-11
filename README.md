# Prose & Spine

A personal book-tracking Progressive Web App. No account, no server, no subscriptions — your library lives on your device.

## Features

- **Three shelves** — Currently Reading, TBR, Read
- **AI book search** — type a title or author and cover, metadata, and tags are filled in automatically via the Open Library API (no API key required)
- **ISBN barcode scanning** — point your camera at the back of a book (Chrome/Android)
- **Book covers** — full portrait thumbnails on every card
- **Progress tracking** — by percentage or page number
- **Half-star ratings** — 1–5 stars in 0.5 increments
- **Reading stats** — books per shelf, average rating, language breakdown, recent reads
- **Filter & sort** — by language, rating, date added, date finished, title
- **Full Urdu/RTL support** — Noto Nastaliq Urdu font applied automatically for Arabic-script text
- **Export / Import JSON** — your only backup, use it often
- **Offline-first PWA** — works without internet once installed; installable on iOS and Android home screen
- **Dark mode** — follows system preference

## Tech stack

- Vanilla HTML / CSS / JavaScript (ES modules) — no framework, no build step
- IndexedDB for local storage
- Service Worker for offline caching (network-first strategy)
- Open Library API for book search and cover images
- Cloudflare Pages for hosting

## Environments

| Environment | Branch   | Purpose                        |
|-------------|----------|--------------------------------|
| Production  | `main`   | Live app for real use          |
| Staging     | `staging`| Validation before going live   |

Staging shows a persistent amber banner with the current version number. Production shows the version as a small badge next to the app title.

## Development workflow

All changes follow this flow:

```
feature/my-change → staging → (validate) → main
```

1. Branch from `staging`: `git checkout staging && git checkout -b feature/my-change`
2. Make changes, commit
3. Merge to staging and push: `git checkout staging && git merge feature/my-change && git push origin staging`
4. Validate on the staging Cloudflare deployment
5. Merge to main: `git checkout main && git merge staging && git push origin main`

## Versioning

The app version is hardcoded in three places and must be updated together on every release:

| File         | What to update                          |
|--------------|-----------------------------------------|
| `index.html` | `const V = 'N'` in the inline script   |
| `index.html` | `<span class="app-version">vN</span>`  |
| `index.html` | `⚠ STAGING · vN` in the banner text    |
| `sw.js`      | `const CACHE = 'proseandspine-vN'`     |

The inline script detects a version change, unregisters any stale service workers, clears all caches, and hard-reloads. This ensures users always get the latest code after a deploy.

## Cloudflare Pages setup

Two separate Cloudflare Pages projects point to the same GitHub repository:

- **Prod project** — production branch: `main`
- **Staging project** — production branch: `staging`

The `_headers` file at the repo root sets `Cache-Control: no-cache` on `index.html`, `sw.js`, and all JS/CSS files so Cloudflare never serves stale assets.

## Local development

No build step needed. Serve the repo root with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080`. The service worker requires HTTPS in production but works on `localhost` in development.

# Changelog

All notable changes to Prose & Spine are documented here.

---

## [v33.1] — 2026-07-11

### Changed
- **Year-in-books card refinements** — languages are now **listed** (e.g. "EN · DE") instead of just counted; the highlights section is labelled **"Five-star highlights"** to signal it's a selection; the redundant footer wordmark is removed. **Series now collapse correctly** even when the series is named in the title's parenthetical (e.g. two "Remembrance of Earth's Past" volumes show as one entry).

---

## [v33.0] — 2026-07-11

### Added
- **Shareable "Year in books" card** (#24) — a "Share my year 📸" button on the Stats page generates a warm editorial image (PNG) with your books-read count, avg rating, pages/best month, languages, and a **five-star reads** highlight list. Highlights are spread across the year, show a per-book **language badge**, and **collapse series to a single entry** (a trilogy shows once). Falls back to 4★ reads if you have fewer than three 5★. Shares via the OS share sheet (Save to Files / OneDrive / socials) with a download fallback. Reflects the year selected on the Stats page.

---

## [v32.11] — 2026-07-11

### Changed
- **AI import prompt is now a two-step flow** — the AI first lists recognised books as a flat numbered list so you can pick which to keep, then (after you reply with the numbers) generates a **downloadable** `.json` file rather than pasting it inline.

---

## [v32.10] — 2026-07-11

### Added
- **Copy AI import prompt** (Settings → Your library) — opens a ready-made prompt describing the app's exact import JSON format. Paste it into any AI assistant with a photo/screenshot of your books; it returns an importable file you can trim and load via Import backup (Add new only). A lightweight alternative to a built-in Audible/library import.

---

## [v32.9] — 2026-07-11

### Changed
- **Staging banner is now neon magenta** — bright magenta, bold uppercase white text, gentle pulse — so staging is obvious at a glance next to production (which has similar data). Staging-only; respects reduced-motion.

---

## [v32.7] — 2026-07-11

### Changed
- **Import now de-duplicates — you can never end up with a book listed twice.** The old Merge (which blindly appended and caused duplicates) is replaced by three clearly-labelled choices, each with a description:
  - **Add new only** — add books you don't have; existing ones left untouched.
  - **Update & add** — add new books and refresh existing ones with the file's version (covers, ratings, dates…).
  - **Replace everything** — wipe the library first, then load the file (clean restore).
- Books are matched by **ISBN**, or by **title + author** when there's no ISBN. After import, a summary shows how many were added / updated / already present.
- Goodreads import's "Merge" now also de-duplicates (adds only books not already present).

---

## [v32.6] — 2026-07-11

### Added
- **"Delete all books" in Settings → Storage** — wipe the library and start fresh, behind a confirmation modal that shows the count and suggests backing up first. Useful for clearing duplicates (e.g. after an Import → Merge) then re-importing with Replace all.

---

## [v32.5] — 2026-07-11

### Fixed
- **"Back up to cloud" now shows OneDrive / Save to Files** (#16) — the share sheet was passing title/text, which made iOS present a text/message share (hiding storage apps). Now it shares only the file, so OneDrive, iCloud Drive, and "Save to Files" appear.

---

## [v32.4] — 2026-07-11

### Added
- **One-tap "Back up to cloud"** (#16) — Settings → *Back up to cloud* opens the OS share sheet so you can save your library straight to OneDrive, iCloud Drive, or Files. Falls back to a normal download where the share sheet isn't available. Restore is via the existing Import. (Automatic backup is tracked separately.)

---

## [v32.3] — 2026-07-11

### Fixed
- **Staging banner no longer crops the Settings header** (#17) — full-page modals render outside `#app`, so the earlier banner offset didn't reach them; they now sit below the banner on staging. Staging-only; prod unaffected.

---

## [v32.2] — 2026-07-11

### Added
- **Persistent storage** (#16, layer 1) — the app now asks the browser to keep your library from being auto-evicted under storage pressure. A new **Storage** section in Settings shows whether persistent storage is on and how much is stored; tap it to (re)request. This is a safety net, not a backup — keep exporting for true durability. Cloud backup/sync is still tracked separately.

---

## [v32.1] — 2026-07-11

### Changed
- **Per-shelf sort** (#14) — each shelf now remembers its own sort instead of one global setting. Defaults: Reading → **date started** (newest first), Read → **date finished** (newest first), TBR → **recently added**. Your choice per shelf persists across sessions.
- Added a **"Date started"** sort option.

### Fixed
- **Finished books default to today's date** (#15) — moving a book to Read without a finish date now sets it to today, so it lands at the top of the Read shelf.

---

## [v32.0] — 2026-07-11

### Changed
- **Stats page redesigned as a reading report** (#13). New layout: a bold hero number (books finished in the selected year) with library / avg-rating / reading-now beneath it, a **"Your years"** bar chart, a **monthly reading rhythm**, a **formats donut**, **languages** bars, and **top tags**.
- **Year-over-year drill-in** — tap any year (chip or bar) to scope the whole report to that year; "All time" shows the full picture. The "Your years" chart lets you compare years at a glance.

---

## [v31.0] — 2026-07-11

### Added
- **Multi-format support: Kindle / Paper / Audio** (#7). A book can now have several formats at once (e.g. Kindle + Audio) via a multi-select toggle in the Add/Edit form. Cards show a badge for each format.

### Changed
- The single "Format" dropdown (Paperback/Hardcover/Ebook/Audiobook) is replaced by the three-way Kindle/Paper/Audio toggle.
- One-time migration maps existing formats: paperback + hardcover → Paper, ebook → Kindle, audiobook → Audio. Goodreads imports are mapped the same way.

---

## [v30.1] — 2026-07-11

### Changed
- **Full book covers in the list** (#12) — card thumbnails now show the entire cover (`object-fit: contain`) instead of cropping the left/right edges. A neutral backdrop fills any letterbox gap for covers that don't match the column proportions.

_Versioning note: switched to `major.minor` from this release on. This is a minor (cosmetic) change._

---

## [v30] — 2026-07-11

### Added
- **On-demand cover picker in the Add/Edit form** (#9). Every book form now has a Cover chooser showing the current cover and a **"Find cover with Claude"** button. Tap it to search the web for a cover (~15–30s); when it returns, the Claude cover appears next to the current one and you tap whichever you prefer — you can always fall back to the current/Google cover. Works when editing any single existing book too, so you can fix one cover without a full bulk refresh. The chosen source is recorded (a Claude pick is marked done, so bulk refresh skips it).

---

## [v29] — 2026-07-11

### Fixed
- **Staging banner no longer crops the first book row** (#11) — the banner's height is now reserved on the app container, so the header and first card start below it instead of sliding underneath. Staging-only; prod was unaffected.

---

## [v28] — 2026-07-11

### Changed
- **Cover banner is now status-coloured and no longer collides with the + button.** In-progress = slate, success = green, error = amber — so the message colour tells you the outcome at a glance. The floating + button fades out while the banner is showing so the two no longer overlap or blend together.

---

## [v27] — 2026-07-11

### Changed
- **Cover progress/result banner redesigned** — now has a solid ink-blue background (was easy to miss on white), respects the iOS safe area, and wraps long messages fully so nothing is cut off on the right edge.
- **Friendly cover errors** — the raw API error is translated into a short message. E.g. an out-of-credits response now reads "Anthropic API is out of credits — add credits to fetch more covers" instead of dumping the raw JSON.

---

## [v26] — 2026-07-11

### Added
- **Cover-source tracking so bulk refresh skips finished books** (#10). Each book now records where its cover came from (`coverSource`). The cover actions are now three:
  - **Refresh new covers** — Claude search for books *not yet done* (skips ones already covered by Claude, your baseline, or manually set). Cheap to re-run after adding books.
  - **Fetch missing covers** — only books with no cover.
  - **Re-fetch ALL covers** — redoes every book (slow, uses tokens); behind a confirm.
- One-time migration marks all currently-covered books as done, so the first "Refresh new covers" run won't reprocess your existing library.

### Fixed
- Editing a book no longer drops fields that aren't on the form (e.g. `dateAdded`) — edits now merge onto the existing record.

---

## [v25] — 2026-07-11

### Fixed
- **Cover refresh works end to end.** The Worker must be deployed from an isolated folder — deploying inside the repo made wrangler upload `.git` as static assets, which broke the browser's CORS preflight ("Network: Load failed"). Documented the safe deploy in `workers/README.md`.
- Cover refresh now finds current-edition covers via Claude web search and populates them across the library.

---

## [v24] — 2026-07-11

### Fixed
- **Worker deploys were silently failing since v19** — removing the root `wrangler.toml` (needed to fix the site deployment) also removed the Worker's deploy config, so `wrangler deploy` had nothing to deploy and the Worker kept running the broken v17 code. The config now lives at `workers/wrangler.toml`; deploy with `cd workers && wrangler deploy`.
- **Cover refresh errors are now visible** — the progress banner ends with a summary ("Updated X, no cover for Y"), and if nothing updated it shows the actual error from the Worker instead of failing silently.

---

## [v23] — 2026-07-11

### Fixed
- **Root cause of all cover failures found: wrong model in the Worker.** The Worker used `claude-haiku-4-5`, but the `web_search_20260209`/`web_fetch_20260209` tools only exist on Sonnet 4.6+ models — every API call was rejected with a 400 and the app silently swallowed the error. Switched to `claude-sonnet-4-6`.
- **Worker now validates image URLs** — it fetches the URL itself and confirms it returns an actual image before handing it to the app.
- **Prompt asks for the current in-print edition** — no more decades-old covers.
- Cover lookup timeout raised to 45 s (search + page fetch takes longer).

---

## [v22] — 2026-07-11

### Fixed
- **Cover Worker now uses web_fetch to get actual image URLs** — web_search alone only returns text snippets and can't see image CDN URLs. Now Claude searches for the Amazon product page URL, then fetches that page and extracts the `og:image` cover URL from the HTML metadata. Falls back to Goodreads if Amazon fails.

---

## [v21] — 2026-07-11

### Changed
- **Cover refresh uses Claude only** — no Google Books, no Open Library. Claude searches Amazon for each book and returns the cover image URL directly from Amazon's CDN (`m.media-amazon.com`), which is current, high-quality, and publicly embeddable.

---

## [v20] — 2026-07-11

### Changed
- **Cover refresh now uses Google Books thumbnails** — Claude web search finds the ISBN, then Google Books API returns the cover. Google Books has current, high-quality covers and allows hotlinking. Open Library is no longer used for cover refresh.

---

## [v19] — 2026-07-11

### Fixed
- **Cover Worker now returns reliable Open Library URLs** — instead of asking Claude to return a raw image URL (often hotlink-protected), the Worker now asks Claude to find the book's ISBN via web search, then constructs a guaranteed-embeddable Open Library cover URL from it.

---

## [v18] — 2026-07-11

### Fixed
- **Cover refresh now finds embeddable images** — Claude web search Worker now specifically looks for Open Library and Google Books cover URLs (which allow hotlinking), instead of returning hotlink-protected Amazon/Goodreads image URLs that failed to load.
- Claude web search remains first priority; Google Books is the fallback.

---

## [v17] — 2026-07-11

### Added
- **Claude-powered cover search** — a Cloudflare Worker uses Claude API + web search to find current, high-quality cover images from the internet (Amazon, Goodreads, publishers, etc.). Far more accurate and up-to-date than Open Library.
- **"Refresh all covers" in Settings** — re-fetches covers for every book in your library, replacing outdated or wrong covers found by previous lookups.

### Changed
- "Fetch missing covers" now uses Claude web search via the Worker as its primary source.

---

## [v16] — 2026-07-11

### Changed
- **Google Books as primary cover source** — searches and ISBN lookups now hit Google Books first (better quality, more current editions); Open Library is the fallback.

---

## [v15] — 2026-07-11

### Changed
- **Marginalia visual redesign** — full design overhaul with ink-blue colour system, Spectral + Public Sans typefaces.
- **Shelf tabs with live counts** — Reading / TBR / Read tabs now show book counts as badge pills.
- **Coloured cover placeholders** — books without a cover image get a deterministic colour from a curated palette with a title-initial overlay.
- **Redesigned filter bar** — simplified to search + sort only; sort shows a text label ("Recent", "Title", etc.).
- **Segmented shelf control** — shelf picker in the Add/Edit form is now a three-button segmented control.
- **New empty states** — animated spine-bars illustration replaces plain emoji empty states.
- **Settings as full-page slide** — settings panel opens as a full-screen page with a back-arrow button.
- **New app icon** — ink-blue book icon replacing the gold open-book.

---

## [v14] — 2026-07-11

### Changed
- **Compact "Mark as finished" / "Start reading" buttons** — action buttons are now small pill-shaped labels inside the card body instead of a large gold block spanning the card height.

---

## [v13] — 2026-07-11

### Changed
- **Compact book covers** — cover thumbnails are now a narrow 72px column on the left of each card instead of a full-portrait image. Low-resolution covers no longer look blurry or pixelated. The card layout switches from column to row so title, author, and metadata flow to the right of the cover.

---

## [v12] — 2026-07-10

### Added
- **Automatic cover fetch after Goodreads import** — immediately after importing, a background pass looks up covers for every book without a thumbnail. Uses ISBN first (from the CSV), then falls back to a title/author search via Open Library. Books update on-screen as covers arrive.
- **"Fetch missing covers" button in Settings** — runs the same cover pass on demand at any time, for any books in your library that have no cover.
- Progress banner at the bottom of the screen shows "Fetching covers… N / total" with a stop button (✕) to cancel mid-run.
- 250 ms delay between requests to stay within Open Library's rate limits.

---

## [v11] — 2026-07-10

### Added
- **Goodreads CSV import** — import your entire Goodreads library in one step. Export from Goodreads → My Books → Import/Export → Export Library, then tap "Import from Goodreads" in Settings and pick the file.
  - Shelf mapping: read → Read, currently-reading → Currently Reading, to-read → TBR
  - Imports: title, author (converts "Last, First" to "First Last"), rating, format (paperback/hardcover/ebook/audiobook), date read, date added, review, private notes, custom bookshelves (as tags), ISBN
  - Merge with existing library or replace all books
  - Languages default to English (Goodreads CSV does not include language data)
  - Includes a robust CSV parser that correctly handles quoted fields and escaped quotes

---

## [v10] — 2026-07-10

### Fixed
- **Stale cache reload broken** — `location.reload(true)` is a no-op in modern browsers (the force flag was removed from the spec), so iOS could still serve old cached content after the SW was cleared. Replaced with `location.replace('/?cb=VERSION')` — a cache-busting URL that guarantees a genuine network fetch since it doesn't match any cached entry. The `?cb=` param is checked on arrival so the clear loop only runs once.

---

## [v9] — 2026-07-10

### Fixed
- **Search bar cropped by sticky header** — the filter bar was in normal document flow while the header was `position: sticky`, so scrolling caused the header to overlap and crop the search input. Fixed by moving the filter bar inside the `<header>` element so both stick together as one unit. Works correctly with and without the staging banner.

---

## [v8] — 2026-07-10

### Changed
- Book cover thumbnails now display the full cover image with no cropping
- Card cover area uses a 2:3 portrait aspect ratio (standard book proportions)
- Switched from `object-fit: cover` to `object-fit: contain` so the entire cover is always visible

---

## [v7] — 2026-07-10

### Changed
- Tapping anywhere on a book card now opens the edit modal (previously required tapping a tiny ✎ pencil icon)
- Action buttons (Mark as finished / Start reading) still work independently without triggering edit
- Keyboard accessible: Enter/Space on a focused card opens edit
- Version badge redesigned as a gold pill next to the app title — clearly visible on all devices
- Staging banner updated to always reflect the current version number

### Removed
- Small ✎ edit button on cards (replaced by full-card tap)

---

## [v6] — 2026-07-10

### Fixed
- **Delete book broken on iOS PWA** — `window.confirm()` is silently blocked in iOS standalone PWA mode, so the delete flow always exited early without deleting anything. Replaced with a proper "Delete book?" confirmation modal matching the style of existing modals.

---

## [v5] — 2026-07-10

### Fixed
- **`">` raw HTML appearing below book covers** — the inline `onerror` handler on cover images used escaped double quotes (`\"`) which the HTML parser interpreted as ending the attribute early, leaking `">` as visible text. Fixed by removing the inline handler entirely and attaching image error listeners after render using a `data-initial` attribute.
- **Dirty Open Library tags** — subjects prefixed with `form:`, `genre:`, `place:`, `time:`, `person:` were showing raw on book cards. Now filtered out before saving.
- **Header title clipped on notched iPhones** — added `padding-left: max(1rem, env(safe-area-inset-left))` to the header and filter bar to respect the iOS safe area with `viewport-fit=cover`.

### Added
- App version number displayed permanently in the header (small badge next to the title)

---

## [v4] — 2026-07-10

### Added
- `_headers` file for Cloudflare Pages: sets `Cache-Control: no-cache, no-store` on `index.html` and `sw.js`, and `no-cache` on all JS/CSS files, preventing the CDN from serving stale assets after a deploy
- Inline version-check script in `index.html`: on each page load, compares a hardcoded version string against `localStorage`. On mismatch, unregisters all service workers, clears all caches, and hard-reloads to guarantee fresh code is loaded

### Changed
- Service worker cache bumped to `proseandspine-v3` (network-first strategy from previous release)

---

## [v3] — 2026-07-10

### Changed
- **Service worker strategy changed from cache-first to network-first** — always fetches fresh files from the network and falls back to cache only when offline. Eliminates the stale-code problem where users kept running old JS/CSS after a deploy.
- Bumped SW cache name to `proseandspine-v3` to evict old caches on activation

---

## Book search rewrite — 2026-07-10

### Changed
- **Switched from Google Books API to Open Library API** — Google Books shared quota was exhausted (429 errors), causing silent empty results. Open Library is free, requires no API key, and has no quota.
- Cover images now served from `covers.openlibrary.org`
- Replaced `AbortSignal.timeout()` with `AbortController` + manual `setTimeout` for fetch timeouts — `AbortSignal.timeout()` is unsupported on iOS Safari < 16 and threw a silent TypeError.

---

## Staging environment — 2026-07-10

### Added
- Amber "⚠ STAGING" banner fixed to the top of the screen in the staging branch — always visible so it's impossible to confuse staging with production
- Two permanent Cloudflare Pages environments: staging (tracks `staging` branch) and production (tracks `main` branch)
- Feature branch workflow established: `feature/*` → `staging` → validate → `main`

---

## AI book lookup & cover thumbnails — 2026-07-10

### Added
- **Quick-search panel** in the Add Book modal — type a title or author to search Open Library and auto-fill all book fields (title, author, language, tags, page count, publish year, ISBN)
- **Book cover thumbnails** — displayed as a full-width strip at the top of each book card, with an initial-letter placeholder when no cover is available
- **ISBN barcode scanning** via `BarcodeDetector` API (Chrome/Android only; hidden on unsupported devices)
- **"Add title only" fallback** — if search returns no results, tap to open the full form with just the typed title pre-filled
- Book preview header inside the form showing the selected cover and title before saving
- "Search again" link to return to the search panel without losing the form

---

## [v1] — Initial release — 2026-07-10

### Added
- Three shelves: Currently Reading, TBR, Read — books moveable between shelves
- Book fields: title, author, language (English / German / Urdu / French), format, shelf, progress, half-star rating (1–5 in 0.5 steps), date started, date finished, tags, notes
- Filter bar: search by title/author, filter by language, filter by minimum rating, sort by date added / date finished / title / rating
- Reading stats view: total books per shelf, books read this year, average rating, language bar chart, recent reads list
- Export library to JSON / Import JSON (merge or replace)
- Full Urdu/RTL support: `dir="auto"` on all text fields, Noto Nastaliq Urdu font auto-applied via Unicode range detection (`/[؀-ۿ]/`), Arabic script also mapped to Urdu slot
- IndexedDB persistence via a custom async wrapper (`js/db.js`)
- PWA: `manifest.json`, service worker with cache-first offline support, iOS installable (`apple-mobile-web-app-capable`, `apple-touch-icon`), `theme-color` for status bar
- Warm paper aesthetic with full dark mode (follows system preference)
- Mobile-first responsive layout; two-column grid on tablet/desktop
- Deployable on Cloudflare Pages with no build step

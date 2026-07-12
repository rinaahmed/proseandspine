# Roadmap

Planned features and ideas for Prose & Spine. High-level overview only —
detailed, actionable work is tracked in [GitHub Issues](../../issues)
(look for the `enhancement` label). This file and the issues are kept in sync:
each idea below links to its issue.

Status key: 💡 idea · 📋 planned · 🚧 in progress · ✅ shipped

---

## Next up

_Nothing queued — pull from the backlog below._

---

## Backlog / unsorted ideas

_Add new ideas here as one-liners; promote them to "Next up" and open an issue
when they're ready to be worked on._

- **Cache cover thumbnails locally** — covers are remote URLs today (slow loads, break when URLs rot). Store downscaled thumbnails in IndexedDB for instant/offline covers. Needs a Worker image-proxy (CORS) + a backup with/without-images toggle. #19
- **Automatic cloud backup to OneDrive** — hands-off backup via Microsoft Graph (auto-write to the user's OneDrive, one-tap restore on a new device). Follow-on to the one-tap share backup. Needs Azure app + OAuth. #18

---

## Known bugs

_None open._

---

## Shipped

- ✅ **AI import prompt** — shipped in **v32.10/32.11**. Copyable two-step prompt (numbered list → downloadable JSON) to turn a photo/screenshot of books into an importable file. Supersedes #8 (Audible import) — screenshot Audible and use this instead.
- ✅ **Durable storage: persist + one-tap cloud backup** — #16 — persistent local storage in **v32.2** (`navigator.storage.persist()`), and one-tap "Back up to cloud" (share to OneDrive/iCloud/Files) in **v32.4**. Automatic OneDrive backup continues as #18.
- ✅ **Fix staging banner cropping the Settings header** — #17 — shipped in **v32.3**. Offsets full-page modals below the banner on staging.
- ✅ **Per-shelf sort with sensible defaults** — #14 — shipped in **v32.1**. Each shelf remembers its own sort (Reading → started, Read → finished, TBR → added); added a "Date started" option; persists across sessions.
- ✅ **Default finish date to today** — #15 — shipped in **v32.1**. Moving a book to Read without a date sets it to today so it sorts to the top.
- ✅ **Redesign the Stats page** — #13 — shipped in **v32.0**. Reading-report layout: hero number, "Your years" chart, monthly rhythm, formats donut, languages, top tags, with year-over-year drill-in.
- ✅ **Multi-format support: Kindle / Paper / Audio** — #7 — shipped in **v31.0**. A book can hold several formats at once; multi-select toggle in the form, a badge per format on cards, one-time migration of the old `format` field.
- ✅ **Show full cover in list (no side cropping)** — #12 — shipped in **v30.1**. Card thumbnails use `object-fit: contain` with a neutral letterbox backdrop.
- ✅ **On-demand cover picker (Google vs. Claude), add & edit** — #9 — shipped in **v30**. "Find cover with Claude" button in the book form; compare and choose, fall back to the current cover anytime; works per-book when editing.
- ✅ **Fix staging banner cropping the first book row** — #11 — shipped in **v29**. Reserves the banner's height so the header/first card start below it.
- ✅ **Track cover source to skip already-done books** — #10 — shipped in **v26**. Bulk "Refresh new covers" skips books already covered by Claude; "Fetch missing" and "Re-fetch ALL" round out the three actions.

See [CHANGELOG.md](CHANGELOG.md) for the full history of released versions.

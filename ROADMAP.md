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

- **Durable storage: persistent local + cloud backup** — IndexedDB can be evicted, so local + manual export isn't safe for years. Quick win: request `navigator.storage.persist()`. Bigger: opt-in cloud backup/sync (user's own Drive/Dropbox, or a Cloudflare-hosted backend). Keep it opt-in to preserve the on-device privacy default. #16
- **Read shelf sorted by date finished (newest first)** — books marked read appear at the bottom; the Read shelf should default to `dateFinished` descending so the most recently finished sit on top. #14
- **Default finish date to today** — if a book is moved to Read without a finish date (e.g. via the edit form), set `dateFinished` to today. Ties into #14. #15
- **Audible library import** _(undecided — may or may not build)_ — import audiobook titles from Audible via a selective checklist (untick a child's/private titles); no official API, needs a workaround source. Depends on multi-format (now shipped). #8

---

## Known bugs

_None open._

---

## Shipped

- ✅ **Redesign the Stats page** — #13 — shipped in **v32.0**. Reading-report layout: hero number, "Your years" chart, monthly rhythm, formats donut, languages, top tags, with year-over-year drill-in.
- ✅ **Multi-format support: Kindle / Paper / Audio** — #7 — shipped in **v31.0**. A book can hold several formats at once; multi-select toggle in the form, a badge per format on cards, one-time migration of the old `format` field.
- ✅ **Show full cover in list (no side cropping)** — #12 — shipped in **v30.1**. Card thumbnails use `object-fit: contain` with a neutral letterbox backdrop.
- ✅ **On-demand cover picker (Google vs. Claude), add & edit** — #9 — shipped in **v30**. "Find cover with Claude" button in the book form; compare and choose, fall back to the current cover anytime; works per-book when editing.
- ✅ **Fix staging banner cropping the first book row** — #11 — shipped in **v29**. Reserves the banner's height so the header/first card start below it.
- ✅ **Track cover source to skip already-done books** — #10 — shipped in **v26**. Bulk "Refresh new covers" skips books already covered by Claude; "Fetch missing" and "Re-fetch ALL" round out the three actions.

See [CHANGELOG.md](CHANGELOG.md) for the full history of released versions.

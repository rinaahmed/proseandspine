# Roadmap

Planned features and ideas for Prose & Spine. High-level overview only —
detailed, actionable work is tracked in [GitHub Issues](../../issues)
(look for the `enhancement` label). This file and the issues are kept in sync:
each idea below links to its issue.

Status key: 💡 idea · 📋 planned · 🚧 in progress · ✅ shipped

---

## Next up

### 💡 Multi-format support: Kindle / Paper / Audio — #7
Mark each book by how you own/consume it. Support books held in more than one
format (e.g. Kindle + Audible), with a badge per format on the card. Needs a
one-time migration of the existing `format` field.

### 💡 Audible library import — #8
Import audiobook titles from Audible. No official export exists, so the likely
approach is an unofficial export tool (or paste-from-web) feeding a **selective
import checklist** so private titles (e.g. a child's account) can be unticked
before importing. Multi-language listening is already covered by the app's
per-book language field.

---

## Backlog / unsorted ideas

_Add new ideas here as one-liners; promote them to "Next up" and open an issue
when they're ready to be worked on._

- …

---

## Known bugs

_None open._

---

## Shipped

- ✅ **Show full cover in list (no side cropping)** — #12 — shipped in **v30.1**. Card thumbnails use `object-fit: contain` with a neutral letterbox backdrop.
- ✅ **On-demand cover picker (Google vs. Claude), add & edit** — #9 — shipped in **v30**. "Find cover with Claude" button in the book form; compare and choose, fall back to the current cover anytime; works per-book when editing.
- ✅ **Fix staging banner cropping the first book row** — #11 — shipped in **v29**. Reserves the banner's height so the header/first card start below it.
- ✅ **Track cover source to skip already-done books** — #10 — shipped in **v26**. Bulk "Refresh new covers" skips books already covered by Claude; "Fetch missing" and "Re-fetch ALL" round out the three actions.

See [CHANGELOG.md](CHANGELOG.md) for the full history of released versions.

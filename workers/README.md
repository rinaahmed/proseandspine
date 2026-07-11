# Cover-finder Worker

A Cloudflare Worker that finds current book cover images. It receives
`{ title, author }`, uses Claude (Sonnet 4.6) with web search + web fetch to
locate the cover image on Amazon/Goodreads, validates the URL, and returns
`{ coverUrl }`. The app (`js/books-api.js`) calls it from "Refresh all covers".

The Anthropic API key lives only as a Worker secret — never in the repo.

## Deploying (the safe way)

Do **NOT** run `wrangler deploy` inside this repo. Wrangler walks up to the
repo root and uploads `.git` as "static assets", which flips the Worker into
static-asset mode and breaks the browser CORS preflight (the app then shows
"Network: Load failed").

Deploy from an isolated copy instead:

```bash
mkdir -p ~/cover-worker
cp cover-finder.js ~/cover-worker/
cp wrangler.toml  ~/cover-worker/
cd ~/cover-worker
wrangler deploy
```

Confirm the output says `Uploaded proseandspine-cover-finder` and does **not**
list any uploaded assets.

## Setting the API key (one time, and after the first deploy)

```bash
cd ~/cover-worker
wrangler secret put ANTHROPIC_API_KEY --name proseandspine-cover-finder
```

Paste the key when prompted. Secrets persist across future deploys.

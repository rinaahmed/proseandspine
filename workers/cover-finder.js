// Cloudflare Worker — finds current book cover image URLs via Claude web search + fetch
// Model must be Sonnet 4.6+ — the *_20260209 web tools are rejected (400) on Haiku.
// Deploy: wrangler deploy
// Secret: wrangler secret put ANTHROPIC_API_KEY

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function askClaudeForCover(title, author, apiKey) {
  const body = {
    model: MODEL,
    max_tokens: 2048,
    tools: [
      { type: 'web_search_20260209', name: 'web_search' },
      { type: 'web_fetch_20260209', name: 'web_fetch' },
    ],
    messages: [
      {
        role: 'user',
        content: `Find the cover image of the CURRENT edition of the book "${title}"${author ? ` by ${author}` : ''}.

Steps:
1. Search for the book on Goodreads (site:goodreads.com) or Amazon.
2. Fetch the book's page and extract the cover image URL from the og:image meta tag, e.g.:
   <meta property="og:image" content="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/...jpg"/>
   or https://m.media-amazon.com/images/I/XXXXX.jpg

Rules:
- Prefer the newest / currently in-print edition, NOT old editions from decades ago.
- The URL must be a direct image file (jpg/png/webp) on an Amazon or Goodreads CDN.
- Respond with ONLY the image URL on a single line. No explanation.
- If no cover can be found, respond with exactly: none`,
      },
    ],
  };

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  // Concatenate all text blocks (search/fetch runs can produce several)
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join(' ')
    .trim();

  if (!text || /^none$/i.test(text)) return null;

  const urlMatch = text.match(/https:\/\/[^\s"'<>()]+\.(?:jpg|jpeg|png|webp)[^\s"'<>()]*/i);
  return urlMatch ? urlMatch[0].replace(/[.,;]+$/, '') : null;
}

// Verify the URL actually serves an image before handing it to the app
async function validateImageUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cover-finder)' },
    });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') || '';
    return type.startsWith('image/');
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { title, author } = body;
    if (!title) return json({ error: 'title is required' }, 400);

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    try {
      const coverUrl = await askClaudeForCover(title, author, apiKey);
      if (!coverUrl) return json({ coverUrl: null });

      const ok = await validateImageUrl(coverUrl);
      return json({ coverUrl: ok ? coverUrl : null });
    } catch (e) {
      console.error('cover-finder error:', e.message);
      return json({ error: e.message }, 500);
    }
  },
};

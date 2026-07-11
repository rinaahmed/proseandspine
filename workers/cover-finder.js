// Cloudflare Worker — finds book cover image URLs via Claude web search
// Claude searches Amazon for the cover CDN image URL (embeddable, current quality)
// Deploy: wrangler deploy
// Secret: wrangler secret put ANTHROPIC_API_KEY

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

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

async function findCoverUrl(title, author, apiKey) {
  const body = {
    model: MODEL,
    max_tokens: 1024,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Search Amazon for the book "${title}"${author ? ` by ${author}` : ''} and find the direct cover image URL.

Amazon product images are hosted on m.media-amazon.com and look like:
https://m.media-amazon.com/images/I/XXXXXXXXX.jpg

Search for the book on Amazon, find the product page, and extract the cover image URL from m.media-amazon.com/images/. Return the largest version available (remove size suffixes like ._SX300_ or ._AC_UF_ from the URL to get the full image).

Return ONLY the image URL on a single line, nothing else.
If you cannot find an Amazon image URL, return "none".`,
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
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) return null;

  const text = textBlock.text.trim();
  if (text.toLowerCase() === 'none' || !text) return null;

  // Extract Amazon CDN image URL
  const urlMatch = text.match(/https:\/\/m\.media-amazon\.com\/images\/[^\s"'<>]+/);
  if (!urlMatch) return null;

  // Strip size suffixes to get full resolution: ._SX300_ ._AC_UF350,466_ etc.
  const url = urlMatch[0].replace(/\._[^.]+_(\.\w+)$/, '$1').replace(/[.,;)]+$/, '');
  return url;
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
      const coverUrl = await findCoverUrl(title, author, apiKey);
      return json({ coverUrl });
    } catch (e) {
      console.error('cover-finder error:', e.message);
      return json({ error: e.message }, 500);
    }
  },
};

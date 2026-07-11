// Cloudflare Worker — finds book cover image URLs via Claude web search + fetch
// 1. Claude searches for the book on Amazon to get the product page URL
// 2. Claude fetches that page and extracts the og:image cover URL
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
    max_tokens: 2048,
    tools: [
      { type: 'web_search_20260209', name: 'web_search' },
      { type: 'web_fetch_20260209', name: 'web_fetch' },
    ],
    messages: [
      {
        role: 'user',
        content: `Find the cover image for the book "${title}"${author ? ` by ${author}` : ''}.

Step 1: Search for the book on Amazon to find its product page URL.
Step 2: Fetch that Amazon product page and look for the og:image meta tag in the HTML, which contains the cover image URL. It looks like:
<meta property="og:image" content="https://m.media-amazon.com/images/I/XXXXX.jpg"/>

Return ONLY the https://m.media-amazon.com/... image URL, nothing else.
If you cannot find it on Amazon, try searching on Goodreads and fetch that page for the og:image instead.
If you still cannot find a cover image URL, return "none".`,
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

  // Extract any https image URL
  const urlMatch = text.match(/https:\/\/[^\s"'<>]+\.jpg[^\s"'<>]*/i)
    || text.match(/https:\/\/[^\s"'<>]+\.png[^\s"'<>]*/i)
    || text.match(/https:\/\/[^\s"'<>]+/);
  if (!urlMatch) return null;

  return urlMatch[0].replace(/[.,;)>]+$/, '');
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

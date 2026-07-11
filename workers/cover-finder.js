// Cloudflare Worker — finds book ISBN via Claude web search, returns Open Library cover URL
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

async function findISBN(title, author, apiKey) {
  const body = {
    model: MODEL,
    max_tokens: 512,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Search the web for the ISBN-13 of the book "${title}"${author ? ` by ${author}` : ''}.

Return ONLY the 13-digit ISBN number, nothing else — no dashes, no spaces, no other text. Example: 9780141439518

If you cannot find a 13-digit ISBN, try to find a 10-digit ISBN and return that instead.
If you cannot find any ISBN, return "none".`,
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

  // Extract a 10 or 13 digit ISBN
  const isbnMatch = text.match(/\b(\d{13}|\d{10})\b/);
  return isbnMatch ? isbnMatch[1] : null;
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
      const isbn = await findISBN(title, author, apiKey);
      if (!isbn) return json({ coverUrl: null });

      // Construct a reliable Open Library cover URL from the ISBN
      const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
      return json({ coverUrl, isbn });
    } catch (e) {
      console.error('cover-finder error:', e.message);
      return json({ error: e.message }, 500);
    }
  },
};

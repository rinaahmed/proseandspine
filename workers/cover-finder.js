// Cloudflare Worker — finds book cover image URLs using Claude + web search
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
  const query = author
    ? `"${title}" by ${author} book cover image`
    : `"${title}" book cover image`;

  const body = {
    model: MODEL,
    max_tokens: 1024,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Search the web for the book cover image of "${title}"${author ? ` by ${author}` : ''}.

I need a cover image URL that can be embedded directly in an <img> tag — it must be a publicly accessible image file, not a webpage.

Preferred sources (these allow hotlinking):
- Open Library: https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg or https://covers.openlibrary.org/b/id/{ID}-L.jpg
- Google Books: https://books.google.com/books/content?vid=ISBN{ISBN}&printsec=frontcover&img=1&zoom=1

Search for the book, find its ISBN or Open Library ID, then construct or find the direct cover image URL.

Return ONLY the image URL on a single line, nothing else. If you cannot find one, return "none".`,
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

  // Extract text from the final assistant message
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) return null;

  const text = textBlock.text.trim();
  if (text.toLowerCase() === 'none' || !text) return null;

  // Extract URL from the response text
  const urlMatch = text.match(/https?:\/\/\S+/);
  if (!urlMatch) return null;

  const url = urlMatch[0].replace(/[.,;)]+$/, '');
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

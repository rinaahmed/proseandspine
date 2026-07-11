// Book search: Google Books primary (better covers), Open Library fallback
// Covers: Claude API web search via Cloudflare Worker (most accurate/current)
// Google Books: https://developers.google.com/books/docs/v1/using
// Open Library: https://openlibrary.org/developers/api

const GB_SEARCH  = 'https://www.googleapis.com/books/v1/volumes';
const OL_SEARCH  = 'https://openlibrary.org/search.json';
const OL_COVERS  = 'https://covers.openlibrary.org/b/id';

// Set this to your deployed Worker URL after running: wrangler deploy
const COVER_WORKER_URL = 'https://proseandspine-cover-finder.rina-ahmed.workers.dev';

const LANG_MAP = {
  eng: 'en', en: 'en',
  ger: 'de', deu: 'de', de: 'de',
  urd: 'ur', ur: 'ur',
  fre: 'fr', fra: 'fr', fr: 'fr',
  ara: 'ur',
};

// Ask the Cloudflare Worker (Claude + web search) for the cover image URL
async function fetchCoverViaWorker(title, author) {
  if (!COVER_WORKER_URL) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(COVER_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.coverUrl || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// Google Books returns http:// thumbnails — upgrade to https and strip curl edge
function cleanGBThumb(url) {
  if (!url) return null;
  return url.replace(/^http:\/\//, 'https://').replace(/&edge=curl/g, '');
}

function parseGBItem(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn = (ids.find(i => i.type === 'ISBN_13') || ids.find(i => i.type === 'ISBN_10') || {}).identifier || null;

  const rawThumb = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || null;
  const thumbnail = cleanGBThumb(rawThumb);

  // Zoom=1 gives a larger image than the default thumbnail
  const betterThumb = thumbnail
    ? thumbnail.replace(/zoom=\d/, 'zoom=1')
    : null;

  const langCode = (v.language || '').toLowerCase();

  return {
    openLibKey: null,
    title: v.title || '',
    author: (v.authors || []).join(', '),
    language: LANG_MAP[langCode] || 'en',
    thumbnail: betterThumb,
    tags: (v.categories || []).slice(0, 5).join(', '),
    description: (v.description || '').slice(0, 500),
    pageCount: v.pageCount || null,
    publishedDate: v.publishedDate || null,
    isbn,
    gbId: item.id || null,
  };
}

function olCoverURL(coverId, size = 'M') {
  if (!coverId || coverId === -1) return null;
  return `${OL_COVERS}/${coverId}-${size}.jpg`;
}

function parseOLDoc(doc) {
  const lang = (doc.language || []).find(l => LANG_MAP[l]);
  return {
    openLibKey: doc.key || null,
    title: doc.title || '',
    author: (doc.author_name || []).join(', '),
    language: LANG_MAP[lang] || 'en',
    thumbnail: olCoverURL(doc.cover_i),
    tags: (doc.subject || [])
      .filter(s => !/^(form|genre|place|time|person|subject):/i.test(s) && s.length < 40)
      .slice(0, 5).join(', '),
    description: '',
    pageCount: doc.number_of_pages_median || null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    isbn: (doc.isbn || [])[0] || null,
  };
}

// Search Google Books; fall back to Open Library if no results
export async function searchBooks(query, maxResults = 8) {
  if (!query || query.trim().length < 2) return { results: [], error: null };

  // 1. Try Google Books
  try {
    const url = `${GB_SEARCH}?q=${encodeURIComponent(query.trim())}&maxResults=${maxResults}&printType=books&fields=items(id,volumeInfo(title,authors,language,publishedDate,pageCount,categories,industryIdentifiers,imageLinks,description))`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      const results = (data.items || []).map(parseGBItem).filter(b => b.title);
      if (results.length) return { results, error: null };
    }
  } catch (e) {
    if (e.name === 'AbortError') return { results: [], error: 'Search timed out — check your connection.' };
  }

  // 2. Fall back to Open Library
  try {
    const url = `${OL_SEARCH}?q=${encodeURIComponent(query.trim())}&limit=${maxResults}&fields=key,title,author_name,cover_i,first_publish_year,subject,language,isbn,number_of_pages_median`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { results: [], error: `Search failed (${res.status}). Try again.` };
    const data = await res.json();
    const results = (data.docs || []).map(parseOLDoc).filter(b => b.title);
    return { results, error: null };
  } catch (e) {
    if (e.name === 'AbortError') return { results: [], error: 'Search timed out — check your connection.' };
    return { results: [], error: 'Search unavailable — you can still add the book manually.' };
  }
}

// ISBN lookup: Google Books first, Open Library fallback
export async function lookupISBN(isbn) {
  // 1. Google Books
  try {
    const url = `${GB_SEARCH}?q=isbn:${encodeURIComponent(isbn)}&maxResults=1&fields=items(id,volumeInfo(title,authors,language,publishedDate,pageCount,categories,industryIdentifiers,imageLinks,description))`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      if (data.items?.[0]) return parseGBItem(data.items[0]);
    }
  } catch {}

  // 2. Open Library
  try {
    const url = `${OL_SEARCH}?isbn=${encodeURIComponent(isbn)}&limit=1&fields=key,title,author_name,cover_i,first_publish_year,subject,language,number_of_pages_median`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      if (data.docs?.[0]) return parseOLDoc(data.docs[0]);
    }
  } catch {}

  return null;
}

// Fetch cover via Claude web search only (finds Amazon CDN image URL)
export async function fetchCoverForBook({ title, author }) {
  return await fetchCoverViaWorker(title, author);
}

export async function detectBarcodeFromVideoFrame(videoEl) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] });
    const codes = await detector.detect(videoEl);
    return codes.length ? codes[0].rawValue : null;
  } catch {
    return null;
  }
}

export function isBarcodeSupported() {
  return 'BarcodeDetector' in window;
}

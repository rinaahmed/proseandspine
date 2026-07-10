const BASE = 'https://www.googleapis.com/books/v1/volumes';

const LANG_MAP = { en: 'en', de: 'de', ur: 'ur', fr: 'fr', ar: 'ur' };

// Safe timeout compatible with all browsers including old iOS Safari
// (AbortSignal.timeout is not available before Safari 16)
function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function parseVolume(item) {
  const v = item.volumeInfo || {};

  let thumbnail = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || null;
  if (thumbnail) {
    thumbnail = thumbnail.replace(/^http:\/\//, 'https://').replace(/&zoom=\d/, '&zoom=2');
  }

  const isbn = (v.industryIdentifiers || []).find(
    i => i.type === 'ISBN_13' || i.type === 'ISBN_10'
  );

  return {
    googleId: item.id,
    title: v.title || '',
    subtitle: v.subtitle || '',
    author: (v.authors || []).join(', '),
    language: LANG_MAP[v.language] || 'en',
    thumbnail,
    description: v.description ? v.description.replace(/<[^>]+>/g, '').slice(0, 600) : '',
    tags: (v.categories || []).join(', '),
    pageCount: v.pageCount || null,
    publishedDate: v.publishedDate || null,
    publisher: v.publisher || null,
    isbn: isbn ? isbn.identifier : null,
  };
}

// Returns { results, error } so callers can show a message on failure
export async function searchBooks(query, maxResults = 8) {
  if (!query || query.trim().length < 2) return { results: [], error: null };
  // No fields param — simpler URL is less likely to hit quota edge cases
  const url = `${BASE}?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  try {
    const res = await fetchWithTimeout(url);
    if (res.status === 429) return { results: [], error: 'Search limit reached — try again in a moment.' };
    if (!res.ok) return { results: [], error: `Search failed (${res.status}).` };
    const data = await res.json();
    if (data.error) return { results: [], error: data.error.message || 'Search failed.' };
    return { results: (data.items || []).map(parseVolume), error: null };
  } catch (e) {
    const msg = e.name === 'AbortError'
      ? 'Search timed out — check your connection.'
      : 'Search failed — check your connection.';
    return { results: [], error: msg };
  }
}

export async function lookupISBN(isbn) {
  const url = `${BASE}?q=isbn:${isbn}&maxResults=1`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0] ? parseVolume(data.items[0]) : null;
  } catch {
    return null;
  }
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

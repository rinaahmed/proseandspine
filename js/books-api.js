// Open Library — free, no key, no quota
// Docs: https://openlibrary.org/developers/api

const SEARCH = 'https://openlibrary.org/search.json';
const COVERS = 'https://covers.openlibrary.org/b/id';

const LANG_MAP = {
  eng: 'en', en: 'en',
  ger: 'de', deu: 'de', de: 'de',
  urd: 'ur', ur: 'ur',
  fre: 'fr', fra: 'fr', fr: 'fr',
  ara: 'ur', // Arabic → Urdu slot (both RTL)
};

function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function coverURL(coverId, size = 'M') {
  if (!coverId || coverId === -1) return null;
  return `${COVERS}/${coverId}-${size}.jpg`;
}

function parseDoc(doc) {
  const lang = (doc.language || []).find(l => LANG_MAP[l]);
  const cover = coverURL(doc.cover_i);

  return {
    openLibKey: doc.key || null,
    title: doc.title || '',
    author: (doc.author_name || []).join(', '),
    language: LANG_MAP[lang] || 'en',
    thumbnail: cover,
    tags: (doc.subject || []).slice(0, 5).join(', '),
    description: '',          // OL search doesn't return description; blank is fine
    pageCount: doc.number_of_pages_median || null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    isbn: (doc.isbn || [])[0] || null,
  };
}

// Returns { results: Book[], error: string|null }
export async function searchBooks(query, maxResults = 8) {
  if (!query || query.trim().length < 2) return { results: [], error: null };

  const url = `${SEARCH}?q=${encodeURIComponent(query.trim())}&limit=${maxResults}&fields=key,title,author_name,cover_i,first_publish_year,subject,language,isbn,number_of_pages_median`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { results: [], error: `Search failed (${res.status}). Try again.` };
    const data = await res.json();
    const results = (data.docs || []).map(parseDoc).filter(b => b.title);
    return { results, error: results.length ? null : null }; // empty list is valid, not an error
  } catch (e) {
    if (e.name === 'AbortError') return { results: [], error: 'Search timed out — check your connection.' };
    return { results: [], error: 'Search unavailable — you can still add the book manually.' };
  }
}

export async function lookupISBN(isbn) {
  const url = `${SEARCH}?isbn=${encodeURIComponent(isbn)}&limit=1&fields=key,title,author_name,cover_i,first_publish_year,subject,language,number_of_pages_median`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.docs?.[0] ? parseDoc(data.docs[0]) : null;
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

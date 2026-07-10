const BASE = 'https://www.googleapis.com/books/v1/volumes';

const LANG_MAP = { en: 'en', de: 'de', ur: 'ur', fr: 'fr', ar: 'ur' };

function parseVolume(item) {
  const v = item.volumeInfo || {};

  let thumbnail = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || null;
  if (thumbnail) {
    // Force https and request a larger zoom
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

export async function searchBooks(query, maxResults = 8) {
  if (!query || query.trim().length < 2) return [];
  const url = `${BASE}?q=${encodeURIComponent(query)}&maxResults=${maxResults}&fields=items(id,volumeInfo(title,subtitle,authors,language,imageLinks,description,categories,pageCount,publishedDate,publisher,industryIdentifiers))`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(parseVolume);
  } catch {
    return [];
  }
}

export async function lookupISBN(isbn) {
  const url = `${BASE}?q=isbn:${isbn}&maxResults=1&fields=items(id,volumeInfo(title,subtitle,authors,language,imageLinks,description,categories,pageCount,publishedDate,publisher,industryIdentifiers))`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
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

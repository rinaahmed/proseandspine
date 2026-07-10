// Goodreads CSV export parser
// Export from: Goodreads → My Books → Import/Export → Export Library

const SHELF_MAP = {
  'read': 'read',
  'currently-reading': 'reading',
  'to-read': 'tbr',
};

const FORMAT_MAP = {
  'paperback': 'paperback',
  'hardcover': 'hardcover',
  'mass market paperback': 'paperback',
  'ebook': 'ebook',
  'kindle edition': 'ebook',
  'audiobook': 'audiobook',
  'audio cd': 'audiobook',
  'mp3 cd': 'audiobook',
};

// Minimal but correct CSV parser — handles quoted fields and escaped quotes
function parseCSV(text) {
  const rows = [];
  let field = '';
  let inQuotes = false;
  let row = [];
  const n = text.length;

  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped ""
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); field = '';
        rows.push(row); row = [];
      } else if (ch === '\r') {
        // skip CR (handle \r\n)
      } else {
        field += ch;
      }
    }
  }
  // last field/row
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function col(headers, row, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? (row[i] || '').trim() : '';
}

// Goodreads dates come as YYYY/MM/DD
function parseGRDate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// Normalise "Last, First" → "First Last"
function normaliseAuthor(raw) {
  if (!raw) return '';
  const m = raw.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2].trim()} ${m[1].trim()}` : raw.trim();
}

export function parseGoodreadsCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { books: [], error: 'File appears empty.' };

  // Normalise header names (trim + lowercase)
  const headers = rows[0].map(h => h.trim().toLowerCase());

  // Verify it looks like a Goodreads export
  if (!headers.includes('title') || !headers.includes('exclusive shelf')) {
    return { books: [], error: 'This doesn\'t look like a Goodreads export CSV. Make sure you export from My Books → Import/Export → Export Library.' };
  }

  const books = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue; // skip blank lines

    const title = col(headers, row, 'title');
    if (!title) continue;

    const authorRaw = col(headers, row, 'author l-f') || col(headers, row, 'author');
    const author = normaliseAuthor(authorRaw);

    const grShelf = col(headers, row, 'exclusive shelf');
    const shelf = SHELF_MAP[grShelf] || 'tbr';

    const grRating = parseInt(col(headers, row, 'my rating')) || 0;
    const rating = grRating > 0 ? grRating : 0; // Goodreads uses 0 = unrated

    const bindingRaw = col(headers, row, 'binding').toLowerCase();
    const format = FORMAT_MAP[bindingRaw] || null;

    const dateRead = parseGRDate(col(headers, row, 'date read'));
    const dateAdded = parseGRDate(col(headers, row, 'date added'));

    const review = col(headers, row, 'my review');
    const privateNotes = col(headers, row, 'private notes');
    const notes = [review, privateNotes].filter(Boolean).join('\n\n').trim();

    // Bookshelves (excluding the exclusive shelf itself)
    const allShelves = col(headers, row, 'bookshelves')
      .split(',')
      .map(s => s.trim())
      .filter(s => s && s !== grShelf);
    const tags = allShelves.slice(0, 5).join(', ');

    const isbn = col(headers, row, 'isbn13').replace(/[^0-9X]/gi, '')
             || col(headers, row, 'isbn').replace(/[^0-9X]/gi, '')
             || null;

    books.push({
      title,
      author,
      shelf,
      rating,
      format,
      dateFinished: dateRead,
      dateAdded: dateAdded || new Date().toISOString(),
      notes,
      tags,
      isbn,
      language: 'en', // Goodreads CSV doesn't include language
      thumbnail: null,
      openLibKey: null,
    });
  }

  if (!books.length) return { books: [], error: 'No books found in the CSV.' };
  return { books, error: null };
}

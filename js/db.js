const DB_NAME = 'proseandspine';
const DB_VERSION = 1;
const STORE = 'books';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('shelf', 'shelf', { unique: false });
        store.createIndex('language', 'language', { unique: false });
        store.createIndex('dateAdded', 'dateAdded', { unique: false });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    if (req && req.onsuccess !== undefined) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }
  }));
}

export function getAllBooks() {
  return withStore('readonly', store => store.getAll());
}

export function getBook(id) {
  return withStore('readonly', store => store.get(id));
}

export function addBook(book) {
  book = { ...book, dateAdded: book.dateAdded || new Date().toISOString() };
  return withStore('readwrite', store => store.add(book));
}

export function updateBook(book) {
  return withStore('readwrite', store => store.put(book));
}

export function deleteBook(id) {
  return withStore('readwrite', store => store.delete(id));
}

export function clearAllBooks() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

// One-time backfill of the coverSource field for books added before it existed.
// Books that already have a cover are marked 'existing' (baseline — bulk refresh
// leaves them alone); cover-less books get null so they can still be fetched.
// Idempotent: only writes books that lack the field, so it no-ops after first run.
export async function migrateCoverSource() {
  const books = await getAllBooks();
  const need = books.filter(b => b.coverSource === undefined);
  if (!need.length) return 0;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const b of need) {
      store.put({ ...b, coverSource: b.thumbnail ? 'existing' : null });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return need.length;
}

// Ask the browser to keep our data from being evicted under storage pressure.
// Returns { supported, persisted, usageMB } describing the current state.
export async function ensurePersistentStorage() {
  const s = navigator.storage;
  if (!s || !s.persist || !s.persisted) {
    return { supported: false, persisted: false, usageMB: null };
  }
  let persisted = await s.persisted();
  if (!persisted) {
    try { persisted = await s.persist(); } catch { /* ignore */ }
  }
  let usageMB = null;
  try {
    if (s.estimate) {
      const { usage } = await s.estimate();
      if (typeof usage === 'number') usageMB = usage / (1024 * 1024);
    }
  } catch { /* ignore */ }
  return { supported: true, persisted, usageMB };
}

// Map the old single `format` string to the new `formats` array.
const LEGACY_FORMAT_MAP = {
  paperback: 'paper', hardcover: 'paper', paper: 'paper',
  ebook: 'kindle', kindle: 'kindle',
  audiobook: 'audio', audio: 'audio',
};

// Derive a book's formats array from either the new field or the legacy `format`.
export function bookFormats(book) {
  if (Array.isArray(book.formats)) return book.formats;
  const mapped = LEGACY_FORMAT_MAP[(book.format || '').toLowerCase()];
  return mapped ? [mapped] : [];
}

// One-time backfill: give every book a `formats` array derived from `format`.
// Idempotent — only writes books that don't already have `formats`.
export async function migrateFormats() {
  const books = await getAllBooks();
  const need = books.filter(b => !Array.isArray(b.formats));
  if (!need.length) return 0;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const b of need) {
      store.put({ ...b, formats: bookFormats(b) });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return need.length;
}

// Identity key used to detect "the same book" across a library and an import
// file: ISBN when present, otherwise normalised title + author.
function matchKey(book) {
  const isbn = (book.isbn || '').replace(/[^0-9Xx]/g, '');
  if (isbn) return 'isbn:' + isbn.toLowerCase();
  const norm = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return 'ta:' + norm(book.title) + '|' + norm(book.author);
}

// Import with one of three modes — no mode ever produces a duplicate:
//   'add-new' : add only books not already present; leave existing untouched.
//   'update'  : add new books AND overwrite existing ones with the file's version.
//   'replace' : wipe the whole library first, then load the file.
// Returns { added, updated, skipped }.
export async function importBooks(books, mode = 'add-new') {
  // Collapse duplicates within the file itself (last one wins).
  const incoming = new Map();
  for (const b of books) incoming.set(matchKey(b), b);

  if (mode === 'replace') {
    await clearAllBooks();
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const b of incoming.values()) { const c = { ...b }; delete c.id; store.add(c); }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { added: incoming.size, updated: 0, skipped: 0 };
  }

  // add-new / update: match against what's already there.
  const existing = await getAllBooks();
  const existingByKey = new Map();
  for (const b of existing) existingByKey.set(matchKey(b), b);

  let added = 0, updated = 0, skipped = 0;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const [key, book] of incoming) {
      const current = existingByKey.get(key);
      if (!current) {
        const c = { ...book }; delete c.id;
        store.add(c);
        added++;
      } else if (mode === 'update') {
        // Overwrite the existing record (keep its id) with the file's version.
        store.put({ ...book, id: current.id });
        updated++;
      } else {
        skipped++;
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return { added, updated, skipped };
}

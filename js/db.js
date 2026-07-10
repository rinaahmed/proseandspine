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

export async function importBooks(books, merge) {
  if (!merge) await clearAllBooks();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const book of books) {
      const b = { ...book };
      if (merge) {
        delete b.id;
        store.add(b);
      } else {
        delete b.id;
        store.add(b);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

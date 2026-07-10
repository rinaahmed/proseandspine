import { getAllBooks, addBook, updateBook, deleteBook, importBooks } from './db.js';
import { searchBooks, lookupISBN, detectBarcodeFromVideoFrame, isBarcodeSupported } from './books-api.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'ur', label: 'Urdu' },
  { code: 'fr', label: 'French' },
];

const FORMATS = ['paperback', 'hardcover', 'ebook', 'audiobook'];

const SHELF_LABELS = {
  reading: 'Currently Reading',
  tbr: 'To Be Read',
  read: 'Read',
};

const EMPTY_STATES = {
  reading: { icon: '📖', msg: 'Nothing on your nightstand yet.', hint: 'Tap + to add what you\'re reading now.' },
  tbr: { icon: '📚', msg: 'Your TBR is empty — lucky you.', hint: 'Add books you\'re planning to read.' },
  read: { icon: '✓', msg: 'No finished books yet.', hint: 'Mark a book as finished to see it here.' },
};

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  shelf: 'reading',
  search: '',
  filterLanguage: '',
  filterRating: '',
  sortBy: 'dateAdded',
  books: [],
  pendingFinishId: null,
  pendingImport: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasArabicScript(text) {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text || '');
}

function textClass(text) {
  return hasArabicScript(text) ? 'urdu-text' : '';
}

function langLabel(code) {
  return (LANGUAGES.find(l => l.code === code) || {}).label || code;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function starsHTML(rating) {
  if (!rating) return '';
  let html = '<span class="stars" aria-label="' + rating + ' out of 5">';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) html += '<span class="s full">★</span>';
    else if (rating >= i - 0.5) html += '<span class="s half">★</span>';
    else html += '<span class="s empty">★</span>';
  }
  return html + '</span>';
}

function escape(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Filtering & Sorting ─────────────────────────────────────────────────────

function filterAndSort(books) {
  let list = books.filter(b => b.shelf === state.shelf);

  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q)
    );
  }

  if (state.filterLanguage) {
    list = list.filter(b => b.language === state.filterLanguage);
  }

  if (state.filterRating) {
    const min = parseFloat(state.filterRating);
    list = list.filter(b => (b.rating || 0) >= min);
  }

  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'title': return (a.title || '').localeCompare(b.title || '');
      case 'rating': return (b.rating || 0) - (a.rating || 0);
      case 'dateFinished': return (b.dateFinished || '').localeCompare(a.dateFinished || '');
      case 'dateAdded':
      default: return (b.dateAdded || '').localeCompare(a.dateAdded || '');
    }
  });

  return list;
}

// ─── Rendering: Book Cards ────────────────────────────────────────────────────

function renderBooks() {
  const grid = document.getElementById('books-grid');
  const statsView = document.getElementById('stats-view');

  if (state.shelf === 'stats') {
    grid.classList.add('hidden');
    statsView.classList.remove('hidden');
    renderStats();
    return;
  }

  grid.classList.remove('hidden');
  statsView.classList.add('hidden');

  const list = filterAndSort(state.books);

  if (!list.length) {
    const e = EMPTY_STATES[state.shelf] || {};
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${e.icon || '📚'}</div>
        <p class="empty-msg">${e.msg || 'Nothing here yet.'}</p>
        <p class="empty-hint">${e.hint || ''}</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(book => bookCardHTML(book)).join('');
}

function bookCardHTML(book) {
  const titleClass = textClass(book.title);
  const authorClass = textClass(book.author);
  const notesClass = textClass(book.notes);
  const titleDir = hasArabicScript(book.title) ? 'rtl' : 'auto';
  const authorDir = hasArabicScript(book.author) ? 'rtl' : 'auto';

  const tags = (book.tags || '').split(',').map(t => t.trim()).filter(Boolean);

  // Thumbnail
  const thumbInitial = (book.title || '?')[0].toUpperCase();
  const thumbHTML = book.thumbnail
    ? `<div class="card-thumb-wrap">
        <img class="card-thumb-img" src="${escape(book.thumbnail)}" alt="" loading="lazy"
          onerror="this.parentElement.innerHTML='<div class=\\"card-thumb-placeholder\\">${thumbInitial}</div>'">
       </div>`
    : `<div class="card-thumb-wrap"><div class="card-thumb-placeholder">${thumbInitial}</div></div>`;

  let progressHTML = '';
  if (book.shelf === 'reading' && book.progress && book.progress.value) {
    const pct = book.progress.type === 'percent'
      ? Math.min(100, book.progress.value)
      : null;
    progressHTML = `<div class="progress-bar-wrap">
      <div class="progress-bar" style="width:${pct ? pct + '%' : '0'}"></div>
      <span class="progress-label">${book.progress.value}${book.progress.type === 'percent' ? '%' : ' pages'}</span>
    </div>`;
  }

  let metaItems = [];
  if (book.language) metaItems.push(`<span class="meta-tag lang-tag">${langLabel(book.language)}</span>`);
  if (book.format) metaItems.push(`<span class="meta-tag">${book.format}</span>`);
  if (book.dateFinished) metaItems.push(`<span class="meta-tag">Finished ${fmtDate(book.dateFinished)}</span>`);
  else if (book.dateStarted) metaItems.push(`<span class="meta-tag">Started ${fmtDate(book.dateStarted)}</span>`);

  const tagHTML = tags.map(t => `<span class="meta-tag tag">${escape(t)}</span>`).join('');

  let actionButtons = '';
  if (book.shelf === 'tbr') {
    actionButtons = `<button class="card-action-btn" data-action="start" data-id="${book.id}">Start reading</button>`;
  } else if (book.shelf === 'reading') {
    actionButtons = `<button class="card-action-btn primary" data-action="finish" data-id="${book.id}">Mark as finished</button>`;
  }

  return `
    <article class="book-card" data-id="${book.id}">
      ${thumbHTML}
      <div class="card-body">
        <div class="card-header">
          <h3 class="book-title ${titleClass}" dir="${titleDir}">${escape(book.title)}</h3>
          <button class="card-edit-btn" data-action="edit" data-id="${book.id}" aria-label="Edit">✎</button>
        </div>
        <p class="book-author ${authorClass}" dir="${authorDir}">${escape(book.author)}</p>
        ${book.rating ? starsHTML(book.rating) : ''}
        ${book.notes ? `<p class="book-notes ${notesClass}" dir="auto">${escape(book.notes)}</p>` : ''}
        ${progressHTML}
        <div class="meta-row">${metaItems.join('')}${tagHTML}</div>
      </div>
      ${actionButtons ? `<div class="card-actions">${actionButtons}</div>` : ''}
    </article>`;
}

// ─── Rendering: Stats ─────────────────────────────────────────────────────────

function renderStats() {
  const view = document.getElementById('stats-view');
  const books = state.books;
  const readBooks = books.filter(b => b.shelf === 'read');
  const thisYear = new Date().getFullYear();
  const readThisYear = readBooks.filter(b => (b.dateFinished || '').startsWith(String(thisYear)));

  const rated = readBooks.filter(b => b.rating);
  const avgRating = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : '—';

  const byLang = {};
  for (const b of readBooks) {
    const l = b.language || 'unknown';
    byLang[l] = (byLang[l] || 0) + 1;
  }
  const maxLang = Math.max(1, ...Object.values(byLang));

  const langBars = Object.entries(byLang)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `
      <div class="lang-bar-row">
        <span class="lang-bar-label">${langLabel(code)}</span>
        <div class="lang-bar-track">
          <div class="lang-bar-fill" style="width:${(count / maxLang * 100).toFixed(1)}%"></div>
        </div>
        <span class="lang-bar-count">${count}</span>
      </div>`).join('');

  const allShelves = [
    { label: 'Read', count: readBooks.length },
    { label: 'Reading', count: books.filter(b => b.shelf === 'reading').length },
    { label: 'TBR', count: books.filter(b => b.shelf === 'tbr').length },
  ];

  view.innerHTML = `
    <div class="stats-container">
      <h2 class="stats-heading">Your library</h2>

      <div class="stat-cards">
        ${allShelves.map(s => `
          <div class="stat-card">
            <div class="stat-num">${s.count}</div>
            <div class="stat-label">${s.label}</div>
          </div>`).join('')}
        <div class="stat-card">
          <div class="stat-num">${readThisYear.length}</div>
          <div class="stat-label">Read in ${thisYear}</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${avgRating}</div>
          <div class="stat-label">Avg rating</div>
        </div>
      </div>

      ${langBars ? `
        <div class="stats-section">
          <h3 class="stats-subheading">Books read by language</h3>
          <div class="lang-bars">${langBars}</div>
        </div>` : ''}

      ${readBooks.length ? `
        <div class="stats-section">
          <h3 class="stats-subheading">Recent reads</h3>
          <ul class="recent-reads">
            ${readBooks
              .filter(b => b.dateFinished)
              .sort((a, b) => (b.dateFinished || '').localeCompare(a.dateFinished || ''))
              .slice(0, 5)
              .map(b => `<li>
                <span class="rr-title ${textClass(b.title)}" dir="auto">${escape(b.title)}</span>
                ${b.rating ? starsHTML(b.rating) : ''}
                <span class="rr-date">${fmtDate(b.dateFinished)}</span>
              </li>`)
              .join('')}
          </ul>
        </div>` : ''}
    </div>`;
}

// ─── Star Input Widget ────────────────────────────────────────────────────────

function buildStarInput(containerId, hiddenInputId) {
  const container = document.getElementById(containerId);
  const hidden = document.getElementById(hiddenInputId);

  function render(val) {
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const span = document.createElement('span');
      span.className = 's ' + (val >= i ? 'full' : val >= i - 0.5 ? 'half' : 'empty');
      span.textContent = '★';
      span.dataset.i = i;
      container.appendChild(span);
    }
  }

  function setVal(val) {
    hidden.value = val;
    render(val);
  }

  function handleClick(e) {
    const star = e.target.closest('[data-i]');
    if (!star) return;
    const i = parseInt(star.dataset.i);
    const rect = star.getBoundingClientRect();
    const half = (e.clientX - rect.left) < rect.width / 2;
    const newVal = half ? i - 0.5 : i;
    const current = parseFloat(hidden.value) || 0;
    setVal(current === newVal ? 0 : newVal);
  }

  function handleMouseMove(e) {
    const star = e.target.closest('[data-i]');
    if (!star) return;
    const i = parseInt(star.dataset.i);
    const rect = star.getBoundingClientRect();
    const half = (e.clientX - rect.left) < rect.width / 2;
    render(half ? i - 0.5 : i);
  }

  function handleMouseLeave() {
    render(parseFloat(hidden.value) || 0);
  }

  container.addEventListener('click', handleClick);
  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseleave', handleMouseLeave);

  render(parseFloat(hidden.value) || 0);
  return { setVal };
}

// ─── Quick-search logic ───────────────────────────────────────────────────────

let _searchDebounce = null;
let _cameraStream = null;
let _barcodeInterval = null;

function showQSPanel() {
  document.getElementById('quick-search-panel').classList.remove('hidden');
  document.getElementById('book-form').classList.add('hidden');
  document.getElementById('qs-input').value = '';
  document.getElementById('qs-results').classList.add('hidden');
  document.getElementById('qs-results').innerHTML = '';
  // Show barcode scan button only if BarcodeDetector is available
  document.getElementById('qs-scan-btn').classList.toggle('hidden', !isBarcodeSupported());
  setTimeout(() => document.getElementById('qs-input').focus(), 60);
}

function showFormPanel(book = null) {
  document.getElementById('quick-search-panel').classList.add('hidden');
  document.getElementById('book-form').classList.remove('hidden');
  stopCamera();
  if (book) {
    fillFormFromBook(book);
  }
}

function fillFormFromBook(book) {
  const form = document.getElementById('book-form');
  form.reset();
  document.getElementById('field-id').value = book.id || '';
  document.getElementById('field-thumbnail').value = book.thumbnail || '';
  document.getElementById('field-google-id').value = book.googleId || '';
  document.getElementById('field-title').value = book.title || '';
  document.getElementById('field-author').value = book.author || '';
  document.getElementById('field-language').value = book.language || 'en';
  document.getElementById('field-format').value = book.format || '';
  document.getElementById('field-shelf').value = book.shelf || state.shelf;
  document.getElementById('field-rating').value = book.rating || 0;
  document.getElementById('field-date-started').value = book.dateStarted || '';
  document.getElementById('field-date-finished').value = book.dateFinished || '';
  document.getElementById('field-tags').value = book.tags || '';
  document.getElementById('field-notes').value = book.notes || '';

  if (book.progress) {
    document.getElementById('field-progress-type').value = book.progress.type || 'percent';
    document.getElementById('field-progress-value').value = book.progress.value || '';
  } else {
    document.getElementById('field-progress-type').value = 'percent';
    document.getElementById('field-progress-value').value = '';
  }

  updateProgressVisibility();

  if (!starInputMain) {
    starInputMain = buildStarInput('star-input', 'field-rating');
  }
  starInputMain.setVal(book.rating || 0);

  // Show or hide the preview header
  const previewHeader = document.getElementById('book-preview-header');
  const thumb = document.getElementById('preview-thumb');
  const titleText = document.getElementById('preview-title-text');
  const authorText = document.getElementById('preview-author-text');

  if (book.googleId && (book.title || book.thumbnail)) {
    previewHeader.classList.remove('hidden');
    titleText.textContent = book.title || '';
    authorText.textContent = book.author || '';
    if (book.thumbnail) {
      thumb.src = book.thumbnail;
      thumb.style.display = '';
    } else {
      thumb.style.display = 'none';
    }
  } else {
    previewHeader.classList.add('hidden');
  }

  document.getElementById('btn-delete').classList.toggle('hidden', !book.id);
}

function onQSInput() {
  clearTimeout(_searchDebounce);
  const q = document.getElementById('qs-input').value.trim();
  const results = document.getElementById('qs-results');
  const spinner = document.getElementById('qs-spinner');

  if (!q) {
    results.classList.add('hidden');
    spinner.classList.add('hidden');
    return;
  }

  spinner.classList.remove('hidden');

  _searchDebounce = setTimeout(async () => {
    const books = await searchBooks(q);
    spinner.classList.add('hidden');
    renderQSResults(books);
  }, 350);
}

function renderQSResults(books) {
  const results = document.getElementById('qs-results');
  if (!books.length) {
    results.innerHTML = '<li class="qs-no-results">No results — try a different title or spell it out</li>';
    results.classList.remove('hidden');
    return;
  }

  results.innerHTML = books.map((b, i) => {
    const year = (b.publishedDate || '').slice(0, 4);
    const thumbEl = b.thumbnail
      ? `<img class="qs-result-thumb" src="${escape(b.thumbnail)}" alt="" loading="lazy">`
      : `<div class="qs-result-thumb-placeholder">📖</div>`;
    return `<li class="qs-result-item" role="option" tabindex="0" data-index="${i}">
      ${thumbEl}
      <div class="qs-result-info">
        <div class="qs-result-title">${escape(b.title)}</div>
        <div class="qs-result-author">${escape(b.author)}</div>
        ${year ? `<div class="qs-result-year">${year}</div>` : ''}
      </div>
    </li>`;
  }).join('');

  results.classList.remove('hidden');

  // Store result data for click handler
  results._data = books;
}

function onQSResultClick(e) {
  const item = e.target.closest('.qs-result-item');
  if (!item) return;
  const results = document.getElementById('qs-results');
  const book = results._data[parseInt(item.dataset.index)];
  if (!book) return;
  showFormPanel(book);
}

function onQSResultKeydown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onQSResultClick({ target: e.target });
  }
}

// ─── Camera / barcode scanning ────────────────────────────────────────────────

async function startCamera() {
  const wrap = document.getElementById('qs-camera-wrap');
  const video = document.getElementById('qs-video');
  wrap.classList.remove('hidden');

  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = _cameraStream;
    await video.play();

    // Poll for barcode every 500ms
    _barcodeInterval = setInterval(async () => {
      const code = await detectBarcodeFromVideoFrame(video);
      if (!code) return;
      stopCamera();
      document.getElementById('qs-spinner').classList.remove('hidden');
      const book = await lookupISBN(code);
      document.getElementById('qs-spinner').classList.add('hidden');
      if (book) {
        showFormPanel(book);
      } else {
        // Barcode found but no book match — prefill the search
        document.getElementById('qs-input').value = code;
        await onQSInput();
      }
    }, 500);
  } catch {
    wrap.classList.add('hidden');
    alert('Camera access denied or not available.');
  }
}

function stopCamera() {
  clearInterval(_barcodeInterval);
  _barcodeInterval = null;
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(t => t.stop());
    _cameraStream = null;
  }
  document.getElementById('qs-camera-wrap').classList.add('hidden');
}

// ─── Book Modal ───────────────────────────────────────────────────────────────

let starInputMain = null;

function openBookModal(book = null) {
  const modal = document.getElementById('book-modal');
  document.getElementById('modal-title').textContent = book ? 'Edit Book' : 'Add Book';

  if (book) {
    // Editing existing: skip search panel, go straight to form
    showFormPanel(book);
  } else {
    // New book: show quick-search panel first
    showQSPanel();
    // Reset form defaults for new book
    document.getElementById('book-form').reset();
    document.getElementById('field-id').value = '';
    document.getElementById('field-thumbnail').value = '';
    document.getElementById('field-google-id').value = '';
    document.getElementById('field-shelf').value = state.shelf;
    document.getElementById('book-preview-header').classList.add('hidden');
    document.getElementById('btn-delete').classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeBookModal() {
  stopCamera();
  document.getElementById('book-modal').classList.add('hidden');
}

function updateProgressVisibility() {
  const shelf = document.getElementById('field-shelf').value;
  document.getElementById('progress-group').style.display = shelf === 'reading' ? '' : 'none';
}

async function handleBookSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('field-id').value;
  const shelf = document.getElementById('field-shelf').value;
  const progressValue = document.getElementById('field-progress-value').value;

  const book = {
    title: document.getElementById('field-title').value.trim(),
    author: document.getElementById('field-author').value.trim(),
    language: document.getElementById('field-language').value,
    format: document.getElementById('field-format').value || null,
    shelf,
    rating: parseFloat(document.getElementById('field-rating').value) || 0,
    dateStarted: document.getElementById('field-date-started').value || null,
    dateFinished: document.getElementById('field-date-finished').value || null,
    tags: document.getElementById('field-tags').value.trim(),
    notes: document.getElementById('field-notes').value.trim(),
    thumbnail: document.getElementById('field-thumbnail').value || null,
    googleId: document.getElementById('field-google-id').value || null,
    progress: shelf === 'reading' && progressValue
      ? { type: document.getElementById('field-progress-type').value, value: parseFloat(progressValue) }
      : null,
  };

  if (!book.title || !book.author) {
    alert('Title and author are required.');
    return;
  }

  if (id) {
    await updateBook({ ...book, id: parseInt(id) });
  } else {
    await addBook(book);
  }

  closeBookModal();
  await refreshBooks();
}

// ─── Finish Modal (move to Read) ──────────────────────────────────────────────

let starInputFinish = null;

function openFinishModal(id) {
  state.pendingFinishId = id;
  const modal = document.getElementById('finish-modal');
  document.getElementById('finish-date').value = today();
  document.getElementById('finish-rating').value = '0';

  if (!starInputFinish) {
    starInputFinish = buildStarInput('finish-star-input', 'finish-rating');
  }
  starInputFinish.setVal(0);

  modal.classList.remove('hidden');
}

function closeFinishModal() {
  document.getElementById('finish-modal').classList.add('hidden');
  state.pendingFinishId = null;
}

async function confirmFinish() {
  const id = state.pendingFinishId;
  if (!id) return;
  const book = state.books.find(b => b.id === id);
  if (!book) return;

  const rating = parseFloat(document.getElementById('finish-rating').value) || 0;
  const dateFinished = document.getElementById('finish-date').value || today();

  await updateBook({ ...book, shelf: 'read', rating, dateFinished });
  closeFinishModal();
  await refreshBooks();
}

// ─── Settings / Export / Import ───────────────────────────────────────────────

function openSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function exportData() {
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), books: state.books }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proseandspine-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      const books = Array.isArray(parsed) ? parsed : (parsed.books || []);
      if (!books.length) { alert('No books found in file.'); return; }
      state.pendingImport = books;
      document.getElementById('import-count').textContent = books.length;
      document.getElementById('import-modal').classList.remove('hidden');
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function confirmImport(merge) {
  if (!state.pendingImport) return;
  await importBooks(state.pendingImport, merge);
  state.pendingImport = null;
  document.getElementById('import-modal').classList.add('hidden');
  await refreshBooks();
}

// ─── Data & Navigation ────────────────────────────────────────────────────────

async function refreshBooks() {
  state.books = await getAllBooks();
  renderBooks();
}

function setShelf(shelf) {
  state.shelf = shelf;
  document.querySelectorAll('.shelf-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shelf === shelf);
  });

  const filterBar = document.getElementById('filter-bar');
  filterBar.classList.toggle('hidden', shelf === 'stats');

  renderBooks();
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

function bindEvents() {
  // Shelf nav
  document.querySelectorAll('.shelf-btn').forEach(btn => {
    btn.addEventListener('click', () => setShelf(btn.dataset.shelf));
  });

  // FAB
  document.getElementById('fab').addEventListener('click', () => openBookModal());

  // Settings
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-modal').querySelector('.modal-overlay').addEventListener('click', closeSettings);

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', handleImportFile);

  // Import confirm
  document.getElementById('btn-import-merge').addEventListener('click', () => confirmImport(true));
  document.getElementById('btn-import-replace').addEventListener('click', () => confirmImport(false));
  document.getElementById('btn-import-cancel').addEventListener('click', () => {
    state.pendingImport = null;
    document.getElementById('import-modal').classList.add('hidden');
  });

  // Book modal
  document.getElementById('modal-close').addEventListener('click', closeBookModal);
  document.getElementById('btn-cancel').addEventListener('click', closeBookModal);
  document.getElementById('book-modal').querySelector('.modal-overlay').addEventListener('click', closeBookModal);
  document.getElementById('book-form').addEventListener('submit', handleBookSubmit);
  document.getElementById('field-shelf').addEventListener('change', updateProgressVisibility);

  // Quick-search panel
  document.getElementById('qs-input').addEventListener('input', onQSInput);
  document.getElementById('qs-results').addEventListener('click', onQSResultClick);
  document.getElementById('qs-results').addEventListener('keydown', onQSResultKeydown);
  document.getElementById('qs-manual-btn').addEventListener('click', () => {
    showFormPanel({ shelf: state.shelf });
    // Initialize star input since we're showing the form
    if (!starInputMain) starInputMain = buildStarInput('star-input', 'field-rating');
    starInputMain.setVal(0);
    document.getElementById('book-preview-header').classList.add('hidden');
    setTimeout(() => document.getElementById('field-title').focus(), 60);
  });
  document.getElementById('btn-change-book').addEventListener('click', () => {
    showQSPanel();
  });
  document.getElementById('qs-scan-btn').addEventListener('click', startCamera);
  document.getElementById('qs-camera-close').addEventListener('click', stopCamera);

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = parseInt(document.getElementById('field-id').value);
    if (!id) return;
    if (!confirm('Delete this book?')) return;
    await deleteBook(id);
    closeBookModal();
    await refreshBooks();
  });

  // Finish modal
  document.getElementById('btn-finish-confirm').addEventListener('click', confirmFinish);
  document.getElementById('btn-finish-cancel').addEventListener('click', closeFinishModal);
  document.getElementById('finish-modal').querySelector('.modal-overlay').addEventListener('click', closeFinishModal);

  // Card actions (delegated)
  document.getElementById('books-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === 'edit') {
      const book = state.books.find(b => b.id === id);
      if (book) openBookModal(book);
    } else if (action === 'finish') {
      openFinishModal(id);
    } else if (action === 'start') {
      const book = state.books.find(b => b.id === id);
      if (book) {
        await updateBook({ ...book, shelf: 'reading', dateStarted: book.dateStarted || today() });
        await refreshBooks();
      }
    }
  });

  // Filters
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderBooks();
  });

  document.getElementById('filter-language').addEventListener('change', (e) => {
    state.filterLanguage = e.target.value;
    renderBooks();
  });

  document.getElementById('filter-rating').addEventListener('change', (e) => {
    state.filterRating = e.target.value;
    renderBooks();
  });

  document.getElementById('sort-by').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderBooks();
  });

  // Close modals with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('book-modal').classList.contains('hidden')) closeBookModal();
    else if (!document.getElementById('finish-modal').classList.contains('hidden')) closeFinishModal();
    else if (!document.getElementById('settings-modal').classList.contains('hidden')) closeSettings();
  });
}

// ─── PWA Service Worker ───────────────────────────────────────────────────────

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  bindEvents();
  await refreshBooks();
  registerSW();
}

init();

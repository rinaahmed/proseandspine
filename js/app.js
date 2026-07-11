import { getAllBooks, addBook, updateBook, deleteBook, importBooks, migrateCoverSource } from './db.js';
import { searchBooks, lookupISBN, fetchCoverForBook, getLastCoverError, detectBarcodeFromVideoFrame, isBarcodeSupported } from './books-api.js';
import { parseGoodreadsCSV } from './goodreads.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'ur', label: 'Urdu' },
  { code: 'fr', label: 'French' },
];

const FORMATS = ['paperback', 'hardcover', 'ebook', 'audiobook'];

const COVER_PALETTE = ['#2A4B8D', '#3F6CB0', '#1C7C6B', '#6B4C9A', '#C24D6C', '#2E7D8A'];

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
        <div class="empty-illustration">
          <div class="empty-spine"></div>
          <div class="empty-spine"></div>
          <div class="empty-spine"></div>
          <div class="empty-spine"></div>
          <div class="empty-spine"></div>
        </div>
        <p class="empty-msg">${e.msg || 'Nothing here yet.'}</p>
        <p class="empty-hint">${e.hint || ''}</p>
        <button class="btn-primary" onclick="document.getElementById('fab').click()">Add a book</button>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(book => bookCardHTML(book)).join('');
  bindThumbErrors(grid);
}

function bindThumbErrors(container) {
  container.querySelectorAll('.card-thumb-img').forEach(img => {
    img.addEventListener('error', () => {
      const initial = img.dataset.initial || '?';
      const color = img.dataset.color || COVER_PALETTE[0];
      img.parentElement.outerHTML = `<div class="card-thumb-wrap card-thumb-placeholder" style="background:${color}"><span class="card-thumb-initial">${initial}</span></div>`;
    }, { once: true });
  });
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
  const placeholderColor = COVER_PALETTE[(book.id || 0) % COVER_PALETTE.length];
  const thumbHTML = book.thumbnail
    ? `<div class="card-thumb-wrap">
        <img class="card-thumb-img" src="${escape(book.thumbnail)}" alt="" loading="lazy" data-initial="${escape(thumbInitial)}" data-color="${placeholderColor}">
       </div>`
    : `<div class="card-thumb-wrap card-thumb-placeholder" style="background:${placeholderColor}"><span class="card-thumb-initial">${thumbInitial}</span></div>`;

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
    actionButtons = `<button class="card-action-btn primary" data-action="finish" data-id="${book.id}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Finished</button>`;
  }

  return `
    <article class="book-card" data-id="${book.id}" data-action="edit" role="button" tabindex="0" aria-label="Edit ${escape(book.title)}">
      ${thumbHTML}
      <div class="card-body">
        <h3 class="book-title ${titleClass}" dir="${titleDir}">${escape(book.title)}</h3>
        <p class="book-author ${authorClass}" dir="${authorDir}">${escape(book.author)}</p>
        ${book.rating ? starsHTML(book.rating) : ''}
        ${book.notes ? `<p class="book-notes ${notesClass}" dir="auto">${escape(book.notes)}</p>` : ''}
        ${progressHTML}
        <div class="meta-row">${metaItems.join('')}${tagHTML}</div>
        ${actionButtons ? `<div class="card-actions">${actionButtons}</div>` : ''}
      </div>
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
  const resultsList = document.getElementById('qs-results');
  resultsList.classList.add('hidden');
  resultsList.innerHTML = '';
  resultsList._data = [];
  document.getElementById('qs-spinner').classList.add('hidden');
  document.getElementById('qs-scan-btn').classList.toggle('hidden', !isBarcodeSupported());
  setTimeout(() => document.getElementById('qs-input').focus(), 80);
}

function showFormPanel(book = null) {
  document.getElementById('quick-search-panel').classList.add('hidden');
  document.getElementById('book-form').classList.remove('hidden');
  stopCamera();
  fillFormFromBook(book || {});
  setTimeout(() => document.getElementById('field-title').focus(), 80);
}

function fillFormFromBook(book) {
  document.getElementById('book-form').reset();
  document.getElementById('field-id').value = book.id || '';
  document.getElementById('field-thumbnail').value = book.thumbnail || '';
  document.getElementById('field-open-lib-key').value = book.openLibKey || '';
  document.getElementById('field-title').value = book.title || '';
  document.getElementById('field-author').value = book.author || '';
  document.getElementById('field-language').value = book.language || 'en';
  document.getElementById('field-format').value = book.format || '';
  const shelfVal = book.shelf || state.shelf;
  document.getElementById('field-shelf').value = shelfVal;
  document.querySelectorAll('.shelf-seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.segShelf === shelfVal);
  });
  document.getElementById('field-rating').value = book.rating || 0;
  document.getElementById('field-date-started').value = book.dateStarted || '';
  document.getElementById('field-date-finished').value = book.dateFinished || '';
  document.getElementById('field-tags').value = book.tags || '';
  document.getElementById('field-notes').value = book.description || book.notes || '';

  if (book.progress) {
    document.getElementById('field-progress-type').value = book.progress.type || 'percent';
    document.getElementById('field-progress-value').value = book.progress.value || '';
  } else {
    document.getElementById('field-progress-type').value = 'percent';
    document.getElementById('field-progress-value').value = '';
  }

  updateProgressVisibility();
  if (!starInputMain) starInputMain = buildStarInput('star-input', 'field-rating');
  starInputMain.setVal(book.rating || 0);

  // Preview header — show when we have a search-picked book with title
  const fromSearch = !!(book.openLibKey && book.title);
  const previewHeader = document.getElementById('book-preview-header');
  previewHeader.classList.toggle('hidden', !fromSearch);
  if (fromSearch) {
    document.getElementById('preview-title-text').textContent = book.title;
    document.getElementById('preview-author-text').textContent = book.author || '';
    const thumb = document.getElementById('preview-thumb');
    if (book.thumbnail) { thumb.src = book.thumbnail; thumb.style.display = ''; }
    else { thumb.style.display = 'none'; }
  }

  document.getElementById('btn-delete').classList.toggle('hidden', !book.id);

  initCoverPicker(book);
}

// ─── Cover picker (on-demand Google vs. Claude in the Add/Edit form) ──────────

function initCoverPicker(book) {
  const currentUrl = book.thumbnail || '';
  const currentOpt = document.getElementById('cover-opt-current');
  // The "current" option keeps the book's existing source (edit) or empty for a
  // fresh add (empty → derive the source on save).
  currentOpt.dataset.source = book.coverSource || '';
  currentOpt.dataset.src = currentUrl;

  const curImg = document.getElementById('cover-opt-current-img');
  const curFallback = document.getElementById('cover-opt-current-fallback');
  if (currentUrl) {
    curImg.src = currentUrl; curImg.style.display = '';
    curFallback.classList.add('hidden');
  } else {
    curImg.removeAttribute('src'); curImg.style.display = 'none';
    curFallback.classList.remove('hidden');
  }

  const claudeOpt = document.getElementById('cover-opt-claude');
  claudeOpt.classList.add('hidden');
  claudeOpt.dataset.src = '';

  selectCover('current');

  const status = document.getElementById('cover-picker-status');
  status.classList.add('hidden');
  status.classList.remove('is-error');
  status.textContent = '';
  const btn = document.getElementById('btn-find-cover-claude');
  btn.disabled = false;
  btn.textContent = 'Find cover with Claude';
}

function selectCover(which) { // 'current' | 'claude'
  const current = document.getElementById('cover-opt-current');
  const claude = document.getElementById('cover-opt-claude');
  const chosen = which === 'claude' ? claude : current;
  [current, claude].forEach(o => o.classList.toggle('selected', o === chosen));

  const url = chosen.dataset.src || '';
  document.getElementById('field-thumbnail').value = url;
  document.getElementById('field-cover-source').value = chosen.dataset.source || '';

  // Keep the preview-header thumbnail (if shown) in sync with the choice
  const pth = document.getElementById('preview-thumb');
  if (pth) {
    if (url) { pth.src = url; pth.style.display = ''; }
    else { pth.style.display = 'none'; }
  }
}

async function findCoverWithClaude() {
  const title = document.getElementById('field-title').value.trim();
  const author = document.getElementById('field-author').value.trim();
  const status = document.getElementById('cover-picker-status');
  const btn = document.getElementById('btn-find-cover-claude');

  if (!title) {
    status.classList.remove('hidden');
    status.classList.add('is-error');
    status.textContent = 'Enter a title first.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Searching…';
  status.classList.remove('hidden', 'is-error');
  status.textContent = 'Searching the web for a cover… (~15–30s)';

  const url = await fetchCoverForBook({ title, author });

  if (url) {
    const claudeImg = document.getElementById('cover-opt-claude-img');
    claudeImg.src = url;
    const claudeOpt = document.getElementById('cover-opt-claude');
    claudeOpt.dataset.src = url;
    claudeOpt.classList.remove('hidden');
    selectCover('claude');
    status.classList.add('hidden');
    status.textContent = '';
    btn.disabled = false;
    btn.textContent = 'Find again';
  } else {
    status.classList.remove('hidden');
    status.classList.add('is-error');
    status.textContent = getLastCoverError() || 'No cover found.';
    btn.disabled = false;
    btn.textContent = 'Try again';
  }
}

function onQSInput() {
  clearTimeout(_searchDebounce);
  const q = document.getElementById('qs-input').value.trim();
  const resultsList = document.getElementById('qs-results');
  const spinner = document.getElementById('qs-spinner');

  if (!q) {
    resultsList.classList.add('hidden');
    spinner.classList.add('hidden');
    return;
  }

  spinner.classList.remove('hidden');
  resultsList.classList.add('hidden');

  _searchDebounce = setTimeout(async () => {
    const { results, error } = await searchBooks(q);
    spinner.classList.add('hidden');
    if (error) {
      resultsList.innerHTML = `<li class="qs-result-message qs-error">${error}</li>`;
      resultsList.classList.remove('hidden');
    } else {
      renderQSResults(results, q);
    }
  }, 400);
}

function renderQSResults(books, query) {
  const resultsList = document.getElementById('qs-results');
  resultsList._data = books;

  if (!books.length) {
    resultsList.innerHTML = `<li class="qs-result-message">No results for "<strong>${escape(query)}</strong>" — tap <em>Add title only</em> below.</li>`;
    resultsList.classList.remove('hidden');
    return;
  }

  resultsList.innerHTML = books.map((b, i) => {
    const year = (b.publishedDate || '').slice(0, 4);
    const thumbEl = b.thumbnail
      ? `<img class="qs-result-thumb" src="${escape(b.thumbnail)}" alt="" loading="lazy">`
      : `<div class="qs-result-thumb-placeholder">📖</div>`;
    return `<li class="qs-result-item" role="option" tabindex="0" data-index="${i}">
      ${thumbEl}
      <div class="qs-result-info">
        <div class="qs-result-title" dir="auto">${escape(b.title)}</div>
        <div class="qs-result-author" dir="auto">${escape(b.author)}</div>
        ${year ? `<div class="qs-result-year">${year}</div>` : ''}
      </div>
    </li>`;
  }).join('');

  resultsList.classList.remove('hidden');
}

function onQSResultClick(e) {
  const item = e.target.closest('.qs-result-item');
  if (!item) return;
  const resultsList = document.getElementById('qs-results');
  const book = (resultsList._data || [])[parseInt(item.dataset.index)];
  if (!book) return;
  showFormPanel(book);
}

function onQSResultKeydown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onQSResultClick({ target: e.target });
  }
}

// ─── Camera / barcode ─────────────────────────────────────────────────────────

async function startCamera() {
  const wrap = document.getElementById('qs-camera-wrap');
  const video = document.getElementById('qs-video');
  wrap.classList.remove('hidden');
  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = _cameraStream;
    await video.play();
    _barcodeInterval = setInterval(async () => {
      const code = await detectBarcodeFromVideoFrame(video);
      if (!code) return;
      stopCamera();
      document.getElementById('qs-spinner').classList.remove('hidden');
      const book = await lookupISBN(code);
      document.getElementById('qs-spinner').classList.add('hidden');
      if (book) { showFormPanel(book); }
      else { document.getElementById('qs-input').value = code; onQSInput(); }
    }, 600);
  } catch {
    wrap.classList.add('hidden');
    alert('Camera access denied or not available.');
  }
}

function stopCamera() {
  clearInterval(_barcodeInterval);
  _barcodeInterval = null;
  if (_cameraStream) { _cameraStream.getTracks().forEach(t => t.stop()); _cameraStream = null; }
  document.getElementById('qs-camera-wrap').classList.add('hidden');
}

// ─── Book Modal ───────────────────────────────────────────────────────────────

let starInputMain = null;

function openBookModal(book = null) {
  document.getElementById('modal-title').textContent = book ? 'Edit Book' : 'Add Book';
  if (book) {
    showFormPanel(book);
  } else {
    showQSPanel();
  }
  document.getElementById('book-modal').classList.remove('hidden');
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
    openLibKey: document.getElementById('field-open-lib-key').value || null,
    progress: shelf === 'reading' && progressValue
      ? { type: document.getElementById('field-progress-type').value, value: parseFloat(progressValue) }
      : null,
  };

  if (!book.title || !book.author) {
    alert('Title and author are required.');
    return;
  }

  // The cover picker records the chosen source ('claude', or the book's original
  // source when "Current" is kept). Empty means derive it below.
  const chosenSource = document.getElementById('field-cover-source').value || null;

  if (id) {
    // Merge onto the existing record so fields not in the form (dateAdded,
    // coverSource, …) are preserved.
    const existing = state.books.find(b => b.id === parseInt(id)) || {};
    const coverSource = chosenSource ?? existing.coverSource ?? (book.thumbnail ? 'existing' : null);
    await updateBook({ ...existing, ...book, id: parseInt(id), coverSource });
  } else {
    // New book: a picked Claude cover is 'claude'; an auto cover from search is
    // 'search' (bulk refresh may upgrade it); no cover means it still needs one.
    const coverSource = chosenSource ?? (book.thumbnail ? 'search' : null);
    await addBook({ ...book, coverSource });
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

// ─── Cover Fetching ───────────────────────────────────────────────────────────

let _coverFetchAbort = false;

// Books already handled by Claude (or deliberately set) — bulk refresh skips these.
const COVER_DONE = new Set(['claude', 'manual', 'existing']);

// mode: 'missing' (no cover) | 'refresh' (not yet Claude-done) | 'force' (every book)
async function fetchMissingCovers(books, mode = 'missing') {
  let targets;
  if (mode === 'force') targets = books.slice();
  else if (mode === 'refresh') targets = books.filter(b => !COVER_DONE.has(b.coverSource));
  else targets = books.filter(b => !b.thumbnail);

  const banner = document.getElementById('cover-fetch-banner');
  const bannerText = document.getElementById('cover-fetch-text');
  // status: default (no class) = in-progress slate, 'is-success', 'is-error'
  const setBannerStatus = (s) => {
    banner.classList.remove('is-success', 'is-error');
    if (s) banner.classList.add(s);
  };

  if (!targets.length) {
    setBannerStatus('is-success');
    banner.classList.remove('hidden');
    bannerText.textContent = mode === 'refresh'
      ? 'All covers already up to date — nothing to do.'
      : 'No books need a cover.';
    setTimeout(() => banner.classList.add('hidden'), 4000);
    return;
  }

  _coverFetchAbort = false;
  setBannerStatus(null);
  banner.classList.remove('hidden');

  const verb = mode === 'missing' ? 'Fetching' : 'Refreshing';
  let found = 0;
  let missed = 0;
  for (let i = 0; i < targets.length; i++) {
    if (_coverFetchAbort) break;
    const book = targets[i];
    bannerText.textContent = `${verb} covers… ${i + 1} / ${targets.length}`;

    const coverUrl = await fetchCoverForBook({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
    });

    if (coverUrl) {
      // Store the cover and mark it Claude-done so future refreshes skip it
      await updateBook({ ...book, thumbnail: coverUrl, coverSource: 'claude' });
      found++;
      state.books = await getAllBooks();
    } else {
      missed++;
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  await refreshBooks();

  // Show the outcome — including the last error, so failures are never silent
  let summary = `Updated ${found}, no cover for ${missed}.`;
  const lastErr = getLastCoverError();
  if (found === 0 && lastErr) {
    summary = `No covers updated — ${lastErr}`;
    setBannerStatus('is-error');
  } else {
    setBannerStatus('is-success');
  }
  bannerText.textContent = summary;
  setTimeout(() => banner.classList.add('hidden'), 6000);
}

// ─── Goodreads Import ─────────────────────────────────────────────────────────

function handleGoodreadsFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const { books, error } = parseGoodreadsCSV(ev.target.result);
    if (error) { alert(error); return; }
    state.pendingImport = books;
    document.getElementById('goodreads-count').textContent = books.length;
    document.getElementById('goodreads-modal').classList.remove('hidden');
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function confirmGoodreadsImport(merge) {
  if (!state.pendingImport) return;
  await importBooks(state.pendingImport, merge);
  state.pendingImport = null;
  document.getElementById('goodreads-modal').classList.add('hidden');
  closeSettings();
  await refreshBooks();
  // Kick off background cover fetch for all books without thumbnails
  fetchMissingCovers(state.books, 'missing');
}

// ─── Data & Navigation ────────────────────────────────────────────────────────

function updateShelfCounts() {
  ['reading', 'tbr', 'read'].forEach(shelf => {
    const el = document.getElementById('count-' + shelf);
    if (el) el.textContent = state.books.filter(b => b.shelf === shelf).length;
  });
}

async function refreshBooks() {
  state.books = await getAllBooks();
  updateShelfCounts();
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

  // Fetch missing covers (only books with no cover)
  document.getElementById('btn-fetch-covers')?.addEventListener('click', () => {
    closeSettings();
    fetchMissingCovers(state.books, 'missing');
  });

  // Refresh new covers (only books not yet done by Claude — skips finished ones)
  document.getElementById('btn-refresh-covers')?.addEventListener('click', () => {
    closeSettings();
    fetchMissingCovers(state.books, 'refresh');
  });

  // Force re-fetch EVERY cover (slow + uses tokens) — behind a confirm
  document.getElementById('btn-force-covers')?.addEventListener('click', () => {
    const done = state.books.filter(b => COVER_DONE.has(b.coverSource)).length;
    if (!confirm(`Re-fetch covers for ALL ${state.books.length} books, including ${done} already done? This is slow and uses API tokens.`)) return;
    closeSettings();
    fetchMissingCovers(state.books, 'force');
  });
  document.getElementById('cover-fetch-stop')?.addEventListener('click', () => {
    _coverFetchAbort = true;
    document.getElementById('cover-fetch-banner').classList.add('hidden');
  });

  // Goodreads import
  document.getElementById('btn-goodreads-import').addEventListener('click', () => {
    document.getElementById('goodreads-file').click();
  });
  document.getElementById('goodreads-file').addEventListener('change', handleGoodreadsFile);
  document.getElementById('btn-goodreads-merge').addEventListener('click', () => confirmGoodreadsImport(true));
  document.getElementById('btn-goodreads-replace').addEventListener('click', () => confirmGoodreadsImport(false));
  document.getElementById('btn-goodreads-cancel').addEventListener('click', () => {
    state.pendingImport = null;
    document.getElementById('goodreads-modal').classList.add('hidden');
  });
  document.getElementById('goodreads-modal').querySelector('.modal-overlay').addEventListener('click', () => {
    state.pendingImport = null;
    document.getElementById('goodreads-modal').classList.add('hidden');
  });

  // Book modal
  document.getElementById('modal-close').addEventListener('click', closeBookModal);
  document.getElementById('btn-cancel').addEventListener('click', closeBookModal);
  document.getElementById('book-modal').querySelector('.modal-overlay').addEventListener('click', closeBookModal);
  document.getElementById('book-form').addEventListener('submit', handleBookSubmit);

  // Quick-search panel
  document.getElementById('qs-input').addEventListener('input', onQSInput);
  document.getElementById('qs-results').addEventListener('click', onQSResultClick);
  document.getElementById('qs-results').addEventListener('keydown', onQSResultKeydown);
  document.getElementById('qs-manual-btn').addEventListener('click', () => {
    // Pre-fill title from whatever they typed, then open form
    const typed = document.getElementById('qs-input').value.trim();
    showFormPanel({ title: typed, shelf: state.shelf });
  });
  document.getElementById('btn-change-book').addEventListener('click', () => {
    showQSPanel();
  });
  document.getElementById('qs-scan-btn').addEventListener('click', startCamera);
  document.getElementById('qs-camera-close').addEventListener('click', stopCamera);

  // Cover picker
  document.getElementById('btn-find-cover-claude')?.addEventListener('click', findCoverWithClaude);
  document.getElementById('cover-opt-current')?.addEventListener('click', () => selectCover('current'));
  document.getElementById('cover-opt-claude')?.addEventListener('click', () => selectCover('claude'));

  document.getElementById('btn-delete').addEventListener('click', () => {
    const id = parseInt(document.getElementById('field-id').value);
    if (!id) return;
    document.getElementById('delete-modal').classList.remove('hidden');
  });

  document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
    const id = parseInt(document.getElementById('field-id').value);
    document.getElementById('delete-modal').classList.add('hidden');
    if (!id) return;
    await deleteBook(id);
    closeBookModal();
    await refreshBooks();
  });

  document.getElementById('btn-delete-cancel').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.add('hidden');
  });

  document.getElementById('delete-modal').querySelector('.modal-overlay').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.add('hidden');
  });

  // Finish modal
  document.getElementById('btn-finish-confirm').addEventListener('click', confirmFinish);
  document.getElementById('btn-finish-cancel').addEventListener('click', closeFinishModal);
  document.getElementById('finish-modal').querySelector('.modal-overlay').addEventListener('click', closeFinishModal);

  // Card actions (delegated)
  document.getElementById('books-grid').addEventListener('click', async (e) => {
    // Action buttons inside the card (finish / start) take priority
    const btn = e.target.closest('.card-action-btn[data-action]');
    if (btn) {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === 'finish') { openFinishModal(id); return; }
      if (action === 'start') {
        const book = state.books.find(b => b.id === id);
        if (book) { await updateBook({ ...book, shelf: 'reading', dateStarted: book.dateStarted || today() }); await refreshBooks(); }
        return;
      }
    }
    // Tap anywhere on card → edit
    const card = e.target.closest('.book-card[data-action="edit"]');
    if (!card) return;
    const id = parseInt(card.dataset.id);
    const book = state.books.find(b => b.id === id);
    if (book) openBookModal(book);
  });

  document.getElementById('books-grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.book-card[data-action="edit"]');
    if (!card) return;
    e.preventDefault();
    const book = state.books.find(b => b.id === parseInt(card.dataset.id));
    if (book) openBookModal(book);
  });

  // Filters
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderBooks();
  });

  document.getElementById('sort-by').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    const labels = { dateAdded: 'Recent', title: 'Title', rating: 'Rating', dateFinished: 'Finished' };
    const labelEl = document.getElementById('sort-label');
    if (labelEl) labelEl.textContent = labels[e.target.value] || 'Recent';
    renderBooks();
  });

  // Segmented shelf control in book form
  document.querySelectorAll('.shelf-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shelf-seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const hidden = document.getElementById('field-shelf');
      hidden.value = btn.dataset.segShelf;
      updateProgressVisibility();
    });
  });

  // Close modals with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('delete-modal').classList.contains('hidden')) document.getElementById('delete-modal').classList.add('hidden');
    else if (!document.getElementById('book-modal').classList.contains('hidden')) closeBookModal();
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
  await migrateCoverSource();
  await refreshBooks();
  registerSW();
}

init();

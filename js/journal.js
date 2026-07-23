/* ==========================================================================
   MindMate — journal.js
   Reflection Journal: Add / Edit / Delete entries, search, filter by mood tag,
   and simple stats. Reuses MOOD_OPTIONS + readJSON/writeJSON from app.js.
   ========================================================================== */

let activeFilter = 'all';
let searchTerm = '';
let editingEntryId = null;

/* ---------- Data Helpers ---------- */
function getJournalEntries() {
  return readJSON(JOURNAL_KEY, []);
}

function saveJournalEntries(entries) {
  writeJSON(JOURNAL_KEY, entries);
}

function moodMeta(key) {
  return MOOD_OPTIONS.find((m) => m.key === key);
}

/* ---------- Filter Chips ---------- */
function renderFilterChips() {
  const group = document.getElementById('filterChipGroup');
  if (!group) return;

  const chips = [{ key: 'all', label: 'All', emoji: '✨' }, ...MOOD_OPTIONS.map((m) => ({ key: m.key, label: m.label, emoji: m.emoji }))];

  group.innerHTML = chips.map((c) => `
    <button type="button" class="filter-chip ${activeFilter === c.key ? 'active' : ''}" data-filter="${c.key}">
      ${c.emoji} ${c.label}
    </button>
  `).join('');

  group.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.getAttribute('data-filter');
      renderFilterChips();
      renderEntries();
    });
  });
}

/* ---------- Stats ---------- */
function renderStats() {
  const entries = getJournalEntries();
  const totalEl = document.getElementById('statTotalEntries');
  const weekEl = document.getElementById('statWeekEntries');
  const topMoodEl = document.getElementById('statTopMood');

  if (totalEl) totalEl.textContent = entries.length;

  if (weekEl) {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    const weekCount = entries.filter((e) => new Date(e.timestamp) >= weekAgo).length;
    weekEl.textContent = weekCount;
  }

  if (topMoodEl) {
    const counts = {};
    entries.forEach((e) => (e.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const meta = top ? moodMeta(top) : null;
    topMoodEl.textContent = meta ? `${meta.emoji} ${meta.label}` : '—';
  }
}

/* ---------- Entries Grid ---------- */
function getFilteredEntries() {
  let entries = getJournalEntries().slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (activeFilter !== 'all') {
    entries = entries.filter((e) => (e.tags || []).includes(activeFilter));
  }

  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    entries = entries.filter((e) => (e.title || '').toLowerCase().includes(q));
  }

  return entries;
}

function renderEntries() {
  const grid = document.getElementById('entriesGrid');
  const emptyState = document.getElementById('journalEmptyState');
  const countLabel = document.getElementById('entriesCountLabel');
  if (!grid) return;

  const entries = getFilteredEntries();
  countLabel.textContent = activeFilter === 'all' && !searchTerm
    ? `Showing all ${entries.length} entries`
    : `Showing ${entries.length} matching entr${entries.length === 1 ? 'y' : 'ies'}`;

  if (entries.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    renderStats();
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  grid.innerHTML = entries.map((e) => {
    const moods = (e.tags || []).map(tag => moodMeta(tag)).filter(Boolean);
    const dateLabel = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div class="card card-hover entry-card" data-id="${e.id}">
        <div class="entry-card-top">
          <span class="entry-date">${dateLabel}</span>
          <div class="entry-mood-tags">
  ${moods.map(m => `
    <span class="entry-mood-tag" style="background:${m.color}">
      ${m.emoji} ${m.label}
    </span>
  `).join('')}
</div>
        </div>
        <h3 class="entry-title">
  ${escapeHtml(e.title || "My Journal Entry")}
</h3>
        <p class="entry-text-preview">${escapeHtml(e.text)}</p>
        <div class="entry-card-actions">
          <button type="button" class="entry-action-btn edit-entry" data-id="${e.id}" aria-label="Edit entry"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="entry-action-btn delete delete-entry" data-id="${e.id}" aria-label="Delete entry"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.edit-entry').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(btn.getAttribute('data-id'));
    });
  });

  grid.querySelectorAll('.delete-entry').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEntry(btn.getAttribute('data-id'));
    });
  });

  renderStats();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---------- Delete ---------- */
let deleteEntryId = null;

function deleteEntry(id) {
  deleteEntryId = id;

  const modal = document.getElementById('deleteModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}


function confirmDeleteEntry() {
  const entries = getJournalEntries().filter((e) => e.id !== deleteEntryId);

  saveJournalEntries(entries);
  renderEntries();
  showToast('Entry deleted.');

  closeDeleteModal();
}


function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
  document.body.style.overflow = '';
  deleteEntryId = null;
}

/* ---------- Modal: Add / Edit ---------- */
function renderEmotionTagPicker(selectedTags = []) {
  const picker = document.getElementById('emotionTagPicker');
  picker.innerHTML = MOOD_OPTIONS.map((m) => `
    <button type="button" class="emotion-tag-option ${selectedTags.includes(m.key) ? 'selected' : ''}"
      data-tag="${m.key}" style="${selectedTags.includes(m.key) ? `background:${m.color}; border-color:transparent;` : ''}">
      ${m.emoji} ${m.label}
    </button>
  `).join('');

  picker.querySelectorAll('.emotion-tag-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isSelected = btn.classList.toggle('selected');
      const tag = btn.getAttribute('data-tag');
      const meta = moodMeta(tag);
      if (isSelected) {
        btn.style.background = meta.color;
        btn.style.borderColor = 'transparent';
      } else {
        btn.style.background = '';
        btn.style.borderColor = '';
      }
    });
  });
}

function getSelectedTags() {
  return Array.from(document.querySelectorAll('.emotion-tag-option.selected')).map((b) => b.getAttribute('data-tag'));
}

function openModal(entryId = null) {
  editingEntryId = entryId;

  const modal = document.getElementById('entryModal');
  const title = document.getElementById('modalTitle');
  const textArea = document.getElementById('entryText');
  const titleInput = document.getElementById('entryTitle');

  if (entryId) {
    const entry = getJournalEntries().find((e) => e.id === entryId);

    title.textContent = 'Edit Journal Entry';

    textArea.value = entry ? entry.text : '';
    titleInput.value = entry ? entry.title || '' : '';

    renderEmotionTagPicker(entry ? entry.tags : []);

  } else {

    title.textContent = 'New Journal Entry';

    textArea.value = '';
    titleInput.value = '';

    renderEmotionTagPicker([]);
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
  titleInput.focus();
  titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
}, 150);
}

function closeModal() {
  document.getElementById('entryModal').classList.remove('open');
  document.body.style.overflow = '';
  editingEntryId = null;
}

function initModalControls() {
  document.getElementById('openAddModalBtn').addEventListener('click', () => openModal());
  document.getElementById('emptyStateAddBtn').addEventListener('click', () => openModal());
  document.getElementById('fabAddEntry').addEventListener('click', () => openModal());
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);


  // Delete confirmation modal controls
  document.getElementById('confirmDelete')
    .addEventListener('click', confirmDeleteEntry);

  document.getElementById('cancelDelete')
    .addEventListener('click', closeDeleteModal);

  document.getElementById('closeDeleteModal')
    .addEventListener('click', closeDeleteModal);


  document.getElementById('entryModal').addEventListener('click', (e) => {
    if (e.target.id === 'entryModal') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function initEntryForm() {
  const form = document.getElementById('entryForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('entryTitle').value.trim();
const text = document.getElementById('entryText').value.trim();
const tags = getSelectedTags();

    if (!text) {
      showToast('Write something before saving — even a sentence counts.');
      return;
    }

    const entries = getJournalEntries();

    if (editingEntryId) {
      const idx = entries.findIndex((e) => e.id === editingEntryId);
      if (idx >= 0) {
         entries[idx].title = title || "My Journal Entry";
        entries[idx].text = text;
        entries[idx].tags = tags;
        entries[idx].timestamp = entries[idx].timestamp || new Date().toISOString();
      }
      showToast('Entry updated.');
    } else {
     entries.push({
  id: 'j_' + Date.now(),
  title: title || "My Journal Entry",
  date: todayStr(),
  text,
  tags,
  timestamp: new Date().toISOString()
});
      showToast('Entry saved to your journal.');
    }

    saveJournalEntries(entries);
    closeModal();
    renderEntries();
  });
}

/* ---------- Search ---------- */
function initSearch() {
  const input = document.getElementById('journalSearch');
  input.addEventListener('input', () => {
    searchTerm = input.value;
    renderEntries();
  });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'journal') return;
  renderFilterChips();
  renderEntries();
  initModalControls();
  initEntryForm();
  initSearch();
});
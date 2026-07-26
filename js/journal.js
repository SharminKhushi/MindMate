/* ==========================================================================
   MindMate — journal.js
   Reflection Journal: Add/Edit/Delete, search, filter, stats.
   Fully DB-based via api/journal.php (apiFetch from app.js).
   ========================================================================== */

let activeFilter = 'all';
let searchTerm = '';
let editingEntryId = null;
let deleteEntryId = null;

/* ---------- Data Helpers ---------- */
async function getJournalEntries() {
  const res = await apiFetch('journal.php');
  return res && res.ok ? await res.json() : [];
}

async function createJournalEntry(entry) {
  return apiFetch('journal.php', { method: 'POST', body: JSON.stringify(entry) });
}

async function updateJournalEntry(id, entry) {
  return apiFetch(`journal.php?id=${id}`, { method: 'PUT', body: JSON.stringify(entry) });
}

async function deleteJournalEntryApi(id) {
  return apiFetch(`journal.php?id=${id}`, { method: 'DELETE' });
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
async function renderStats() {
  const entries = await getJournalEntries();
  const totalEl = document.getElementById('statTotalEntries');
  const weekEl = document.getElementById('statWeekEntries');
  const topMoodEl = document.getElementById('statTopMood');

  if (totalEl) totalEl.textContent = entries.length;

  if (weekEl) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekEl.textContent = entries.filter((e) => new Date(e.timestamp) >= weekAgo).length;
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
async function getFilteredEntries() {
  let entries = (await getJournalEntries()).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (activeFilter !== 'all') entries = entries.filter((e) => (e.tags || []).includes(activeFilter));
  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    entries = entries.filter((e) => (e.title || '').toLowerCase().includes(q));
  }
  return entries;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function renderEntries() {
  const grid = document.getElementById('entriesGrid');
  const emptyState = document.getElementById('journalEmptyState');
  const countLabel = document.getElementById('entriesCountLabel');
  if (!grid) return;

  const entries = await getFilteredEntries();
  countLabel.textContent = activeFilter === 'all' && !searchTerm
    ? `Showing all ${entries.length} entries`
    : `Showing ${entries.length} matching entr${entries.length === 1 ? 'y' : 'ies'}`;

  if (entries.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    await renderStats();
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  grid.innerHTML = entries.map((e) => {
    const moods = (e.tags || []).map((tag) => moodMeta(tag)).filter(Boolean);
    const dateLabel = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div class="card card-hover entry-card" data-id="${e.id}">
        <div class="entry-card-top">
          <span class="entry-date">${dateLabel}</span>
          <div class="entry-mood-tags">
            ${moods.map((m) => `<span class="entry-mood-tag" style="background:${m.color}">${m.emoji} ${m.label}</span>`).join('')}
          </div>
        </div>
        <h3 class="entry-title">${escapeHtml(e.title || "My Journal Entry")}</h3>
        <p class="entry-text-preview">${escapeHtml(e.text)}</p>
        <div class="entry-card-actions">
          <button type="button" class="action-btn edit-entry" data-id="${e.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button type="button" class="action-btn danger delete-entry" data-id="${e.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.edit-entry').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openModal(btn.getAttribute('data-id')); });
  });
  grid.querySelectorAll('.delete-entry').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteEntry(btn.getAttribute('data-id')); });
  });

  await renderStats();
}

/* ---------- Delete ---------- */
function deleteEntry(id) {
  deleteEntryId = id;
  document.getElementById('deleteModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function confirmDeleteEntry() {
  await deleteJournalEntryApi(deleteEntryId);
  await renderEntries();
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
      const meta = moodMeta(btn.getAttribute('data-tag'));
      btn.style.background = isSelected ? meta.color : '';
      btn.style.borderColor = isSelected ? 'transparent' : '';
    });
  });
}

function getSelectedTags() {
  return Array.from(document.querySelectorAll('.emotion-tag-option.selected')).map((b) => b.getAttribute('data-tag'));
}

async function openModal(entryId = null) {
  editingEntryId = entryId;
  const modal = document.getElementById('entryModal');
  const title = document.getElementById('modalTitle');
  const textArea = document.getElementById('entryText');
  const titleInput = document.getElementById('entryTitle');

  if (entryId) {
    const entries = await getJournalEntries();
    const entry = entries.find((e) => e.id === entryId);
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
  setTimeout(() => { titleInput.focus(); titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length); }, 150);
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

  document.getElementById('confirmDelete').addEventListener('click', confirmDeleteEntry);
  document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);

  document.getElementById('entryModal').addEventListener('click', (e) => { if (e.target.id === 'entryModal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

function initEntryForm() {
  const form = document.getElementById('entryForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('entryTitle').value.trim();
    const text = document.getElementById('entryText').value.trim();
    const tags = getSelectedTags();

    if (!text) { showToast('Write something before saving — even a sentence counts.'); return; }

    if (editingEntryId) {
      await updateJournalEntry(editingEntryId, { title: title || "My Journal Entry", text, tags });
      showToast('Entry updated.');
    } else {
      await createJournalEntry({ title: title || "My Journal Entry", text, tags, date: todayStr() });
      showToast('Entry saved to your journal.');
    }

    closeModal();
    await renderEntries();
  });
}

/* ---------- Search ---------- */
function initSearch() {
  const input = document.getElementById('journalSearch');
  input.addEventListener('input', () => { searchTerm = input.value; renderEntries(); });
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
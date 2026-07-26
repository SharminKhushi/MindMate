/* ==========================================================================
   MindMate — app.js
   Session, API helper, theme, sidebar, toast, dashboard rendering,
   Self-Help (contacts), Profile (stats/edit/avatar/delete account/password).
   Fully DB-based — localStorage only holds session token + theme preference.
   ========================================================================== */

const SESSION_KEY = 'mindmate_session';
const THEME_KEY = 'mindmate_theme';
const API_BASE = '../api/';

/* ---------- API Helper ---------- */
async function apiFetch(path, options = {}) {
  const session = getSession();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session && session.token) headers['Authorization'] = 'Bearer ' + session.token;

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
    return null;
  }
  return res;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- Session Guard ---------- */
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function requireSession() {
  const session = getSession();
  if (!session || !session.userId) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function logout() {
  await apiFetch('auth.php?action=logout', { method: 'POST' });
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
}

/* ---------- Theme Toggle ---------- */
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  if (savedTheme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    if (themeToggle) themeToggle.setAttribute('aria-pressed', 'true');
  }
  if (!themeToggle) return;
  themeToggle.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
      root.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'light');
      themeToggle.setAttribute('aria-pressed', 'false');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
      themeToggle.setAttribute('aria-pressed', 'true');
    }
  });
}

/* ---------- Password Show/Hide Toggle (used in Change Password modal) ---------- */
function initPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  });
}

/* ---------- Sidebar / Bottom Tab Active State ---------- */
function highlightActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.sidebar-nav a, .bottom-tabbar a').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === current);
  });
}

/* ---------- Sidebar User Card (avatar fetched from profile.php) ---------- */
async function renderSidebarUser(session) {
  const nameEl = document.getElementById('sidebarUserName');
  const emailEl = document.getElementById('sidebarUserEmail');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (!session) return;
  if (nameEl) nameEl.textContent = session.name;
  if (emailEl) emailEl.textContent = session.email;

  if (avatarEl) {
    const res = await apiFetch('profile.php');
    if (res && res.ok) {
      const data = await res.json();
      avatarEl.textContent = data.user.avatar || session.name.trim().charAt(0).toUpperCase();
    } else {
      avatarEl.textContent = session.name.trim().charAt(0).toUpperCase();
    }
  }
}

/* ---------- Logout Confirmation Modal (injected dynamically) ---------- */
function ensureLogoutModal() {
  let modal = document.getElementById('logoutConfirmModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'logoutConfirmModal';
  modal.innerHTML = `
    <div class="card modal-box">
      <div class="modal-head">
        <h3>Log Out</h3>
        <button class="modal-close" id="closeLogoutModalBtn"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p style="margin-bottom:20px;">Are you sure you want to log out?</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancelLogoutBtn">Cancel</button>
        <button class="btn btn-primary" id="confirmLogoutBtn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => { modal.classList.remove('open'); document.body.style.overflow = ''; };
  modal.querySelector('#closeLogoutModalBtn').addEventListener('click', close);
  modal.querySelector('#cancelLogoutBtn').addEventListener('click', close);
  modal.querySelector('#confirmLogoutBtn').addEventListener('click', logout);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  return modal;
}

/* ---------- Toast ---------- */
function ensureToastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

function showToast(message, opts = {}) {
  const stack = ensureToastStack();
  const toast = document.createElement('div');
  toast.className = 'toast' + (opts.badge ? ' toast-badge' : '');
  const icon = opts.icon || (opts.badge ? 'fa-solid fa-trophy' : 'fa-solid fa-circle-check');
  toast.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 220ms ease';
    setTimeout(() => toast.remove(), 240);
  }, 3200);
}

/* ---------- Greeting + Quote ---------- */
function getGreetingPhrase() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatFriendlyDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const QUOTES = [
  { text: "Progress isn't a straight line — showing up today is enough.", author: 'MindMate' },
  { text: 'Small steps still move you forward.', author: 'MindMate' },
  { text: 'You are allowed to rest without earning it.', author: 'MindMate' },
  { text: 'Your feelings are information, not a verdict on you.', author: 'MindMate' },
  { text: "It's okay to not have it all figured out yet.", author: 'MindMate' },
  { text: 'One honest check-in beats a week of pretending.', author: 'MindMate' },
  { text: 'Growth is quiet most days. Keep going anyway.', author: 'MindMate' },
  { text: 'Be as kind to yourself as you are to your friends.', author: 'MindMate' },
  { text: 'You are not behind. You are on your own timeline.', author: 'MindMate' },
  { text: 'Today only asks for effort, not perfection.', author: 'MindMate' }
];

function getTodayQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((new Date() - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

/* ---------- Mood Reference (shared: journal.js, mood.js, app.js) ---------- */
const MOOD_OPTIONS = [
  { key: 'happy', emoji: '🙂', label: 'Happy', color: 'var(--mood-happy)' },
  { key: 'calm', emoji: '😌', label: 'Calm', color: 'var(--mood-calm)' },
  { key: 'neutral', emoji: '😐', label: 'Neutral', color: 'var(--mood-neutral)' },
  { key: 'sad', emoji: '😔', label: 'Sad', color: 'var(--mood-sad)' },
  { key: 'anxious', emoji: '😟', label: 'Anxious', color: 'var(--mood-anxious)' },
  { key: 'stressed', emoji: '😣', label: 'Stressed', color: 'var(--mood-stressed)' }
];

function moodMeta(key) {
  return MOOD_OPTIONS.find((m) => m.key === key);
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
async function renderGreeting(session) {
  const greetEl = document.getElementById('greetingText');
  const dateEl = document.getElementById('greetingDate');
  const moodPillEl = document.getElementById('todayMoodPill');
  if (greetEl) greetEl.textContent = `${getGreetingPhrase()}, ${session.name.split(' ')[0]}`;
  if (dateEl) dateEl.textContent = formatFriendlyDate();

  if (moodPillEl) {
    const res = await apiFetch('checkins.php');
    const checkins = res && res.ok ? await res.json() : [];
    const today = checkins.find((c) => c.date === todayStr());
    if (today) {
      const meta = moodMeta(today.mood);
      moodPillEl.innerHTML = `<span class="emoji">${meta ? meta.emoji : '🙂'}</span><span><strong>${meta ? meta.label : 'Logged'}</strong><span>Today's mood</span></span>`;
    } else {
      moodPillEl.innerHTML = `<span class="emoji">👋</span><span><strong>Not checked in yet</strong><span>Use the card below</span></span>`;
    }
  }
}

function renderQuote() {
  const textEl = document.getElementById('dailyQuoteText');
  const authorEl = document.getElementById('dailyQuoteAuthor');
  const quote = getTodayQuote();
  if (textEl) textEl.textContent = `"${quote.text}"`;
  if (authorEl) authorEl.textContent = `— ${quote.author}`;
}

async function renderMoodChips() {
  const row = document.getElementById('quickMoodRow');
  if (!row) return;

  const res = await apiFetch('checkins.php');
  const checkins = res && res.ok ? await res.json() : [];
  const today = checkins.find((c) => c.date === todayStr());

  row.innerHTML = MOOD_OPTIONS.map((m) => `
    <button type="button" class="mood-chip ${today && today.mood === m.key ? 'selected' : ''}" data-mood="${m.key}" title="${m.label}">${m.emoji}</button>
  `).join('');

  row.querySelectorAll('.mood-chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const moodKey = chip.getAttribute('data-mood');
      await apiFetch('checkins.php', { method: 'POST', body: JSON.stringify({ mood: moodKey }) });
      row.querySelectorAll('.mood-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      showToast(`Logged as ${moodMeta(moodKey).label}. Head to Mood Check-in for a full reflection.`);
      await renderGreeting(getSession());
    });
  });
}

async function renderChallengesPreview() {
  const list = document.getElementById('challengeList');
  const progressText = document.getElementById('challengeProgressText');
  const progressFill = document.getElementById('challengeProgressFill');
  const streakEl = document.getElementById('streakNumber');
  if (!list) return;

  const res = await apiFetch('challenges.php?action=list');
  if (!res || !res.ok) return;
  const data = await res.json();

  if (streakEl) streakEl.textContent = data.streak;

  const preview = data.challenges.slice(0, 3);
  list.innerHTML = preview.map((c) => {
    const done = data.completedToday.includes(c.challenge_key);
    return `
      <div class="challenge-item ${done ? 'done' : ''}" data-key="${c.challenge_key}">
        <button type="button" class="challenge-check" aria-label="Toggle ${c.label}"><i class="fa-solid fa-check"></i></button>
        <div class="challenge-icon"><i class="${c.icon}"></i></div>
        <div class="challenge-info"><strong>${c.label}</strong></div>
      </div>`;
  }).join('');

  const doneCount = data.completedToday.length;
  const totalCount = data.challenges.length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  if (progressText) progressText.textContent = `${doneCount}/${totalCount} completed`;
  if (progressFill) progressFill.style.width = pct + '%';

  list.querySelectorAll('.challenge-item').forEach((item) => {
    item.addEventListener('click', async () => {
      await apiFetch(`challenges.php?action=toggle&key=${encodeURIComponent(item.getAttribute('data-key'))}`, { method: 'POST' });
      await renderChallengesPreview();
    });
  });
}

async function renderBadgePreview() {
  const badgeRow = document.getElementById('badgeRow');
  if (!badgeRow) return;

  const res = await apiFetch('achievements.php');
  if (!res || !res.ok) return;
  const badges = await res.json();

  badgeRow.innerHTML = badges.map((b) => `
    <div class="badge-item ${b.unlocked ? '' : 'locked'}" title="${b.label}">
      <div class="badge-circle"><i class="${b.unlocked ? b.icon : 'fa-solid fa-lock'}"></i></div>
      <span>${b.label}</span>
    </div>`).join('');
}

async function renderJournalPreview() {
  const container = document.getElementById('journalPreviewList');
  if (!container) return;

  const res = await apiFetch('journal.php');
  const allEntries = res && res.ok ? await res.json() : [];
  const entries = allEntries.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 3);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-book-open"></i>
        <p>No journal entries yet. Your thoughts deserve a page.</p>
        <a href="journal.html" class="btn btn-secondary">Write your first entry</a>
      </div>`;
    return;
  }

  container.innerHTML = entries.map((e) => {
    const meta = moodMeta((e.tags && e.tags[0]));
    return `
      <div class="journal-preview-item">
        <span class="journal-mood-dot" style="background:${meta ? meta.color : 'var(--mood-neutral)'}"></span>
        <div class="journal-preview-text">
          <strong>${e.date}</strong>
          <p>${(e.text || '').slice(0, 60)}${e.text && e.text.length > 60 ? '…' : ''}</p>
        </div>
      </div>`;
  }).join('');
}

async function renderGoalsAndHabitsPreview() {
  const goalContainer = document.getElementById('goalProgressBody');
  const habitContainer = document.getElementById('habitProgressBody');

  if (goalContainer) {
    const res = await apiFetch('goals.php');
    const goals = res && res.ok ? await res.json() : [];
    if (goals.length === 0) {
      goalContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-bullseye"></i>
          <p>No goals yet. Set one to start tracking progress.</p>
          <a href="goals.html" class="btn btn-secondary">Add a goal</a>
        </div>`;
    } else {
      const avgPct = Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length);
      goalContainer.innerHTML = `
        <div class="progress-row"><span>${goals.length} active goal${goals.length > 1 ? 's' : ''}</span><span>${avgPct}% avg</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${avgPct}%"></div></div>`;
    }
  }

  if (habitContainer) {
    const res = await apiFetch('habits.php');
    const habits = res && res.ok ? await res.json() : [];
    if (habits.length === 0) {
      habitContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-list-check"></i>
          <p>No habits yet. Build one, one day at a time.</p>
          <a href="goals.html" class="btn btn-secondary">Add a habit</a>
        </div>`;
    } else {
      const today = todayStr();
      const doneToday = habits.filter((h) => h.completedDates && h.completedDates.includes(today)).length;
      const pct = Math.round((doneToday / habits.length) * 100);
      habitContainer.innerHTML = `
        <div class="progress-row"><span>${doneToday}/${habits.length} done today</span><span>${pct}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    }
  }
}

async function renderDashboard() {
  const session = requireSession();
  if (!session) return;

  await renderSidebarUser(session);
  await renderGreeting(session);
  renderQuote();
  await renderMoodChips();
  await renderChallengesPreview();
  await renderBadgePreview();
  await renderJournalPreview();
  await renderGoalsAndHabitsPreview();
}

/* ==========================================================================
   SELF HELP CENTER — topics (static) + contacts (contacts.php)
   ========================================================================== */
const SELFHELP_TOPICS = [
  { id: 'exam-stress', title: 'Exam Stress', icon: 'fa-solid fa-book', color: 'var(--mood-anxious)',
    desc: 'Feeling overwhelmed before tests.',
    tips: ['Break study sessions into 25-minute focused blocks with short breaks.', 'The night before, review key points only — cramming rarely helps.', 'One exam does not define your worth or your future.'] },
  { id: 'peer-pressure', title: 'Peer Pressure', icon: 'fa-solid fa-people-group', color: 'var(--mood-stressed)',
    desc: "Feeling pushed to do things you're not comfortable with.",
    tips: ['A simple "not my thing" is a complete sentence.', 'Real friends respect a no without guilt-tripping.', "It's okay to step away from a group that only feels good when you conform."] },
  { id: 'bullying', title: 'Bullying', icon: 'fa-solid fa-shield-heart', color: 'var(--mood-sad)',
    desc: 'Dealing with unkind or hurtful behavior.',
    tips: ["What's happening to you is not your fault.", 'Keep a record — dates, messages, screenshots.', "Tell a trusted adult, even if it feels small."] },
  { id: 'anxiety', title: 'Anxiety', icon: 'fa-solid fa-leaf', color: 'var(--mood-calm)',
    desc: 'Racing thoughts or a constant sense of worry.',
    tips: ['Try box breathing: in for 4, hold for 4, out for 4, hold for 4.', 'Anxious thoughts feel like facts but often aren\'t.', 'Physical movement can lower anxious energy fast.'] },
  { id: 'loneliness', title: 'Loneliness', icon: 'fa-solid fa-heart', color: 'var(--mood-sad)',
    desc: 'Feeling disconnected, even around other people.',
    tips: ['Loneliness is a signal, not a life sentence.', 'One club or activity can open doors slowly.', 'Quality over quantity in conversations.'] },
  { id: 'low-confidence', title: 'Low Confidence', icon: 'fa-solid fa-face-smile-beam', color: 'var(--mood-neutral)',
    desc: 'Doubting yourself or comparing to others.',
    tips: ['Confidence is built by doing, not waiting to feel ready.', 'Write one thing you did well today.', "Comparison is often unfair."] },
  { id: 'time-management', title: 'Time Management', icon: 'fa-solid fa-clock', color: 'var(--brand-primary)',
    desc: 'Struggling to balance school, life, and rest.',
    tips: ['Write your top 3 priorities each morning.', 'Protect sleep like an appointment you can\'t cancel.', "It's fine to say no to one thing."] }
];

function renderSelfHelpTopics() {
  const grid = document.getElementById('topicsGrid');
  if (!grid) return;

  grid.innerHTML = SELFHELP_TOPICS.map((t) => `
    <div class="card card-hover topic-card" id="topic-${t.id}">
      <div class="topic-card-head">
        <div class="topic-icon" style="background:${t.color}"><i class="${t.icon}"></i></div>
        <h4 style="margin:0;">${t.title}</h4>
        <i class="fa-solid fa-chevron-down topic-toggle-icon"></i>
      </div>
      <p>${t.desc}</p>
      <div class="topic-detail">
        ${t.tips.map((tip) => `<div class="topic-tip"><i class="fa-solid fa-circle-check"></i><span>${tip}</span></div>`).join('')}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.topic-card').forEach((card) => card.addEventListener('click', () => card.classList.toggle('open')));

  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const target = document.getElementById('topic-' + hash);
    if (target) { target.classList.add('open'); setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }
  }
}

let editingContactId = null;
let deleteContactId = null;

async function getContactsApi() {
  const res = await apiFetch('contacts.php');
  return res && res.ok ? await res.json() : [];
}

async function renderContacts() {
  const list = document.getElementById('contactsList');
  if (!list) return;
  const contacts = await getContactsApi();

  if (contacts.length === 0) {
    list.innerHTML = `<p style="font-size:0.85rem; color:var(--text-secondary);">No contacts added yet.</p>`;
    return;
  }

  list.innerHTML = contacts.map((c) => `
    <div class="contact-item">
      <div class="contact-avatar">${c.name.charAt(0).toUpperCase()}</div>
      <div class="contact-info"><strong>${c.name}</strong><span>${c.relation}</span></div>
      <button type="button" class="action-btn edit-contact" data-id="${c.id}"><i class="fa-solid fa-pen"></i> Edit</button>
      <button type="button" class="action-btn danger delete-contact" data-id="${c.id}"><i class="fa-solid fa-trash"></i> Delete</button>
    </div>
  `).join('');

  list.querySelectorAll('.edit-contact').forEach((btn) => btn.addEventListener('click', () => openContactEdit(btn.getAttribute('data-id'))));
  list.querySelectorAll('.delete-contact').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteContactId = btn.getAttribute('data-id');
      document.getElementById('contactDeleteModal').classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });
}

async function openContactEdit(id) {
  editingContactId = id;
  const contacts = await getContactsApi();
  const contact = contacts.find((c) => c.id === id);
  if (!contact) return;
  document.getElementById('contactName').value = contact.name;
  document.getElementById('contactRelation').value = contact.relation;
  document.querySelector('#contactForm button[type="submit"]').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Contact';
  document.getElementById('contactName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function confirmContactDelete() {
  await apiFetch(`contacts.php?id=${deleteContactId}`, { method: 'DELETE' });
  await renderContacts();
  showToast('Contact deleted.');
  closeContactDeleteModal();
}

function closeContactDeleteModal() {
  document.getElementById('contactDeleteModal').classList.remove('open');
  document.body.style.overflow = '';
  deleteContactId = null;
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  document.getElementById('confirmContactDelete').addEventListener('click', confirmContactDelete);
  document.getElementById('cancelContactDelete').addEventListener('click', closeContactDeleteModal);
  document.getElementById('closeContactDeleteModal').addEventListener('click', closeContactDeleteModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('contactName').value.trim();
    const relation = document.getElementById('contactRelation').value.trim();
    if (!name || !relation) return;

    if (editingContactId) {
      await apiFetch(`contacts.php?id=${editingContactId}`, { method: 'PUT', body: JSON.stringify({ name, relation }) });
      showToast('Contact updated.');
    } else {
      await apiFetch('contacts.php', { method: 'POST', body: JSON.stringify({ name, relation }) });
      showToast('Contact added.');
    }

    editingContactId = null;
    form.reset();
    document.querySelector('#contactForm button[type="submit"]').innerHTML = '<i class="fa-solid fa-plus"></i> Add';
    await renderContacts();
  });
}

function initSelfHelpPage() {
  renderSelfHelpTopics();
  renderContacts();
  initContactForm();
}

/* ==========================================================================
   PROFILE & SETTINGS — stats + edit (modal) + avatar + delete account +
   change password (modal)
   ========================================================================== */
const AVATAR_EMOJIS = ['🙂', '😌', '🌟', '🌈', '🐱', '🐶', '🦊', '🐼', '🌸', '🍀', '⚡', '🎧'];

async function loadProfileData() {
  const res = await apiFetch('profile.php');
  return res && res.ok ? await res.json() : null;
}

async function renderProfileHeader() {
  const data = await loadProfileData();
  if (!data) return null;
  const { user, stats } = data;

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const ageEl = document.getElementById('profileAge');
  const avatarBig = document.getElementById('profileAvatarLarge');

  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = user.email;
  if (ageEl && user.age) ageEl.textContent = `Age ${user.age}`;
  if (avatarBig) avatarBig.textContent = user.avatar || '🙂';

  const sinceStat = document.getElementById('statMemberSince');
  if (sinceStat) sinceStat.textContent = new Date(user.created_at.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const j = document.getElementById('summaryJournalCount');
  const c = document.getElementById('summaryCheckinCount');
  const g = document.getElementById('summaryGoalsCount');
  const a = document.getElementById('summaryAchievementsCount');
  const s = document.getElementById('summaryStreak');
  if (j) j.textContent = stats.journalCount;
  if (c) c.textContent = stats.checkinCount;
  if (g) g.textContent = stats.goalsCount;
  if (a) a.textContent = stats.achievementsCount;
  if (s) s.textContent = stats.streak;

  return user;
}

async function renderAvatarPicker(currentAvatar) {
  const grid = document.getElementById('avatarPickerGrid');
  if (!grid) return;

  grid.innerHTML = AVATAR_EMOJIS.map((a) => `
    <button type="button" class="avatar-option ${a === currentAvatar ? 'selected' : ''}" data-avatar="${a}">${a}</button>
  `).join('');

  grid.querySelectorAll('.avatar-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const avatar = btn.getAttribute('data-avatar');
      const res = await apiFetch('profile.php', { method: 'PUT', body: JSON.stringify({ avatar, name: document.getElementById('editName').value, email: document.getElementById('editEmail').value, age: document.getElementById('editAge').value }) });
      if (res && res.ok) {
        grid.querySelectorAll('.avatar-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('profileAvatarLarge').textContent = avatar;
        await renderSidebarUser(getSession());
        showToast('Avatar updated.');
      }
    });
  });
}

function initSettingsThemeToggleSync() {
  const settingsToggle = document.getElementById('settingsThemeToggle');
  if (!settingsToggle) return;
  const root = document.documentElement;

  if (root.getAttribute('data-theme') === 'dark') settingsToggle.setAttribute('aria-pressed', 'true');

  settingsToggle.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
      root.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'light');
      settingsToggle.setAttribute('aria-pressed', 'false');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
      settingsToggle.setAttribute('aria-pressed', 'true');
    }
  });
}

function initEditProfileForm(user) {
  const form = document.getElementById('editProfileForm');
  if (!form || !user) return;

  document.getElementById('editName').value = user.name;
  document.getElementById('editEmail').value = user.email;
  document.getElementById('editAge').value = user.age || '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim().toLowerCase();
    const age = document.getElementById('editAge').value;

    const res = await apiFetch('profile.php', { method: 'PUT', body: JSON.stringify({ name, email, age }) });
    if (res && res.ok) {
      const session = getSession();
      session.name = name;
      session.email = email;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      await renderProfileHeader();
      await renderSidebarUser(session);

      const editModal = document.getElementById('editProfileModal');
      if (editModal) { editModal.classList.remove('open'); document.body.style.overflow = ''; }

      showToast('Profile updated.');
    } else if (res) {
      const data = await res.json();
      showToast(data.error || 'Could not update profile.');
    }
  });
}

function initDeleteAccount() {
  const btn = document.getElementById('deleteAccountBtn');
  const modal = document.getElementById('deleteAccountModal');
  if (!btn || !modal) return;

  btn.addEventListener('click', () => { modal.classList.add('open'); document.body.style.overflow = 'hidden'; });
  document.getElementById('closeDeleteAccountModal').addEventListener('click', () => { modal.classList.remove('open'); document.body.style.overflow = ''; });
  document.getElementById('cancelDeleteAccount').addEventListener('click', () => { modal.classList.remove('open'); document.body.style.overflow = ''; });

  document.getElementById('confirmDeleteAccount').addEventListener('click', async () => {
    await apiFetch('auth.php?action=delete-account', { method: 'POST' });
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '../index.html';
  });
}

function initChangePasswordForm() {
  const form = document.getElementById('changePasswordForm');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      showToast('New password must be different from your current password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    const res = await apiFetch('auth.php?action=change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (res && res.ok) {
      const passwordModal = document.getElementById('changePasswordModal');
      if (passwordModal) { passwordModal.classList.remove('open'); document.body.style.overflow = ''; }
      showToast('Password updated successfully.');
      form.reset();
    } else if (res) {
      const data = await res.json();
      showToast(data.error || 'Could not update password.');
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-key"></i> Update Password';
  });
}

/* Opens/closes the Edit Profile and Change Password modals from their
   respective "Edit Profile" / "Update Password" action buttons on the page. */
function initProfileModals() {
  const editModal = document.getElementById('editProfileModal');
  const passwordModal = document.getElementById('changePasswordModal');
  const openEditBtn = document.getElementById('openEditProfileModalBtn');
  const openPasswordBtn = document.getElementById('openPasswordModalBtn');

  if (editModal && openEditBtn) {
    const openEdit = () => { editModal.classList.add('open'); document.body.style.overflow = 'hidden'; };
    const closeEdit = () => { editModal.classList.remove('open'); document.body.style.overflow = ''; };
    openEditBtn.addEventListener('click', openEdit);
    const closeBtn = document.getElementById('closeEditProfileModal');
    const cancelBtn = document.getElementById('cancelEditProfile');
    if (closeBtn) closeBtn.addEventListener('click', closeEdit);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEdit);
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEdit(); });
  }

  if (passwordModal && openPasswordBtn) {
    const openPassword = () => { passwordModal.classList.add('open'); document.body.style.overflow = 'hidden'; };
    const closePassword = () => { passwordModal.classList.remove('open'); document.body.style.overflow = ''; };
    openPasswordBtn.addEventListener('click', openPassword);
    const closeBtn = document.getElementById('closePasswordModal');
    const cancelBtn = document.getElementById('cancelPasswordChange');
    if (closeBtn) closeBtn.addEventListener('click', closePassword);
    if (cancelBtn) cancelBtn.addEventListener('click', closePassword);
    passwordModal.addEventListener('click', (e) => { if (e.target === passwordModal) closePassword(); });
  }
}

async function initProfilePage() {
  initSettingsThemeToggleSync();
  initDeleteAccount();
  initChangePasswordForm();
  initProfileModals();
  initPasswordToggles();

  try {
    const user = await renderProfileHeader();
    await renderAvatarPicker(user ? user.avatar : '🙂');
    initEditProfileForm(user);
  } catch (err) {
    console.error('Profile data failed to load:', err);
    showToast('Could not load your profile data. Check your connection and refresh.');
  }
}

/* ---------- Global Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const session = requireSession();
  if (!session) return;

  initThemeToggle();
  highlightActiveNav();
  renderSidebarUser(session);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    const modal = ensureLogoutModal();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  const page = document.body.getAttribute('data-page');
  if (page === 'dashboard') renderDashboard();
  if (page === 'selfhelp') initSelfHelpPage();
  if (page === 'profile') initProfilePage();
});
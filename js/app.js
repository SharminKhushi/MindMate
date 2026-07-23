/* ==========================================================================
   MindMate — app.js
   Shared logic for every authenticated page (dashboard.html onward):
   - Session guard + logout
   - Theme toggle (single source of truth from here on)
   - Sidebar / bottom-tab active state
   - Greeting + daily quote
   - Daily Wellness Challenges (LocalStorage, resets per calendar day)
   - Streak calculation + Achievement badges
   - Dashboard widget rendering (mood, journal, goals — reads shared keys
     so journal.js / goals.js / mood.js "just work" once built, no changes
     needed here later)
   - Toast helper

   Shared LocalStorage keys (contract for all feature JS files):
     mindmate_users      -> [{id, name, age, email, password, createdAt}]
     mindmate_session     -> {userId, name, email, loginAt}
     mindmate_theme        -> 'light' | 'dark'
     mindmate_checkins      -> [{date:'YYYY-MM-DD', mood, stress, energy, sleep, timestamp}]
     mindmate_journal        -> [{id, date:'YYYY-MM-DD', text, tags:[], timestamp}]
     mindmate_goals            -> [{id, title, targetDate, createdAt}]
     mindmate_habits            -> [{id, title, completedDates:['YYYY-MM-DD',...]}]
     mindmate_challenges          -> {date:'YYYY-MM-DD', completed:['drink_water',...]}

   MULTI-USER NOTE:
   Every key above (except mindmate_users, mindmate_session, mindmate_theme)
   is automatically namespaced per logged-in user by readJSON()/writeJSON()
   below, e.g. mindmate_journal_u_1690000000000. See scopedKey().
   ========================================================================== */

const SESSION_KEY = 'mindmate_session';
const THEME_KEY = 'mindmate_theme';
const CHECKINS_KEY = 'mindmate_checkins';
const JOURNAL_KEY = 'mindmate_journal';
const GOALS_KEY = 'mindmate_goals';
const HABITS_KEY = 'mindmate_habits';
const CHALLENGES_KEY = 'mindmate_challenges';

/* ---------- Generic Storage Helpers ---------- */
/* Keys that must stay global (not tied to one user). Everything else that
   flows through readJSON/writeJSON is automatically namespaced with the
   logged-in user's userId, so each user's data is fully isolated. */
const GLOBAL_KEYS = ['mindmate_users', 'mindmate_session', 'mindmate_theme'];

function scopedKey(key) {
  if (GLOBAL_KEYS.includes(key)) return key;
  const session = getSession();
  return session && session.userId ? `${key}_${session.userId}` : key;
}

function readJSON(key, fallback) {
  try {
    const val = JSON.parse(localStorage.getItem(scopedKey(key)));
    return val === null || val === undefined ? fallback : val;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(scopedKey(key), JSON.stringify(value));
}

function removeJSON(key) {
  localStorage.removeItem(scopedKey(key));
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- Session Guard ---------- */
function getSession() {
  return readJSON(SESSION_KEY, null);
}

function requireSession() {
  const session = getSession();
  if (!session || !session.userId) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

function logout() {
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

/* ---------- Sidebar / Bottom Tab Active State ---------- */
function highlightActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.sidebar-nav a, .bottom-tabbar a').forEach((link) => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href === current);
  });
}

/* ---------- Sidebar User Card ---------- */
function renderSidebarUser(session) {
  const nameEl = document.getElementById('sidebarUserName');
  const emailEl = document.getElementById('sidebarUserEmail');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (!session) return;
  if (nameEl) nameEl.textContent = session.name;
  if (emailEl) emailEl.textContent = session.email;
  if (avatarEl) avatarEl.textContent = session.name.trim().charAt(0).toUpperCase();
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

/* ---------- Greeting ---------- */
function getGreetingPhrase() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatFriendlyDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/* ---------- Daily Quotes ---------- */
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
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

/* ---------- Mood Reference (shared with mood.js later) ---------- */
const MOOD_OPTIONS = [
  { key: 'happy', emoji: '🙂', label: 'Happy', color: 'var(--mood-happy)' },
  { key: 'calm', emoji: '😌', label: 'Calm', color: 'var(--mood-calm)' },
  { key: 'neutral', emoji: '😐', label: 'Neutral', color: 'var(--mood-neutral)' },
  { key: 'sad', emoji: '😔', label: 'Sad', color: 'var(--mood-sad)' },
  { key: 'anxious', emoji: '😟', label: 'Anxious', color: 'var(--mood-anxious)' },
  { key: 'stressed', emoji: '😣', label: 'Stressed', color: 'var(--mood-stressed)' }
];

function getCheckins() {
  return readJSON(CHECKINS_KEY, []);
}

function getTodayCheckin() {
  return getCheckins().find((c) => c.date === todayStr()) || null;
}

/* Quick check-in from the dashboard mood-chip row (mood only).
   mood.html's full form will upsert the same record with stress/energy/sleep. */
function quickSaveMood(moodKey) {
  const checkins = getCheckins();
  const today = todayStr();
  const idx = checkins.findIndex((c) => c.date === today);
  const moodMeta = MOOD_OPTIONS.find((m) => m.key === moodKey);
  const record = idx >= 0 ? { ...checkins[idx] } : { date: today };
  record.mood = moodKey;
  record.timestamp = new Date().toISOString();
  if (idx >= 0) {
    checkins[idx] = record;
  } else {
    checkins.push(record);
  }
  writeJSON(CHECKINS_KEY, checkins);
  return moodMeta;
}

/* ---------- Streak Calculation ---------- */
/* Counts consecutive calendar days (ending today or yesterday) with
   at least one check-in OR at least one completed challenge. */
function calcStreak() {
  const checkins = getCheckins();
  const challenges = readJSON(CHALLENGES_KEY, {});
  const activeDates = new Set(checkins.map((c) => c.date));
  if (challenges.date && challenges.completed && challenges.completed.length > 0) {
    activeDates.add(challenges.date);
  }

  let streak = 0;
  let cursor = new Date();

  // If nothing logged today yet, streak counts through yesterday.
  if (!activeDates.has(todayStr())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0') + '-' + String(cursor.getDate()).padStart(2, '0');
    if (activeDates.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/* ---------- Daily Wellness Challenges ---------- */
const CHALLENGE_DEFS = [
  { id: 'drink_water', label: 'Drink Water', desc: '8 glasses today', icon: 'fa-solid fa-glass-water' },
  { id: 'walk', label: 'Walk 15 Minutes', desc: 'Anywhere counts', icon: 'fa-solid fa-person-walking' },
  { id: 'study', label: 'Study 30 Minutes', desc: 'Any subject', icon: 'fa-solid fa-book' },
  { id: 'meditate', label: 'Meditate', desc: '5 minutes of quiet', icon: 'fa-solid fa-spa' }
];

function getChallengeState() {
  const state = readJSON(CHALLENGES_KEY, { date: todayStr(), completed: [] });
  if (state.date !== todayStr()) {
    // New day — reset.
    return { date: todayStr(), completed: [] };
  }
  return state;
}

function toggleChallenge(id) {
  const state = getChallengeState();
  const isDone = state.completed.includes(id);
  state.completed = isDone
    ? state.completed.filter((c) => c !== id)
    : [...state.completed, id];
  writeJSON(CHALLENGES_KEY, state);
  return state;
}

/* ---------- Badges / Achievements ---------- */
function getBadgeDefs() {
  return [
    { id: 'first_checkin', label: 'First Check-in', icon: 'fa-solid fa-seedling', test: () => getCheckins().length >= 1 },
    { id: 'streak_3', label: '3-Day Streak', icon: 'fa-solid fa-fire', test: () => calcStreak() >= 3 },
    { id: 'streak_7', label: '7-Day Streak', icon: 'fa-solid fa-fire-flame-curved', test: () => calcStreak() >= 7 },
    { id: 'challenge_master', label: 'All Challenges Done', icon: 'fa-solid fa-medal', test: () => {
        const s = getChallengeState();
        return s.completed.length >= CHALLENGE_DEFS.length;
      } },
    { id: 'journal_writer', label: 'First Journal Entry', icon: 'fa-solid fa-pen-nib', test: () => readJSON(JOURNAL_KEY, []).length >= 1 },
    { id: 'goal_setter', label: 'First Goal Set', icon: 'fa-solid fa-bullseye', test: () => readJSON(GOALS_KEY, []).length >= 1 }
  ];
}

/* ==========================================================================
   DASHBOARD RENDERING
   ========================================================================== */
function renderGreeting(session) {
  const greetEl = document.getElementById('greetingText');
  const dateEl = document.getElementById('greetingDate');
  const moodPillEl = document.getElementById('todayMoodPill');
  if (greetEl) greetEl.textContent = `${getGreetingPhrase()}, ${session.name.split(' ')[0]}`;
  if (dateEl) dateEl.textContent = formatFriendlyDate();

  if (moodPillEl) {
    const today = getTodayCheckin();
    if (today) {
      const meta = MOOD_OPTIONS.find((m) => m.key === today.mood);
      moodPillEl.innerHTML = `
        <span class="emoji">${meta ? meta.emoji : '🙂'}</span>
        <span>
          <strong>${meta ? meta.label : 'Logged'}</strong>
          <span>Today's mood</span>
        </span>`;
    } else {
      moodPillEl.innerHTML = `
        <span class="emoji">👋</span>
        <span>
          <strong>Not checked in yet</strong>
          <span>Use the card below</span>
        </span>`;
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

function renderMoodChips() {
  const row = document.getElementById('quickMoodRow');
  if (!row) return;
  const today = getTodayCheckin();

  row.innerHTML = MOOD_OPTIONS.map((m) => `
    <button type="button" class="mood-chip ${today && today.mood === m.key ? 'selected' : ''}"
      data-mood="${m.key}" aria-label="${m.label}" title="${m.label}">${m.emoji}</button>
  `).join('');

  row.querySelectorAll('.mood-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const meta = quickSaveMood(chip.getAttribute('data-mood'));
      row.querySelectorAll('.mood-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      showToast(`Logged as ${meta.label}. Head to Mood Check-in for a full reflection.`);
      renderGreeting(getSession());
      renderStreakAndBadges();
    });
  });
}

function renderChallenges() {
  const list = document.getElementById('challengeList');
  const progressText = document.getElementById('challengeProgressText');
  const progressFill = document.getElementById('challengeProgressFill');
  if (!list) return;

  const state = getChallengeState();

  list.innerHTML = CHALLENGE_DEFS.map((c) => {
    const done = state.completed.includes(c.id);
    return `
      <div class="challenge-item ${done ? 'done' : ''}" data-id="${c.id}">
        <button type="button" class="challenge-check" aria-label="Toggle ${c.label}">
          <i class="fa-solid fa-check"></i>
        </button>
        <div class="challenge-icon"><i class="${c.icon}"></i></div>
        <div class="challenge-info">
          <strong>${c.label}</strong>
          <span>${c.desc}</span>
        </div>
      </div>`;
  }).join('');

  const pct = Math.round((state.completed.length / CHALLENGE_DEFS.length) * 100);
  if (progressText) progressText.textContent = `${state.completed.length}/${CHALLENGE_DEFS.length} completed`;
  if (progressFill) progressFill.style.width = pct + '%';

  list.querySelectorAll('.challenge-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const wasAllDone = getChallengeState().completed.length === CHALLENGE_DEFS.length;
      toggleChallenge(id);
      renderChallenges();
      renderStreakAndBadges();
      const nowAllDone = getChallengeState().completed.length === CHALLENGE_DEFS.length;
      if (!wasAllDone && nowAllDone) {
        showToast('All challenges complete for today! Badge unlocked.', { badge: true });
      }
    });
  });
}

function renderStreakAndBadges() {
  const streakEl = document.getElementById('streakNumber');
  const badgeRow = document.getElementById('badgeRow');
  const streak = calcStreak();
  if (streakEl) streakEl.textContent = streak;

  if (badgeRow) {
    const defs = getBadgeDefs();
    badgeRow.innerHTML = defs.map((b) => {
      const unlocked = b.test();
      return `
        <div class="badge-item ${unlocked ? '' : 'locked'}" title="${b.label}">
          <div class="badge-circle"><i class="${unlocked ? b.icon : 'fa-solid fa-lock'}"></i></div>
          <span>${b.label}</span>
        </div>`;
    }).join('');
  }
}

function renderJournalPreview() {
  const container = document.getElementById('journalPreviewList');
  if (!container) return;
  const entries = readJSON(JOURNAL_KEY, []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 3);

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
    const moodMeta = MOOD_OPTIONS.find((m) => m.key === (e.tags && e.tags[0]));
    return `
      <div class="journal-preview-item">
        <span class="journal-mood-dot" style="background:${moodMeta ? moodMeta.color : 'var(--mood-neutral)'}"></span>
        <div class="journal-preview-text">
          <strong>${e.date}</strong>
          <p>${(e.text || '').slice(0, 60)}${e.text && e.text.length > 60 ? '…' : ''}</p>
        </div>
      </div>`;
  }).join('');
}

function renderGoalProgress() {
  const container = document.getElementById('goalProgressBody');
  if (!container) return;
  const goals = readJSON(GOALS_KEY, []);

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-bullseye"></i>
        <p>No goals yet. Set one to start tracking progress.</p>
        <a href="goals.html" class="btn btn-secondary">Add a goal</a>
      </div>`;
    return;
  }

  const goal = goals[0];
  const pct = goal.progress || 0;
  container.innerHTML = `
    <p style="font-size:0.9rem; color:var(--text-primary); margin-bottom:var(--sp-3);">${goal.title}</p>
    <div class="progress-row"><span>${pct}% complete</span><span>${goals.length} goal${goals.length > 1 ? 's' : ''} total</span></div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
  `;
}

function renderHabitProgress() {
  const container = document.getElementById('habitProgressBody');
  if (!container) return;
  const habits = readJSON(HABITS_KEY, []);

  if (habits.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-list-check"></i>
        <p>No habits yet. Build one, one day at a time.</p>
        <a href="goals.html" class="btn btn-secondary">Add a habit</a>
      </div>`;
    return;
  }

  const today = todayStr();
  const doneToday = habits.filter((h) => h.completedDates && h.completedDates.includes(today)).length;
  const pct = Math.round((doneToday / habits.length) * 100);
  container.innerHTML = `
    <div class="progress-row"><span>${doneToday}/${habits.length} done today</span><span>${pct}%</span></div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
  `;
}

function renderDashboard() {
  const session = requireSession();
  if (!session) return;

  renderSidebarUser(session);
  renderGreeting(session);
  renderQuote();
  renderMoodChips();
  renderChallenges();
  renderStreakAndBadges();
  renderJournalPreview();
  renderGoalProgress();
  renderHabitProgress();
}

/* ==========================================================================
   SELF HELP CENTER — topic accordions + simple trusted contacts
   ========================================================================== */
const CONTACTS_KEY = 'mindmate_contacts';

const SELFHELP_TOPICS = [
  { id: 'exam-stress', title: 'Exam Stress', icon: 'fa-solid fa-book', color: 'var(--mood-anxious)',
    desc: 'Feeling overwhelmed before tests.',
    tips: ['Break study sessions into 25-minute focused blocks with short breaks.', 'The night before, review key points only — cramming new material rarely helps.', 'Remind yourself: one exam does not define your worth or your future.'] },
  { id: 'peer-pressure', title: 'Peer Pressure', icon: 'fa-solid fa-people-group', color: 'var(--mood-stressed)',
    desc: 'Feeling pushed to do things you\'re not comfortable with.',
    tips: ['A simple "not my thing" is a complete sentence — you don\'t owe an explanation.', 'Real friends respect a no without making you feel guilty.', 'It\'s okay to step away from a group that only feels good when you go along with everything.'] },
  { id: 'bullying', title: 'Bullying', icon: 'fa-solid fa-shield-heart', color: 'var(--mood-sad)',
    desc: 'Dealing with unkind or hurtful behavior.',
    tips: ['What\'s happening to you is not your fault, no matter what anyone says.', 'Keep a record of what happened — dates, messages, screenshots.', 'Tell a trusted adult, even if it feels small. You don\'t have to handle it alone.'] },
  { id: 'anxiety', title: 'Anxiety', icon: 'fa-solid fa-leaf', color: 'var(--mood-calm)',
    desc: 'Racing thoughts or a constant sense of worry.',
    tips: ['Try box breathing: in for 4, hold for 4, out for 4, hold for 4.', 'Anxious thoughts feel like facts but often aren\'t — ask "what\'s the evidence?"', 'Physical movement, even a short walk, can lower anxious energy fast.'] },
  { id: 'loneliness', title: 'Loneliness', icon: 'fa-solid fa-heart', color: 'var(--mood-sad)',
    desc: 'Feeling disconnected, even around other people.',
    tips: ['Loneliness is a signal, not a life sentence — small reach-outs count.', 'Joining one club or activity you\'re curious about can open doors slowly.', 'Quality over quantity: one real conversation beats a hundred surface ones.'] },
  { id: 'low-confidence', title: 'Low Confidence', icon: 'fa-solid fa-face-smile-beam', color: 'var(--mood-neutral)',
    desc: 'Doubting yourself or comparing to others.',
    tips: ['Confidence is built by doing, not by waiting to feel ready first.', 'Write down one thing you did well today, however small.', 'Comparison is often unfair — you\'re seeing someone else\'s highlight reel.'] },
  { id: 'time-management', title: 'Time Management', icon: 'fa-solid fa-clock', color: 'var(--brand-primary)',
    desc: 'Struggling to balance school, life, and rest.',
    tips: ['Write your top 3 priorities each morning — not a 20-item list.', 'Protect sleep like an appointment you can\'t cancel.', 'It\'s fine to say no to one thing so you can do another thing well.'] }
];

function renderSelfHelpTopics() {
  const grid = document.getElementById('topicsGrid');
  if (!grid) return;

  grid.innerHTML = SELFHELP_TOPICS.map((t) => `
    <div class="card card-hover topic-card" data-id="${t.id}" id="topic-${t.id}">
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

  grid.querySelectorAll('.topic-card').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('open'));
  });

  // Deep-link support, e.g. selfhelp.html#anxiety
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const target = document.getElementById('topic-' + hash);
    if (target) {
      target.classList.add('open');
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }
}

function getContacts() {
  return readJSON(CONTACTS_KEY, []);
}

function renderContacts() {
  const list = document.getElementById('contactsList');
  if (!list) return;
  const contacts = getContacts();

  if (contacts.length === 0) {
    list.innerHTML = `<p style="font-size:0.85rem; color:var(--text-secondary);">No contacts added yet.</p>`;
    return;
  }

  list.innerHTML = contacts.map((c) => `
    <div class="contact-item">
      <div class="contact-avatar">${c.name.charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <strong>${c.name}</strong>
        <span>${c.relation}</span>
      </div>
      <button type="button" class="entry-action-btn delete delete-contact" data-id="${c.id}" aria-label="Remove contact"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('');

  list.querySelectorAll('.delete-contact').forEach((btn) => {
    btn.addEventListener('click', () => {
      writeJSON(CONTACTS_KEY, getContacts().filter((c) => c.id !== btn.getAttribute('data-id')));
      renderContacts();
    });
  });
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contactName').value.trim();
    const relation = document.getElementById('contactRelation').value.trim();
    if (!name || !relation) return;

    const contacts = getContacts();
    contacts.push({ id: 'c_' + Date.now(), name, relation });
    writeJSON(CONTACTS_KEY, contacts);
    form.reset();
    renderContacts();
    showToast('Contact added.');
  });
}

function initSelfHelpPage() {
  renderSelfHelpTopics();
  renderContacts();
  initContactForm();
}

/* ==========================================================================
   PROFILE & SETTINGS
   ========================================================================== */
const AVATAR_EMOJIS = ['🙂', '😌', '🌟', '🌈', '🐱', '🐶', '🦊', '🐼', '🌸', '🍀', '⚡', '🎧'];
const AVATAR_KEY = 'mindmate_avatar';

function renderProfileHeader(session) {
  const users = readJSON('mindmate_users', []);
  const user = users.find((u) => u.id === session.userId) || session;
  const avatar = localStorage.getItem(scopedKey(AVATAR_KEY)) || '🙂';

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const ageEl = document.getElementById('profileAge');
  const avatarBig = document.getElementById('profileAvatarLarge');

  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = user.email;
  if (ageEl && user.age) ageEl.textContent = `Age ${user.age}`;
  if (avatarBig) avatarBig.textContent = avatar;

  const accName = document.getElementById('accountName');
  const accEmail = document.getElementById('accountEmail');
  const accSince = document.getElementById('accountSince');
  if (accName) accName.textContent = user.name;
  if (accEmail) accEmail.textContent = user.email;
  if (accSince) accSince.textContent = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—';
}

function renderAvatarPicker() {
  const grid = document.getElementById('avatarPickerGrid');
  if (!grid) return;
  const current = localStorage.getItem(scopedKey(AVATAR_KEY)) || '🙂';

  grid.innerHTML = AVATAR_EMOJIS.map((a) => `
    <button type="button" class="avatar-option ${a === current ? 'selected' : ''}" data-avatar="${a}">${a}</button>
  `).join('');

  grid.querySelectorAll('.avatar-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      localStorage.setItem(scopedKey(AVATAR_KEY), btn.getAttribute('data-avatar'));
      grid.querySelectorAll('.avatar-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('profileAvatarLarge').textContent = btn.getAttribute('data-avatar');
      showToast('Avatar updated.');
    });
  });
}

function initSettingsThemeToggleSync() {
  // The settings page has a second theme toggle switch that must mirror the topbar one.
  const settingsToggle = document.getElementById('settingsThemeToggle');
  if (!settingsToggle) return;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === 'dark') settingsToggle.setAttribute('aria-pressed', 'true');
  settingsToggle.addEventListener('click', () => {
    document.getElementById('themeToggle').click();
    settingsToggle.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
  });
}

function initDataControls() {
  const exportBtn = document.getElementById('exportDataBtn');
  const clearBtn = document.getElementById('clearDataBtn');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = {
        checkins: readJSON(CHECKINS_KEY, []),
        journal: readJSON(JOURNAL_KEY, []),
        goals: readJSON(GOALS_KEY, []),
        habits: readJSON(HABITS_KEY, []),
        contacts: readJSON(CONTACTS_KEY, [])
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mindmate-my-data.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Your data has been exported.');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm('This will permanently delete all your check-ins, journal entries, goals, and habits on this device. Continue?')) return;
      [CHECKINS_KEY, JOURNAL_KEY, GOALS_KEY, HABITS_KEY, CHALLENGES_KEY, CONTACTS_KEY].forEach((k) => removeJSON(k));
      showToast('All data cleared.');
      setTimeout(() => window.location.href = 'dashboard.html', 900);
    });
  }
}

function initProfilePage(session) {
  renderProfileHeader(session);
  renderAvatarPicker();
  initSettingsThemeToggleSync();
  initDataControls();
}

/* ---------- Global Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const session = requireSession();
  if (!session) return; // redirected to login

  initThemeToggle();
  highlightActiveNav();
  renderSidebarUser(session);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  const page = document.body.getAttribute('data-page');
  if (page === 'dashboard') renderDashboard();
  if (page === 'selfhelp') initSelfHelpPage();
  if (page === 'profile') initProfilePage(session);
});
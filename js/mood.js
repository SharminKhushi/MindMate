/* ==========================================================================
   MindMate — mood.js
   Mood Check-in form, Smart Suggestion engine, Weekly/Monthly analytics.
   Fully DB-based via api/checkins.php. moodMeta() comes from app.js.
   ========================================================================== */

let selectedMood = null;
let currentRange = 'weekly';
let moodChartInstance = null;

const MOOD_SCORE = { happy: 6, calm: 5, neutral: 4, anxious: 3, sad: 2, stressed: 1 };

async function getCheckinsApi() {
  const res = await apiFetch('checkins.php');
  return res && res.ok ? await res.json() : [];
}

async function getTodayCheckinApi() {
  const checkins = await getCheckinsApi();
  return checkins.find((c) => c.date === todayStr()) || null;
}

/* ---------- Check-in Form UI ---------- */
async function renderMoodOptions() {
  const grid = document.getElementById('checkinMoodGrid');
  if (!grid) return;

  const today = await getTodayCheckinApi();
  if (today && today.mood) selectedMood = today.mood;

  grid.innerHTML = MOOD_OPTIONS.map((m) => `
    <button type="button" class="checkin-mood-option ${selectedMood === m.key ? 'selected' : ''}" data-mood="${m.key}">
      <span class="emoji">${m.emoji}</span>
      <span>${m.label}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.checkin-mood-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMood = btn.getAttribute('data-mood');
      grid.querySelectorAll('.checkin-mood-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

async function initSliders() {
  const stress = document.getElementById('stressSlider');
  const stressVal = document.getElementById('stressValue');
  const energy = document.getElementById('energySlider');
  const energyVal = document.getElementById('energyValue');

  stress.addEventListener('input', () => (stressVal.textContent = stress.value));
  energy.addEventListener('input', () => (energyVal.textContent = energy.value));

  const today = await getTodayCheckinApi();
  if (today) {
    if (today.stress) { stress.value = today.stress; stressVal.textContent = today.stress; }
    if (today.energy) { energy.value = today.energy; energyVal.textContent = today.energy; }
    if (today.sleep) document.getElementById('sleepInput').value = today.sleep;
  }
}

function initSleepQuickButtons() {
  const input = document.getElementById('sleepInput');
  document.querySelectorAll('.sleep-quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = btn.getAttribute('data-val');
      document.querySelectorAll('.sleep-quick-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

/* ---------- Smart Mood Companion ---------- */
function getSmartSuggestion(mood, stress, energy, sleep) {
  if (stress >= 4 && sleep < 6) {
    return { icon: 'fa-solid fa-wind', title: "Let's ease that stress",
      text: 'High stress and short sleep are a tough combo. Try a 5-minute breathing exercise before anything else today.',
      linkText: 'Try Calm Corner', linkHref: 'calm.html' };
  }
  if (mood === 'sad') {
    return { icon: 'fa-solid fa-heart', title: 'Sending you a little lift',
      text: "It's okay to have heavy days. A short walk or a message to a friend can help more than it seems.",
      linkText: 'Explore Self-Help', linkHref: 'selfhelp.html#loneliness' };
  }
  if (mood === 'happy' && energy >= 4) {
    return { icon: 'fa-solid fa-star', title: "You're on a roll!",
      text: 'Great mood, great energy — a good moment to lock in a habit or tackle something you\'ve been putting off.',
      linkText: 'Check your streak', linkHref: 'dashboard.html' };
  }
  if (mood === 'anxious' && stress >= 3) {
    return { icon: 'fa-solid fa-leaf', title: "Let's ground you",
      text: 'Try the 5-4-3-2-1 technique: 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste.',
      linkText: 'See Anxiety resources', linkHref: 'selfhelp.html#anxiety' };
  }
  if (energy <= 2 && sleep < 6) {
    return { icon: 'fa-solid fa-mug-hot', title: 'Your body is asking for rest',
      text: "Low energy plus short sleep isn't a productivity problem — it's a rest problem.",
      linkText: null, linkHref: null };
  }
  return { icon: 'fa-solid fa-feather', title: 'Steady as you go',
    text: 'Nothing urgent today — a great moment to write a quick journal entry.',
    linkText: 'Write in your Journal', linkHref: 'journal.html' };
}

function initCheckinForm() {
  const form = document.getElementById('checkinForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedMood) { showToast('Pick a mood first — even a guess is fine.'); return; }

    const stress = Number(document.getElementById('stressSlider').value);
    const energy = Number(document.getElementById('energySlider').value);
    const sleepRaw = document.getElementById('sleepInput').value;
    const sleep = sleepRaw === '' ? 7 : Number(sleepRaw);

    await apiFetch('checkins.php', {
      method: 'POST',
      body: JSON.stringify({ mood: selectedMood, stress, energy, sleep })
    });

    const suggestion = getSmartSuggestion(selectedMood, stress, energy, sleep);
    showCompanionResult(suggestion);
    showToast('Check-in saved.');
    await renderAnalytics();
  });
}

function showCompanionResult(s) {
  const box = document.getElementById('companionResult');
  document.getElementById('companionIcon').className = s.icon;
  document.getElementById('companionTitle').textContent = s.title;
  document.getElementById('companionText').textContent = s.text;

  const link = document.getElementById('companionLink');
  if (s.linkHref) {
    link.href = s.linkHref;
    document.getElementById('companionLinkText').textContent = s.linkText;
    link.style.display = 'inline-flex';
  } else {
    link.style.display = 'none';
  }

  box.classList.add('show');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Analytics ---------- */
function initAnalyticsTabs() {
  document.querySelectorAll('.analytics-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.analytics-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentRange = tab.getAttribute('data-range');
      renderAnalytics();
    });
  });
}

async function getWeeklyData() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    days.push({ key, label: d.toLocaleDateString('en-US', { weekday: 'short' }) });
  }
  const checkins = await getCheckinsApi();
  return days.map((d) => {
    const entry = checkins.find((c) => c.date === d.key);
    return { label: d.label, score: entry ? MOOD_SCORE[entry.mood] : null };
  });
}

async function getMonthlyData() {
  const checkins = await getCheckinsApi();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const recent = checkins.filter((c) => new Date(c.date) >= monthAgo);

  const counts = {};
  MOOD_OPTIONS.forEach((m) => (counts[m.key] = 0));
  recent.forEach((c) => { if (counts[c.mood] !== undefined) counts[c.mood]++; });
  return { counts };
}

async function renderChart() {
  const ctx = document.getElementById('moodChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (moodChartInstance) moodChartInstance.destroy();

  const styles = getComputedStyle(document.documentElement);
  const brand = styles.getPropertyValue('--brand-primary').trim() || '#6C63FF';
  const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#6B6B7B';
  const gridColor = styles.getPropertyValue('--border-soft').trim() || '#E7E5F5';

  if (currentRange === 'weekly') {
    const data = await getWeeklyData();
    moodChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: data.map((d) => d.label), datasets: [{ label: 'Mood', data: data.map((d) => d.score), borderColor: brand, backgroundColor: brand, tension: 0.4, spanGaps: true, pointRadius: 5, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { min: 1, max: 6, ticks: { color: textSecondary, stepSize: 1 }, grid: { color: gridColor } }, x: { ticks: { color: textSecondary }, grid: { display: false } } } }
    });
  } else {
    const { counts } = await getMonthlyData();
    moodChartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: MOOD_OPTIONS.map((m) => m.label), datasets: [{ label: 'Times logged', data: MOOD_OPTIONS.map((m) => counts[m.key]), backgroundColor: brand, borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { color: textSecondary, precision: 0 }, grid: { color: gridColor } }, x: { ticks: { color: textSecondary }, grid: { display: false } } } }
    });
  }
}

async function renderSummary() {
  const checkins = await getCheckinsApi();
  let periodEntries = [];

  if (currentRange === 'weekly') {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    periodEntries = checkins.filter((c) => new Date(c.date) >= weekAgo);
    document.getElementById('summaryCountLabel').textContent = 'check-ins this week';
  } else {
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    periodEntries = checkins.filter((c) => new Date(c.date) >= monthAgo);
    document.getElementById('summaryCountLabel').textContent = 'check-ins this month';
  }

  document.getElementById('summaryCount').textContent = periodEntries.length;

  if (periodEntries.length === 0) {
    document.getElementById('summaryAvgEmoji').textContent = '🙂';
    document.getElementById('summaryAvgLabel').textContent = '—';
    document.getElementById('summaryTopEmoji').textContent = '🙂';
    document.getElementById('summaryTopLabel').textContent = '—';
    return;
  }

  const avgScore = Math.round(periodEntries.reduce((sum, c) => sum + (MOOD_SCORE[c.mood] || 4), 0) / periodEntries.length);
  const avgMoodKey = Object.keys(MOOD_SCORE).find((k) => MOOD_SCORE[k] === avgScore) || 'neutral';
  const avgMeta = moodMeta(avgMoodKey);
  document.getElementById('summaryAvgEmoji').textContent = avgMeta ? avgMeta.emoji : '🙂';
  document.getElementById('summaryAvgLabel').textContent = avgMeta ? avgMeta.label : '—';

  const counts = {};
  periodEntries.forEach((c) => (counts[c.mood] = (counts[c.mood] || 0) + 1));
  const topKey = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const topMeta = moodMeta(topKey);
  document.getElementById('summaryTopEmoji').textContent = topMeta ? topMeta.emoji : '🙂';
  document.getElementById('summaryTopLabel').textContent = topMeta ? topMeta.label : '—';
}

async function renderAnalytics() {
  await renderChart();
  await renderSummary();
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'mood') return;
  renderMoodOptions();
  initSliders();
  initSleepQuickButtons();
  initCheckinForm();
  initAnalyticsTabs();
  renderAnalytics();
});
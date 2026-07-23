/* ==========================================================================
   MindMate — mood.js
   Full Mood Check-in form (mood + stress + energy + sleep), the Smart Mood
   Companion rule-based suggestion engine, and Weekly/Monthly Chart.js
   analytics + emotional summary. Reads/writes mindmate_checkins (shared
   with app.js's quick dashboard check-in).
   ========================================================================== */

let selectedMood = null;
let currentRange = 'weekly';
let moodChartInstance = null;

/* Numeric score for trend charting: higher = more positive/regulated. */
const MOOD_SCORE = { happy: 6, calm: 5, neutral: 4, anxious: 3, sad: 2, stressed: 1 };

/* ---------- Check-in Form UI ---------- */
function renderMoodOptions() {
  const grid = document.getElementById('checkinMoodGrid');
  if (!grid) return;

  const today = getTodayCheckin();
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

function initSliders() {
  const stress = document.getElementById('stressSlider');
  const stressVal = document.getElementById('stressValue');
  const energy = document.getElementById('energySlider');
  const energyVal = document.getElementById('energyValue');

  stress.addEventListener('input', () => (stressVal.textContent = stress.value));
  energy.addEventListener('input', () => (energyVal.textContent = energy.value));

  const today = getTodayCheckin();
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

/* ==========================================================================
   SMART MOOD COMPANION — rule-based recommendation engine
   Inputs: mood (string key), stress (1-5), energy (1-5), sleep (hours)
   Rules are checked in priority order; first match wins.
   ========================================================================== */
function getSmartSuggestion(mood, stress, energy, sleep) {
  if (stress >= 4 && sleep < 6) {
    return {
      icon: 'fa-solid fa-wind',
      title: 'Let\'s ease that stress',
      text: 'High stress and short sleep are a tough combo. Try a 5-minute breathing exercise before anything else today — in for 4 counts, hold for 4, out for 6. Your to-do list can wait a few minutes.',
      linkText: 'See Exam Stress tips',
      linkHref: 'selfhelp.html#exam-stress'
    };
  }

  if (mood === 'sad') {
    return {
      icon: 'fa-solid fa-heart',
      title: 'Sending you a little lift',
      text: 'It\'s okay to have heavy days. You don\'t have to fix everything right now — just be gentle with yourself. A short walk or a message to a friend can help more than it seems.',
      linkText: 'Explore Loneliness &amp; Low Confidence',
      linkHref: 'selfhelp.html#loneliness'
    };
  }

  if (mood === 'happy' && energy >= 4) {
    return {
      icon: 'fa-solid fa-star',
      title: 'You\'re on a roll!',
      text: 'Great mood, great energy — this is a good moment to lock in a habit or tackle something you\'ve been putting off. Keep the momentum going.',
      linkText: 'Check your streak',
      linkHref: 'dashboard.html'
    };
  }

  if (mood === 'anxious' && stress >= 3) {
    return {
      icon: 'fa-solid fa-leaf',
      title: 'Let\'s ground you',
      text: 'Try the 5-4-3-2-1 technique: name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. It brings your mind back to right now.',
      linkText: 'See Anxiety resources',
      linkHref: 'selfhelp.html#anxiety'
    };
  }

  if (energy <= 2 && sleep < 6) {
    return {
      icon: 'fa-solid fa-mug-hot',
      title: 'Your body is asking for rest',
      text: 'Low energy plus short sleep isn\'t a productivity problem — it\'s a rest problem. Give yourself permission to slow down today, even just a little.',
      linkText: null,
      linkHref: null
    };
  }

  return {
    icon: 'fa-solid fa-feather',
    title: 'Steady as you go',
    text: 'Nothing urgent today — that\'s a good thing. This might be a great moment to write a quick journal entry and capture how today actually felt.',
    linkText: 'Write in your Journal',
    linkHref: 'journal.html'
  };
}

/* ---------- Form Submit ---------- */
function initCheckinForm() {
  const form = document.getElementById('checkinForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!selectedMood) {
      showToast('Pick a mood first — even a guess is fine.');
      return;
    }

    const stress = Number(document.getElementById('stressSlider').value);
    const energy = Number(document.getElementById('energySlider').value);
    const sleepRaw = document.getElementById('sleepInput').value;
    const sleep = sleepRaw === '' ? 7 : Number(sleepRaw);

    // Upsert today's check-in (merges with the dashboard's quick mood save if present).
    const checkins = getCheckins();
    const today = todayStr();
    const idx = checkins.findIndex((c) => c.date === today);
    const record = { date: today, mood: selectedMood, stress, energy, sleep, timestamp: new Date().toISOString() };
    if (idx >= 0) checkins[idx] = record; else checkins.push(record);
    writeJSON(CHECKINS_KEY, checkins);

    const suggestion = getSmartSuggestion(selectedMood, stress, energy, sleep);
    showCompanionResult(suggestion);
    showToast('Check-in saved.');
    renderAnalytics();
  });
}

function showCompanionResult(s) {
  const box = document.getElementById('companionResult');
  document.getElementById('companionIcon').className = s.icon;
  document.getElementById('companionTitle').textContent = s.title;
  document.getElementById('companionText').innerHTML = s.text;

  const link = document.getElementById('companionLink');
  if (s.linkHref) {
    link.href = s.linkHref;
    document.getElementById('companionLinkText').innerHTML = s.linkText;
    link.style.display = 'inline-flex';
  } else {
    link.style.display = 'none';
  }

  box.classList.add('show');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ==========================================================================
   ANALYTICS — Weekly / Monthly Chart.js + Emotional Summary
   ========================================================================== */
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

function getWeeklyData() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    days.push({ key, label: d.toLocaleDateString('en-US', { weekday: 'short' }) });
  }
  const checkins = getCheckins();
  return days.map((d) => {
    const entry = checkins.find((c) => c.date === d.key);
    return { label: d.label, score: entry ? MOOD_SCORE[entry.mood] : null, mood: entry ? entry.mood : null };
  });
}

function getMonthlyData() {
  const checkins = getCheckins();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const recent = checkins.filter((c) => new Date(c.date) >= monthAgo);

  const counts = {};
  MOOD_OPTIONS.forEach((m) => (counts[m.key] = 0));
  recent.forEach((c) => { if (counts[c.mood] !== undefined) counts[c.mood]++; });

  return { recent, counts };
}

function renderChart() {
  const ctx = document.getElementById('moodChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (moodChartInstance) {
    moodChartInstance.destroy();
  }

  const styles = getComputedStyle(document.documentElement);
  const brand = styles.getPropertyValue('--brand-primary').trim() || '#6C63FF';
  const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#6B6B7B';
  const gridColor = styles.getPropertyValue('--border-soft').trim() || '#E7E5F5';

  if (currentRange === 'weekly') {
    const data = getWeeklyData();
    moodChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((d) => d.label),
        datasets: [{
          label: 'Mood',
          data: data.map((d) => d.score),
          borderColor: brand,
          backgroundColor: brand,
          tension: 0.4,
          spanGaps: true,
          pointRadius: 5,
          pointBackgroundColor: brand,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 1, max: 6,
            ticks: {
              color: textSecondary,
              stepSize: 1,
              callback: (val) => {
                const found = Object.keys(MOOD_SCORE).find((k) => MOOD_SCORE[k] === val);
                return found ? found.charAt(0).toUpperCase() + found.slice(1) : '';
              }
            },
            grid: { color: gridColor }
          },
          x: { ticks: { color: textSecondary }, grid: { display: false } }
        }
      }
    });
  } else {
    const { counts } = getMonthlyData();
    moodChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: MOOD_OPTIONS.map((m) => m.label),
        datasets: [{
          label: 'Times logged (last 30 days)',
          data: MOOD_OPTIONS.map((m) => counts[m.key]),
          backgroundColor: MOOD_OPTIONS.map((m) => {
            const varName = m.color.match(/--[a-z-]+/)[0];
            return styles.getPropertyValue(varName).trim() || brand;
          }),
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: textSecondary, precision: 0 }, grid: { color: gridColor } },
          x: { ticks: { color: textSecondary }, grid: { display: false } }
        }
      }
    });
  }
}

function renderSummary() {
  const checkins = getCheckins();
  let periodEntries = [];

  if (currentRange === 'weekly') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    periodEntries = checkins.filter((c) => new Date(c.date) >= weekAgo);
    document.getElementById('summaryCountLabel').textContent = 'check-ins this week';
  } else {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
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

function renderAnalytics() {
  renderChart();
  renderSummary();
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
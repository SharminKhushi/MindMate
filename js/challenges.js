/* ==========================================================================
   MindMate — challenges.js
   Daily Wellness Challenges: list, toggle, streak (with grace day),
   and customization. Talks to api/challenges.php via apiFetch() (app.js).
   ========================================================================== */

let currentChallenges = [];
let customEditList = [];

/* ---------- Load + Render ---------- */
async function loadChallenges() {
  const res = await apiFetch('challenges.php?action=list');
  if (!res || !res.ok) return null;
  return await res.json();
}

async function renderChallenges() {
  const data = await loadChallenges();
  if (!data) return;

  currentChallenges = data.challenges;
  const list = document.getElementById('challengeList');
  const progressText = document.getElementById('challengeProgressText');
  const progressFill = document.getElementById('challengeProgressFill');
  const streakEl = document.getElementById('streakNumber');
  const graceStatusEl = document.getElementById('graceDayStatus');
  const useGraceBtn = document.getElementById('useGraceBtn');

  if (streakEl) streakEl.textContent = data.streak;

  if (graceStatusEl) {
    graceStatusEl.textContent = data.graceDayUsedThisWeek
      ? 'Rest day already used this week — see you tomorrow!'
      : '1 rest day available this week';
  }
  if (useGraceBtn) useGraceBtn.style.display = data.graceDayUsedThisWeek ? 'none' : 'inline-flex';

  if (!list) return;

  list.innerHTML = currentChallenges.map((c) => {
    const done = data.completedToday.includes(c.challenge_key);
    return `
      <div class="challenge-item ${done ? 'done' : ''}" data-key="${c.challenge_key}">
        <button type="button" class="challenge-check" aria-label="Toggle ${c.label}"><i class="fa-solid fa-check"></i></button>
        <div class="challenge-icon"><i class="${c.icon}"></i></div>
        <div class="challenge-info"><strong>${c.label}</strong></div>
      </div>`;
  }).join('');

  const doneCount = data.completedToday.length;
  const totalCount = currentChallenges.length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  if (progressText) progressText.textContent = `${doneCount}/${totalCount} completed`;
  if (progressFill) progressFill.style.width = pct + '%';

  list.querySelectorAll('.challenge-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const key = item.getAttribute('data-key');
      const wasAllDone = doneCount === totalCount;
      await apiFetch(`challenges.php?action=toggle&key=${encodeURIComponent(key)}`, { method: 'POST' });
      await renderChallenges();
      const newData = await loadChallenges();
      const nowAllDone = newData.completedToday.length === totalCount;
      if (!wasAllDone && nowAllDone) {
        showToast("All challenges done today — nice work! 🎉", { badge: true });
      }
    });
  });
}

/* ---------- Grace Day ---------- */
function initGraceDay() {
  const btn = document.getElementById('useGraceBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const res = await apiFetch('challenges.php?action=use-grace', { method: 'POST' });
    if (res && res.ok) {
      showToast("Rest day used — your streak is safe. Take care of yourself today.");
      await renderChallenges();
    } else if (res) {
      const data = await res.json();
      showToast(data.error || 'Could not use rest day.');
    }
  });
}

/* ---------- Customize Modal ---------- */
function renderCustomizeList() {
  const container = document.getElementById('customizeList');
  container.innerHTML = customEditList.map((c, idx) => `
    <div class="customize-row" data-idx="${idx}">
      <input type="text" class="customize-label-input" value="${c.label}" placeholder="Challenge name">
      <button type="button" class="action-btn danger remove-custom-btn" data-idx="${idx}"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('');

  container.querySelectorAll('.customize-label-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.closest('.customize-row').getAttribute('data-idx'));
      customEditList[idx].label = e.target.value;
    });
  });

  container.querySelectorAll('.remove-custom-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      customEditList.splice(idx, 1);
      renderCustomizeList();
    });
  });
}

function initCustomizeModal() {
  const modal = document.getElementById('customizeModal');
  const openBtn = document.getElementById('customizeBtn');
  const closeBtn = document.getElementById('closeCustomizeModal');
  const cancelBtn = document.getElementById('cancelCustomizeBtn');
  const saveBtn = document.getElementById('saveCustomizeBtn');
  const addBtn = document.getElementById('addCustomChallengeBtn');

  const open = () => {
    customEditList = currentChallenges.map((c) => ({ label: c.label, icon: c.icon }));
    renderCustomizeList();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  const close = () => { modal.classList.remove('open'); document.body.style.overflow = ''; };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  addBtn.addEventListener('click', () => {
    if (customEditList.length >= 6) {
      showToast('You can have up to 6 challenges.');
      return;
    }
    customEditList.push({ label: '', icon: 'fa-solid fa-star' });
    renderCustomizeList();
  });

  saveBtn.addEventListener('click', async () => {
    const cleaned = customEditList.filter((c) => c.label.trim() !== '');
    if (cleaned.length === 0) {
      showToast('Add at least one challenge.');
      return;
    }
    const res = await apiFetch('challenges.php?action=customize', {
      method: 'PUT',
      body: JSON.stringify({ challenges: cleaned })
    });
    if (res && res.ok) {
      showToast('Challenges updated.');
      close();
      await renderChallenges();
    } else {
      showToast('Could not save changes.');
    }
  });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'challenges') return;
  renderChallenges();
  initGraceDay();
  initCustomizeModal();
});
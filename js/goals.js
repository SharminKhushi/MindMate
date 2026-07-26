/* ==========================================================================
   MindMate — goals.js
   Goal CRUD (progress %), Habit CRUD (daily toggle + streak).
   Fully DB-based via api/goals.php, api/habits.php, api/habit_toggle.php
   ========================================================================== */

let deleteGoalId = null;
let deleteHabitId = null;
let editingGoalId = null;
let editingHabitId = null;

/* ---------- API helpers ---------- */
async function getGoals() {
  const res = await apiFetch('goals.php');
  return res && res.ok ? await res.json() : [];
}
async function createGoal(data) { return apiFetch('goals.php', { method: 'POST', body: JSON.stringify(data) }); }
async function updateGoal(id, data) { return apiFetch(`goals.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
async function adjustGoalProgressApi(id, delta) { return apiFetch(`goals.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ progressDelta: delta }) }); }
async function deleteGoalApi(id) { return apiFetch(`goals.php?id=${id}`, { method: 'DELETE' }); }

async function getHabits() {
  const res = await apiFetch('habits.php');
  return res && res.ok ? await res.json() : [];
}
async function createHabit(title) { return apiFetch('habits.php', { method: 'POST', body: JSON.stringify({ title }) }); }
async function updateHabitApi(id, title) { return apiFetch(`habits.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ title }) }); }
async function toggleHabitApi(id) { return apiFetch(`habit_toggle.php?id=${id}`, { method: 'POST' }); }
async function deleteHabitApi(id) { return apiFetch(`habits.php?id=${id}`, { method: 'DELETE' }); }

function escapeHtmlSafe(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---------- Goals ---------- */
async function renderGoals() {
  const list = document.getElementById('goalList');
  const empty = document.getElementById('goalEmptyState');
  const goals = await getGoals();

  if (goals.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
  } else {
    list.style.display = 'flex';
    empty.style.display = 'none';

    list.innerHTML = goals.map((g) => `
      <div class="card goal-card" data-id="${g.id}">
        <div class="goal-card-top">
          <div>
            <h4>${escapeHtmlSafe(g.title)}</h4>
            <span class="goal-meta">${g.targetDate ? 'Target: ' + new Date(g.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No target date'}</span>
          </div>
          <div class="goal-actions">
            <button type="button" class="action-btn edit-goal" data-id="${g.id}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button type="button" class="action-btn danger delete-goal" data-id="${g.id}"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>
        <div class="progress-row"><span>${g.progress || 0}% complete</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${g.progress || 0}%"></div></div>
        <div style="display:flex; gap:8px; margin-top:var(--sp-3);">
          <button type="button" class="btn progress-minus" data-id="${g.id}" title="Decrease progress by 10%" style="padding:0.4rem 0.9rem;">−10%</button>
          <button type="button" class="btn progress-plus" data-id="${g.id}" title="Increase progress by 10%" style="padding:0.4rem 0.9rem;">+10%</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.delete-goal').forEach((btn) => btn.addEventListener('click', () => deleteGoal(btn.getAttribute('data-id'))));
    list.querySelectorAll('.edit-goal').forEach((btn) => btn.addEventListener('click', () => openGoalEdit(btn.getAttribute('data-id'))));
    list.querySelectorAll('.progress-plus').forEach((btn) => btn.addEventListener('click', () => adjustGoalProgress(btn.getAttribute('data-id'), 10)));
    list.querySelectorAll('.progress-minus').forEach((btn) => btn.addEventListener('click', () => adjustGoalProgress(btn.getAttribute('data-id'), -10)));
  }

  await renderGoalStats();
}

async function adjustGoalProgress(id, delta) {
  const res = await adjustGoalProgressApi(id, delta);
  if (res && res.ok) {
    const data = await res.json();
    await renderGoals();
    if (data.progress === 100) showToast('Goal complete! 🎉', { badge: true });
  }
}

async function openGoalEdit(id) {
  editingGoalId = id;
  const goals = await getGoals();
  const goal = goals.find((g) => g.id === id);
  if (!goal) return;

  document.getElementById('goalTitle').value = goal.title;
  document.getElementById('goalDate').value = goal.targetDate || '';
  document.getElementById('goalModalTitle').textContent = 'Edit Goal';
  document.getElementById('goalModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function deleteGoal(id) {
  deleteGoalId = id;
  document.getElementById('goalDeleteModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function confirmGoalDelete() {
  await deleteGoalApi(deleteGoalId);
  await renderGoals();
  showToast('Goal deleted.');
  closeGoalDeleteModal();
}

function closeGoalDeleteModal() {
  document.getElementById('goalDeleteModal').classList.remove('open');
  document.body.style.overflow = '';
  deleteGoalId = null;
}

/* ---------- Habits ---------- */
function habitStreak(habit) {
  const dates = new Set(habit.completedDates || []);
  let streak = 0;
  let cursor = new Date();
  if (!dates.has(todayStr())) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const key = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0') + '-' + String(cursor.getDate()).padStart(2, '0');
    if (dates.has(key)) { streak++; cursor.setDate(cursor.getDate() - 1); } else break;
  }
  return streak;
}

async function renderHabits() {
  const list = document.getElementById('habitList');
  const empty = document.getElementById('habitEmptyState');
  const habits = await getHabits();
  const today = todayStr();

  if (habits.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
  } else {
    list.style.display = 'flex';
    empty.style.display = 'none';

    list.innerHTML = habits.map((h) => {
      const done = (h.completedDates || []).includes(today);
      const streak = habitStreak(h);
      return `
        <div class="habit-item ${done ? 'done' : ''}" data-id="${h.id}">
          <button type="button" class="challenge-check habit-check" data-id="${h.id}" aria-label="Toggle habit"><i class="fa-solid fa-check"></i></button>
          <div class="habit-info">
            <strong>${escapeHtmlSafe(h.title)}</strong>
            ${streak > 0 ? `<span class="habit-streak-badge"><i class="fa-solid fa-fire"></i> ${streak} day streak</span>` : '<span style="font-size:0.75rem; color:var(--text-secondary);">No streak yet</span>'}
          </div>
          <button type="button" class="action-btn edit-habit" data-id="${h.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button type="button" class="action-btn danger delete-habit" data-id="${h.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.habit-check').forEach((btn) => btn.addEventListener('click', () => toggleHabit(btn.getAttribute('data-id'))));
    list.querySelectorAll('.delete-habit').forEach((btn) => btn.addEventListener('click', () => deleteHabit(btn.getAttribute('data-id'))));
    list.querySelectorAll('.edit-habit').forEach((btn) => btn.addEventListener('click', () => openHabitEdit(btn.getAttribute('data-id'))));
  }

  await renderGoalStats();
}

async function toggleHabit(id) {
  await toggleHabitApi(id);
  await renderHabits();
}

async function openHabitEdit(id) {
  editingHabitId = id;
  const habits = await getHabits();
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;

  document.getElementById('habitTitle').value = habit.title;
  document.getElementById('habitModalTitle').textContent = 'Edit Habit';
  document.getElementById('habitModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function deleteHabit(id) {
  deleteHabitId = id;
  document.getElementById('habitDeleteModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function confirmHabitDelete() {
  await deleteHabitApi(deleteHabitId);
  await renderHabits();
  showToast('Habit deleted.');
  closeHabitDeleteModal();
}

function closeHabitDeleteModal() {
  document.getElementById('habitDeleteModal').classList.remove('open');
  document.body.style.overflow = '';
  deleteHabitId = null;
}

/* ---------- Stats ---------- */
async function renderGoalStats() {
  const goals = await getGoals();
  const habits = await getHabits();
  const today = todayStr();

  document.getElementById('statGoalCount').textContent = goals.length;

  const avgProgress = goals.length ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length) : 0;
  document.getElementById('statAvgProgress').textContent = avgProgress + '%';

  const doneToday = habits.filter((h) => (h.completedDates || []).includes(today)).length;
  const habitPct = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;
  document.getElementById('statHabitPct').textContent = habitPct + '%';
}

/* ---------- Modals ---------- */
function initGoalModal() {
  const modal = document.getElementById('goalModal');
  const open = () => { modal.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { modal.classList.remove('open'); document.body.style.overflow = ''; document.getElementById('goalForm').reset(); document.getElementById('goalModalTitle').textContent = 'New Goal'; editingGoalId = null; };

  document.getElementById('openGoalModalBtn').addEventListener('click', open);
  document.getElementById('emptyGoalAddBtn').addEventListener('click', open);
  document.getElementById('closeGoalModalBtn').addEventListener('click', close);
  document.getElementById('cancelGoalBtn').addEventListener('click', close);
  document.getElementById('confirmGoalDelete').addEventListener('click', confirmGoalDelete);
  document.getElementById('cancelGoalDelete').addEventListener('click', closeGoalDeleteModal);
  document.getElementById('closeGoalDeleteModal').addEventListener('click', closeGoalDeleteModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.getElementById('goalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('goalTitle').value.trim();
    const targetDate = document.getElementById('goalDate').value;
    if (!title) return;

    if (editingGoalId) {
      await updateGoal(editingGoalId, { title, targetDate });
      showToast('Goal updated.');
    } else {
      await createGoal({ title, targetDate });
      showToast("Goal added — you've got this.");
    }

    close();
    await renderGoals();
  });
}

function initHabitModal() {
  const modal = document.getElementById('habitModal');
  const open = () => { modal.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { modal.classList.remove('open'); document.body.style.overflow = ''; document.getElementById('habitForm').reset(); document.getElementById('habitModalTitle').textContent = 'New Habit'; editingHabitId = null; };

  document.getElementById('openHabitModalBtn').addEventListener('click', open);
  document.getElementById('emptyHabitAddBtn').addEventListener('click', open);
  document.getElementById('closeHabitModalBtn').addEventListener('click', close);
  document.getElementById('cancelHabitBtn').addEventListener('click', close);
  document.getElementById('confirmHabitDelete').addEventListener('click', confirmHabitDelete);
  document.getElementById('cancelHabitDelete').addEventListener('click', closeHabitDeleteModal);
  document.getElementById('closeHabitDeleteModal').addEventListener('click', closeHabitDeleteModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.getElementById('habitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('habitTitle').value.trim();
    if (!title) return;

    if (editingHabitId) {
      await updateHabitApi(editingHabitId, title);
      showToast('Habit updated.');
    } else {
      await createHabit(title);
      showToast('Habit added to your daily checklist.');
    }

    close();
    await renderHabits();
  });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'goals') return;
  renderGoals();
  renderHabits();
  initGoalModal();
  initHabitModal();
});
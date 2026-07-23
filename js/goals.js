/* ==========================================================================
   MindMate — goals.js
   Goal CRUD (with progress %), Daily Habit Checklist CRUD, and the
   completion-percentage math shown on this page + the dashboard.
   ========================================================================== */

/* ---------- Goals ---------- */
let deleteGoalId = null;
let deleteHabitId = null;
let editingGoalId = null;
let editingHabitId = null;
function getGoals() {
  return readJSON(GOALS_KEY, []);
}
function saveGoals(goals) {
  writeJSON(GOALS_KEY, goals);
}

function renderGoals() {
  const list = document.getElementById('goalList');
  const empty = document.getElementById('goalEmptyState');
  const goals = getGoals();

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

<button type="button" class="entry-action-btn edit-goal" data-id="${g.id}">
<i class="fa-solid fa-pen"></i>
</button>

<button type="button" class="entry-action-btn delete delete-goal" data-id="${g.id}">
<i class="fa-solid fa-trash"></i>
</button>

</div>
        </div>
        <div class="progress-row"><span>${g.progress || 0}% complete</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${g.progress || 0}%"></div></div>
       <div style="display:flex; gap:8px; margin-top:var(--sp-3);">
  <button 
    type="button" 
    class="btn btn-ghost progress-minus" 
    data-id="${g.id}" 
    title="Decrease goal progress by 10%"
    style="padding:0.4rem 0.9rem;">
    −10%
  </button>

  <button 
    type="button" 
    class="btn btn-ghost progress-plus" 
    data-id="${g.id}" 
    title="Increase goal progress by 10%"
    style="padding:0.4rem 0.9rem;">
    +10%
  </button>
</div>
      </div>`).join('');

    list.querySelectorAll('.delete-goal').forEach((btn) => {
      btn.addEventListener('click', () => deleteGoal(btn.getAttribute('data-id')));
    });
    list.querySelectorAll('.edit-goal').forEach((btn)=>{
  btn.addEventListener('click',()=>{
    openGoalEdit(btn.getAttribute('data-id'));
  });
});
    list.querySelectorAll('.progress-plus').forEach((btn) => {
      btn.addEventListener('click', () => adjustGoalProgress(btn.getAttribute('data-id'), 10));
    });
    list.querySelectorAll('.progress-minus').forEach((btn) => {
      btn.addEventListener('click', () => adjustGoalProgress(btn.getAttribute('data-id'), -10));
    });
    list.querySelectorAll('.edit-goal').forEach((btn)=>{
  btn.addEventListener('click',()=>{
    openGoalEdit(btn.getAttribute('data-id'));
  });
});
  }

  renderGoalStats();
}

function adjustGoalProgress(id, delta) {
  const goals = getGoals();
  const goal = goals.find((g) => g.id === id);
  if (!goal) return;
  goal.progress = Math.max(0, Math.min(100, (goal.progress || 0) + delta));
  saveGoals(goals);
  renderGoals();
  if (goal.progress === 100) showToast(`"${goal.title}" complete! 🎉`, { badge: true });
}

function openGoalEdit(id){

  editingGoalId = id;

  const goal = getGoals().find(g => g.id === id);
  if(!goal) return;

  document.getElementById('goalTitle').value = goal.title;
  document.getElementById('goalDate').value = goal.targetDate || '';

  document.querySelector('#goalModal h3').textContent = 'Edit Goal';

  const modal = document.getElementById('goalModal');
  modal.classList.add('open');
  document.body.style.overflow='hidden';
}

function deleteGoal(id) {

  deleteGoalId = id;

  const modal = document.getElementById('goalDeleteModal');

  modal.classList.add('open');

  document.body.style.overflow = 'hidden';
}

function confirmGoalDelete(){

  saveGoals(getGoals().filter((g)=> g.id !== deleteGoalId));

  renderGoals();

  showToast('Goal deleted.');

  closeGoalDeleteModal();

}


function closeGoalDeleteModal(){

  document.getElementById('goalDeleteModal')
  .classList.remove('open');

  document.body.style.overflow = '';

  deleteGoalId = null;

}

/* ---------- Habits ---------- */
function getHabits() {
  return readJSON(HABITS_KEY, []);
}
function saveHabits(habits) {
  writeJSON(HABITS_KEY, habits);
}

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

function renderHabits() {
  const list = document.getElementById('habitList');
  const empty = document.getElementById('habitEmptyState');
  const habits = getHabits();
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
          <button type="button" class="entry-action-btn edit-habit" data-id="${h.id}">
<i class="fa-solid fa-pen"></i>
</button>
          <button type="button" class="entry-action-btn delete delete-habit" data-id="${h.id}" aria-label="Delete habit"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');

    list.querySelectorAll('.habit-check').forEach((btn) => {
      btn.addEventListener('click', () => toggleHabit(btn.getAttribute('data-id')));
    });
    list.querySelectorAll('.delete-habit').forEach((btn) => {
      btn.addEventListener('click', () => deleteHabit(btn.getAttribute('data-id')));
    });
    list.querySelectorAll('.edit-habit').forEach((btn)=>{
  btn.addEventListener('click',()=>{
    openHabitEdit(btn.getAttribute('data-id'));
  });
});
  }

  renderGoalStats();
}

function toggleHabit(id) {
  const habits = getHabits();
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  const today = todayStr();
  habit.completedDates = habit.completedDates || [];
  const idx = habit.completedDates.indexOf(today);
  if (idx >= 0) habit.completedDates.splice(idx, 1);
  else habit.completedDates.push(today);
  saveHabits(habits);
  renderHabits();
}

function openHabitEdit(id){

  editingHabitId = id;

  const habit = getHabits().find(h => h.id === id);
  if(!habit) return;

  document.getElementById('habitTitle').value = habit.title;

  document.querySelector('#habitModal h3').textContent = 'Edit Habit';

  const modal = document.getElementById('habitModal');
  modal.classList.add('open');
  document.body.style.overflow='hidden';
}

function deleteHabit(id) {

  deleteHabitId = id;

  const modal = document.getElementById('habitDeleteModal');

  modal.classList.add('open');

  document.body.style.overflow = 'hidden';

}

function confirmHabitDelete(){

  saveHabits(getHabits().filter((h)=> h.id !== deleteHabitId));

  renderHabits();

  showToast('Habit deleted.');

  closeHabitDeleteModal();

}


function closeHabitDeleteModal(){

  document.getElementById('habitDeleteModal')
  .classList.remove('open');

  document.body.style.overflow = '';

  deleteHabitId = null;

}

/* ---------- Stats ---------- */
function renderGoalStats() {
  const goals = getGoals();
  const habits = getHabits();
  const today = todayStr();

  document.getElementById('statGoalCount').textContent = goals.length;

  const avgProgress = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
    : 0;
  document.getElementById('statAvgProgress').textContent = avgProgress + '%';

  const doneToday = habits.filter((h) => (h.completedDates || []).includes(today)).length;
  const habitPct = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;
  document.getElementById('statHabitPct').textContent = habitPct + '%';
}

function escapeHtmlSafe(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---------- Modals ---------- */
function initGoalModal() {
  const modal = document.getElementById('goalModal');
  const open = () => { modal.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { modal.classList.remove('open'); document.body.style.overflow = ''; document.getElementById('goalForm').reset(); };

  document.getElementById('openGoalModalBtn').addEventListener('click', open);
  document.getElementById('emptyGoalAddBtn').addEventListener('click', open);
  document.getElementById('closeGoalModalBtn').addEventListener('click', close);
  document.getElementById('cancelGoalBtn').addEventListener('click', close);
  document.getElementById('confirmGoalDelete')
.addEventListener('click', confirmGoalDelete);


document.getElementById('cancelGoalDelete')
.addEventListener('click', closeGoalDeleteModal);


document.getElementById('closeGoalDeleteModal')
.addEventListener('click', closeGoalDeleteModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.getElementById('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('goalTitle').value.trim();
    const targetDate = document.getElementById('goalDate').value;
    if (!title) return;

  const goals = getGoals();

if(editingGoalId){

  const index = goals.findIndex(g => g.id === editingGoalId);

  if(index !== -1){
    goals[index].title = title;
    goals[index].targetDate = targetDate || null;
  }

  showToast('Goal updated.');

}else{

  goals.push({
    id: 'g_' + Date.now(),
    title,
    targetDate: targetDate || null,
    progress: 0,
    createdAt: new Date().toISOString()
  });

  showToast('Goal added — you\'ve got this.');
}

saveGoals(goals);

editingGoalId = null;

close();
renderGoals();
  });
}

function initHabitModal() {
  const modal = document.getElementById('habitModal');
  const open = () => { modal.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { modal.classList.remove('open'); document.body.style.overflow = ''; document.getElementById('habitForm').reset(); };

  document.getElementById('openHabitModalBtn').addEventListener('click', open);
  document.getElementById('emptyHabitAddBtn').addEventListener('click', open);
  document.getElementById('closeHabitModalBtn').addEventListener('click', close);
  document.getElementById('cancelHabitBtn').addEventListener('click', close);
  document.getElementById('confirmHabitDelete')
.addEventListener('click', confirmHabitDelete);

document.getElementById('cancelHabitDelete')
.addEventListener('click', closeHabitDeleteModal);

document.getElementById('closeHabitDeleteModal')
.addEventListener('click', closeHabitDeleteModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.getElementById('habitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('habitTitle').value.trim();
    if (!title) return;

    const habits = getHabits();

if(editingHabitId){

  const index = habits.findIndex(h => h.id === editingHabitId);

  if(index !== -1){
    habits[index].title = title;
  }

  showToast('Habit updated.');

}else{

  habits.push({
    id: 'h_' + Date.now(),
    title,
    completedDates: [],
    createdAt: new Date().toISOString()
  });

  showToast('Habit added to your daily checklist.');
}

saveHabits(habits);

editingHabitId = null;

close();
renderHabits();
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
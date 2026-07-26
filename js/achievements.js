/* ==========================================================================
   MindMate — achievements.js
   Full achievement grid: locked/unlocked, "why it matters", progress hints,
   unlock dates. Data comes from api/achievements.php.
   ========================================================================== */

async function renderAchievements() {
  const grid = document.getElementById('achievementsGrid');
  if (!grid) return;

  const res = await apiFetch('achievements.php');
  if (!res || !res.ok) return;
  const badges = await res.json();

  grid.innerHTML = badges.map((b) => {
    const unlockedDateLabel = b.unlockedAt
      ? new Date(b.unlockedAt.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    return `
      <div class="card achievement-card ${b.unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">
          <i class="${b.unlocked ? b.icon : 'fa-solid fa-lock'}"></i>
        </div>
        <h4>${b.label}</h4>
        <p class="achievement-why">${b.why}</p>
        ${b.unlocked
          ? `<span class="achievement-unlocked-tag"><i class="fa-solid fa-check"></i> Unlocked ${unlockedDateLabel}</span>`
          : `<span class="achievement-hint">${b.hint}</span>`
        }
      </div>`;
  }).join('');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'achievements') return;
  renderAchievements();
});
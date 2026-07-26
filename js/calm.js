/* ==========================================================================
   MindMate — calm.js
   Calm Corner: Relaxing Sounds (6), Breathing Exercise, Daily Positive
   Quote, Quick Relax Tips. Fully client-side — no DB calls needed.
   ========================================================================== */

const CALM_SOUNDS = [
  { id: 'rain',       label: 'Rain',         icon: 'fa-solid fa-cloud-rain',   src: '../assets/audio/rain.mp3' },
  { id: 'forest',     label: 'Forest',       icon: 'fa-solid fa-tree',        src: '../assets/audio/forest.mp3' },
  { id: 'ocean',      label: 'Ocean Waves',  icon: 'fa-solid fa-water',       src: '../assets/audio/ocean.mp3' },
  { id: 'wind',       label: 'Gentle Wind',  icon: 'fa-solid fa-wind',        src: '../assets/audio/wind.mp3' },
  { id: 'birds',      label: 'Morning Birds',icon: 'fa-solid fa-dove',        src: '../assets/audio/birds.mp3' },
  { id: 'whitenoise', label: 'White Noise',  icon: 'fa-solid fa-wave-square', src: '../assets/audio/whitenoise.mp3' }
];

let currentAudio = null;
let currentPlayingId = null;

function renderSounds() {
  const list = document.getElementById('soundList');
  if (!list) return;

  list.innerHTML = CALM_SOUNDS.map((s) => `
    <div class="sound-item" data-id="${s.id}">
      <div class="sound-info">
        <i class="${s.icon}"></i>
        <span>${s.label}</span>
      </div>
      <button type="button" class="btn btn-ghost sound-play-btn" data-id="${s.id}">
        <i class="fa-solid fa-play"></i>
      </button>
      <input type="range" class="sound-volume" data-id="${s.id}" min="0" max="1" step="0.05" value="0.6">
    </div>
  `).join('');

  list.querySelectorAll('.sound-play-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleSound(btn.getAttribute('data-id')));
  });

  list.querySelectorAll('.sound-volume').forEach((slider) => {
    slider.addEventListener('input', () => {
      if (currentAudio && currentPlayingId === slider.getAttribute('data-id')) {
        currentAudio.volume = Number(slider.value);
      }
    });
  });
}

function toggleSound(id) {
  const sound = CALM_SOUNDS.find((s) => s.id === id);
  if (!sound) return;

  if (currentPlayingId === id && currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    currentPlayingId = null;
    updateSoundButtons();
    return;
  }

  if (currentAudio) currentAudio.pause();

  const volumeSlider = document.querySelector(`.sound-volume[data-id="${id}"]`);
  currentAudio = new Audio(sound.src);
  currentAudio.loop = true;
  currentAudio.volume = volumeSlider ? Number(volumeSlider.value) : 0.6;
  currentAudio.play().catch(() => {
    showToast('Could not play audio — check the file exists in assets/audio/.');
  });
  currentPlayingId = id;
  updateSoundButtons();
}

function updateSoundButtons() {
  document.querySelectorAll('.sound-play-btn').forEach((btn) => {
    const id = btn.getAttribute('data-id');
    const isPlaying = id === currentPlayingId;
    btn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    btn.closest('.sound-item').classList.toggle('playing', isPlaying);
  });
}

/* ---------- Breathing Exercise (4-4-6 pattern) ---------- */
let breathingActive = false;
let breathingTimeout = null;

function runBreathingCycle() {
  if (!breathingActive) return;
  const circle = document.getElementById('breathingCircle');
  const text = document.getElementById('breathingText');

  circle.className = 'breathing-circle inhale';
  text.textContent = 'Breathe In';
  breathingTimeout = setTimeout(() => {
    if (!breathingActive) return;
    circle.className = 'breathing-circle hold';
    text.textContent = 'Hold';
    breathingTimeout = setTimeout(() => {
      if (!breathingActive) return;
      circle.className = 'breathing-circle exhale';
      text.textContent = 'Breathe Out';
      breathingTimeout = setTimeout(runBreathingCycle, 6000);
    }, 4000);
  }, 4000);
}

function initBreathingExercise() {
  const btn = document.getElementById('breathingToggleBtn');
  const circle = document.getElementById('breathingCircle');
  const text = document.getElementById('breathingText');
  if (!btn) return;

  btn.addEventListener('click', () => {
    breathingActive = !breathingActive;
    if (breathingActive) {
      btn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
      runBreathingCycle();
    } else {
      btn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
      clearTimeout(breathingTimeout);
      circle.className = 'breathing-circle';
      text.textContent = 'Ready';
    }
  });
}

/* ---------- Daily Positive Quote ---------- */
const CALM_QUOTES = [
  { text: 'You are doing better than you think you are.', author: 'MindMate' },
  { text: 'This feeling is temporary. You have gotten through hard days before.', author: 'MindMate' },
  { text: 'Breathe. You are exactly where you need to be right now.', author: 'MindMate' },
  { text: 'Rest is productive too.', author: 'MindMate' },
  { text: "You don't have to be perfect to be enough.", author: 'MindMate' },
  { text: 'Small calm moments add up to a calmer life.', author: 'MindMate' },
  { text: "It's okay to slow down. The world can wait a few minutes.", author: 'MindMate' }
];

function renderCalmQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((new Date() - start) / 86400000);
  const quote = CALM_QUOTES[dayOfYear % CALM_QUOTES.length];

  const textEl = document.getElementById('calmQuoteText');
  const authorEl = document.getElementById('calmQuoteAuthor');
  if (textEl) textEl.textContent = `"${quote.text}"`;
  if (authorEl) authorEl.textContent = `— ${quote.author}`;
}

/* ---------- Quick Relax Tips ---------- */
const RELAX_TIPS = [
  'Unclench your jaw and drop your shoulders — tension hides there without you noticing.',
  'Look away from the screen for 20 seconds and focus on something far away.',
  'Take one sip of water, slowly, paying full attention to it.',
  'Name 3 things you can see, 2 you can hear, 1 you can feel right now.',
  'Stretch your arms above your head and hold for 10 seconds.'
];

function renderTips() {
  const list = document.getElementById('tipsList');
  if (!list) return;
  list.innerHTML = RELAX_TIPS.map((tip) => `<li><i class="fa-solid fa-leaf"></i> ${tip}</li>`).join('');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'calm') return;
  renderSounds();
  initBreathingExercise();
  renderCalmQuote();
  renderTips();
});
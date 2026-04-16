const state = {
  isSleeping: false,
  currentSession: null,
  selectedQuality: 0,
  timerInterval: null
};

// ── API (auth-aware) ──
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
  const res = await fetch('/api' + path, {
    headers, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

// ── Init (called after successful auth) ──
async function init() {
  setupStarRating();
  updateGreeting();
  await checkStatus();
  loadLastSleep();
  updateTodayStrip();
  await initStudy();
}

// ── Greeting ──
function updateGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const el = document.getElementById('greeting-time');
  const nameEl = document.getElementById('greeting-name');
  if (el) el.textContent = greet;
  if (nameEl && auth.user) nameEl.textContent = auth.user.display_name || auth.user.name || '';
}

// ── Sleep Status ──
async function checkStatus() {
  const data = await api('/status');
  if (!data) return;
  state.isSleeping = data.is_sleeping;
  state.currentSession = data.current_session;
  updateSleepUI();
  if (state.isSleeping) startTimer();
}

function updateSleepUI() {
  const btn = document.getElementById('sleep-btn');
  const icon = document.getElementById('hero-icon');
  const label = document.getElementById('hero-label');
  const statusText = document.getElementById('status-text');
  const dot = document.getElementById('sleep-dot');

  if (state.isSleeping) {
    btn.className = 'hero-btn state-sleeping';
    icon.innerHTML = '&#9788;';
    label.textContent = "I'm awake!";
    statusText.textContent = 'Sleeping...';
    dot?.classList.add('active-sleep');
  } else {
    btn.className = 'hero-btn state-awake';
    icon.innerHTML = '&#9790;';
    label.textContent = "I'm going to sleep";
    statusText.textContent = "You're awake";
    dot?.classList.remove('active-sleep');
    document.getElementById('status-timer').textContent = '';
    clearInterval(state.timerInterval);
  }
}

function startTimer() {
  if (!state.currentSession) return;
  updateTimerDisplay();
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  if (!state.currentSession) return;
  const start = new Date(state.currentSession.sleep_start + 'Z').getTime();
  const elapsed = Date.now() - start;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  const el = document.getElementById('status-timer');
  if (el) el.textContent = `${h}h ${pad(m)}m ${pad(s)}s`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── Sleep Toggle ──
async function toggleSleep() {
  if (navigator.vibrate) navigator.vibrate(50);
  if (state.isSleeping) {
    state.selectedQuality = 0;
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.getElementById('quality-modal').style.display = 'flex';
  } else {
    const data = await api('/sleep', { method: 'POST' });
    if (!data || data.error) return;
    state.isSleeping = true;
    state.currentSession = { id: data.id, sleep_start: data.sleep_start };
    updateSleepUI();
    startTimer();
  }
}

async function submitWake(skip = false) {
  document.getElementById('quality-modal').style.display = 'none';
  const body = skip ? {} : { quality: state.selectedQuality || null };
  const data = await api('/wake', { method: 'POST', body });
  if (!data) return;
  state.isSleeping = false;
  state.currentSession = null;
  clearInterval(state.timerInterval);
  updateSleepUI();
  loadLastSleep();
  updateTodayStrip();
  const statusText = document.getElementById('status-text');
  if (statusText) statusText.textContent = `Slept ${formatDuration(data.duration_minutes)}`;
}

// ── Star Rating ──
function setupStarRating() {
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      state.selectedQuality = val;
      document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val));
    });
  });
}

// ── Last Sleep (home card) ──
async function loadLastSleep() {
  const data = await api('/records?days=30&limit=1');
  if (!data) return;
  // no separate today-card anymore; strip handles it
}

// ── Today Strip ──
async function updateTodayStrip() {
  const today = new Date().toISOString().slice(0, 10);

  // Sleep today
  api('/records?days=1&limit=10').then(d => {
    if (!d) return;
    const todayMin = d.records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const el = document.getElementById('strip-sleep-val');
    if (el) el.textContent = todayMin > 0 ? formatDuration(todayMin) : '—';
  });

  // Study today
  api('/study/records?days=1').then(d => {
    if (!d) return;
    const todayMin = d.records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const el = document.getElementById('strip-study-val');
    if (el) el.textContent = todayMin > 0 ? formatDuration(todayMin) : '—';
  });

  // Exercise today
  api('/exercise/records?days=1').then(d => {
    if (!d) return;
    const el = document.getElementById('strip-exercise-val');
    if (el) el.textContent = d.records.length > 0 ? d.records.length + ' log' + (d.records.length > 1 ? 's' : '') : '—';
  });
}

// ── Sleep History ──
async function loadHistory() {
  const data = await api('/records?days=90&limit=100');
  if (!data) return;
  const list = document.getElementById('history-list');

  if (data.records.length === 0) {
    list.innerHTML = '<p class="empty-msg">No sleep records yet.<br>Tap the moon to start tracking!</p>';
    return;
  }

  const groups = {};
  data.records.forEach(r => {
    const date = r.sleep_start.split(' ')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(r);
  });

  let html = '';
  for (const [date, records] of Object.entries(groups)) {
    html += `<div class="history-date-group">
      <div class="history-date">${formatDate(date)}</div>`;
    records.forEach(r => {
      const dur = formatDuration(r.duration_minutes);
      const cls = durationClass(r.duration_minutes);
      const stars = r.quality ? `<div class="history-stars">${'\u2605'.repeat(r.quality)}${'\u2606'.repeat(5 - r.quality)}</div>` : '';
      html += `<div class="history-item">
        <span class="history-item-icon">&#9790;</span>
        <div class="history-item-info">
          <div class="history-time">${formatTime(r.sleep_start)} – ${r.sleep_end ? formatTime(r.sleep_end) : 'ongoing'}</div>
          <div class="history-duration ${cls}">${dur}</div>
          ${stars}
        </div>
        <button class="history-delete" onclick="deleteRecord(${r.id})">&times;</button>
      </div>`;
    });
    html += '</div>';
  }
  list.innerHTML = html;
}

async function deleteRecord(id) {
  if (!confirm('Delete this sleep record?')) return;
  await api('/records/' + id, { method: 'DELETE' });
  loadHistory();
  updateTodayStrip();
}

// ── Profile ──
async function loadProfile() {
  const data = await api('/auth/me');
  if (!data) return;

  document.getElementById('profile-avatar').src = data.picture || '';
  document.getElementById('profile-name').textContent = data.display_name || data.name || '';
  document.getElementById('profile-email').textContent = data.email || '';

  // Stat tiles (lifetime totals)
  const [sleepS, studyS, exerS] = await Promise.all([
    api('/stats?days=365'),
    api('/study/stats?days=365'),
    api('/exercise/stats?days=365')
  ]);

  const grid = document.getElementById('profile-stats');
  if (grid) grid.innerHTML = `
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--sleep-hi)">${sleepS?.total_records || 0}</div><div class="stat-tile-label">Sleeps</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--study-hi)">${studyS?.total_sessions || 0}</div><div class="stat-tile-label">Study sessions</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--exer-hi)">${exerS?.total_workouts || 0}</div><div class="stat-tile-label">Workouts</div></div>
  `;

  const scheduleMap = { regular:'Regular 9–5', shift:'Shift Work', flexible:'Flexible', student:'Student' };
  const exerMap = { daily:'Every day', few_times_week:'4–5x/week', weekly:'2–3x/week', rarely:'Rarely', never:'Never' };

  const info = document.getElementById('profile-info');
  if (info) info.innerHTML = [
    data.age ? `<div class="profile-row"><span class="profile-row-label">Age</span><span class="profile-row-val">${data.age}</span></div>` : '',
    data.gender ? `<div class="profile-row"><span class="profile-row-label">Gender</span><span class="profile-row-val">${capitalize(data.gender)}</span></div>` : '',
    `<div class="profile-row"><span class="profile-row-label">Sleep goal</span><span class="profile-row-val">${data.sleep_goal_hours || 8}h / night</span></div>`,
    data.occupation ? `<div class="profile-row"><span class="profile-row-label">Occupation</span><span class="profile-row-val">${data.occupation}</span></div>` : '',
    data.work_schedule ? `<div class="profile-row"><span class="profile-row-label">Schedule</span><span class="profile-row-val">${scheduleMap[data.work_schedule] || data.work_schedule}</span></div>` : '',
    data.exercise_frequency ? `<div class="profile-row"><span class="profile-row-label">Exercise</span><span class="profile-row-val">${exerMap[data.exercise_frequency] || data.exercise_frequency}</span></div>` : ''
  ].join('');
}

// ── View Switching ──
function switchView(name) {
  document.querySelectorAll('#app-container .view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));

  if (name === 'history') loadHistory();
  if (name === 'log') { switchLog('study'); }
  if (name === 'charts') loadCharts(chartType, chartPeriod);
  if (name === 'profile') loadProfile();
}

// ── Formatters ──
function formatDuration(min) {
  if (!min && min !== 0) return '—';
  if (min < 1) return '< 1m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function durationClass(min) {
  if (!min) return 'poor';
  const h = min / 60;
  return h >= 7 ? 'good' : h >= 6 ? 'okay' : 'poor';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(isoStr) {
  return new Date(isoStr + 'Z').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : ''; }

function shakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

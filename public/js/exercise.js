let selectedExType = null;

function openExerciseModal() {
  selectedExType = null;
  document.querySelectorAll('.ex-type-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('ex-duration').value = '';
  document.getElementById('ex-calories').value = '';
  document.getElementById('ex-notes').value = '';
  // Reset intensity to moderate
  document.querySelectorAll('.ob-option[data-field="intensity"]').forEach(b => b.classList.remove('selected'));
  document.querySelector('.ob-option[data-field="intensity"][data-value="moderate"]')?.classList.add('selected');
  document.getElementById('exercise-modal').style.display = 'flex';
}

function closeExerciseModal() {
  document.getElementById('exercise-modal').style.display = 'none';
}

function setupExerciseModal() {
  document.querySelectorAll('.ex-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ex-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedExType = btn.dataset.type;
    });
  });
}

async function submitExercise() {
  if (!selectedExType) {
    document.getElementById('exercise-type-grid').style.animation = 'none';
    document.getElementById('exercise-type-grid').offsetHeight;
    document.getElementById('exercise-type-grid').style.animation = 'shake .4s';
    return;
  }
  const duration = parseInt(document.getElementById('ex-duration').value);
  if (!duration || duration < 1) {
    shakeInput('ex-duration');
    return;
  }

  const intensity = document.querySelector('.ob-option.selected[data-field="intensity"]')?.dataset.value || 'moderate';
  const calories = parseInt(document.getElementById('ex-calories').value) || null;
  const notes = document.getElementById('ex-notes').value.trim() || null;

  const data = await api('/exercise', {
    method: 'POST',
    body: { exercise_type: selectedExType, duration_minutes: duration, intensity, calories, notes }
  });

  if (data && !data.error) {
    closeExerciseModal();
    loadExerciseList();
    updateTodayStrip();
  }
}

async function loadExerciseList() {
  const data = await api('/exercise/records?days=30');
  if (!data) return;
  const list = document.getElementById('exercise-list');
  if (!list) return;

  if (data.records.length === 0) {
    list.innerHTML = '<p class="empty-msg">No workouts logged yet.<br>Tap + Log Workout to add one!</p>';
    return;
  }

  list.innerHTML = data.records.map(r => {
    const icon = exerciseIcon(r.exercise_type);
    const dur = formatDuration(r.duration_minutes);
    const dateStr = formatDate(r.logged_at.split(' ')[0]);
    const badgeClass = `intensity-${r.intensity || 'moderate'}`;
    const calStr = r.calories ? ` &bull; ${r.calories} cal` : '';
    return `<div class="activity-item">
      <span class="ai-icon">${icon}</span>
      <div class="ai-info">
        <div class="ai-title">${r.exercise_type}</div>
        <div class="ai-sub">${dateStr}${calStr}</div>
        <span class="intensity-badge ${badgeClass}">${r.intensity || 'moderate'}</span>
      </div>
      <div>
        <div class="ai-dur exer-color">${dur}</div>
        <button class="history-delete" onclick="deleteExerciseRecord(${r.id})" style="display:block;margin-top:4px">&times;</button>
      </div>
    </div>`;
  }).join('');
}

async function deleteExerciseRecord(id) {
  if (!confirm('Delete this workout?')) return;
  await api('/exercise/' + id, { method: 'DELETE' });
  loadExerciseList();
  updateTodayStrip();
}

function exerciseIcon(type) {
  const map = {
    'Running': '&#127939;', 'Walking': '&#128694;', 'Cycling': '&#128690;',
    'Swimming': '&#127946;', 'Gym': '&#127947;', 'Yoga': '&#129340;',
    'Sports': '&#9917;', 'Other': '&#128310;'
  };
  return map[type] || '&#127947;';
}

document.addEventListener('DOMContentLoaded', setupExerciseModal);

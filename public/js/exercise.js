let selectedExType = null;

function openExerciseModal() {
  selectedExType = null;
  document.querySelectorAll('.ex-type-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('ex-duration').value = '';
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
    const grid = document.getElementById('exercise-type-grid');
    grid.style.animation = 'none';
    void grid.offsetHeight;
    grid.style.animation = 'shake .4s';
    return;
  }
  const duration = parseInt(document.getElementById('ex-duration').value);
  if (!duration || duration < 1) {
    shakeInput('ex-duration');
    return;
  }

  const data = await api('/exercise', {
    method: 'POST',
    body: { exercise_type: selectedExType, duration_minutes: duration }
  });

  if (data && !data.error) {
    closeExerciseModal();
    loadUnifiedLog();
    updateTodayStrip();
  }
}

async function deleteExerciseRecord(id) {
  if (!confirm('Delete this workout?')) return;
  await api('/exercise/' + id, { method: 'DELETE' });
  loadUnifiedLog();
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

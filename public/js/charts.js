Chart.defaults.color = '#8090b0';
Chart.defaults.borderColor = '#1e293b';

let mainChart = null;
let secondaryChart = null;
let chartType = 'sleep';
let chartPeriod = 7;

function setChartType(type) {
  chartType = type;
  document.querySelectorAll('.ctype-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('onclick').includes(`'${type}'`));
    t.dataset.type = t.getAttribute('onclick').match(/'(\w+)'/)[1];
  });
  loadCharts(chartType, chartPeriod);
}

function setChartPeriod(days) {
  chartPeriod = days;
  document.querySelectorAll('.period-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('onclick').includes(days));
  });
  loadCharts(chartType, chartPeriod);
}

async function loadCharts(type = 'sleep', days = 7) {
  chartType = type;
  chartPeriod = days;

  if (type === 'sleep') await renderSleepCharts(days);
  else if (type === 'study') await renderStudyCharts(days);
  else if (type === 'exercise') await renderExerciseCharts(days);
}

// ── SLEEP ──
async function renderSleepCharts(days) {
  const data = await api('/stats?days=' + days);
  if (!data) return;

  document.getElementById('chart-main-title').textContent = 'Sleep Duration (hours)';
  document.getElementById('chart-secondary-title').textContent = 'Sleep Quality Trend';
  document.getElementById('chart-secondary-wrap').style.display = 'block';

  renderStatsGrid([
    { val: formatDuration(data.avg_duration_minutes), label: 'Average', color: 'var(--sleep-hi)' },
    { val: data.current_streak + 'd', label: 'Streak', color: 'var(--gold)' },
    { val: formatDuration(data.max_duration_minutes), label: 'Best', color: 'var(--good)' },
    { val: formatDuration(data.min_duration_minutes), label: 'Worst', color: 'var(--poor)' }
  ]);

  const labels = data.daily.map(d => shortDate(d.date));
  const durations = data.daily.map(d => +(d.duration_minutes / 60).toFixed(1));
  const colors = durations.map(v => v >= 7 ? '#22c55e' : v >= 6 ? '#f59e0b' : '#ef4444');

  destroyAndCreate('main-chart', {
    type: 'bar',
    data: { labels, datasets: [{ data: durations, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
    options: barOptions('h', 12)
  });

  const withQuality = data.daily.filter(d => d.quality != null);
  if (withQuality.length > 0) {
    destroyAndCreate('secondary-chart', {
      type: 'line',
      data: {
        labels: withQuality.map(d => shortDate(d.date)),
        datasets: [{ data: withQuality.map(d => +d.quality.toFixed(1)), borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,.1)', tension: .3, fill: true, pointBackgroundColor: '#fbbf24', pointRadius: 5 }]
      },
      options: lineOptions(0, 5, v => '⭐'.repeat(Math.round(v)))
    });
  } else {
    destroyAndCreate('secondary-chart', emptyChart('Rate your sleep to see quality trends'));
  }
}

// ── STUDY ──
async function renderStudyCharts(days) {
  const data = await api('/study/stats?days=' + days);
  if (!data) return;

  document.getElementById('chart-main-title').textContent = 'Study Duration (hours)';
  document.getElementById('chart-secondary-title').textContent = 'Time by Subject';
  document.getElementById('chart-secondary-wrap').style.display = 'block';

  renderStatsGrid([
    { val: formatDuration(data.total_duration_minutes), label: 'Total', color: 'var(--study-hi)' },
    { val: data.total_sessions.toString(), label: 'Sessions', color: 'var(--text)' },
    { val: formatDuration(data.avg_duration_minutes), label: 'Avg Session', color: 'var(--study-hi)' },
    { val: formatDuration(Math.round(data.total_duration_minutes / days)), label: 'Daily Avg', color: 'var(--good)' }
  ]);

  const labels = data.daily.map(d => shortDate(d.date));
  const durations = data.daily.map(d => +(d.duration_minutes / 60).toFixed(1));

  destroyAndCreate('main-chart', {
    type: 'bar',
    data: { labels, datasets: [{ data: durations, backgroundColor: '#0ea5e9', borderRadius: 6, borderSkipped: false }] },
    options: barOptions('h', Math.max(4, ...durations) + 1)
  });

  if (data.bySubject.length > 0) {
    const subColors = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#34d399'];
    destroyAndCreate('secondary-chart', {
      type: 'doughnut',
      data: {
        labels: data.bySubject.map(s => s.subject),
        datasets: [{ data: data.bySubject.map(s => Math.round(s.total_minutes)), backgroundColor: subColors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 16, font: { size: 11 } } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${formatDuration(c.raw)}` } }
        }
      }
    });
  } else {
    destroyAndCreate('secondary-chart', emptyChart('No study sessions yet'));
  }
}

// ── EXERCISE ──
async function renderExerciseCharts(days) {
  const data = await api('/exercise/stats?days=' + days);
  if (!data) return;

  document.getElementById('chart-main-title').textContent = 'Exercise Duration (min)';
  document.getElementById('chart-secondary-title').textContent = 'Workouts by Type';
  document.getElementById('chart-secondary-wrap').style.display = 'block';

  renderStatsGrid([
    { val: formatDuration(data.total_duration_minutes), label: 'Total', color: 'var(--exer-hi)' },
    { val: data.total_workouts.toString(), label: 'Workouts', color: 'var(--text)' },
    { val: formatDuration(data.avg_duration_minutes), label: 'Avg', color: 'var(--exer-hi)' },
    { val: data.total_calories ? data.total_calories + ' cal' : '—', label: 'Calories', color: 'var(--good)' }
  ]);

  const labels = data.daily.map(d => shortDate(d.date));
  const durations = data.daily.map(d => Math.round(d.duration_minutes));

  destroyAndCreate('main-chart', {
    type: 'bar',
    data: { labels, datasets: [{ data: durations, backgroundColor: '#10b981', borderRadius: 6, borderSkipped: false }] },
    options: barOptions('min', Math.max(60, ...durations) + 10)
  });

  if (data.byType.length > 0) {
    const typeColors = ['#10b981','#0ea5e9','#7c3aed','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#34d399'];
    destroyAndCreate('secondary-chart', {
      type: 'doughnut',
      data: {
        labels: data.byType.map(t => t.exercise_type),
        datasets: [{ data: data.byType.map(t => Math.round(t.total_minutes)), backgroundColor: typeColors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 16, font: { size: 11 } } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${formatDuration(c.raw)}` } }
        }
      }
    });
  } else {
    destroyAndCreate('secondary-chart', emptyChart('No workouts logged yet'));
  }
}

// ── Helpers ──
function renderStatsGrid(tiles) {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  grid.innerHTML = tiles.map(t => `
    <div class="stat-tile">
      <div class="stat-tile-val" style="color:${t.color}">${t.val}</div>
      <div class="stat-tile-label">${t.label}</div>
    </div>`).join('');
}

function barOptions(unit, maxY) {
  return {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw}${unit}` } } },
    scales: {
      y: { beginAtZero: true, max: maxY, ticks: { callback: v => v + unit }, grid: { color: '#0e1420' } },
      x: { grid: { display: false } }
    }
  };
}

function lineOptions(min, max, tickCb) {
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { min, max, ticks: { callback: tickCb, stepSize: 1 }, grid: { color: '#0e1420' } },
      x: { grid: { display: false } }
    }
  };
}

function emptyChart(msg) {
  return {
    type: 'doughnut',
    data: { labels: [msg], datasets: [{ data: [1], backgroundColor: ['#1e293b'], borderWidth: 0 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false },
      title: { display: true, text: msg, color: '#8090b0', font: { size: 12 } } } }
  };
}

function destroyAndCreate(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();
  new Chart(ctx, config);
}

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

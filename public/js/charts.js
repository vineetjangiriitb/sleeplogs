const chartState = {
  range: 'today',
  from: null,
  to: null,
  records: [],
  tasks: [],
  charts: {},
  fullscreenChart: null
};

async function loadCharts() {
  setupPeriodTabs();
  await fetchChartData();
  renderAll();
}

function setupPeriodTabs() {
  const tabs = document.querySelectorAll('#chart-period-tabs .period-tab');
  tabs.forEach(t => {
    if (!t.dataset._bound) {
      t.addEventListener('click', () => selectRange(t.dataset.range));
      t.dataset._bound = '1';
    }
    t.classList.toggle('active', t.dataset.range === chartState.range);
  });
}

function selectRange(range) {
  chartState.range = range;
  document.querySelectorAll('#chart-period-tabs .period-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.range === range)
  );
  const customRow = document.getElementById('chart-range-row');
  if (range === 'custom') {
    customRow.style.display = 'flex';
    const to = chartState.to || isoDate(new Date());
    const from = chartState.from || isoDate(addDays(new Date(), -6));
    document.getElementById('chart-from').value = from;
    document.getElementById('chart-to').value = to;
  } else {
    customRow.style.display = 'none';
    fetchChartData().then(renderAll);
  }
}

function applyCustomRange() {
  const from = document.getElementById('chart-from').value;
  const to = document.getElementById('chart-to').value;
  if (!from || !to) return;
  if (from > to) { alert('From date must be before To date'); return; }
  chartState.from = from;
  chartState.to = to;
  fetchChartData().then(renderAll);
}

function computeRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (chartState.range === 'today') return { from: isoDate(today), to: isoDate(today) };
  if (chartState.range === 'week')  return { from: isoDate(addDays(today, -6)), to: isoDate(today) };
  if (chartState.range === 'month') return { from: isoDate(addDays(today, -29)), to: isoDate(today) };
  return { from: chartState.from || isoDate(today), to: chartState.to || isoDate(today) };
}

function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function isoDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

async function fetchChartData() {
  const { from, to } = computeRange();
  const daysSpan = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const fetchDays = Math.max(daysSpan + 1, 2);
  const token = localStorage.getItem('timelog_token');
  const headers = { 'Authorization': 'Bearer ' + token };

  const [recRes, taskRes] = await Promise.all([
    fetch('/api/records?days=' + fetchDays, { headers }),
    fetch('/api/tasks', { headers })
  ]);
  if (!recRes.ok || !taskRes.ok) return;
  const recData = await recRes.json();
  const taskData = await taskRes.json();

  chartState.tasks = taskData.tasks || [];
  chartState.records = (recData.records || []).filter(r => {
    const d = r.start_time.split(' ')[0];
    return d >= from && d <= to;
  });
}

function renderAll() {
  const { from, to } = computeRange();
  const label = document.getElementById('chart-range-label');
  if (from === to) label.textContent = formatDateHuman(from);
  else label.textContent = `${formatDateHuman(from)} → ${formatDateHuman(to)}`;

  renderStats();
  renderTimelineChart();
  renderBreakdownChart();
}

function renderStats() {
  const totalMin = chartState.records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const sessions = chartState.records.length;
  const { from, to } = computeRange();
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const avgPerDay = totalMin / days;
  document.getElementById('chart-stats-grid').innerHTML = `
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--sleep-hi)">${formatDur(totalMin)}</div><div class="stat-tile-label">Total Time</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--study-hi)">${sessions}</div><div class="stat-tile-label">Sessions</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--exer-hi)">${formatDur(avgPerDay)}</div><div class="stat-tile-label">Avg / Day</div></div>
  `;
}

function aggregateByDay() {
  const { from, to } = computeRange();
  const days = [];
  for (let d = new Date(from); isoDate(d) <= to; d = addDays(d, 1)) days.push(isoDate(d));

  const taskIds = [...new Set(chartState.records.map(r => r.task_id))];
  const tasksById = {};
  chartState.tasks.forEach(t => tasksById[t.id] = t);
  chartState.records.forEach(r => { if (!tasksById[r.task_id]) tasksById[r.task_id] = { id: r.task_id, name: r.task_name, color: r.color, icon: r.icon }; });

  const datasets = taskIds.map(tid => {
    const t = tasksById[tid] || {};
    return {
      label: t.name || 'Task',
      backgroundColor: t.color || '#7c3aed',
      borderRadius: 4,
      data: days.map(day => {
        const mins = chartState.records
          .filter(r => r.task_id === tid && r.start_time.startsWith(day))
          .reduce((s, r) => s + (r.duration_minutes || 0), 0);
        return Math.round(mins);
      })
    };
  });

  return { days, datasets };
}

function aggregateByHour() {
  const hours = Array.from({ length: 24 }, () => ({}));
  chartState.records.forEach(r => {
    if (!r.start_time || !r.end_time) return;
    const s = new Date(r.start_time + 'Z');
    const e = new Date(r.end_time + 'Z');
    let cur = new Date(s);
    while (cur < e) {
      const h = cur.getHours();
      const nextHour = new Date(cur);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(h + 1);
      const segEnd = nextHour < e ? nextHour : e;
      const mins = (segEnd - cur) / 60000;
      hours[h][r.task_id] = (hours[h][r.task_id] || { name: r.task_name, color: r.color, mins: 0 });
      hours[h][r.task_id].mins += mins;
      cur = segEnd;
    }
  });

  const taskIds = [...new Set(chartState.records.map(r => r.task_id))];
  const datasets = taskIds.map(tid => {
    const meta = hours.map(h => h[tid]).find(Boolean) || { name: 'Task', color: '#7c3aed' };
    return {
      label: meta.name,
      backgroundColor: meta.color,
      borderRadius: 4,
      data: hours.map(h => Math.round((h[tid]?.mins) || 0))
    };
  });

  const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);
  return { labels, datasets };
}

function renderTimelineChart() {
  const title = document.getElementById('chart-timeline-title');
  const ctx = document.getElementById('chart-timeline');
  if (!ctx) return;
  if (chartState.charts.timeline) chartState.charts.timeline.destroy();

  let config;
  if (chartState.range === 'today') {
    title.textContent = 'Today by hour';
    const { labels, datasets } = aggregateByHour();
    config = timelineConfig(labels, datasets, 'min', true);
  } else {
    title.textContent = 'Time per day';
    const { days, datasets } = aggregateByDay();
    const labels = days.map(d => formatDayShort(d));
    config = timelineConfig(labels, datasets, 'min', true);
  }
  chartState.charts.timeline = new Chart(ctx, config);
}

function timelineConfig(labels, datasets, unit, stacked) {
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#1e293b';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim() || '#8090b0';
  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatDur(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { stacked, grid: { display: false }, ticks: { color: textColor, maxRotation: 0, autoSkip: true } },
        y: { stacked, beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: v => v + ' ' + unit } }
      }
    }
  };
}

function renderBreakdownChart() {
  const ctx = document.getElementById('chart-breakdown');
  if (!ctx) return;
  if (chartState.charts.breakdown) chartState.charts.breakdown.destroy();

  const totals = {};
  chartState.records.forEach(r => {
    if (!totals[r.task_id]) totals[r.task_id] = { name: r.task_name, color: r.color, mins: 0 };
    totals[r.task_id].mins += (r.duration_minutes || 0);
  });
  const entries = Object.values(totals).sort((a, b) => b.mins - a.mins);
  const labels = entries.map(e => e.name);
  const data = entries.map(e => Math.round(e.mins));
  const colors = entries.map(e => e.color);

  const legend = document.getElementById('chart-breakdown-legend');
  const totalMin = entries.reduce((s, e) => s + e.mins, 0) || 1;
  legend.innerHTML = entries.length
    ? entries.map(e => `
        <div class="legend-row">
          <span class="legend-swatch" style="background:${e.color}"></span>
          <span class="legend-name">${escapeHtml(e.name)}</span>
          <span class="legend-val">${formatDur(e.mins)} · ${Math.round(e.mins/totalMin*100)}%</span>
        </div>`).join('')
    : '<p class="empty-msg" style="padding:12px 0">No activity in this range.</p>';

  chartState.charts.breakdown = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatDur(ctx.parsed)}` } }
      }
    }
  });
}

function expandChart(which) {
  const fs = document.getElementById('chart-fullscreen');
  const titleEl = document.getElementById('chart-fullscreen-title');
  const canvas = document.getElementById('chart-fullscreen-canvas');
  const legend = document.getElementById('chart-fullscreen-legend');

  fs.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (chartState.fullscreenChart) chartState.fullscreenChart.destroy();

  if (which === 'timeline') {
    titleEl.textContent = chartState.range === 'today' ? 'Today by hour' : 'Time per day';
    legend.innerHTML = '';
    let labels, datasets;
    if (chartState.range === 'today') {
      ({ labels, datasets } = aggregateByHour());
    } else {
      const agg = aggregateByDay();
      labels = agg.days.map(d => formatDayShort(d));
      datasets = agg.datasets;
    }
    chartState.fullscreenChart = new Chart(canvas, timelineConfig(labels, datasets, 'min', true));
  } else {
    titleEl.textContent = 'Time by activity';
    const totals = {};
    chartState.records.forEach(r => {
      if (!totals[r.task_id]) totals[r.task_id] = { name: r.task_name, color: r.color, mins: 0 };
      totals[r.task_id].mins += (r.duration_minutes || 0);
    });
    const entries = Object.values(totals).sort((a, b) => b.mins - a.mins);
    const totalMin = entries.reduce((s, e) => s + e.mins, 0) || 1;
    legend.innerHTML = entries.map(e => `
      <div class="legend-row">
        <span class="legend-swatch" style="background:${e.color}"></span>
        <span class="legend-name">${escapeHtml(e.name)}</span>
        <span class="legend-val">${formatDur(e.mins)} · ${Math.round(e.mins/totalMin*100)}%</span>
      </div>`).join('');

    chartState.fullscreenChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e.name),
        datasets: [{ data: entries.map(e => Math.round(e.mins)), backgroundColor: entries.map(e => e.color), borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}: ${formatDur(c.parsed)}` } } }
      }
    });
  }
}

function closeChartFullscreen() {
  document.getElementById('chart-fullscreen').style.display = 'none';
  document.body.style.overflow = '';
  if (chartState.fullscreenChart) { chartState.fullscreenChart.destroy(); chartState.fullscreenChart = null; }
}

function formatDur(min) {
  if (!min) return '0m';
  if (min < 1) return '<1m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatDayShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}
function formatDateHuman(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

window.loadCharts = loadCharts;
window.applyCustomRange = applyCustomRange;
window.expandChart = expandChart;
window.closeChartFullscreen = closeChartFullscreen;

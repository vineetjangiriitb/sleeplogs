const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/study/status
router.get('/status', (req, res) => {
  const active = db.prepare(
    'SELECT * FROM study_sessions WHERE user_id = ? AND session_end IS NULL'
  ).get(req.userId);

  if (active) {
    const elapsed = (Date.now() - new Date(active.session_start + 'Z').getTime()) / 60000;
    res.json({ is_studying: true, current_session: { ...active, elapsed_minutes: Math.round(elapsed) } });
  } else {
    res.json({ is_studying: false, current_session: null });
  }
});

// POST /api/study/start
router.post('/start', (req, res) => {
  const active = db.prepare(
    'SELECT id FROM study_sessions WHERE user_id = ? AND session_end IS NULL'
  ).get(req.userId);
  if (active) return res.status(409).json({ error: 'Already studying' });

  const subject = req.body.subject || 'General';
  const now = nowStr();
  const result = db.prepare(
    'INSERT INTO study_sessions (user_id, subject, session_start) VALUES (?, ?, ?)'
  ).run(req.userId, subject, now);

  res.status(201).json({ id: result.lastInsertRowid, subject, session_start: now, status: 'studying' });
});

// POST /api/study/stop
router.post('/stop', (req, res) => {
  const active = db.prepare(
    'SELECT * FROM study_sessions WHERE user_id = ? AND session_end IS NULL'
  ).get(req.userId);
  if (!active) return res.status(409).json({ error: 'No active study session' });

  const now = nowStr();
  const duration = (new Date(now + 'Z') - new Date(active.session_start + 'Z')) / 60000;

  db.prepare(`
    UPDATE study_sessions SET session_end = ?, duration_minutes = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `).run(now, duration, req.body.notes || null, active.id, req.userId);

  res.json({ id: active.id, subject: active.subject, session_start: active.session_start,
    session_end: now, duration_minutes: Math.round(duration) });
});

// GET /api/study/records?days=30
router.get('/records', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const cutoff = cutoffStr(days);

  const records = db.prepare(`
    SELECT * FROM study_sessions
    WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
    ORDER BY session_start DESC LIMIT 100
  `).all(req.userId, cutoff);

  res.json({ records });
});

// GET /api/study/stats?days=7
router.get('/stats', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const cutoff = cutoffStr(days);

  const agg = db.prepare(`
    SELECT AVG(duration_minutes) as avg_dur, SUM(duration_minutes) as total_dur,
           COUNT(*) as total_sessions
    FROM study_sessions WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
  `).get(req.userId, cutoff);

  const daily = db.prepare(`
    SELECT DATE(session_start) as date, SUM(duration_minutes) as duration_minutes,
           COUNT(*) as sessions
    FROM study_sessions
    WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
    GROUP BY DATE(session_start) ORDER BY date ASC
  `).all(req.userId, cutoff);

  const bySubject = db.prepare(`
    SELECT subject, SUM(duration_minutes) as total_minutes, COUNT(*) as sessions
    FROM study_sessions WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
    GROUP BY subject ORDER BY total_minutes DESC
  `).all(req.userId, cutoff);

  res.json({
    avg_duration_minutes: Math.round(agg.avg_dur || 0),
    total_duration_minutes: Math.round(agg.total_dur || 0),
    total_sessions: agg.total_sessions,
    daily, bySubject
  });
});

// DELETE /api/study/:id
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM study_sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

function nowStr() {
  return new Date().toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
}
function cutoffStr(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = router;

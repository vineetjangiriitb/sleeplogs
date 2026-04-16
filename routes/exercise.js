const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/exercise — log a workout
router.post('/', (req, res) => {
  const { exercise_type, duration_minutes, intensity, calories, notes, logged_at } = req.body;
  if (!exercise_type || !duration_minutes) {
    return res.status(400).json({ error: 'exercise_type and duration_minutes are required' });
  }

  const at = logged_at || nowStr();
  const result = db.prepare(`
    INSERT INTO exercise_logs (user_id, exercise_type, logged_at, duration_minutes, intensity, calories, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.userId, exercise_type, at, duration_minutes, intensity || 'moderate', calories || null, notes || null);

  res.status(201).json({ id: result.lastInsertRowid, exercise_type, logged_at: at, duration_minutes });
});

// GET /api/exercise/records?days=30
router.get('/records', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const cutoff = cutoffStr(days);

  const records = db.prepare(`
    SELECT * FROM exercise_logs
    WHERE user_id = ? AND logged_at >= ?
    ORDER BY logged_at DESC LIMIT 100
  `).all(req.userId, cutoff);

  res.json({ records });
});

// GET /api/exercise/stats?days=7
router.get('/stats', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const cutoff = cutoffStr(days);

  const agg = db.prepare(`
    SELECT SUM(duration_minutes) as total_dur, COUNT(*) as total_workouts,
           AVG(duration_minutes) as avg_dur, SUM(calories) as total_calories
    FROM exercise_logs WHERE user_id = ? AND logged_at >= ?
  `).get(req.userId, cutoff);

  const daily = db.prepare(`
    SELECT DATE(logged_at) as date, SUM(duration_minutes) as duration_minutes,
           COUNT(*) as workouts, SUM(calories) as calories
    FROM exercise_logs WHERE user_id = ? AND logged_at >= ?
    GROUP BY DATE(logged_at) ORDER BY date ASC
  `).all(req.userId, cutoff);

  const byType = db.prepare(`
    SELECT exercise_type, SUM(duration_minutes) as total_minutes, COUNT(*) as workouts
    FROM exercise_logs WHERE user_id = ? AND logged_at >= ?
    GROUP BY exercise_type ORDER BY total_minutes DESC
  `).all(req.userId, cutoff);

  res.json({
    total_duration_minutes: Math.round(agg.total_dur || 0),
    total_workouts: agg.total_workouts,
    avg_duration_minutes: Math.round(agg.avg_dur || 0),
    total_calories: agg.total_calories || 0,
    daily, byType
  });
});

// DELETE /api/exercise/:id
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM exercise_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
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

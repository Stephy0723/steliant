// ============================================
// GlitchGang API - Match & Report Routes
// ============================================

const express = require('express');
const { loadMatches } = require('../../services/matchService');
const { loadReports } = require('../../services/reportService');

const router = express.Router();

// GET /match - Get all matches
router.get('/', (req, res) => {
  res.json(loadMatches());
});

// GET /match/active - Get active matches
router.get('/active', (req, res) => {
  const active = loadMatches().filter(m => m.status === 'in_progress');
  res.json(active);
});

// GET /match/:id - Get match by ID
router.get('/:id', (req, res) => {
  const match = loadMatches().find(m => m.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: `Partida "${req.params.id}" no encontrada` });
  }
  res.json(match);
});

module.exports = router;

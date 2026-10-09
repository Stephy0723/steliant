// ============================================
// GlitchGang API - Stats Routes
// ============================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadMatches } = require('../../services/matchService');
const { loadReports } = require('../../services/reportService');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'tournaments.json');

function loadTournaments() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

// GET /stats - Overview stats for dashboard
router.get('/', (req, res) => {
  const tournaments = loadTournaments();
  const matches = loadMatches();
  const reports = loadReports();

  const totalTeams = tournaments.reduce((sum, t) => sum + t.teams.length, 0);
  const totalPlayers = tournaments.reduce(
    (sum, t) => sum + t.teams.reduce((s, team) => s + team.players.length, 0), 0
  );

  res.json({
    tournaments: tournaments.length,
    activeTournament: tournaments.find(t => t.status === 'active')?.name || null,
    teams: totalTeams,
    players: totalPlayers,
    matches: {
      total: matches.length,
      active: matches.filter(m => m.status === 'in_progress').length,
      completed: matches.filter(m => m.status === 'completed').length,
    },
    reports: reports.length,
  });
});

module.exports = router;

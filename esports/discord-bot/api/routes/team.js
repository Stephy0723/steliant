// ============================================
// GlitchGang API - Team Routes
// ============================================

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'tournaments.json');

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// POST /team - Add team to a tournament
router.post('/', (req, res) => {
  const { name, tournamentId } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'El campo "name" es obligatorio' });
  }

  const tournaments = loadData();
  const target = tournamentId
    ? tournaments.find(t => t.id === Number(tournamentId))
    : tournaments.find(t => t.status === 'active') || tournaments[0];

  if (!target) {
    return res.status(404).json({ error: 'Torneo no encontrado' });
  }

  const exists = target.teams.some(
    t => t.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (exists) {
    return res.status(409).json({ error: `El equipo "${name}" ya existe en este torneo` });
  }

  const team = { name: name.trim(), players: [] };
  target.teams.push(team);
  saveData(tournaments);

  res.status(201).json({ team, tournamentId: target.id, tournament: target.name });
});

// GET /team/:name - Get team details
router.get('/:name', (req, res) => {
  const tournaments = loadData();
  const teamName = req.params.name.toLowerCase();

  for (const tournament of tournaments) {
    const team = tournament.teams.find(t => t.name.toLowerCase() === teamName);
    if (team) {
      return res.json({ team, tournamentId: tournament.id, tournament: tournament.name });
    }
  }

  res.status(404).json({ error: `Equipo "${req.params.name}" no encontrado` });
});

// DELETE /team - Delete a team from a tournament
router.delete('/', (req, res) => {
  const { name, tournamentId } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El campo "name" es obligatorio' });
  }

  const tournaments = loadData();
  const target = tournamentId
    ? tournaments.find(t => t.id === Number(tournamentId))
    : tournaments.find(t => t.status === 'active') || tournaments[0];

  if (!target) {
    return res.status(404).json({ error: 'Torneo no encontrado' });
  }

  const index = target.teams.findIndex(
    t => t.name.toLowerCase() === name.toLowerCase()
  );
  if (index === -1) {
    return res.status(404).json({ error: `Equipo "${name}" no encontrado` });
  }

  const removed = target.teams.splice(index, 1)[0];
  saveData(tournaments);
  res.json({ removed: removed.name, tournament: target.name });
});

module.exports = router;

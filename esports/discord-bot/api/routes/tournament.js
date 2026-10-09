// ============================================
// GlitchGang API - Tournament Routes
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
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /tournament - Get active tournament (first with status=active, or first overall)
router.get('/', (req, res) => {
  const tournaments = loadData();
  const active = tournaments.find(t => t.status === 'active') || tournaments[0];
  if (!active) {
    return res.status(404).json({ error: 'No hay torneos activos' });
  }
  res.json(active);
});

// GET /tournament/all - Get all tournaments
router.get('/all', (req, res) => {
  res.json(loadData());
});

// GET /tournament/:id - Get tournament by ID
router.get('/:id', (req, res) => {
  const tournaments = loadData();
  const tournament = tournaments.find(t => t.id === Number(req.params.id));
  if (!tournament) {
    return res.status(404).json({ error: 'Torneo no encontrado' });
  }
  res.json(tournament);
});

// POST /tournament - Create a new tournament
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'El campo "name" es obligatorio' });
  }

  const tournaments = loadData();
  const tournament = {
    id: tournaments.length > 0 ? Math.max(...tournaments.map(t => t.id)) + 1 : 1,
    name: name.trim(),
    status: tournaments.length === 0 ? 'active' : 'draft',
    teams: [],
    createdAt: new Date().toISOString(),
  };

  tournaments.push(tournament);
  saveData(tournaments);
  res.status(201).json(tournament);
});

// PUT /tournament/:id - Update tournament
router.put('/:id', (req, res) => {
  const tournaments = loadData();
  const tournament = tournaments.find(t => t.id === Number(req.params.id));
  if (!tournament) {
    return res.status(404).json({ error: 'Torneo no encontrado' });
  }

  if (req.body.name) tournament.name = req.body.name.trim();
  if (req.body.status) tournament.status = req.body.status;

  saveData(tournaments);
  res.json(tournament);
});

// PUT /tournament/:id/activate - Set a tournament as active (deactivates others)
router.put('/:id/activate', (req, res) => {
  const tournaments = loadData();
  const tournament = tournaments.find(t => t.id === Number(req.params.id));
  if (!tournament) {
    return res.status(404).json({ error: 'Torneo no encontrado' });
  }

  tournaments.forEach(t => {
    t.status = t.id === tournament.id ? 'active' : (t.status === 'active' ? 'inactive' : t.status);
  });

  saveData(tournaments);
  res.json(tournament);
});

// DELETE /tournament/:id - Delete a tournament
router.delete('/:id', (req, res) => {
  const tournaments = loadData();
  const index = tournaments.findIndex(t => t.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Torneo no encontrado' });
  }

  const removed = tournaments.splice(index, 1)[0];
  saveData(tournaments);
  res.json({ removed: removed.name });
});

module.exports = router;

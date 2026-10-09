// ============================================
// GlitchGang API - Player Routes
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

// POST /player - Add player to a team
router.post('/', (req, res) => {
  const { team: teamName, tournamentId, name, discordId, isLeader } = req.body;

  if (!teamName || !name) {
    return res.status(400).json({ error: 'Los campos "team" y "name" son obligatorios' });
  }

  const tournaments = loadData();
  let targetTeam = null;
  let targetTournament = null;

  const searchIn = tournamentId
    ? tournaments.filter(t => t.id === Number(tournamentId))
    : tournaments;

  for (const tournament of searchIn) {
    const team = tournament.teams.find(
      t => t.name.toLowerCase() === teamName.toLowerCase()
    );
    if (team) {
      targetTeam = team;
      targetTournament = tournament;
      break;
    }
  }

  if (!targetTeam) {
    return res.status(404).json({ error: `Equipo "${teamName}" no encontrado` });
  }

  if (discordId) {
    const exists = targetTeam.players.some(p => p.discordId === String(discordId));
    if (exists) {
      return res.status(409).json({ error: `El jugador con discordId "${discordId}" ya existe en ${teamName}` });
    }
  }

  const player = {
    discordId: discordId ? String(discordId) : '',
    name: name.trim(),
    isLeader: Boolean(isLeader),
  };

  if (player.isLeader) {
    targetTeam.players.forEach(p => { p.isLeader = false; });
  }

  targetTeam.players.push(player);
  saveData(tournaments);

  res.status(201).json({ player, team: targetTeam.name, tournament: targetTournament.name });
});

// DELETE /player/:discordId - Remove player by Discord ID
router.delete('/:discordId', (req, res) => {
  const { discordId } = req.params;
  const tournaments = loadData();

  for (const tournament of tournaments) {
    for (const team of tournament.teams) {
      const index = team.players.findIndex(p => p.discordId === discordId);
      if (index !== -1) {
        const removed = team.players.splice(index, 1)[0];
        saveData(tournaments);
        return res.json({ removed, team: team.name, tournament: tournament.name });
      }
    }
  }

  res.status(404).json({ error: `Jugador con discordId "${discordId}" no encontrado` });
});

module.exports = router;

const tournaments = [
  {
    id: "gg-mlbb-001",
    name: "GlitchGang MLBB Cup",
    game: "Mobile Legends",
    status: "open",
    startDate: "2026-09-05",
    maxTeams: 16,
    registeredTeams: 12,
    bracketUrl: "https://glitchgang.net/tournaments/gg-mlbb-001/bracket",
    rulesUrl: "https://glitchgang.net/tournaments/gg-mlbb-001/rules",
    discordUrl: "https://discord.gg/glitchgang"
  },
  {
    id: "gg-uni-001",
    name: "University Clash",
    game: "Mobile Legends",
    status: "open",
    startDate: "2026-09-12",
    maxTeams: 32,
    registeredTeams: 20,
    bracketUrl: "https://glitchgang.net/tournaments/gg-uni-001/bracket",
    rulesUrl: "https://glitchgang.net/tournaments/gg-uni-001/rules",
    discordUrl: "https://discord.gg/glitchgang"
  }
];

const teams = [
  {
    id: "team-neoxys",
    name: "NEOXYS",
    game: "Mobile Legends",
    region: "República Dominicana",
    members: ["Tephy", "Melu", "Lala", "Noa", "Laydi"]
  },
  {
    id: "team-eclipse",
    name: "Eclipse",
    game: "Mobile Legends",
    region: "Caribe",
    members: ["Player1", "Player2", "Player3", "Player4", "Player5"]
  }
];

const users = [
  {
    id: "user-demo-1",
    username: "Tephy",
    phone: "18095550000",
    game: "Mobile Legends",
    teamId: "team-neoxys",
    verified: true
  }
];

const matches = [
  {
    id: "match-001",
    tournamentId: "gg-mlbb-001",
    tournamentName: "GlitchGang MLBB Cup",
    teamA: "NEOXYS",
    teamB: "Eclipse",
    scheduledAt: "2026-09-05T20:00:00-04:00",
    checkinAt: "2026-09-05T19:15:00-04:00",
    discordUrl: "https://discord.gg/glitchgang",
    bracketUrl: "https://glitchgang.net/tournaments/gg-mlbb-001/bracket",
    status: "scheduled"
  }
];

const checkins = [];

module.exports = {
  tournaments,
  teams,
  users,
  matches,
  checkins
};

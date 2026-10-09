const XLSX = require('xlsx');

const HEADER_ALIASES = {
  tournament: [
    'torneo',
    'tournament',
    'nombretorneo',
    'nombredeltorneo',
    'torneonombre',
    'tournamentname',
  ],
  team: [
    'equipo',
    'team',
    'nombreequipo',
    'nombredelequipo',
    'equiponombre',
    'teamname',
  ],
  player: [
    'jugador',
    'player',
    'participante',
    'nombrejugador',
    'nombredeljugador',
    'nombredejugador',
    'nombreparticipante',
    'playername',
  ],
  discordId: ['discordid', 'discord', 'iddiscord', 'iddiscord', 'discorduserid'],
  discordUsername: [
    'discordusername',
    'discorduser',
    'discordnombre',
    'discordtag',
    'discordhandle',
    'usuariodiscord',
    'nombrediscord',
  ],
  leader: ['lider', 'liderdelequipo', 'capitan', 'leader', 'captain', 'isleader'],
};

function parseBoolean(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return ['1', 'true', 'si', 'yes', 'y', 'lider', 'leader', 'capitan', 'captain', 'x'].includes(
    normalized
  );
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function getValueByAlias(row, aliases) {
  const entries = Object.entries(row);

  for (const [key, value] of entries) {
    if (aliases.includes(normalizeHeader(key))) {
      return String(value || '').trim();
    }
  }

  return '';
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const tournamentsMap = new Map();

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
      blankrows: false,
    });

    rows.forEach((row) => {
      const tournamentName =
        getValueByAlias(row, HEADER_ALIASES.tournament) || `Importado ${sheetName}`;
      const teamName = getValueByAlias(row, HEADER_ALIASES.team) || 'Participantes';
      const playerName = getValueByAlias(row, HEADER_ALIASES.player);
      const discordId = getValueByAlias(row, HEADER_ALIASES.discordId);
      const discordUsername = getValueByAlias(row, HEADER_ALIASES.discordUsername);
      const isLeader = parseBoolean(getValueByAlias(row, HEADER_ALIASES.leader));

      if (!tournamentsMap.has(tournamentName)) {
        tournamentsMap.set(tournamentName, {
          name: tournamentName,
          teams: [],
        });
      }

      const tournament = tournamentsMap.get(tournamentName);
      let team = tournament.teams.find(
        (entry) => entry.name.toLowerCase() === teamName.toLowerCase()
      );

      if (!team) {
        team = {
          name: teamName,
          players: [],
        };
        tournament.teams.push(team);
      }

      if (playerName) {
        if (isLeader) {
          team.players.forEach((player) => {
            player.isLeader = false;
          });
        }

        team.players.push({
          name: playerName,
          discordId,
          discordUsername,
          isLeader,
        });
      }
    });
  });

  const tournaments = Array.from(tournamentsMap.values()).filter(
    (tournament) => tournament.name && tournament.teams.length > 0
  );

  if (tournaments.length === 0) {
    throw new Error(
      'No pude leer torneos desde el archivo. Usa columnas como torneo, equipo, jugador, discordId, discordUsername y lider.'
    );
  }

  return tournaments;
}

function getTemplateCsv() {
  return [
    'torneo,equipo,jugador,discordId,discordUsername,lider',
    'Torneo Test,Bandits,Tephy,123456789012345678,tephygg,si',
    'Torneo Test,Bandits,Bryan,223456789012345678,bryangg,no',
    'Torneo Test,Bandits,Mikasa,323456789012345678,mikasa.no,no',
    'Torneo Test,Rivals,Player 1,423456789012345678,rivalscap,si',
  ].join('\n');
}

function getTemplateWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['torneo', 'equipo', 'jugador', 'discordId', 'discordUsername', 'lider'],
    ['Torneo Test', 'Bandits', 'Tephy', '123456789012345678', 'tephygg', 'si'],
    ['Torneo Test', 'Bandits', 'Bryan', '223456789012345678', 'bryangg', 'no'],
    ['Torneo Test', 'Bandits', 'Mikasa', '323456789012345678', 'mikasa.no', 'no'],
    ['Torneo Test', 'Rivals', 'Player 1', '423456789012345678', 'rivalscap', 'si'],
  ]);

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Torneos');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function getDemoTournaments() {
  return [
    {
      name: 'Copa Demo GlitchGang',
      teams: [
        {
          name: 'Bandits',
          players: [
            { name: 'Tephy', discordId: '123456789012345678', isLeader: true },
            { name: 'Bryan', discordId: '223456789012345678', isLeader: false },
            { name: 'Mikasa', discordId: '323456789012345678', isLeader: false },
          ],
        },
        {
          name: 'Rivals',
          players: [
            { name: 'Afeliz', discordId: '423456789012345678', isLeader: true },
            { name: 'Nyx', discordId: '523456789012345678', isLeader: false },
            { name: 'Luna', discordId: '623456789012345678', isLeader: false },
          ],
        },
      ],
    },
  ];
}

module.exports = {
  getDemoTournaments,
  getTemplateCsv,
  getTemplateWorkbookBuffer,
  parseWorkbook,
};

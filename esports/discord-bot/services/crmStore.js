const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'tournaments.json');

function nowIso() {
  return new Date().toISOString();
}

function normalizeId(value) {
  return String(value || '').trim();
}

function normalizeName(value, fallback) {
  const name = String(value || '').trim();
  return name || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeMoney(value, fallback = 0) {
  return Math.max(0, normalizeNumber(value, fallback));
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();

    if (['true', '1', 'si', 'sí', 'yes', 'y', 'on', 'enabled'].includes(lowered)) {
      return true;
    }

    if (['false', '0', 'no', 'off', 'disabled'].includes(lowered)) {
      return false;
    }
  }

  return Boolean(value);
}

function normalizeAccessModel(value, fallback = 'free') {
  const lowered = String(value || '').trim().toLowerCase();

  if (['commission', 'comision', 'comisión'].includes(lowered)) {
    return 'commission';
  }

  if (['per_tournament', 'per-tournament', 'fee', 'fixed', 'fixed_fee', 'pago'].includes(lowered)) {
    return 'per_tournament';
  }

  if (['platform-only', 'platform_only', 'solo-plataforma', 'solo_plataforma'].includes(lowered)) {
    return 'platform-only';
  }

  if (lowered === 'free' || lowered === 'gratis') {
    return 'free';
  }

  return fallback;
}

function sanitizeDiscordUsername(value) {
  return String(value || '').trim().replace(/^@+/, '');
}

function isValidDiscordId(value) {
  return /^\d{17,20}$/.test(String(value || '').trim());
}

function isValidLegacyDiscordTag(value) {
  return /^.{2,32}#[0-9]{4}$/.test(String(value || '').trim());
}

function isValidModernDiscordUsername(value) {
  return /^(?=.{2,32}$)(?!.*\.\.)(?![_.])(?!.*[_.]$)[a-z0-9._]+$/.test(
    String(value || '').trim().toLowerCase()
  );
}

function isValidDiscordUsername(value) {
  const username = sanitizeDiscordUsername(value);
  if (!username) return false;
  return isValidLegacyDiscordTag(username) || isValidModernDiscordUsername(username);
}

function normalizeDiscordUsername(value) {
  const username = sanitizeDiscordUsername(value);
  if (!username) return '';
  return username.includes('#') ? username : username.toLowerCase();
}

function buildDiscordIdentity(player = {}, options = {}) {
  const discordId = String(player?.discordId || '').trim();
  const discordUsername = normalizeDiscordUsername(
    player?.discordUsername || player?.discordTag || player?.discord || ''
  );
  const hasDiscordId = Boolean(discordId);
  const hasDiscordUsername = Boolean(discordUsername);
  const validDiscordId = !hasDiscordId || isValidDiscordId(discordId);
  const validDiscordUsername = !hasDiscordUsername || isValidDiscordUsername(discordUsername);

  if (options.strict && !hasDiscordId && !hasDiscordUsername) {
    throw new Error('Debes registrar un Discord ID o un nombre de Discord valido.');
  }

  if (options.strict && hasDiscordId && !validDiscordId) {
    throw new Error('El Discord ID debe ser un numero real de 17 a 20 digitos.');
  }

  if (options.strict && hasDiscordUsername && !validDiscordUsername) {
    throw new Error('El nombre de Discord no tiene un formato valido. Usa el username exacto o el formato usuario#1234.');
  }

  if (options.strict && options.requireStrongIdentity && !hasDiscordId) {
    throw new Error('El lider del equipo debe tener un Discord ID valido para evitar suplantaciones.');
  }

  let identityStatus = 'missing';

  if (hasDiscordId && validDiscordId) {
    identityStatus = 'verified';
  } else if (hasDiscordUsername && validDiscordUsername) {
    identityStatus = 'username_only';
  } else if (hasDiscordId || hasDiscordUsername) {
    identityStatus = 'invalid';
  }

  return {
    discordId,
    discordUsername,
    identityVerified: identityStatus === 'verified',
    identityStatus,
  };
}

function ensureStore() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, '[]');
  }
}

function normalizePlayer(player, options = {}) {
  const identity = buildDiscordIdentity(player, options);

  return {
    discordId: identity.discordId,
    discordUsername: identity.discordUsername,
    identityVerified: identity.identityVerified,
    identityStatus: identity.identityStatus,
    name: normalizeName(player?.name, 'Jugador sin nombre'),
    isLeader: Boolean(player?.isLeader),
  };
}

function normalizeTeam(team, index, options = {}) {
  return {
    name: normalizeName(team?.name, `Equipo ${index + 1}`),
    players: Array.isArray(team?.players) ? team.players.map((player) => normalizePlayer(player, options)) : [],
  };
}

function normalizeOrganizer(organizer = {}, fallbackType = 'glitchgang') {
  const inputType = String(
    organizer?.type
    || organizer?.ownerType
    || organizer?.kind
    || fallbackType
  ).trim().toLowerCase();

  const type = ['partner', 'external', 'empresa', 'organizador', 'third-party', 'third_party'].includes(inputType)
    ? 'partner'
    : 'glitchgang';

  return {
    type,
    name: normalizeName(
      organizer?.name || organizer?.organizerName || organizer?.companyName,
      type === 'glitchgang' ? 'GlitchGang' : 'Organizador externo'
    ),
    partnerId: normalizeId(organizer?.partnerId),
    websiteId: normalizeId(organizer?.websiteId || organizer?.portalId),
    contactName: normalizeName(organizer?.contactName, ''),
    email: normalizeName(organizer?.email, ''),
  };
}

function normalizeCommercial(commercial = {}, organizer, botRequested) {
  let accessModel = normalizeAccessModel(
    commercial?.accessModel || commercial?.billingMode || commercial?.model,
    organizer.type === 'glitchgang'
      ? 'free'
      : (botRequested ? 'commission' : 'platform-only')
  );

  if (organizer.type === 'glitchgang') {
    accessModel = 'free';
  }

  return {
    accessModel,
    perTournamentFee: accessModel === 'per_tournament'
      ? normalizeMoney(commercial?.perTournamentFee || commercial?.fee, 25)
      : normalizeMoney(commercial?.perTournamentFee || commercial?.fee, 0),
    commissionRate: accessModel === 'commission'
      ? normalizeNumber(commercial?.commissionRate || commercial?.commission, 12)
      : normalizeNumber(commercial?.commissionRate || commercial?.commission, 0),
    currency: normalizeName(commercial?.currency, 'USD'),
    settlementStatus:
      organizer.type === 'glitchgang'
        ? 'included'
        : accessModel === 'commission'
          ? 'commission-agreement'
          : accessModel === 'per_tournament'
            ? 'payment-required'
            : accessModel === 'platform-only'
              ? 'platform-only'
              : 'included',
  };
}

function normalizeBot(bot = {}, organizer, commercial, requestedEnabled) {
  const enabled = organizer.type === 'glitchgang'
    ? normalizeBoolean(requestedEnabled ?? bot?.enabled ?? bot?.useBot, true)
    : normalizeBoolean(requestedEnabled ?? bot?.enabled ?? bot?.useBot, false);

  return {
    enabled,
    access:
      organizer.type === 'glitchgang'
        ? 'free'
        : commercial.accessModel === 'commission'
          ? 'commission'
          : commercial.accessModel === 'per_tournament'
            ? 'paid'
            : 'disabled',
    status:
      !enabled
        ? 'disabled'
        : organizer.type === 'glitchgang'
          ? 'included'
          : commercial.accessModel === 'commission'
            ? 'commission'
            : 'paid',
    voiceAutomation: normalizeBoolean(bot?.voiceAutomation, enabled),
    commandsEnabled: normalizeBoolean(bot?.commandsEnabled, enabled),
    syncedAt: bot?.syncedAt || null,
  };
}

function normalizeSource(source = {}, organizer, fallbackType = '') {
  const type = normalizeName(
    source?.type || source?.channel || fallbackType,
    organizer.type === 'glitchgang' ? 'glitchgang-web' : 'partner-api'
  );

  return {
    type,
    externalId: normalizeId(source?.externalId || source?.portalTournamentId || source?.id),
    syncedAt: source?.syncedAt || nowIso(),
    createdBy: normalizeName(source?.createdBy, ''),
    channel: normalizeName(source?.channel, type),
  };
}

function hydrateTournamentPayload(payload = {}) {
  const organizer = typeof payload.organizer === 'object' && payload.organizer
    ? { ...payload.organizer }
    : {};
  const commercial = typeof payload.commercial === 'object' && payload.commercial
    ? { ...payload.commercial }
    : {};
  const bot = typeof payload.bot === 'object' && payload.bot
    ? { ...payload.bot }
    : {};
  const source = typeof payload.source === 'object' && payload.source
    ? { ...payload.source }
    : {};

  if (payload.organizerType) organizer.type = payload.organizerType;
  if (payload.organizerName) organizer.name = payload.organizerName;
  if (payload.partnerId) organizer.partnerId = payload.partnerId;
  if (payload.contactName) organizer.contactName = payload.contactName;
  if (payload.contactEmail || payload.email) organizer.email = payload.contactEmail || payload.email;

  if (Object.prototype.hasOwnProperty.call(payload, 'botEnabled')) bot.enabled = payload.botEnabled;
  if (Object.prototype.hasOwnProperty.call(payload, 'useBot')) bot.enabled = payload.useBot;
  if (Object.prototype.hasOwnProperty.call(payload, 'voiceAutomation')) bot.voiceAutomation = payload.voiceAutomation;

  if (payload.accessModel) commercial.accessModel = payload.accessModel;
  if (payload.billingMode) commercial.accessModel = payload.billingMode;
  if (Object.prototype.hasOwnProperty.call(payload, 'commissionRate')) commercial.commissionRate = payload.commissionRate;
  if (Object.prototype.hasOwnProperty.call(payload, 'perTournamentFee')) commercial.perTournamentFee = payload.perTournamentFee;
  if (payload.currency) commercial.currency = payload.currency;

  if (payload.externalId) source.externalId = payload.externalId;
  if (payload.sourceType) source.type = payload.sourceType;
  if (payload.createdBy) source.createdBy = payload.createdBy;

  return {
    ...payload,
    organizer,
    commercial,
    bot,
    source,
  };
}

function mergeTournamentInput(existing, payload = {}) {
  const hydrated = hydrateTournamentPayload(payload);

  return {
    ...existing,
    ...hydrated,
    organizer: {
      ...(existing?.organizer || {}),
      ...(hydrated.organizer || {}),
    },
    commercial: {
      ...(existing?.commercial || {}),
      ...(hydrated.commercial || {}),
    },
    bot: {
      ...(existing?.bot || {}),
      ...(hydrated.bot || {}),
    },
    source: {
      ...(existing?.source || {}),
      ...(hydrated.source || {}),
    },
    teams: Array.isArray(hydrated.teams) ? hydrated.teams : (existing?.teams || []),
  };
}

function normalizeTournament(tournament, index, options = {}) {
  const merged = mergeTournamentInput({}, tournament);
  const requestedBotEnabled =
    merged?.bot?.enabled
    ?? merged?.botEnabled
    ?? merged?.useBot;
  const organizer = normalizeOrganizer(
    merged.organizer,
    options.defaultOrganizerType || merged.organizerType || 'glitchgang'
  );
  const commercial = normalizeCommercial(merged.commercial, organizer, normalizeBoolean(requestedBotEnabled, organizer.type === 'glitchgang'));
  const bot = normalizeBot(merged.bot, organizer, commercial, requestedBotEnabled);
  const source = normalizeSource(merged.source, organizer, options.sourceType || merged.sourceType || '');

  return {
    id: normalizeId(merged?.id) || String(Date.now() + index),
    name: normalizeName(merged?.name, `Torneo ${index + 1}`),
    active: options.forceActive !== undefined
      ? Boolean(options.forceActive)
      : Boolean(merged?.active || merged?.status === 'active' || merged?.isActive),
    organizer,
    commercial,
    bot,
    source,
    teams: Array.isArray(merged?.teams)
      ? merged.teams.map((team, teamIndex) => normalizeTeam(team, teamIndex, {
        strict: Boolean(options.strictPlayerIdentity),
        requireStrongIdentity: false,
      }))
      : [],
    createdAt: merged?.createdAt || nowIso(),
    updatedAt: merged?.updatedAt || nowIso(),
  };
}

function normalizeTournaments(tournaments) {
  const normalized = Array.isArray(tournaments)
    ? tournaments.map((tournament, index) => normalizeTournament(tournament, index))
    : [];

  if (normalized.length > 0 && !normalized.some((tournament) => tournament.active)) {
    normalized[0].active = true;
  }

  if (normalized.filter((tournament) => tournament.active).length > 1) {
    let found = false;

    normalized.forEach((tournament) => {
      if (tournament.active && !found) {
        found = true;
        return;
      }

      tournament.active = false;
    });
  }

  return normalized;
}

function loadTournaments() {
  ensureStore();

  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const normalized = normalizeTournaments(raw);

  if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
    fs.writeFileSync(FILE, JSON.stringify(normalized, null, 2));
  }

  return normalized;
}

function saveTournaments(tournaments) {
  const normalized = normalizeTournaments(tournaments);
  fs.writeFileSync(FILE, JSON.stringify(normalized, null, 2));
  return normalized;
}

function getActiveTournament(tournaments = loadTournaments()) {
  return tournaments.find((tournament) => tournament.active) || tournaments[0] || null;
}

function getBotEnabledTournament(tournaments = loadTournaments()) {
  const activeTournament = getActiveTournament(tournaments);

  if (activeTournament?.bot?.enabled) {
    return activeTournament;
  }

  return null;
}

function createTournament(payload = {}) {
  const tournaments = loadTournaments();
  const shouldActivate = tournaments.length === 0 || Boolean(payload.makeActive);
  const newTournament = normalizeTournament(
    {
      ...payload,
      id: String(Date.now()),
      active: shouldActivate,
      sourceType: payload.sourceType || 'crm',
      updatedAt: nowIso(),
      createdAt: nowIso(),
    },
    tournaments.length,
    {
      forceActive: shouldActivate,
      defaultOrganizerType: payload.organizerType || 'glitchgang',
      sourceType: payload.sourceType || 'crm',
    }
  );

  if (shouldActivate) {
    tournaments.forEach((tournament) => {
      tournament.active = false;
    });
  }

  tournaments.push(newTournament);
  saveTournaments(tournaments);

  return newTournament;
}

function activateTournament(tournamentId) {
  const tournaments = loadTournaments();
  const normalizedId = normalizeId(tournamentId);
  const tournament = tournaments.find((entry) => entry.id === normalizedId);

  if (!tournament) {
    return null;
  }

  tournaments.forEach((entry) => {
    entry.active = entry.id === normalizedId;
    entry.updatedAt = nowIso();
  });

  saveTournaments(tournaments);
  return tournament;
}

function addTeam({ tournamentId, teamName }) {
  const tournaments = loadTournaments();
  const tournament = tournaments.find(
    (entry) => entry.id === normalizeId(tournamentId)
  );

  if (!tournament) {
    return { error: 'Torneo no encontrado.' };
  }

  const cleanName = normalizeName(teamName, '');
  if (!cleanName) {
    return { error: 'El equipo necesita un nombre.' };
  }

  const exists = tournament.teams.find(
    (team) => team.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (exists) {
    return { error: 'Ese equipo ya existe dentro del torneo.' };
  }

  const team = {
    name: cleanName,
    players: [],
  };

  tournament.teams.push(team);
  tournament.updatedAt = nowIso();
  saveTournaments(tournaments);

  return { tournament, team };
}

function addPlayer({ tournamentId, teamName, player }) {
  const tournaments = loadTournaments();
  const tournament = tournaments.find(
    (entry) => entry.id === normalizeId(tournamentId)
  );

  if (!tournament) {
    return { error: 'Torneo no encontrado.' };
  }

  const team = tournament.teams.find(
    (entry) => entry.name.toLowerCase() === normalizeName(teamName, '').toLowerCase()
  );

  if (!team) {
    return { error: 'Equipo no encontrado.' };
  }

  const playerName = normalizeName(player?.name, '');
  if (!playerName) {
    return { error: 'El jugador necesita un nombre.' };
  }

  let identity;

  try {
    identity = buildDiscordIdentity(player, {
      strict: true,
      requireStrongIdentity: Boolean(player?.isLeader),
    });
  } catch (error) {
    return { error: error.message };
  }

  const duplicate = team.players.find((entry) => {
    if (identity.discordId && entry.discordId) {
      return entry.discordId === identity.discordId;
    }

    if (identity.discordUsername && entry.discordUsername) {
      return entry.discordUsername.toLowerCase() === identity.discordUsername.toLowerCase();
    }

    return entry.name.toLowerCase() === playerName.toLowerCase();
  });

  if (duplicate) {
    return { error: 'Ese jugador ya existe dentro del equipo.' };
  }

  if (player?.isLeader) {
    team.players.forEach((entry) => {
      entry.isLeader = false;
    });
  }

  team.players.push({
    name: playerName,
    discordId: identity.discordId,
    discordUsername: identity.discordUsername,
    identityVerified: identity.identityVerified,
    identityStatus: identity.identityStatus,
    isLeader: Boolean(player?.isLeader),
  });

  tournament.updatedAt = nowIso();
  saveTournaments(tournaments);
  return { tournament, team };
}

function findTournamentForSync(tournaments, payload = {}) {
  const incoming = hydrateTournamentPayload(payload);
  const incomingId = normalizeId(incoming.id);
  const incomingExternalId = normalizeId(incoming.externalId || incoming.source?.externalId);
  const incomingSourceType = normalizeName(incoming.sourceType || incoming.source?.type, '');
  const organizer = normalizeOrganizer(incoming.organizer, incoming.organizerType || 'glitchgang');

  return tournaments.find((entry) => {
    if (incomingId && entry.id === incomingId) {
      return true;
    }

    if (
      incomingExternalId
      && normalizeId(entry.source?.externalId) === incomingExternalId
      && normalizeName(entry.source?.type, '') === incomingSourceType
    ) {
      return true;
    }

    return (
      entry.name.toLowerCase() === normalizeName(incoming.name, '').toLowerCase()
      && entry.organizer?.type === organizer.type
      && entry.organizer?.name.toLowerCase() === organizer.name.toLowerCase()
    );
  }) || null;
}

function upsertSyncedTournament(payload = {}, options = {}) {
  const tournaments = loadTournaments();
  const existing = findTournamentForSync(tournaments, payload);
  const index = existing
    ? tournaments.findIndex((entry) => entry.id === existing.id)
    : tournaments.length;
  const mergedInput = mergeTournamentInput(existing, {
    ...payload,
    active: options.makeActive !== undefined
      ? options.makeActive
      : (payload.active ?? existing?.active ?? false),
    sourceType: options.sourceType || payload.sourceType,
    organizerType: options.defaultOrganizerType || payload.organizerType,
    organizerName: options.defaultOrganizerName || payload.organizerName,
    partnerId: options.partnerId || payload.partnerId,
    updatedAt: nowIso(),
    createdAt: existing?.createdAt || payload.createdAt || nowIso(),
  });
  const normalized = normalizeTournament(
    {
      ...mergedInput,
      id: existing?.id || normalizeId(payload.id) || `sync_${Date.now()}`,
    },
    index,
    {
      forceActive: options.makeActive !== undefined
        ? options.makeActive
        : Boolean(mergedInput.active),
      defaultOrganizerType: options.defaultOrganizerType || mergedInput.organizerType || existing?.organizer?.type || 'glitchgang',
      sourceType: options.sourceType || mergedInput.sourceType || existing?.source?.type || '',
    }
  );

  if (normalized.active) {
    tournaments.forEach((tournament) => {
      tournament.active = false;
    });
  }

  if (existing && index >= 0) {
    tournaments[index] = normalized;
  } else {
    tournaments.push(normalized);
  }

  const saved = saveTournaments(tournaments);

  return {
    created: !existing,
    tournament: saved.find((entry) => entry.id === normalized.id) || normalized,
    tournaments: saved,
    activeTournament: getActiveTournament(saved),
  };
}

function upsertImportedTournaments(importedTournaments, makeActive) {
  const tournaments = loadTournaments();
  let firstImportedId = null;

  importedTournaments.forEach((importedTournament, index) => {
    const existing = findTournamentForSync(tournaments, {
      ...importedTournament,
      sourceType: 'import',
    });
    const mergedInput = mergeTournamentInput(existing, {
      ...importedTournament,
      sourceType: 'import',
      updatedAt: nowIso(),
      createdAt: existing?.createdAt || nowIso(),
    });
    const normalizedTournament = normalizeTournament(
      {
        ...mergedInput,
        id: existing?.id || String(Date.now() + index),
      },
      index,
      {
        forceActive: false,
        defaultOrganizerType: existing?.organizer?.type || 'glitchgang',
        sourceType: 'import',
      }
    );

    if (existing) {
      const existingIndex = tournaments.findIndex((entry) => entry.id === existing.id);
      tournaments[existingIndex] = normalizedTournament;
      if (!firstImportedId) {
        firstImportedId = existing.id;
      }
      return;
    }

    tournaments.push(normalizedTournament);

    if (!firstImportedId) {
      firstImportedId = normalizedTournament.id;
    }
  });

  if (makeActive && firstImportedId) {
    tournaments.forEach((tournament) => {
      tournament.active = tournament.id === firstImportedId;
      tournament.updatedAt = nowIso();
    });
  }

  const saved = saveTournaments(tournaments);

  return {
    tournaments: saved,
    activeTournament: getActiveTournament(saved),
  };
}

function deleteTournament(tournamentId) {
  const tournaments = loadTournaments();
  const normalizedId = normalizeId(tournamentId);
  const index = tournaments.findIndex((entry) => entry.id === normalizedId);

  if (index === -1) {
    return { error: 'Torneo no encontrado.' };
  }

  const wasActive = tournaments[index].active;
  tournaments.splice(index, 1);

  if (wasActive && tournaments.length > 0) {
    tournaments[0].active = true;
  }

  const saved = saveTournaments(tournaments);
  return { tournaments: saved, activeTournament: getActiveTournament(saved) };
}

function renameTournament(tournamentId, newName) {
  const tournaments = loadTournaments();
  const normalizedId = normalizeId(tournamentId);
  const tournament = tournaments.find((entry) => entry.id === normalizedId);

  if (!tournament) {
    return { error: 'Torneo no encontrado.' };
  }

  const cleanName = normalizeName(newName, '');
  if (!cleanName) {
    return { error: 'El torneo necesita un nombre.' };
  }

  tournament.name = cleanName;
  tournament.updatedAt = nowIso();
  saveTournaments(tournaments);
  return { tournament };
}

module.exports = {
  addPlayer,
  addTeam,
  activateTournament,
  createTournament,
  deleteTournament,
  getActiveTournament,
  getBotEnabledTournament,
  loadTournaments,
  normalizeTournament,
  renameTournament,
  saveTournaments,
  upsertImportedTournaments,
  upsertSyncedTournament,
};

// Formato compartido de torneos, equipos y grabaciones para las paginas del
// CRM. Los torneos reales traen los campos del modelo Tournament del backend
// (status, game, date, maxSlots...); los de prueba local no, asi que todo
// aqui tolera campos ausentes.

const STATUS = {
  draft: { label: 'Borrador', accent: 'muted' },
  open: { label: 'Inscripciones abiertas', accent: 'green' },
  registration_closed: { label: 'Inscripciones cerradas', accent: 'amber' },
  ongoing: { label: 'En curso', accent: 'blue' },
  finished: { label: 'Finalizado', accent: 'muted' },
  cancelled: { label: 'Cancelado', accent: 'red' },
};

export const STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'open', label: 'Abiertos' },
  { id: 'registration_closed', label: 'Inscripción cerrada' },
  { id: 'ongoing', label: 'En curso' },
  { id: 'finished', label: 'Finalizados' },
  { id: 'draft', label: 'Borradores' },
  { id: 'cancelled', label: 'Cancelados' },
];

const FORMAT = {
  single_elimination: 'Eliminación simple',
  double_elimination: 'Doble eliminación',
  round_robin: 'Round robin',
  swiss: 'Suizo',
  custom: 'Personalizado',
};

const PLATFORM = { pc: 'PC', mobile: 'Móvil', console: 'Consola', cross: 'Crossplay' };

const PROVISION = {
  none: { label: 'Discord sin crear', accent: 'muted' },
  pending: { label: 'Discord en cola', accent: 'amber' },
  processing: { label: 'Creando en Discord', accent: 'amber' },
  ready: { label: 'Discord listo', accent: 'green' },
  partial: { label: 'Discord incompleto', accent: 'amber' },
  failed: { label: 'Discord falló', accent: 'red' },
};

const REGISTRATION = {
  registered: { label: 'Inscrito', accent: 'muted' },
  checked_in: { label: 'Check-in hecho', accent: 'green' },
  disqualified: { label: 'Descalificado', accent: 'red' },
  withdrawn: { label: 'Retirado', accent: 'muted' },
};

// Estado de la inscripcion del equipo en ESE torneo. El backend todavia no
// lo manda en /api/bots/tournaments/:id/teams (ver BACKEND-PENDIENTE.md);
// cuando llegue, aparece solo.
export function registrationStatus(team) {
  const key = team?.registrationStatus;
  return key && REGISTRATION[key] ? { key, ...REGISTRATION[key] } : null;
}

export function isRealTournament(t) {
  return t?.source?.type === 'backend';
}

export function tournamentStatus(t) {
  if (t?.status && STATUS[t.status]) return { key: t.status, ...STATUS[t.status] };
  const hasTeams = (t?.teams || []).length > 0;
  return hasTeams
    ? { key: 'local', label: 'Prueba local', accent: 'amber' }
    : { key: 'local', label: 'Prueba vacía', accent: 'muted' };
}

export function formatLabel(format) {
  return FORMAT[format] || format || '';
}

export function platformLabel(platform) {
  return PLATFORM[platform] || platform || '';
}

export function provisionStatus(t) {
  const key = t?.discordProvision?.status;
  return key && PROVISION[key] ? { key, ...PROVISION[key] } : null;
}

export function formatDate(iso, withTime = false) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatMoney(amount, currency = 'USD') {
  const value = Number(amount || 0);
  if (!value) return '';
  try {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatDuration(ms) {
  const seconds = Math.floor(Number(ms || 0) / 1000);
  if (seconds <= 0) return '0s';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function countPlayers(t) {
  return (t?.teams || []).reduce((total, team) => total + (team.players || []).length, 0);
}

export function slotsInfo(t) {
  const max = Number(t?.maxSlots || 0);
  const used = (t?.teams || []).length || Number(t?.currentSlots || 0);
  return { max, used, pct: max ? Math.min(100, Math.round((used / max) * 100)) : 0 };
}

export function teamLeader(team) {
  return (team?.players || []).find((p) => p.isLeader) || null;
}

export function verifiedCount(team) {
  return (team?.players || []).filter((p) => p.discordId).length;
}

// Un equipo puede estar inscrito en varios torneos: se agrupa por id (o por
// nombre en los torneos de prueba, que no traen id) y se juntan sus torneos.
export function aggregateTeams(tournaments) {
  const byKey = new Map();
  for (const tournament of tournaments) {
    for (const team of tournament.teams || []) {
      const key = team.id || `local:${String(team.name || '').toLowerCase()}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          id: team.id || '',
          name: team.name,
          tag: team.tag || '',
          players: team.players || [],
          tournaments: [],
        });
      }
      const entry = byKey.get(key);
      // El roster mas grande gana (los torneos viejos pueden traer uno parcial).
      if ((team.players || []).length > entry.players.length) entry.players = team.players;
      entry.tournaments.push({
        id: tournament.id,
        name: tournament.name,
        status: tournamentStatus(tournament),
        registrationStatus: team.registrationStatus || '',
        real: isRealTournament(tournament),
      });
    }
  }
  return [...byKey.values()];
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename, header, rows) {
  const body = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  // BOM para que Excel abra bien los acentos.
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function rosterCsvRows(tournamentName, teams) {
  const rows = [];
  for (const team of teams) {
    const players = team.players || [];
    if (!players.length) rows.push([tournamentName, team.name, team.tag || '', '', '', '', '']);
    for (const p of players) {
      rows.push([tournamentName, team.name, team.tag || '', p.name, p.isLeader ? 'Sí' : '', p.discordUsername || '', p.discordId || '']);
    }
  }
  return rows;
}

export const ROSTER_CSV_HEADER = ['Torneo', 'Equipo', 'Tag', 'Jugador', 'Líder', 'Discord', 'Discord ID'];

export function slugify(text) {
  return String(text || 'torneo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

const UPLOAD = {
  uploaded: { label: 'Guardada en la web', accent: 'green' },
  pending: { label: 'Subiendo', accent: 'amber' },
  failed: { label: 'Falló la subida', accent: 'red' },
  orphan: { label: 'Sin partida en la web', accent: 'amber' },
  legacy: { label: 'Formato viejo (inservible)', accent: 'muted' },
  expired: { label: 'Borrada (30 días)', accent: 'muted' },
};

export function uploadStatus(rec) {
  if (rec?.status === 'recording') return { key: 'recording', label: 'Grabando ahora', accent: 'blue' };
  const key = rec?.uploadStatus;
  return key && UPLOAD[key] ? { key, ...UPLOAD[key] } : { key: key || 'unknown', label: key || 'Sin estado', accent: 'muted' };
}

export const UPLOAD_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'uploaded', label: 'Guardadas' },
  { id: 'recording', label: 'Grabando' },
  { id: 'pending', label: 'Subiendo' },
  { id: 'failed', label: 'Fallidas' },
  { id: 'legacy', label: 'Formato viejo' },
];

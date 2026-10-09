// ============================================
// GlitchGang Bot - Check-in Monitor
// ============================================

const { MATCH_STATUS } = require('../utils/constants');
const { errorEmbed } = require('../utils/embeds');
const { disqualifyCheckin, getExpiredCheckins, getTournamentMatches } = require('./liveMatchService');
const { getActiveTournaments } = require('./tournamentService');
const { pushActivity } = require('./activityService');
const { refreshTournamentsPanel } = require('./tournamentsPanel');

const timers = new Map();
const reminderTimers = new Map();

const REMINDER_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before deadline

function clearCheckinTimer(matchId) {
  const timer = timers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(matchId);
  }

  const reminder = reminderTimers.get(matchId);
  if (reminder) {
    clearTimeout(reminder);
    reminderTimers.delete(matchId);
  }
}

function formatDiscordTimestamp(isoString, style = 't') {
  if (!isoString) return 'N/D';
  return `<t:${Math.floor(new Date(isoString).getTime() / 1000)}:${style}>`;
}

function formatClock(isoString) {
  if (!isoString) return 'N/D';

  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

function formatWindowLabel(ms) {
  const minutes = Math.round(Number(ms || 0) / 60000);

  if (minutes >= 1440) return '1 dia';
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hora(s)`;
  return `${minutes} minutos`;
}

async function notifyCheckinReminder(client, match) {
  const channelId = match.notificationChannelId || match.channelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const { warningEmbed } = require('../utils/embeds');
  const embed = warningEmbed(
    'Recordatorio de check-in',
    [
      `⏰ Al equipo **${match.teamName}** le quedan **5 minutos** para completar el check-in.`,
      '',
      `Límite: ${formatDiscordTimestamp(match.checkinDeadlineAt, 'T')}`,
      '',
      'Si no completan el check-in a tiempo, el equipo será descalificado automáticamente.',
    ].join('\n')
  );

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function notifyDisqualification(client, match) {
  const channelId = match.notificationChannelId || match.channelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = errorEmbed(
    'Equipo descalificado',
    [
      `El equipo **${match.teamName}** no completo el check-in dentro de la ventana establecida (${formatWindowLabel(match.checkinWindowMs)}).`,
      '',
      `Solicitado: ${formatDiscordTimestamp(match.requestedAt, 't')}`,
      `Limite: ${formatDiscordTimestamp(match.checkinDeadlineAt, 't')}`,
      '',
      'El CRM fue actualizado con esta descalificacion.',
    ].join('\n')
  );

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function expireCheckin(client, match) {
  clearCheckinTimer(match.id);

  const updated = await disqualifyCheckin(
    match.id,
    `No completo el check-in dentro de la ventana establecida (${formatWindowLabel(match.checkinWindowMs)}).`
  );

  if (!updated) {
    return null;
  }

  pushActivity(
    'checkin-disqualified',
    `Equipo "${updated.teamName}" descalificado por no completar el check-in antes de las ${formatClock(updated.checkinDeadlineAt)}.`,
    'Sistema'
  );

  await notifyDisqualification(client, updated);
  return updated;
}

function scheduleCheckinTimer(client, match) {
  clearCheckinTimer(match.id);

  if (match.status !== MATCH_STATUS.CHECKING_IN || !match.checkinDeadlineAt) {
    return;
  }

  const deadlineTime = new Date(match.checkinDeadlineAt).getTime();
  const delay = deadlineTime - Date.now();

  if (delay <= 0) {
    void expireCheckin(client, match);
    return;
  }

  const timeout = setTimeout(() => {
    void expireCheckin(client, match);
  }, delay);

  timers.set(match.id, timeout);

  // Schedule reminder 5 minutes before deadline (only if there's enough time left)
  const reminderDelay = delay - REMINDER_BEFORE_MS;
  if (reminderDelay > 0) {
    const reminderTimeout = setTimeout(() => {
      reminderTimers.delete(match.id);
      void notifyCheckinReminder(client, match);
    }, reminderDelay);
    reminderTimers.set(match.id, reminderTimeout);
  }
}

function syncCheckinTimer(client, match) {
  if (!match) return;

  if (match.status === MATCH_STATUS.CHECKING_IN) {
    scheduleCheckinTimer(client, match);
    return;
  }

  clearCheckinTimer(match.id);
}

function isPendingCheckin(match) {
  if (match.status !== MATCH_STATUS.CHECKING_IN || !match.checkinDeadlineAt) return false;
  return new Date(match.checkinDeadlineAt).getTime() > Date.now();
}

// Multi-tenant y multi-torneo: al reiniciar el bot hay que reprogramar los
// check-ins pendientes de CADA servidor donde esta el bot (cada uno es un
// cliente), y dentro de cada servidor de CADA torneo activo (puede haber
// mas de uno a la vez) -- no solo del primero que encuentre.
async function initializeCheckinMonitor(client) {
  const expired = await getExpiredCheckins();
  expired.forEach((match) => {
    void expireCheckin(client, match);
  });

  const guilds = [...client.guilds.cache.values()];
  for (const guild of guilds) {
    const tournaments = await getActiveTournaments(guild.id);
    for (const tournament of tournaments) {
      const matches = await getTournamentMatches(tournament.id);
      matches.filter(isPendingCheckin).forEach((match) => {
        scheduleCheckinTimer(client, match);
      });
    }
    await refreshTournamentsPanel(guild.id).catch((error) => {
      console.warn(`[CheckinMonitor] No se pudo refrescar el panel de torneos de ${guild.id}: ${error.message}`);
    });
  }
}

module.exports = {
  clearCheckinTimer,
  initializeCheckinMonitor,
  syncCheckinTimer,
};

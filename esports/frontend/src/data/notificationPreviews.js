// Solo desarrollo: las tarjetas de accion con el `meta` completo que se le
// pide al backend (BACKEND-PENDIENTE.md #notificaciones-tarjetas-accion).
// Se inyectan desde /notificaciones con el boton "Vista previa" (import.meta.env.DEV).
// Los ids empiezan por "preview-" para que el poll no las borre.

const minutesFromNow = (min) => new Date(Date.now() + min * 60_000).toISOString()

export function buildNotificationPreviews() {
  const now = new Date().toISOString()
  const base = (id, type, extra) => ({ _id: `preview-${id}`, type, createdAt: now, read: false, archived: false, ...extra })

  return [
    base('join', 'join_request', {
      title: 'Solicitud de equipo',
      message: 'PepitoProMax quiere unirse a Los Titanes',
      link: '/mi-equipo/solicitudes',
      meta: { nick: 'PepitoProMax', teamName: 'Los Titanes', vacancyRole: 'Duelista principal', game: 'Valorant', rank: 'Inmortal 2', hasCard: true },
    }),
    base('registration', 'tournament_registration_next_steps', {
      title: 'Siguientes pasos: La Copa del Barrio T2',
      message: 'Los Titanes ya esta inscrito en La Copa del Barrio T2.',
      meta: {
        tournamentTitle: 'La Copa del Barrio T2', tournamentGame: 'Valorant', teamName: 'Los Titanes',
        modality: '5v5', startsAt: '2026-09-28T22:00:00.000Z',
        rosterCount: 5, rosterRequired: 5, missingDiscord: ['Kuroneko'], checkinOpensMinutesBefore: 30,
      },
    }),
    base('checkin', 'tournament_checkin_open', {
      title: 'Check-in abierto', message: 'Confirma la presencia de tu equipo.',
      meta: { tournamentTitle: 'Copa del Barrio', teamName: 'Los Titanes', voiceChannelName: 'Team-Titanes', checkinDeadlineAt: minutesFromNow(15) },
    }),
    base('match', 'tournament_match_ready', {
      title: 'Enfrentamiento listo', message: 'Los Titanes vs Ella y Yo',
      meta: { tournamentTitle: 'La Copa del Barrio', teamName: 'Los Titanes', opponentName: 'Ella y Yo', round: 2, bestOf: 3 },
    }),
    base('result', 'tournament_result_reported', {
      title: 'Resultado reportado', message: 'Ella y Yo reporto el marcador.',
      meta: { teamName: 'Los Titanes', reporterTeamName: 'Ella y Yo', teamScore: 1, reporterScore: 2, evidenceCount: 2, autoApproveAt: minutesFromNow(10) },
    }),
    base('won', 'tournament_match_won', {
      title: 'Victoria', message: 'Los Titanes vencieron a Ella y Yo.',
      meta: {
        tournamentTitle: 'La Copa del Barrio', teamName: 'Los Titanes', opponentName: 'Ella y Yo',
        teamScore: 2, opponentScore: 1, roundLabel: 'Cuartos de final', nextRoundLabel: 'Semifinal',
        nextOpponentName: 'Kraken Esports', source: 'discord-report',
      },
    }),
    base('champion', 'tournament_podium', {
      title: 'Campeones', message: 'Los Titanes ganaron La Copa del Barrio.',
      meta: { tournamentTitle: 'La Copa del Barrio', teamName: 'Los Titanes', placement: 1, finalOpponentName: 'Kraken Esports', prize: 'RD$ 10,000 + trofeo' },
    }),
    base('role', 'role_application_approved', {
      title: '¡Rol de Caster aprobado!',
      message: 'Tu solicitud para el rol de Caster fue aprobada por la administración.',
      link: '/caster',
      meta: { roleLabel: 'Caster', profilePublic: false },
    }),
    base('ticket', 'admin_ticket_reply', {
      title: 'Respuesta admin - 2026-084',
      message: 'Ya revisamos tu cuenta: el rol no se asignó porque tu Discord estaba desvinculado. Vuelve a conectarlo desde Ajustes → Conexiones y se sincroniza solo.',
      link: '/mensajes?ticket=2026-084',
      meta: { publicCode: '2026-084', status: 'in_progress', subject: 'Problema con sincronización de rol de Discord', adminNick: 'Bra' },
    }),
    base('discord', 'discord_sync_failed', {
      title: 'Error de Discord', message: 'No pudimos asignar tus roles.',
      meta: { reason: 'token_expired', errorDetail: 'Discord API 401: invalid_grant (el token de acceso venció el 26/09/2026).' },
    }),
  ]
}


import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { connectSocket, disconnectSocket, onSocket } from '../lib/socket.js'
import { toast } from '../lib/toast.js'
import { useAuth } from './AuthContext.jsx'
import {
  BANNER_GIFT_NOTIFICATION_DISMISSED_KEY,
  BANNER_GIFT_NOTIFICATION_ID,
  BANNER_GIFT_NOTIFICATION_READ_KEY,
  buildBannerGiftNotification,
  isBannerGiftUnlocked,
} from '../data/bannerGift.js'

const NotificationsContext = createContext(null)
export const useNotifications = () => useContext(NotificationsContext)

const POLL_INTERVAL = 30_000
const SOCKET_BURST_MS = 400
const STELIANT_ESPORTS_DISCORD_URL = 'https://discord.gg/bZTsanNB3G'

const TONE_COLORS = {
  success: '#22c55e',
  pending: '#a855f7',
  error: '#ef4444',
  warning: '#f59e0b',
  admin: '#f97316',
  celebrate: '#e879f9',
  info: '#3b82f6',
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  if (h < 48) return 'Ayer'
  const days = Math.floor(h / 24)
  if (days < 7) {
    const d = new Date(dateStr)
    return ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][d.getDay()]
  }
  return `hace ${Math.floor(days / 7)} sem.`
}

function toGroup(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = diff / 3_600_000
  if (h < 24) return 'hoy'
  if (h < 168) return 'semana'
  return 'antes'
}

function clean(value, fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function rows(items) {
  return items
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([label, value]) => ({ label, value }))
}

function staffPanelPath(role) {
  const key = String(role || '').toLowerCase()
  if (key.includes('caster')) return '/caster'
  if (key.includes('analista') || key.includes('analyst')) return '/analyst'
  if (key.includes('coach')) return '/coach'
  if (key.includes('moderador') || key.includes('moderator')) return '/moderator'
  return '/torneos/invitaciones'
}

// El backend hoy solo manda IDs en meta.join_request (teamId/userId/requestId),
// no el nombre del equipo ni el nick -- pero el texto del mensaje ya los trae
// en un formato fijo, mismo truco que staffResponseActor de abajo.
function joinRequestActor(raw) {
  const match = String(raw.message || '').match(/^(.+?)\s+quiere unirse a\s+(.+)$/i)
  return { nick: raw.meta?.nick || match?.[1], teamName: raw.meta?.teamName || match?.[2] }
}

function joinResultTeamName(raw) {
  const match = String(raw.message || '').match(/^(.+?)\s+(?:acept[oó]|rechaz[oó])\s+tu solicitud/i)
  return raw.meta?.teamName || match?.[1]
}

function staffResponseActor(raw) {
  if (raw.meta?.actorNick || raw.fromNick || raw.from) return raw.meta?.actorNick || raw.fromNick || raw.from
  const match = String(raw.title || '').match(/^(.+?)\s+(acepto|aceptó|rechazo|rechazó)\s+/i)
  return match?.[1] || 'Un integrante'
}

function tournamentEntity(title, game) {
  return title ? { kind: 'tournament', name: title, game } : undefined
}

function teamEntity(name, game) {
  return name ? { kind: 'team', name, game } : undefined
}

// ── Tarjetas de accion (layout: 'action') ──
// Formato comun de las notificaciones que piden hacer algo: cabecera con
// visual propio, linea de estado, datos clave, "proximos pasos" y un boton
// principal + secundarios. Todo sale de raw.meta; lo que el backend todavia
// no manda simplemente no se pinta (ver BACKEND-PENDIENTE.md
// #notificaciones-tarjetas-accion), nunca se inventa.

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('es', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function bestOfLabel(value) {
  const n = Number(value)
  if (!n) return ''
  return n === 1 ? 'Partida única (Bo1)' : `Al mejor de ${n} (Bo${n})`
}

function tournamentPathOf(meta) {
  if (meta?.tournamentPath) return meta.tournamentPath
  const id = meta?.tournamentPublicId || meta?.tournamentId
  return id ? `/torneos/${id}` : '/torneos'
}

function numbered(texts) {
  return { kind: 'numbered', items: texts.filter(Boolean).map(text => ({ text })) }
}

// Rol aprobado: el backend manda link = panel ('/caster', '/analista'...) y
// el titulo "¡Rol de X aprobado!" -- no hay meta.roleLabel todavia.
function approvedRoleLabel(raw) {
  if (raw.meta?.roleLabel) return raw.meta.roleLabel
  const match = String(raw.title || '').match(/rol de\s+(.+?)\s+aprobado/i)
  return match?.[1] || 'rol profesional'
}

const ROLE_PROFILE_PATHS = new Set(['/caster', '/analista', '/creador', '/organizador'])

function registrationChecklist(meta) {
  const items = []
  const required = Number(meta?.rosterRequired) || 0
  if (required) {
    const count = Number(meta?.rosterCount) || 0
    items.push(count >= required
      ? { state: 'done', text: `Roster mínimo completo (${count}/${required} jugadores asignados)` }
      : { state: 'warn', text: `Roster incompleto (${count}/${required}): faltan ${required - count} titular(es)` })
  }
  if (Array.isArray(meta?.missingDiscord)) {
    const missing = meta.missingDiscord
    items.push(missing.length
      ? { state: 'warn', text: `${missing.length} jugador${missing.length === 1 ? '' : 'es'} sin Discord vinculado (obligatorio para sala de voz): ${missing.join(', ')}` }
      : { state: 'done', text: 'Todos los titulares tienen Discord vinculado' })
  }
  if (items.length) {
    const minutes = Number(meta?.checkinOpensMinutesBefore)
    items.push(meta?.checkedIn
      ? { state: 'done', text: 'Check-in completado' }
      : { state: 'todo', text: `Check-in pendiente (${minutes ? `abre ${minutes} min antes de la primera ronda` : 'se abre antes de la primera ronda'})` })
  }
  return items
}

const URGENT_TOAST_TYPES = new Set([
  'tournament_checkin_open',
  'tournament_match_ready',
  'tournament_result_reported',
  'tournament_match_won',
  'tournament_podium',
  'discord_sync_failed',
])

const DISCORD_FAILURE_REASONS = {
  not_linked: 'Discord desvinculado',
  token_expired: 'Autorización de Discord vencida',
  not_in_guild: 'No estás en el servidor de GlitchGang',
  missing_permissions: 'El bot no tiene permisos para asignarte roles',
}

function baseTemplate(raw) {
  return {
    title: raw.title,
    subtitle: raw.subtitle,
    desc: raw.desc || raw.message || '',
    fullMessage: raw.fullMessage || raw.desc || raw.message || '',
    category: raw.category,
    tone: raw.tone || 'info',
    priority: raw.priority,
    from: raw.from,
    action: raw.action || (raw.link ? { label: 'Abrir', link: raw.link } : undefined),
    actions: raw.actions,
    request: raw.request,
    entity: raw.entity,
    detailRows: Array.isArray(raw.meta) ? raw.meta : [],
  }
}

// meta.sanctionType de admin_notice (moderation.controller.js).
const SANCTION_LABEL = { warning: 'Advertencia', mute: 'Restricción temporal', unban: 'Sanción levantada' }

const NOTIFICATION_TEMPLATES = {
  raffle_won: (raw) => ({
    title: raw.title || 'Ganaste un sorteo',
    subtitle: clean(raw.meta?.raffleTitle, 'Sorteo GlitchGang'),
    desc: raw.message || 'Ganaste un sorteo. El equipo de GlitchGang te contactara para la entrega.',
    category: 'sistema',
    tone: 'success',
    priority: 'alta',
    from: 'Sorteos GlitchGang',
    action: { label: 'Ver sorteos', link: raw.link || '/sorteos' },
    detailRows: rows([['Premio', raw.meta?.prize], ['Participantes', raw.meta?.entrants]]),
  }),
  role_change: (raw) => ({
    title: raw.title || 'Cambio en tu rol',
    subtitle: 'Equipo de GlitchGang',
    desc: raw.message || 'Un administrador actualizo tu rol en la plataforma.',
    category: 'admin',
    tone: 'admin',
    from: raw.meta?.actorNick ? `${raw.meta.actorNick} · Administracion` : 'Administracion',
    action: { label: 'Ir al inicio', link: raw.link || '/' },
    detailRows: rows([['Rol', raw.meta?.role]]),
  }),
  admin_notice: (raw) => ({
    title: raw.title || 'Aviso administrativo',
    subtitle: 'Mensaje oficial de GlitchGang',
    desc: raw.message || raw.desc || 'Tienes un aviso administrativo pendiente.',
    category: 'admin',
    tone: 'admin',
    priority: 'alta',
    from: 'Moderacion GlitchGang',
    action: { label: 'Contactar admin', link: raw.link || '/mensajes?to=admin&space=support&channel=support-ticket' },
    replyable: raw.replyable ?? true,
    detailRows: rows([
      ['Motivo', raw.meta?.kind === 'post_removed' ? 'Publicación retirada' : raw.meta?.kind === 'sanction' ? SANCTION_LABEL[raw.meta?.sanctionType] || 'Sanción' : ''],
      ['Publicación', raw.meta?.excerpt],
      ['Reportes', raw.meta?.reportsCount],
    ]),
  }),
  admin_ticket_reply: (raw) => {
    const meta = raw.meta || {}
    const code = meta.publicCode || ''
    return {
      layout: 'action',
      title: code ? `Nueva respuesta en ticket #${code}` : 'Nueva respuesta en tu ticket',
      subtitle: 'El Staff de GlitchGang respondió a tu consulta',
      desc: raw.message || 'Tu ticket recibio una respuesta del equipo administrativo.',
      category: 'soporte',
      tone: 'admin',
      priority: 'alta',
      from: 'Soporte GlitchGang',
      replyable: meta.status !== 'closed',
      hero: { kind: 'support' },
      facts: rows([
        ['Asunto', meta.subject],
        ['Atendido por', meta.adminNick ? `@${meta.adminNick} (Administración)` : 'Staff GlitchGang'],
      ]),
      quote: raw.message ? { label: 'Respuesta del staff', text: raw.message } : undefined,
      steps: numbered([
        'Lee la solución proporcionada por el equipo de moderación.',
        // Sin "marcar como resuelto": hoy el usuario no tiene endpoint para
        // cerrar su propio ticket (solo admin, PATCH /system-tickets/admin/:id).
        'Responde si persisten dudas; si ya quedó resuelto, no tienes que hacer nada más.',
      ]),
      actions: [
        meta.status !== 'closed' && { label: 'Responder ticket', do: 'reply' },
        { label: 'Ver historial del ticket', link: code ? `/ayuda/ticket/${encodeURIComponent(code)}` : (raw.link || '/ayuda') },
        { label: 'Abrir en mensajes', link: raw.link || `/mensajes?ticket=${encodeURIComponent(code)}` },
      ].filter(Boolean),
    }
  },
  system_ticket_new: (raw) => ({
    title: raw.title || 'Nuevo ticket del sistema',
    subtitle: raw.meta?.publicCode ? `Ticket ${raw.meta.publicCode}` : 'Panel admin',
    desc: raw.message || 'Hay un ticket nuevo esperando revision.',
    category: 'admin',
    tone: 'admin',
    priority: 'alta',
    from: 'Sistema GlitchGang',
    action: { label: 'Abrir ticket en admin', link: raw.link || '/admin/soporte' },
    detailRows: rows([['Ticket', raw.meta?.publicCode], ['Origen', raw.meta?.sourceLabel], ['Tipo', raw.meta?.sourceType]]),
  }),
  system_ticket_reply: (raw) => ({
    title: raw.title || 'Respuesta de usuario',
    subtitle: raw.meta?.publicCode ? `Ticket ${raw.meta.publicCode}` : 'Seguimiento de soporte',
    desc: raw.message || 'El usuario respondio el ticket.',
    category: 'admin',
    tone: 'warning',
    priority: 'alta',
    from: 'Sistema de tickets',
    action: { label: 'Revisar ticket', link: raw.link || '/admin/soporte' },
    detailRows: rows([['Ticket', raw.meta?.publicCode], ['Estado', raw.meta?.status]]),
  }),
  join_request: (raw) => {
    const actor = joinRequestActor(raw)
    const meta = raw.meta || {}
    const nick = actor.nick || 'Un jugador'
    const teamName = actor.teamName || 'tu equipo'
    const requestsLink = raw.link || '/mi-equipo/solicitudes'
    // Postulacion de staff (coach, analista, manager): no ocupa lugar de jugador.
    const staffRole = ['coach', 'analyst', 'manager'].includes(meta.requestedRole)
      ? { coach: 'Coach', analyst: 'Analista', manager: 'Manager' }[meta.requestedRole]
      : ''
    return {
      layout: 'action',
      title: staffRole ? `Nueva postulación de ${staffRole.toLowerCase()}` : 'Nueva postulación a tu escuadra',
      subtitle: `${nick} quiere unirse a ${teamName}${staffRole ? ` como ${staffRole.toLowerCase()}` : ''}`,
      desc: staffRole
        ? `Entra al staff con su propio cupo, sin quitarle lugar a ningún jugador.${meta.roleVerified ? ` ${staffRole} verificado en GlitchGang.` : ''} Acepta o rechaza desde aquí.`
        : `${meta.vacancyRole ? `Se postula como ${meta.vacancyRole}. ` : ''}Acepta o rechaza la solicitud desde aquí.`,
      category: 'equipos',
      tone: 'pending',
      from: nick,
      entity: teamEntity(teamName, meta.game),
      // meta.requestId ya viene del backend -- se puede aceptar/rechazar
      // desde la propia notificacion (ver Notifications.jsx -> respondInvite).
      request: true,
      hero: { kind: 'avatar', image: meta.avatar, name: nick },
      facts: rows(staffRole
        ? [
          ['Rol en el equipo', staffRole],
          ['Juego', meta.game],
          ['Rol aprobado', meta.roleVerified ? 'Sí, verificado' : 'No'],
        ]
        : [
          ['Rol postulado', meta.vacancyRole],
          ['Juego', meta.game],
          ['Rango competitivo', meta.rank],
          ['Tarjeta Pro', meta.hasCard == null ? '' : meta.hasCard ? 'Activa / Verificada' : 'Sin tarjeta'],
        ]),
      steps: numbered([
        'Evalúa el perfil y estadísticas de juego del postulante.',
        'Acepta para integrarlo al roster o rechaza para liberar la vacante.',
      ]),
      actions: [
        { label: 'Aceptar solicitud', do: 'accept' },
        { label: 'Rechazar', do: 'decline' },
        { label: meta.hasCard ? 'Ver Tarjeta Pro' : 'Ver solicitud completa', link: requestsLink },
      ],
    }
  },
  // Ya es un hecho consumado (el lider ya decidio), no una invitacion a
  // responder -- a diferencia de join_request, esta nunca lleva botones.
  join_request_result: (raw) => {
    const teamName = joinResultTeamName(raw)
    const meta = raw.meta || {}
    return {
      title: raw.title || (raw.meta?.accepted ? 'Solicitud aceptada' : 'Solicitud rechazada'),
      subtitle: teamName || 'Equipo',
      desc: raw.message || '',
      category: 'equipos',
      tone: raw.meta?.accepted ? 'success' : 'warning',
      from: teamName || 'Equipo',
      request: false,
      action: { label: 'Ir a jugador', link: raw.meta?.playerPanelPath || raw.link || '/jugador' },
      hero: { kind: 'banner', image: meta.teamLogo, name: teamName },
      entity: { ...(teamEntity(teamName, meta.game) || {}), tag: meta.teamTag, image: meta.teamLogo },
      detailRows: rows([['Equipo', teamName], ['Juego', meta.game], ['Estado', meta.accepted ? 'Aceptada' : 'Rechazada']]),
    }
  },
  coach_work_plan: (raw) => {
    const meta = raw.meta || {}
    return {
      title: raw.title || 'Nuevo plan de trabajo',
      subtitle: meta.teamName || 'Tu equipo',
      desc: raw.message || '',
      category: 'equipos',
      tone: 'info',
      from: meta.coachNick || 'Coach',
      action: { label: 'Ver plan', link: raw.link || '/mi-equipo/planes' },
      hero: { kind: 'avatar', image: meta.coachAvatar, name: meta.coachNick },
      detailRows: rows([['Equipo', meta.teamName], ['Coach', meta.coachNick]]),
    }
  },
  coach_work_plan_approved: (raw) => ({
    title: raw.title || 'Plan aprobado',
    subtitle: raw.meta?.teamName || 'Equipo',
    desc: raw.message || '',
    category: 'equipos',
    tone: 'success',
    from: raw.meta?.teamName || 'Equipo',
    action: { label: 'Ir a mis planes', link: raw.link || '/coach/sesiones' },
    detailRows: rows([['Equipo', raw.meta?.teamName], ['Estado', 'Aprobado']]),
  }),
  community: (raw) => ({
    title: raw.title || 'Actividad en comunidad',
    subtitle: 'Comunidad',
    desc: raw.message || raw.desc || 'Tu publicacion tuvo actividad nueva.',
    category: 'social',
    tone: 'info',
    from: raw.meta?.actorNick || 'Comunidad',
    action: { label: 'Ver comunidad', link: raw.link || '/comunidad' },
    detailRows: rows([['Actividad', raw.meta?.kind === 'like' ? 'Like' : raw.meta?.kind === 'comment' ? 'Comentario' : raw.title], ['De', raw.meta?.actorNick], ['Comunidad', raw.meta?.communityName]]),
  }),
  university: (raw) => ({
    title: raw.title || 'Actividad universitaria',
    subtitle: raw.meta?.kind === 'leader_transfer' ? clean(raw.meta?.teamName, 'Tu equipo') : 'Universidad',
    desc: raw.message || raw.desc || 'Hay actividad nueva en tu espacio universitario.',
    category: 'social',
    tone: 'info',
    from: raw.meta?.actorNick || 'Comunidad universitaria',
    action: raw.meta?.kind === 'leader_transfer'
      ? { label: 'Abrir mi equipo', link: raw.link || '/mi-equipo' }
      : { label: 'Abrir universidad', link: raw.link || '/universidad' },
    detailRows: rows([
      ['Actividad', raw.meta?.kind === 'like' ? 'Like' : raw.meta?.kind === 'comment' ? 'Comentario' : raw.title],
      ['De', raw.meta?.actorNick],
      ['Equipo', raw.meta?.teamName],
      ['Universidad', raw.meta?.universityName],
    ]),
  }),
  friend_request: (raw) => ({
    title: raw.title || 'Nueva solicitud de amistad',
    subtitle: 'Amigos',
    desc: raw.message || 'Tienes una solicitud de amistad pendiente.',
    category: 'social',
    tone: 'pending',
    from: raw.meta?.actorNick || 'GlitchGang',
    action: { label: 'Ver solicitudes', link: raw.link || '/amigos' },
  }),
  friend_request_accepted: (raw) => ({
    title: raw.title || 'Solicitud aceptada',
    subtitle: 'Amigos',
    desc: raw.message || 'Tu solicitud de amistad fue aceptada.',
    category: 'social',
    tone: 'success',
    from: raw.meta?.actorNick || 'GlitchGang',
    action: { label: 'Ver perfil', link: raw.link || '/amigos' },
  }),
  organizer_discord_request: (raw) => ({
    title: 'Solicitud de Discord para torneos',
    subtitle: raw.meta?.requesterNick || raw.meta?.organizationName || 'Organizador',
    desc: raw.message || 'Un organizador pidio habilitar Discord para sus torneos.',
    category: 'admin',
    tone: 'warning',
    priority: 'alta',
    from: 'Organizaciones',
    action: { label: 'Revisar organizador', link: raw.link || '/admin/organizaciones' },
    detailRows: rows([['Organizador', raw.meta?.requesterNick || raw.meta?.organizationName], ['Nota', raw.meta?.note], ['Servidor', raw.meta?.guildName || raw.meta?.discordGuildId]]),
  }),
  organizer_discord_reviewed: (raw) => ({
    title: raw.title || 'Solicitud de Discord revisada',
    subtitle: 'Organizacion',
    desc: raw.message || 'Tu solicitud de Discord fue revisada.',
    category: 'sistema',
    tone: raw.meta?.decision ? (raw.meta.decision === 'enable' ? 'success' : 'warning') : (String(raw.title || '').toLowerCase().includes('rechaz') ? 'warning' : 'success'),
    from: raw.meta?.actorNick ? `${raw.meta.actorNick} · Organizaciones` : 'Organizaciones',
    action: { label: raw.meta?.decision === 'enable' ? 'Crear torneo' : 'Abrir ajustes', link: raw.link || '/organizer/settings' },
  }),
  organization_request: (raw) => ({
    title: 'Nueva solicitud de organizacion',
    subtitle: raw.meta?.name || 'Organizacion',
    desc: raw.message || 'Hay una organizacion esperando revision.',
    category: 'admin',
    tone: 'pending',
    priority: 'alta',
    from: 'Organizaciones',
    action: { label: 'Revisar solicitud', link: raw.link || '/admin/organizaciones' },
    detailRows: rows([['Organizacion', raw.meta?.name], ['Discord', raw.meta?.discordGuildId], ['Solicitante', raw.meta?.requesterNick]]),
  }),
  organization_request_approved: (raw) => ({
    title: raw.title || 'Organizacion aprobada',
    subtitle: raw.meta?.organizationName || 'Tu organizacion ya esta activa',
    desc: raw.message || 'Tu solicitud de organizacion fue aprobada.',
    category: 'sistema',
    tone: 'success',
    from: 'Organizaciones',
    action: { label: 'Abrir organizacion', link: raw.link || '/organizer' },
  }),
  organization_request_rejected: (raw) => ({
    title: raw.title || 'Organizacion rechazada',
    subtitle: raw.meta?.organizationName || 'Revision administrativa',
    desc: raw.message || 'Tu solicitud de organizacion fue rechazada.',
    category: 'sistema',
    tone: 'warning',
    from: 'Organizaciones',
    action: { label: 'Contactar soporte', link: raw.link || '/mensajes?to=admin' },
    detailRows: rows([['Organizacion', raw.meta?.organizationName], ['Motivo', raw.meta?.reason]]),
  }),
  role_application_approved: (raw) => {
    const roleLabel = approvedRoleLabel(raw)
    const panelPath = raw.link || staffPanelPath(raw.meta?.roleLabel || raw.meta?.roleId)
    const profilePath = raw.meta?.profilePath || (ROLE_PROFILE_PATHS.has(panelPath) ? `${panelPath}/perfil` : panelPath)
    const profilePublic = raw.meta?.profilePublic
    return {
      layout: 'action',
      title: `¡Postulación de ${roleLabel} aprobada!`,
      subtitle: 'La administración validó tus permisos profesionales',
      desc: raw.message || 'Tu solicitud de rol fue aprobada. Ya puedes usar tu panel.',
      category: 'sistema',
      tone: 'success',
      from: 'Validacion de roles',
      hero: { kind: 'staff' },
      status: profilePublic
        ? { tone: 'success', text: 'Perfil profesional público' }
        : { tone: 'warning', text: profilePublic === false ? 'Perfil profesional oculto' : 'Tarjeta profesional por configurar' },
      facts: rows([['Rol asignado', `${roleLabel} oficial GlitchGang`]]),
      steps: numbered([
        'Configura tu tarjeta profesional (redes, juegos y biografía).',
        'Activa tu tarjeta en el escaparate de tu perfil para ser público.',
      ]),
      actions: [
        { label: 'Configurar tarjeta profesional', link: profilePath },
        { label: `Ir a mi panel de ${roleLabel}`, link: panelPath },
        raw.meta?.guideUrl && { label: 'Ver guía del rol', link: raw.meta.guideUrl },
      ].filter(Boolean),
    }
  },
  role_application_rejected: (raw) => ({
    title: raw.title || 'Rol rechazado',
    subtitle: raw.meta?.roleLabel || 'Revision de rol',
    desc: raw.message || 'Tu solicitud de rol fue rechazada por administracion.',
    category: 'sistema',
    tone: 'warning',
    from: 'Validacion de roles',
    action: { label: 'Revisar solicitud', link: raw.link || '/roles' },
    detailRows: rows([['Rol', raw.meta?.roleLabel || raw.meta?.roleId], ['Estado', 'Rechazado'], ['Motivo', raw.meta?.reason]]),
  }),
  tournament_staff_invite: (raw) => {
    const role = clean(raw.meta?.role || raw.staffRole, 'staff')
    const title = clean(raw.meta?.tournamentTitle || raw.tournamentTitle, 'el torneo')
    const actor = raw.meta?.actorNick || raw.fromNick || raw.from || 'El organizador'
    return {
      title: `Invitacion para ser ${role}`,
      subtitle: title,
      desc: `${actor} te invito a participar en ${title} como ${role}. Responde desde tu panel de rol para confirmar disponibilidad, responsabilidades y reglas.`,
      category: 'torneos',
      tone: 'pending',
      from: actor,
      request: true,
      action: { label: 'Abrir panel de rol', link: staffPanelPath(role) },
      entity: tournamentEntity(title, raw.meta?.game),
      detailRows: rows([['Torneo', title], ['Rol', role], ['Invita', actor]]),
    }
  },
  tournament_staff_response: (raw) => {
    const role = clean(raw.meta?.role, 'staff')
    const title = clean(raw.meta?.tournamentTitle, 'el torneo')
    const actor = staffResponseActor(raw)
    const accepted = raw.meta?.status === 'accepted'
    const declined = raw.meta?.status === 'declined'
    return {
      title: 'Respuesta de invitacion de staff',
      subtitle: `${role} en ${title}`,
      desc: `${actor} ${accepted ? 'acepto' : declined ? 'rechazo' : 'respondio'} la invitacion para el rol ${role} en ${title}.`,
      fullMessage: `${actor} ${accepted ? 'acepto' : declined ? 'rechazo' : 'respondio'} la invitacion para el rol ${role} en ${title}.${raw.meta?.reason ? `\n\nMensaje: ${raw.meta.reason}` : ''}`,
      category: 'torneos',
      tone: accepted ? 'success' : 'warning',
      from: actor,
      action: { label: 'Ver torneo', link: raw.link || '/torneos' },
      entity: tournamentEntity(title, raw.meta?.game),
      detailRows: rows([['Torneo', title], ['Rol', role], ['Respuesta', accepted ? 'Aceptada' : declined ? 'Rechazada' : 'Respondida'], ['Mensaje', raw.meta?.reason]]),
    }
  },
  tournament_staff_added: (raw) => ({
    title: raw.title || 'Asignacion de staff',
    subtitle: raw.meta?.tournamentTitle || 'Torneo',
    desc: raw.message || 'Fuiste agregado al staff de un torneo.',
    category: 'torneos',
    tone: 'success',
    from: raw.meta?.actorNick || 'Organizador',
    action: { label: 'Abrir panel de rol', link: staffPanelPath(raw.meta?.role || raw.title) },
    entity: tournamentEntity(raw.meta?.tournamentTitle, raw.meta?.game),
    detailRows: rows([['Torneo', raw.meta?.tournamentTitle], ['Rol', raw.meta?.role || 'staff']]),
  }),
  tournament_staff_removed: (raw) => ({
    title: raw.title || 'Removido del staff',
    subtitle: raw.meta?.tournamentTitle || 'Torneo',
    desc: raw.message || 'Fuiste removido del staff de un torneo.',
    category: 'torneos',
    tone: 'warning',
    from: raw.meta?.actorNick || 'Organizador',
    action: { label: 'Ver torneo', link: raw.link || '/torneos' },
    entity: tournamentEntity(raw.meta?.tournamentTitle, raw.meta?.game),
    detailRows: rows([['Torneo', raw.meta?.tournamentTitle], ['Rol', raw.meta?.role || 'staff'], ['Motivo', raw.meta?.reason]]),
  }),
  tournament_roster_lock: (raw) => ({
    title: raw.title || 'Roster bloqueado',
    subtitle: raw.meta?.tournamentTitle || 'Torneo',
    desc: raw.message || 'El roster de tu equipo quedo bloqueado para el torneo.',
    category: 'torneos',
    tone: 'warning',
    from: 'Sistema de torneos',
    action: { label: 'Ver torneo', link: raw.link || '/torneos' },
    entity: tournamentEntity(raw.meta?.tournamentTitle, raw.meta?.game),
    detailRows: rows([['Torneo', raw.meta?.tournamentTitle], ['Equipo', raw.meta?.teamName], ['Estado', 'Roster bloqueado']]),
  }),
  // Comunicado del organizador al confirmar un cambio (pestaña Competencia).
  // meta.changes = [{ label, before, after }] -- BACKEND-PENDIENTE #competencia-aviso-cambios.
  tournament_changed: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const changes = Array.isArray(meta.changes) ? meta.changes : []
    return {
      title: raw.title || `Cambios en ${title}`,
      subtitle: meta.sectionLabel ? `${title} · ${meta.sectionLabel}` : title,
      desc: raw.message || `El organizador cambió la configuración de ${title}.`,
      category: 'torneos',
      tone: 'warning',
      priority: 'alta',
      from: meta.actorNick ? `${meta.actorNick} · Organización` : 'Organización del torneo',
      action: { label: 'Ver torneo', link: raw.link || tournamentPathOf(meta) },
      entity: tournamentEntity(meta.tournamentTitle, meta.game),
      detailRows: rows(changes.slice(0, 8).map(ch => [ch.label, `${ch.before} → ${ch.after}`])),
    }
  },
  tournament_registration_next_steps: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const teamName = clean(meta.teamName, 'tu equipo')
    const tournamentPath = tournamentPathOf(meta)
    const discordUrl = meta.discordUrl || STELIANT_ESPORTS_DISCORD_URL
    const checklist = registrationChecklist(meta)
    const needsAction = checklist.some(item => item.state === 'warn')
    return {
      layout: 'action',
      title: `Equipo registrado: ${title}`,
      subtitle: `Tu escuadra ${teamName} está en la lista oficial`,
      desc: `${teamName} ya está inscrito en ${title}. Revisa el roster, entra al Discord oficial y queda atento al check-in.`,
      category: 'torneos',
      tone: needsAction ? 'warning' : 'success',
      priority: 'alta',
      from: 'Sistema de torneos',
      hero: { kind: 'banner', image: meta.tournamentBanner, name: title },
      status: needsAction
        ? { tone: 'warning', text: 'Acción requerida previa al inicio' }
        : { tone: 'success', text: checklist.length ? 'Todo listo para competir' : 'Inscripción confirmada' },
      facts: rows([
        ['Modalidad', meta.modality],
        ['Juego', meta.tournamentGame || meta.game],
        ['Fecha', formatDateTime(meta.startsAt)],
      ]),
      // Mientras el backend no mande el estado real del roster, se muestran
      // los pasos genericos que ya vienen en meta.nextSteps.
      steps: checklist.length
        ? { kind: 'checklist', items: checklist }
        : numbered(Array.isArray(meta.nextSteps) ? meta.nextSteps : []),
      actions: [
        { label: 'Revisar roster y Discord', link: '/mi-equipo/roster' },
        { label: 'Ver detalles del torneo', link: tournamentPath },
        { label: 'Ver canal de anuncios', link: meta.announcementsUrl || discordUrl },
      ],
    }
  },
  tournament_checkin_open: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const matchPath = meta.matchPath || '/mi-equipo/enfrentamiento'
    return {
      layout: 'action',
      title: `¡Check-in abierto: ${title}!`,
      subtitle: 'Confirma la presencia de tu equipo en la sala',
      desc: `El check-in de ${title} está abierto. Confirma la presencia de tu equipo antes de que cierre.`,
      category: 'torneos',
      tone: 'warning',
      priority: 'alta',
      from: 'Sistema de torneos',
      hero: { kind: 'checkin' },
      status: { tone: 'warning', text: 'Ventana de confirmación activa', deadline: meta.checkinDeadlineAt, deadlineLabel: 'Cierra en', expiredText: 'La ventana de check-in ya cerró' },
      facts: rows([
        ['Equipo', meta.teamName],
        ['Sala requerida', meta.voiceChannelName ? `Canal de voz #${meta.voiceChannelName}` : ''],
      ]),
      steps: numbered([
        'Conéctate junto a tu equipo en el canal de voz asignado en Discord.',
        'Confirma el check-in en la web o con /checkin en el bot.',
      ]),
      actions: [
        { label: 'Hacer check-in ahora', link: matchPath },
        { label: 'Abrir Discord / sala de voz', link: meta.voiceChannelUrl || meta.discordUrl || STELIANT_ESPORTS_DISCORD_URL },
        { label: 'Ver estado de asistencia', link: matchPath },
      ],
    }
  },
  tournament_match_ready: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const teamName = clean(meta.teamName, 'Tu equipo')
    const opponentName = clean(meta.opponentName, 'Rival por definir')
    const tournamentPath = tournamentPathOf(meta)
    const round = meta.roundLabel || (meta.round ? `Ronda ${meta.round}` : '')
    return {
      layout: 'action',
      title: `¡Enfrentamiento listo${round ? `: ${round}` : ''}!`,
      subtitle: `${teamName} vs ${opponentName}`,
      desc: `${teamName} vs ${opponentName} en ${title}. La sala de partida ya está preparada.`,
      category: 'torneos',
      tone: 'celebrate',
      priority: 'alta',
      from: 'Sistema de torneos',
      hero: { kind: 'versus', left: teamName, right: opponentName },
      status: { tone: 'celebrate', text: 'Sala de partida y canales preparados' },
      facts: rows([
        ['Torneo', title],
        ['Modalidad', bestOfLabel(meta.bestOf)],
      ]),
      steps: numbered([
        'Ingresa a la sala privada de Discord creada para este match.',
        'Contacta al capitán rival para compartir la sala de juego.',
        'Al terminar la partida, reporta el resultado con capturas.',
      ]),
      actions: [
        { label: 'Entrar a la sala de Discord', link: meta.matchChannelUrl || meta.discordUrl || STELIANT_ESPORTS_DISCORD_URL },
        { label: 'Ver llave del torneo', link: `${tournamentPath}?tab=bracket` },
        { label: 'Reglamento del match', link: `${tournamentPath}?tab=reglas` },
      ],
    }
  },
  tournament_result_reported: (raw) => {
    const meta = raw.meta || {}
    const teamName = clean(meta.teamName, 'Tu equipo')
    const reporterName = clean(meta.reporterTeamName, 'El rival')
    const matchPath = meta.matchPath || '/mi-equipo/enfrentamiento'
    const hasScore = meta.teamScore != null && meta.reporterScore != null
    const evidenceUrls = Array.isArray(meta.evidenceUrls) ? meta.evidenceUrls : []
    const evidenceCount = Number(meta.evidenceCount) || evidenceUrls.length
    return {
      layout: 'action',
      title: 'Resultado reportado por el rival',
      subtitle: `${reporterName} ha reportado el marcador del match`,
      desc: `${reporterName} reportó el marcador. Revísalo y confírmalo o abre una disputa.`,
      category: 'torneos',
      tone: 'warning',
      priority: 'alta',
      from: reporterName,
      hero: { kind: 'score', left: teamName, right: reporterName, score: hasScore ? [meta.teamScore, meta.reporterScore] : null },
      status: meta.autoApproveAt
        ? { tone: 'warning', text: 'Pendiente de tu validación', deadline: meta.autoApproveAt, deadlineLabel: 'Se aprueba por defecto en', expiredText: 'El resultado ya se aprobó por defecto' }
        : { tone: 'warning', text: 'Pendiente de tu validación' },
      facts: rows([
        ['Marcador declarado', hasScore ? `${teamName} (${meta.teamScore}) - ${reporterName} (${meta.reporterScore})` : ''],
        ['Evidencia', evidenceCount ? `${evidenceCount} captura${evidenceCount === 1 ? '' : 's'} de pantalla` : ''],
      ]),
      steps: numbered([
        'Revisa las capturas adjuntas y valida si el puntaje es correcto.',
        'Confirma el marcador para avanzar la llave o abre una disputa.',
      ]),
      actions: [
        { label: 'Confirmar marcador', link: matchPath },
        { label: 'Abrir disputa / subir evidencias', link: matchPath },
        evidenceCount > 0 && { label: 'Ver capturas', link: evidenceUrls[0] || matchPath },
      ].filter(Boolean),
    }
  },
  // Resultado ya confirmado (ambos /report coinciden, o el organizador lo
  // cargo en la llave) -- no pide validar nada, solo avisa quien sigue.
  tournament_match_won: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const teamName = clean(meta.teamName, 'Tu equipo')
    const opponentName = clean(meta.opponentName, 'el rival')
    const tournamentPath = tournamentPathOf(meta)
    const hasScore = meta.teamScore != null && meta.opponentScore != null
    const nextRound = meta.nextRoundLabel || (meta.nextRound ? `Ronda ${meta.nextRound}` : '')
    return {
      layout: 'action',
      title: `¡Victoria${nextRound ? `! Pasan a ${nextRound}` : '!'}`,
      subtitle: `${teamName} venció a ${opponentName}`,
      desc: `${teamName} ganó su partida contra ${opponentName} en ${title}.${nextRound ? ` Siguen en carrera: ${nextRound}.` : ''}`,
      category: 'torneos',
      tone: 'success',
      priority: 'alta',
      from: 'Sistema de torneos',
      hero: { kind: 'score', left: teamName, right: opponentName, score: hasScore ? [meta.teamScore, meta.opponentScore] : null },
      status: { tone: 'success', text: meta.source === 'organizer' ? 'Resultado confirmado por el organizador' : 'Resultado confirmado por ambos equipos' },
      facts: rows([
        ['Torneo', title],
        ['Ronda jugada', meta.roundLabel || (meta.round ? `Ronda ${meta.round}` : '')],
        ['Próximo rival', meta.nextOpponentName || (nextRound ? 'Por definir (esperando el otro partido)' : '')],
      ]),
      steps: numbered([
        'Revisa la llave para ver contra quién juegas y a qué hora.',
        'Mantente atento al check-in de la siguiente ronda.',
      ]),
      actions: [
        { label: 'Ver llave del torneo', link: `${tournamentPath}?tab=bracket` },
        { label: 'Ir a mi enfrentamiento', link: meta.matchPath || '/mi-equipo/enfrentamiento' },
      ],
    }
  },
  // Podio final: placement 1 (campeon), 2 (subcampeon) o 3 (tercer lugar,
  // compartido entre los 2 perdedores de semifinal, igual que en Discord).
  // Perdio una serie en eliminacion simple (bracketSync.service.js).
  tournament_eliminated: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const teamName = clean(meta.teamName, 'Tu equipo')
    const score = meta.teamScore != null && meta.opponentScore != null ? `${meta.teamScore}-${meta.opponentScore}` : ''
    return {
      title: `${teamName} quedó fuera de ${title}`,
      subtitle: meta.roundLabel ? `${title} · ${meta.roundLabel}` : title,
      desc: raw.message || `${teamName} perdió su serie y quedó eliminado.`,
      category: 'torneos',
      tone: 'warning',
      from: 'Sistema de torneos',
      action: { label: 'Ver bracket', link: `${raw.link || tournamentPathOf(meta)}?tab=bracket` },
      entity: tournamentEntity(meta.tournamentTitle, meta.game),
      detailRows: rows([['Rival', meta.opponentName], ['Ronda', meta.roundLabel], ['Marcador', score]]),
    }
  },
  // Termino el torneo y el equipo no subio al podio.
  tournament_finished: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    return {
      title: `Terminó ${title}`,
      subtitle: meta.champion ? `Campeón: ${meta.champion}` : title,
      desc: raw.message || `${title} terminó. Gracias por competir.`,
      category: 'torneos',
      tone: 'info',
      from: 'Sistema de torneos',
      action: { label: 'Ver póster del campeón', link: raw.link || `${tournamentPathOf(meta)}?tab=resumen#campeon` },
      entity: tournamentEntity(meta.tournamentTitle, meta.game),
      detailRows: rows([['Campeón', meta.champion], ['Subcampeón', meta.runnerUp]]),
    }
  },
  // Al organizador: que premio entregar a quien.
  tournament_prizes_pending: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const prizes = Array.isArray(meta.prizes) ? meta.prizes : []
    return {
      title: 'Premios por entregar',
      subtitle: title,
      desc: raw.message || `${title} terminó. Tienes premios pendientes de entrega.`,
      category: 'torneos',
      tone: 'warning',
      priority: 'alta',
      from: 'Sistema de torneos',
      action: { label: 'Abrir Prize Pool', link: raw.link || '/organizador' },
      entity: tournamentEntity(meta.tournamentTitle, meta.game),
      detailRows: rows([
        ...prizes.map(item => [`${item.placement}.º ${item.teamName}`, item.prize]),
        ['Plazo de entrega', meta.deadline],
      ]),
    }
  },
  tournament_podium: (raw) => {
    const meta = raw.meta || {}
    const title = clean(meta.tournamentTitle, 'el torneo')
    const teamName = clean(meta.teamName, 'Tu equipo')
    const tournamentPath = tournamentPathOf(meta)
    const place = [1, 2, 3].includes(Number(meta.placement)) ? Number(meta.placement) : 1
    const heading = {
      1: `¡Campeones de ${title}!`,
      2: `¡Subcampeones de ${title}!`,
      3: `¡Tercer lugar en ${title}!`,
    }[place]
    const standing = { 1: '1.er lugar · Campeón', 2: '2.º lugar · Subcampeón', 3: '3.er lugar' }[place]
    return {
      layout: 'action',
      title: heading,
      subtitle: place === 1 ? `${teamName} ganó el torneo` : `${teamName} terminó en el podio`,
      desc: place === 1
        ? `${teamName} es el campeón de ${title}. ¡Felicidades a todo el roster!`
        : `${teamName} terminó en ${standing.toLowerCase()} de ${title}.`,
      category: 'torneos',
      tone: 'celebrate',
      priority: 'alta',
      from: 'Sistema de torneos',
      hero: { kind: 'trophy', place },
      status: { tone: 'celebrate', text: 'Torneo finalizado' },
      facts: rows([
        ['Posición final', standing],
        ['Final', place <= 2 && meta.finalOpponentName ? `vs ${meta.finalOpponentName}` : ''],
        ['Premio', meta.prize],
      ]),
      steps: numbered([
        meta.prize && 'El organizador te contactará para coordinar la entrega del premio.',
        'El resultado ya quedó en el historial de cada jugador del roster.',
      ]),
      actions: [
        { label: 'Ver póster y compartir', link: `${tournamentPath}?tab=resumen#campeon` },
        { label: 'Ver llave final', link: `${tournamentPath}?tab=bracket` },
        { label: 'Ver historial de partidas', link: '/jugador/historial' },
      ],
    }
  },
  discord_sync_failed: (raw) => {
    const meta = raw.meta || {}
    return {
      layout: 'action',
      title: 'Error de conexión con Discord',
      subtitle: 'No pudimos asignar tus roles automáticos',
      desc: 'No pudimos asignar tus roles de Discord. Vuelve a conectar tu cuenta para recuperar el acceso a las salas de tu equipo.',
      category: 'sistema',
      tone: 'error',
      priority: 'alta',
      from: 'Integración Discord',
      hero: { kind: 'discord' },
      status: { tone: 'error', text: DISCORD_FAILURE_REASONS[meta.reason] || 'Discord desvinculado o autorización vencida' },
      facts: rows([['Impacto', meta.impact || 'No tienes acceso a las salas privadas de voz de tu equipo.']]),
      steps: numbered([
        'Vuelve a autorizar a GlitchGang en tu cuenta de Discord.',
        'Comprueba que tu usuario aparezca como conectado en Ajustes → Conexiones.',
      ]),
      details: meta.errorDetail || '',
      actions: [
        { label: 'Reconectar Discord ahora', link: '/conectar-discord' },
        meta.errorDetail && { label: 'Ver motivo del error', do: 'details' },
        { label: 'Ir a Ajustes → Conexiones', link: '/ajustes?tab=conexiones' },
      ].filter(Boolean),
    }
  },
  mensaje: (raw) => ({
    title: raw.title || 'Mensaje enviado',
    subtitle: raw.category === 'torneo' ? 'Mensaje de torneo' : 'Mensajes',
    desc: raw.desc || raw.message || 'Actividad reciente en mensajes.',
    category: raw.category || 'social',
    tone: raw.tone || 'info',
    from: raw.from || 'Mensajes',
    action: raw.link ? { label: 'Abrir mensajes', link: raw.link } : { label: 'Abrir mensajes', link: '/mensajes' },
  }),
  torneo: (raw) => ({
    title: raw.title || 'Actualizacion de torneo',
    subtitle: raw.meta?.tournamentTitle || 'Torneo',
    desc: raw.desc || raw.message || 'Hay una actualizacion relacionada con un torneo.',
    category: 'torneos',
    tone: raw.tone || 'info',
    from: raw.from || 'Organizacion',
    action: { label: 'Ver torneo', link: raw.link || '/torneos' },
    entity: tournamentEntity(raw.meta?.tournamentTitle, raw.meta?.game),
  }),
  bienvenida: (raw) => ({
    title: raw.title || 'Bienvenido a GlitchGang',
    subtitle: 'Regalo desbloqueado',
    desc: raw.desc || raw.message || 'Tienes una recompensa disponible.',
    category: 'sistema',
    tone: 'celebrate',
    from: 'GlitchGang',
    action: raw.action,
  }),
}

function applyTemplate(raw) {
  const base = baseTemplate(raw)
  const template = NOTIFICATION_TEMPLATES[raw.type]?.(raw) || {}
  return { ...base, ...template }
}

function normalise(raw) {
  const shaped = applyTemplate(raw)
  const isAdminNotice = raw.type === 'admin_notice'
  const isTicketReply = raw.type === 'admin_ticket_reply'
  const isSystemTicket = String(raw.type || '').startsWith('system_ticket')
  const ticketLink = raw.link || (raw.meta?.publicCode ? `/mensajes?ticket=${encodeURIComponent(raw.meta.publicCode)}` : '')
  const action = shaped.action || (ticketLink ? { label: isSystemTicket ? 'Abrir ticket en admin' : isTicketReply ? 'Abrir ticket en mensajes' : 'Contactar admin', link: ticketLink } : undefined)
  const tone = shaped.tone || (isAdminNotice || isTicketReply || isSystemTicket ? 'admin' : 'info')
  const category = shaped.category || (isAdminNotice || isTicketReply || isSystemTicket ? 'admin' : 'sistema')

  return {
    ...raw,
    id: raw._id || raw.id,
    title: shaped.title || raw.title || 'Notificacion',
    subtitle: shaped.subtitle,
    desc: shaped.desc || raw.message || '',
    fullMessage: shaped.fullMessage || shaped.desc || raw.message || '',
    category,
    tone,
    toneColor: raw.toneColor || shaped.toneColor || TONE_COLORS[tone] || TONE_COLORS.info,
    heroEmoji: raw.heroEmoji || shaped.heroEmoji || (isAdminNotice ? null : undefined),
    priority: shaped.priority || raw.priority || (isAdminNotice || isTicketReply || isSystemTicket ? 'alta' : undefined),
    replyable: shaped.replyable ?? raw.replyable ?? (isAdminNotice && !isTicketReply),
    request: shaped.request ?? raw.request ?? false,
    entity: shaped.entity || raw.entity,
    action,
    actions: shaped.actions || raw.actions || (action ? [action] : []),
    from: shaped.from || raw.from || (isAdminNotice || isSystemTicket ? 'Moderacion GlitchGang' : undefined),
    detailRows: shaped.detailRows || [],
    layout: shaped.layout,
    hero: shaped.hero,
    status: shaped.status,
    facts: shaped.facts,
    steps: shaped.steps,
    quote: shaped.quote,
    details: shaped.details,
    time: raw.time || relativeTime(raw.createdAt || Date.now()),
    group: raw.group || toGroup(raw.createdAt || Date.now()),
  }
}

function injectBannerGift(list) {
  if (!isBannerGiftUnlocked()) return list
  if (localStorage.getItem(BANNER_GIFT_NOTIFICATION_DISMISSED_KEY) === '1') return list
  if (list.some(n => n.id === BANNER_GIFT_NOTIFICATION_ID)) return list
  return [normalise(buildBannerGiftNotification()), ...list]
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const intervalRef = useRef(null)
  const burstRef = useRef(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const data = await api('/notifications')
      const raw = Array.isArray(data) ? data : (data.notifications || [])
      // Las de vista previa (solo dev, ver data/notificationPreviews.js) no
      // existen en el backend: sin esto el poll las borraba a los 30s.
      setNotifications(prev => injectBannerGift([
        ...prev.filter(n => String(n.id).startsWith('preview-')),
        ...raw.map(normalise),
      ]))
    } catch {
      // Mantiene el estado actual si no hay conexion.
    }
  }, [user])

  useEffect(() => {
    if (!user) { setNotifications([]); return }
    load()
    intervalRef.current = setInterval(load, POLL_INTERVAL)
    connectSocket()
    const off = onSocket('notification', (notification) => {
      if (notification?.type === 'join_request_result') {
        const shaped = normalise(notification)
        toast(
          notification.meta?.accepted
            ? `Felicidades, ya estas en ${shaped.subtitle || 'tu equipo'}.`
            : `Tu solicitud para ${shaped.subtitle || 'el equipo'} fue rechazada.`,
          notification.meta?.accepted ? 'success' : 'warn',
          {
            title: notification.meta?.accepted ? 'Solicitud aceptada' : 'Solicitud rechazada',
            action: { label: 'Ir a jugador', link: shaped.action?.link || '/jugador' },
            duration: 9000,
          },
        )
      }
      // Avisos con reloj corriendo (check-in, match, resultado por validar)
      // o que cortan el acceso a las salas: ademas de la campana, toast
      // inmediato con el boton principal de la tarjeta.
      if (URGENT_TOAST_TYPES.has(notification?.type)) {
        const shaped = normalise(notification)
        const primary = shaped.actions?.find(item => item.link)
        toast(shaped.subtitle || shaped.desc, shaped.tone === 'error' ? 'error' : 'warn', {
          title: shaped.title,
          action: primary ? { label: primary.label, link: primary.link } : undefined,
          duration: 12000,
        })
      }
      // Una notificacion nueva puede significar que el rol/permisos del
      // usuario cambiaron server-side ahora mismo (ej. "rol de organizador
      // aprobado") -- sin esto, AuthContext no se enteraba hasta el proximo
      // focus de la ventana o el poll de 60s, y la app seguia mostrando el
      // menu viejo aunque el backend ya habia aplicado el cambio.
      // Agrupado: una rafaga de avisos (bracket publicado a todo el equipo,
      // chat activo) hacia un GET /notifications + refresh de sesion por
      // cada uno; ahora es uno solo al terminar la rafaga.
      clearTimeout(burstRef.current)
      burstRef.current = setTimeout(() => {
        load()
        window.dispatchEvent(new CustomEvent('gg:auth:refresh'))
      }, SOCKET_BURST_MS)
    })
    return () => { clearInterval(intervalRef.current); clearTimeout(burstRef.current); off() }
  }, [user, load])

  useEffect(() => () => disconnectSocket(), [])

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (id === BANNER_GIFT_NOTIFICATION_ID) {
      localStorage.setItem(BANNER_GIFT_NOTIFICATION_READ_KEY, '1')
    } else {
      await api(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {})
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    localStorage.setItem(BANNER_GIFT_NOTIFICATION_READ_KEY, '1')
    await api('/notifications/read-all', { method: 'PATCH' }).catch(() => {})
  }, [])

  const archive = useCallback(async (id) => {
    if (id === BANNER_GIFT_NOTIFICATION_ID) {
      localStorage.setItem(BANNER_GIFT_NOTIFICATION_DISMISSED_KEY, '1')
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: true, read: true } : n))
    if (id !== BANNER_GIFT_NOTIFICATION_ID) {
      await api(`/notifications/${id}/archive`, { method: 'PATCH' }).catch(() => {})
    }
  }, [])

  const remove = useCallback(async (id) => {
    if (id === BANNER_GIFT_NOTIFICATION_ID) {
      localStorage.setItem(BANNER_GIFT_NOTIFICATION_DISMISSED_KEY, '1')
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (id !== BANNER_GIFT_NOTIFICATION_ID) {
      await api(`/notifications/${id}`, { method: 'DELETE' }).catch(() => {})
    }
  }, [])

  const restore = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: false } : n))
  }, [])

  const toggleSave = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, saved: !n.saved } : n))
  }, [])

  const reply = useCallback((id, text) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, replied: text } : n))
  }, [])

  const pushNotification = useCallback((notification) => {
    setNotifications(prev => [
      normalise({
        _id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
        read: false,
        archived: false,
        ...notification,
      }),
      ...prev,
    ])
  }, [])

  const unread = useMemo(
    () => notifications.filter(n => !n.read && !n.archived).length,
    [notifications],
  )

  const value = useMemo(
    () => ({ notifications, unread, markRead, markAllRead, remove, archive, restore, toggleSave, reply, pushNotification }),
    [notifications, unread, markRead, markAllRead, remove, archive, restore, toggleSave, reply, pushNotification],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}


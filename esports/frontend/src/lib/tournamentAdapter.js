// Convierte el Tournament real (Mongo, /api/tournaments) a la MISMA forma
// que ya esperan las pantallas del organizador (antes alimentadas por el
// mock data/organizerTournaments.js) — para no reescribir cada pestaña de
// Gestionar Torneo, solo la fuente de datos.

import { getGameArt, formatLabel } from '../data/organizerTournaments.js'

const STELIANT_ESPORTS_DISCORD_URL = 'https://discord.gg/bZTsanNB3G'
import { GAMES_BY_CATEGORY } from '../data/games.js'
import { COMPETITION_SYSTEMS, SCORING_MODELS, FORMAT_TO_SYSTEM, roundLabel } from '../../../shared/tournamentSetup.mjs'

// Resumen legible de la estructura competitiva -> [{ label, value }] para paneles.
export function competitionSummary(c) {
  if (!c?.system) return []
  const rows = [{ label: 'Sistema', value: COMPETITION_SYSTEMS[c.system]?.label || c.system }]
  const overrides = Object.entries(c.seriesByRound || {})
  rows.push({
    label: 'Serie por encuentro',
    value: overrides.length
      ? `${c.defaultSeries} · ${overrides.map(([k, v]) => `${roundLabel(k)} ${v}`).join(', ')}`
      : c.defaultSeries,
  })
  if (c.system === 'round_robin') rows.push({ label: 'Vueltas', value: c.legs === 2 ? 'Ida y vuelta' : 'Solo ida' })
  if (c.system === 'swiss') rows.push({ label: 'Rondas suizas', value: c.swissRounds })
  if (c.system === 'groups_playoffs') {
    rows.push({ label: 'Grupos', value: `${c.groups} · avanzan ${c.advancePerGroup} c/u` })
    rows.push({ label: 'Playoffs', value: COMPETITION_SYSTEMS[c.playoffsSystem]?.label || c.playoffsSystem })
  }
  if (c.system === 'single_elim' && c.thirdPlace) rows.push({ label: 'Extra', value: 'Partido por el 3er puesto' })
  const model = c.scoring?.model
  if (model && model !== 'wins') {
    rows.push({ label: 'Puntuacion', value: SCORING_MODELS[model] || model })
    if (model === 'match_points') rows.push({ label: 'Puntos V/E/D', value: `${c.scoring.win}/${c.scoring.draw}/${c.scoring.loss}` })
  }
  return rows
}

// Etiqueta en español del sistema competitivo, priorizando la estructura nueva.
function competitionLabel(t) {
  const system = t.competition?.system || FORMAT_TO_SYSTEM[t.format]
  const base = COMPETITION_SYSTEMS[system]?.label || formatLabel(t.format)
  const bo = t.competition?.defaultSeries
  const overrides = Object.keys(t.competition?.seriesByRound || {}).length
  return bo ? `${base} · ${bo}${overrides ? ' (mixto)' : ''}` : base
}

export const STATUS_LABEL = {
  draft: 'Borrador',
  upcoming: 'Proximo',
  reg_closed: 'Inscripcion cerrada',
  live: 'En vivo',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
}

const API_TO_UI_STATUS = {
  draft: 'draft',
  open: 'upcoming',
  registration_closed: 'reg_closed',
  ongoing: 'live',
  finished: 'finished',
  cancelled: 'cancelled',
}

// Cuando el organizador cambia el status desde la UI, esto lo traduce de vuelta
// al enum real que acepta el backend.
export const UI_TO_API_STATUS = {
  draft: 'draft',
  upcoming: 'open',
  reg_closed: 'registration_closed',
  live: 'ongoing',
  finished: 'finished',
  cancelled: 'cancelled',
}

function splitDate(iso) {
  if (!iso) return { startDate: '', startTime: '19:00' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { startDate: '', startTime: '19:00' }
  const startDate = d.toISOString().slice(0, 10)
  const startTime = d.toISOString().slice(11, 16)
  return { startDate, startTime }
}

function normalizeCollaborators(list) {
  return (list || []).map((c, i) => (
    typeof c === 'string'
      ? { id: i + 1, name: c, role: 'Colaborador', avatar: null }
      : c
  ))
}

function defaultPrizes(pool) {
  if (!pool) return [{ place: '1er Lugar', amount: 0, items: 'Trofeo + reconocimiento' }]
  return [
    { place: '1er Lugar', amount: Math.round(pool * 0.6), items: 'Trofeo + clasificacion' },
    { place: '2do Lugar', amount: Math.round(pool * 0.3), items: 'Medalla de plata' },
    { place: '3er Lugar', amount: Math.round(pool * 0.1), items: 'Medalla de bronce' },
  ]
}

// `extra` es el nombre que usan las pantallas viejas del organizador,
// `items` es el nombre real en el modelo — se exponen ambos.
function normalizePrizes(list, currency = 'USD') {
  return (list || []).map(p => ({
    ...p,
    currency: p.currency || currency,
    payoutMethod: p.payoutMethod || 'transfer',
    status: p.status || 'pending',
    conditions: p.conditions || '',
    proofImage: p.proofImage || '',
    signatureImage: p.signatureImage || '',
    extra: p.items || p.extra || '',
  }))
}

/** Torneo real de la API -> forma que consumen las pantallas del organizador. */
export function normalizeTournament(t) {
  if (!t) return null
  const art = getGameArt(t.game)
  const formatTxt = competitionLabel(t)
  const { startDate, startTime } = splitDate(t.date)
  const registered = t.registrations?.length || t.currentSlots || 0
  const entryFee = t.entryFee || 0
  const prizes = normalizePrizes(t.prizes?.length ? t.prizes : defaultPrizes(t.prizePool), t.currency || 'USD')
  // El plan / servidor propio es admin-only y no se deduce del costo de inscripcion.
  const plan = 'free'
  const staffMembers = Array.isArray(t.staffMembers) ? t.staffMembers : []
  const category = GAMES_BY_CATEGORY.find(c => c.id === t.categoryId)?.name || ''

  const built = {
    id: t.publicId || String(t._id),
    dbId: String(t._id || ''),
    title: t.title,
    game: t.game,
    gameId: t.gameId || '',
    gameCode: t.gameCode,
    publicId: t.publicId,
    internalId: t.tournamentCode,
    seriesId: t.seriesId || '',
    seasonName: t.seasonName || '',
    seasonNumber: t.seasonNumber || 1,
    competition: t.competition || null,
    staffMembers,
    pendingStaff: staffMembers.filter(m => m.status === 'pending').length,
    registrationStart: t.registrationWindow?.start || t.registrationStart || '',
    registrationEnd: t.registrationWindow?.end || t.registrationEnd || '',
    lateRegistration: Boolean(t.lateRegistration),
    timezone: t.timezone || 'America/Santo_Domingo',
    status: API_TO_UI_STATUS[t.status] || 'draft',
    apiStatus: t.status,
    rawStatus: t.status,
    format: formatTxt,
    apiFormat: t.format,
    capacity: t.maxSlots || 0,
    registered,
    prizePool: t.prizePool || 0,
    currency: t.currency || 'USD',
    prizeFundingStatus: t.prizeFundingStatus || 'pending',
    prizeSponsor: t.prizeSponsor || '',
    prizeProofUrl: t.prizeProofUrl || '',
    prizeDelivery: t.prizeDelivery || 'transfer',
    prizePayoutDeadline: t.prizePayoutDeadline || '',
    prizeNotes: t.prizeNotes || '',
    entryFee,
    startDate,
    startTime,
    dateIso: t.date || '',
    endDateIso: t.endDate || '',
    checkinDeadlineIso: t.checkinDeadline || '',
    mapMode: t.mapMode || 'fixed',
    mapPool: t.mapPool || '',
    patch: t.patch || '',
    revenue: entryFee ? registered * entryFee : 0,
    region: t.region || 'LATAM',
    platform: t.platform || 'pc',
    modality: t.modality || '',
    participationScope: t.participationScope || (t.allowedCountries?.length ? 'regional' : 'global'),
    allowedCountries: t.allowedCountries || [],
    minorsAllowed: Boolean(t.minorsAllowed),
    universityOnly: Boolean(t.eligibility?.universityOnly),
    category: category || 'Mixto',
    creator: t.organizer?.nick || 'Organizador',
    organizerId: String(t.organizer?._id || t.organizer?.id || t.organizer || ''),
    winner: t.winner || null,
    description: t.description || '',
    logo: t.logo || '',
    banner: t.banner || art.image,
    primaryColor: t.primaryColor || art.color,
    organizerBrandName: t.organizerBrandName || t.organizer?.nick || 'GlitchGang Esports',
    plan,
    discordEnabled: Boolean(t.discordEnabled),
    discordConsentAt: t.discordConsent?.acceptedAt || null,
    overcup: t.overcup || { enabled: false, locked: false, secondCheckinHours: 6, secondCheckinDeadline: '' },
    checkin: {
      provider: 'discord',
      presenceDeadline: t.checkinDeadline ? new Date(t.checkinDeadline).toISOString() : '',
      prematchMins: 30,
      toleranceMins: 10,
      botReminders: true,
      autoWalkover: true,
      ownDiscord: false,
      botEnabled: Boolean(t.discordEnabled),
      stats: t.checkin || { aTiempo: 0, tarde: 0, noShow: 0 },
    },
    // Config del check-in previo y del bot (la persiste updateTournament -> checkinConfig).
    checkinConfig: {
      prematchMins: t.checkinConfig?.prematchMins ?? 30,
      toleranceMins: t.checkinConfig?.toleranceMins ?? 10,
      autoWalkover: t.checkinConfig?.autoWalkover ?? true,
      botReminders: t.checkinConfig?.botReminders ?? true,
      dmCaptains: t.checkinConfig?.dmCaptains ?? true,
    },
    // Ritmo de partidas (duracion, descanso, aviso previo). null = el backend
    // todavia no guarda este bloque (BACKEND-PENDIENTE #avisos-por-partida).
    matchSchedule: t.matchSchedule ? {
      durationMins: t.matchSchedule.durationMins ?? 30,
      breakMins: t.matchSchedule.breakMins ?? 15,
      reminderMins: t.matchSchedule.reminderMins ?? 15,
    } : null,
    // Estado real de aprovisionamiento del espacio de Discord (lo llena el
    // bot vía el CRM): guildId, status, categoryId, roleIds, channels.* y
    // error -- ver Tournament.discordProvision en el backend.
    discordProvision: t.discordProvision || null,
    prizes,
    prizeType: t.prizeType || '',
    rules: t.rules ? t.rules.split('\n').filter(Boolean) : [],
    rulesText: t.rules || '',
    rulesDocument: t.rulesDocument || '',
    rulesName: t.rulesName || '',
    staff: t.staff || { director: '', admin: '', arbitros: [] },
    collaborators: normalizeCollaborators(t.collaborators),
    sponsors: t.sponsors || [],
    registrations: (t.registrations || []).map(r => ({
      id: r.id || r._id,
      name: r.name || r.teamMeta?.name || 'Equipo',
      tag: r.tag || '',
      status: r.status || 'registered',
      // Sala privada del equipo en Discord (la crea el bot al inscribirse).
      discordRoom: r.discordRoom || null,
    })),
    integrations: {
      discord: { connected: Boolean(t.discordEnabled), server: t.discordEnabled ? 'Discord de GlitchGang' : '', channel: t.contactDiscord || (t.discordEnabled ? STELIANT_ESPORTS_DISCORD_URL : '') },
    },
    contactEmail: t.contactEmail || '',
    contactPhone: t.contactPhone || '',
    contactDiscord: t.contactDiscord || (t.discordEnabled ? STELIANT_ESPORTS_DISCORD_URL : ''),
    whatsappEnabled: Boolean(t.whatsappEnabled),
    streamUrl: t.streamUrl || '',
    streamLang: t.streamLang || 'Espanol',
    server: t.server || '',
    notes: t.notes || '',
    minAge: t.minAge || 0,
    maxAge: t.minAge || 0,
    visibility: t.visibility || 'public',
  }
  return built
}

/** Lista de torneos reales -> misma forma que ORG_TOURNAMENTS. */
export function normalizeTournaments(list) {
  return (list || []).map(normalizeTournament)
}


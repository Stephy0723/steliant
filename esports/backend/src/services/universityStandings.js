// University standings calculator — points are accumulated from finished university-only tournaments
import { bracketShape, titlesPodiumOf } from './bracketSync.service.js'

const UNIVERSITY_POINTS = {
  participation: 25,
  sizeMultipliers: [
    { label: '2-3 equipos',    minTeams: 2,  maxTeams: 3,    multiplier: 1.00 },
    { label: '4-7 equipos',    minTeams: 4,  maxTeams: 7,    multiplier: 1.05 },
    { label: '8-15 equipos',   minTeams: 8,  maxTeams: 15,   multiplier: 1.12 },
    { label: '16-31 equipos',  minTeams: 16, maxTeams: 31,   multiplier: 1.20 },
    { label: '32+ equipos',    minTeams: 32, maxTeams: null,  multiplier: 1.30 },
  ],
  formats: {
    single_elimination: { matchWin: 12, championBonus: 60, finalistBonus: 30, semifinalBonus: 15 },
    double_elimination: { matchWin: 10, championBonus: 60, finalistBonus: 30, semifinalBonus: 15 },
    swiss:              { matchWin:  9, championBonus: 30, finalistBonus: 18, semifinalBonus: 10 },
    round_robin:        { matchWin:  8, championBonus: 24, finalistBonus: 14, semifinalBonus:  8 },
  },
}

const normalize = (value = '', max = 120) => String(value || '').trim().slice(0, max)
const toId = (value) => (value ? String(value) : '')

// Inscripciones que cuentan: las que siguen en pie (registered/checked_in).
// Antes solo contaba 'registered', asi que todo equipo que hizo check-in
// (justo los que jugaron) desaparecia del ranking.
const COUNTED_STATUSES = new Set(['registered', 'checked_in'])

// bracketDoc.format ('single'/'double'/...) -> tabla de puntos.
const FORMAT_KEYS = { single: 'single_elimination', double: 'double_elimination', swiss: 'swiss', round_robin: 'round_robin', rr: 'round_robin' }
const getFormatPoints = (tournament, shape) =>
  UNIVERSITY_POINTS.formats[FORMAT_KEYS[shape?.format] || FORMAT_KEYS[String(tournament?.format || '').toLowerCase()] || 'single_elimination'] ||
  UNIVERSITY_POINTS.formats.single_elimination

const getSizeTier = (count = 0) =>
  UNIVERSITY_POINTS.sizeMultipliers.find(
    (t) => count >= t.minTeams && (t.maxTeams == null || count <= t.maxTeams)
  ) || UNIVERSITY_POINTS.sizeMultipliers[0]

const scale = (value, multiplier = 1) => Math.round(Number(value || 0) * Number(multiplier || 1))

const ensureStanding = (map, universityId = '') => {
  const key = normalize(universityId, 60).toLowerCase()
  if (!key) return null
  if (!map.has(key)) {
    map.set(key, { universityId: key, points: 0, tournamentsPlayed: 0, matchWins: 0, championships: 0, finals: 0, semifinals: 0, achievements: [] })
  }
  return map.get(key)
}

// Un torneo universitario terminado -> participantes, partidas ganadas y
// podio, leidos del bracket real (bracketDoc) con el mismo podio que otorga
// los titulos de equipo (titlesPodiumOf). El bracket identifica equipos por
// nombre/tag, asi que se resuelven con el snapshot teamMeta de la inscripcion.
const analyzeTournament = (tournament) => {
  const regs = (Array.isArray(tournament?.registrations) ? tournament.registrations : [])
    .filter((r) => COUNTED_STATUSES.has(String(r?.status || 'registered')))
  const participants = new Map() // teamId -> { teamId, teamName, universityId }
  const byBracketName = new Map()
  for (const reg of regs) {
    const universityId = normalize(reg?.teamMeta?.university?.universityId, 60).toLowerCase()
    const teamId = toId(reg?.team?._id || reg?.team)
    if (!universityId || !teamId) continue
    const entry = { teamId, teamName: normalize(reg?.teamMeta?.name, 120) || normalize(reg?.teamMeta?.tag, 20), universityId }
    participants.set(teamId, entry)
    for (const name of [reg?.teamMeta?.name, reg?.teamMeta?.tag]) if (name) byBracketName.set(String(name), entry)
  }

  const shape = bracketShape(tournament)
  const results = tournament?.bracketDoc?.results || {}
  const matchWins = []
  for (const round of shape.rounds) {
    for (const match of round.matches || []) {
      const result = results[match.id]
      if (!result?.confirmed || !result.winner) continue
      const entry = byBracketName.get(String(result.winner))
      if (entry) matchWins.push(entry)
    }
  }

  // Torneos viejos guardaban el campeon en `winner` como id del equipo.
  const podium = titlesPodiumOf(tournament, shape)
  const placements = new Map() // teamId -> 1|2|3
  if (podium) {
    const place = (name, n) => { const e = byBracketName.get(String(name || '')); if (e && !placements.has(e.teamId)) placements.set(e.teamId, n) }
    place(podium.champion, 1)
    place(podium.runnerUp, 2)
    for (const name of podium.thirdPlace || []) place(name, 3)
  } else if (participants.has(toId(tournament?.winner))) {
    placements.set(toId(tournament.winner), 1)
  }

  return { participants, matchWins, placements, shape }
}

export const calculateUniversityStandings = (tournaments = []) => {
  const standingsMap = new Map()

  for (const tournament of Array.isArray(tournaments) ? tournaments : []) {
    const { participants, matchWins, placements, shape } = analyzeTournament(tournament)
    if (!participants.size) continue
    const formatPts = getFormatPoints(tournament, shape)
    const sizeTier  = getSizeTier(participants.size)

    const playedBy = new Set()
    for (const entry of participants.values()) {
      const standing = ensureStanding(standingsMap, entry.universityId)
      if (!standing) continue
      standing.points += scale(UNIVERSITY_POINTS.participation, sizeTier.multiplier)
      // Una universidad con 2 equipos en el mismo torneo jugo UN torneo.
      if (!playedBy.has(entry.universityId)) { standing.tournamentsPlayed += 1; playedBy.add(entry.universityId) }
      standing.achievements.push({
        tournamentId: toId(tournament._id),
        publicId:     tournament.publicId || '',
        title:        tournament.title || '',
        game:         tournament.game || '',
        date:         tournament.date || tournament.updatedAt || null,
        teamId:       entry.teamId,
        teamName:     entry.teamName,
        placement:    placements.get(entry.teamId) || null,
      })
    }

    for (const entry of matchWins) {
      const standing = ensureStanding(standingsMap, entry.universityId)
      if (standing) { standing.points += scale(formatPts.matchWin, sizeTier.multiplier); standing.matchWins += 1 }
    }

    for (const [teamId, placement] of placements) {
      const standing = ensureStanding(standingsMap, participants.get(teamId)?.universityId)
      if (!standing) continue
      if (placement === 1) { standing.points += scale(formatPts.championBonus, sizeTier.multiplier); standing.championships++; standing.finals++ }
      if (placement === 2) { standing.points += scale(formatPts.finalistBonus, sizeTier.multiplier); standing.finals++ }
      if (placement === 3) { standing.points += scale(formatPts.semifinalBonus, sizeTier.multiplier); standing.semifinals++ }
    }
  }

  for (const standing of standingsMap.values()) {
    standing.achievements.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }

  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.points         !== a.points)         return b.points         - a.points
    if (b.championships  !== a.championships)  return b.championships  - a.championships
    if (b.matchWins      !== a.matchWins)      return b.matchWins      - a.matchWins
    return a.universityId.localeCompare(b.universityId)
  })
}

export const getUniversityPointsConfig = () => ({
  participation:   UNIVERSITY_POINTS.participation,
  sizeMultipliers: UNIVERSITY_POINTS.sizeMultipliers.map((t) => ({ ...t })),
  formats:         { ...UNIVERSITY_POINTS.formats },
})

// Store compartido del bracket en memoria + helpers de generación.
// Permite que lo que el organizador edita/publica en el panel se vea en la
// vista pública del torneo (TorneoDetalle), incluido el ganador en vivo.

import { USE_BACKEND } from './features.js'
import { tournamentsApi } from './serverApi.js'
import { SERIES_OPTIONS } from '../../../shared/tournamentSetup.mjs'
// Motor de bracket puro (formato/equipos/rondas/standings) vive en shared/
// para que el backend genere y avance EXACTAMENTE los mismos IDs de partido
// que esta pantalla -- ver shared/bracketEngine.mjs para el porque. Se
// importa (no solo re-exporta) porque matchesForTeam/buildPublicRounds mas
// abajo tambien lo usan localmente.
import {
  normalizeFormat, nearestPow2, ceilPow2, padToPow2, resolveBracketTeams,
  roundRobinMatches, groupStage, swissPairings, roundLabel,
  buildSingleBracket, buildDoubleBracket, computeStandings,
} from '../../../shared/bracketEngine.mjs'
export {
  normalizeFormat, nearestPow2, ceilPow2, padToPow2, resolveBracketTeams,
  roundRobinMatches, groupStage, swissPairings, roundLabel,
  buildSingleBracket, buildDoubleBracket, computeStandings,
}

const memory = {}

function readAll() {
  return memory
}

export function getBracket(id) {
  return readAll()[String(id)] || null
}

export function saveBracket(id, data) {
  const all = readAll()
  all[String(id)] = { ...(all[String(id)] || {}), ...data, updatedAt: Date.now() }
  // Notifica a la misma pestaña (storage solo dispara entre pestañas).
  window.dispatchEvent(new CustomEvent('gg-brackets-change', { detail: { id: String(id) } }))
  // Persistencia en backend (best-effort) → multi-dispositivo cuando esté conectado.
  if (USE_BACKEND) {
    tournamentsApi.saveBracket(id, all[String(id)]).catch(() => {})
  }
}

// Trae el bracket desde el backend y actualiza la caché local (si está habilitado).
// Devuelve true si la caché quedó al día con el servidor (o no hay servidor),
// false si la llamada falló y la caché puede estar vacía o vieja.
export async function pullBracket(id) {
  if (!USE_BACKEND) return true
  try {
    const { bracket } = await tournamentsApi.getBracket(id)
    if (bracket) {
      const all = readAll()
      all[String(id)] = bracket
      window.dispatchEvent(new CustomEvent('gg-brackets-change', { detail: { id: String(id) } }))
    }
    return true
  } catch {
    return false /* backend caído: se usa la caché local */
  }
}

export function subscribeBrackets(cb) {
  const handler = () => cb()
  window.addEventListener('gg-brackets-change', handler)
  return () => {
    window.removeEventListener('gg-brackets-change', handler)
  }
}

// ── Serie (BO) por ronda, desde la configuracion de Competencia ──
function roundKeyFromName(name) {
  const n = String(name || '').toLowerCase()
  if (n.includes('gran final') || n === 'final') return 'final'
  if (n.includes('semi')) return 'semifinal'
  if (n.includes('cuartos')) return 'cuartos'
  if (n.includes('octavos')) return 'octavos'
  const m = /ronda de (\d+)/.exec(n)
  if (m) return `ronda_${m[1]}`
  return null
}

export function seriesForRound(competition, roundName) {
  const def = SERIES_OPTIONS.includes(competition?.defaultSeries) ? competition.defaultSeries : 'BO1'
  const key = roundKeyFromName(roundName)
  const custom = key && competition?.seriesByRound?.[key]
  return SERIES_OPTIONS.includes(custom) ? custom : def
}

// Juegos necesarios para ganar la serie y tope de juegos.
export function seriesTarget(series) {
  const bo = Number(String(series || 'BO1').replace(/\D/g, '')) || 1
  return { win: Math.ceil((bo + 1) / 2), max: bo }
}

// competition.system -> clave de formato visual del bracket.
export function formatFromCompetition(competition) {
  return ({
    single_elim: 'single', double_elim: 'double',
    round_robin: 'roundrobin', swiss: 'swiss', groups_playoffs: 'groups',
  })[competition?.system] || null
}

// Enfrentamientos de UN equipo dentro del bracket, para el panel de jugador/
// equipo (a diferencia de buildPublicRounds, esto SÍ expone `scheduledAt` y
// los resultados aún no confirmados -- el equipo necesita ver su rival y
// horario apenas el organizador los carga, no recién cuando se publica el
// marcador final).
export function matchesForTeam(t, stored, teamName) {
  if (!stored?.published || !teamName) return { published: false, format: null, all: [], next: null, recent: [] }
  const format = stored.format || normalizeFormat(t.format)
  const results = stored.results || {}
  const teams = Array.isArray(stored.teams) && stored.teams.length ? stored.teams : []
  const norm = (s) => String(s || '').trim().toLowerCase()
  const isMe = (s) => norm(s) === norm(teamName)

  const collect = (roundsArr) => {
    const out = []
    roundsArr.forEach(rd => {
      rd.matches.forEach(m => {
        if (!isMe(m.a) && !isMe(m.b)) return
        const opponent = isMe(m.a) ? m.b : m.a
        const r = results[m.id] || {}
        const hasResult = Boolean(r.winner || (r.scoreA !== undefined && r.scoreB !== undefined))
        out.push({
          id: m.id,
          round: rd.name,
          opponent,
          bye: opponent === 'BYE',
          pending: opponent === 'Por definir',
          hasResult,
          confirmed: Boolean(hasResult && r.confirmed),
          scoreA: hasResult ? r.scoreA : undefined,
          scoreB: hasResult ? r.scoreB : undefined,
          youAreA: isMe(m.a),
          won: hasResult ? norm(r.winner) === norm(teamName) : undefined,
          scheduledAt: r.scheduledAt || null,
          message: r.message || '',
        })
      })
    })
    return out
  }

  let all = []
  if (format === 'single') {
    all = collect(buildSingleBracket(teams, results, 'se').rounds)
  } else if (format === 'double') {
    const { wbRounds, lbRounds, grandFinal } = buildDoubleBracket(teams, results)
    all = collect(wbRounds.map(rd => ({ ...rd, name: `Winners · ${rd.name}` })))
      .concat(collect(lbRounds.map(rd => ({ ...rd, name: `Losers · ${rd.name}` }))))
      .concat(collect([{ name: 'Gran Final', matches: [grandFinal] }]))
  } else if (format === 'roundrobin') {
    all = collect([{ name: 'Fase de grupos', matches: roundRobinMatches(teams) }])
  } else if (format === 'groups') {
    const groups = groupStage(teams, t.competition?.groups || stored.groupCount || Math.max(1, Math.round(teams.length / 4)))
    all = groups.flatMap(g => collect([{ name: g.name, matches: g.matches }]))
    if (groups.flatMap(g => g.matches).every(m => results[m.id]?.confirmed)) {
      const standings = groups.map(g => computeStandings(g.teams, results, g.matches.map(m => m.id), t.competition?.scoring || {}))
      const qualifiers = []
      for (let pos = 0; pos < (t.competition?.advancePerGroup || 2); pos++) {
        standings.forEach(rows => { if (rows[pos]) qualifiers.push(rows[pos].name) })
      }
      if (qualifiers.length >= 2) all = all.concat(collect(buildSingleBracket(qualifiers, results, 'gpo').rounds))
    }
  } else if (format === 'swiss') {
    const { rounds } = swissPairings(teams, results, stored.swissRounds || Math.max(3, Math.ceil(Math.log2(Math.max(2, teams.length))) + 1))
    all = collect(rounds)
  }

  const next = all.find(m => !m.confirmed && !m.bye && !m.pending) || null
  const recent = all.filter(m => m.confirmed).slice(-5).reverse()
  return { published: true, format, all, next, recent }
}

// Construye las rondas para el componente público <Bracket /> a partir de lo publicado.
// Solo incluye resultados confirmados.
export function buildPublicRounds(t, stored) {
  if (!stored?.published) return { rounds: [], champion: null, published: false }
  const format = stored.format || normalizeFormat(t.format)
  const results = stored.results || {}
  // getBracketTeams ya no existe (llamarla tiraba ReferenceError): sin equipos
  // guardados no se inventan, el bracket público queda vacío.
  const teams = Array.isArray(stored.teams) ? stored.teams : []
  if (!teams.length) return { rounds: [], champion: null, published: true, format }

  const pub = (m, isFinal = false) => {
    const r = results[m.id]?.confirmed ? results[m.id] : null
    return {
      id: m.id,
      teamA: m.a, teamB: m.b,
      scoreA: r ? r.scoreA : undefined,
      scoreB: r ? r.scoreB : undefined,
      winner: r ? r.winner : undefined,
      isFinal,
    }
  }
  const toMatches = (built, finalName = 'Final') => built.rounds.map(rd => ({
    name: rd.name,
    matches: rd.matches.map(m => pub(m, rd.name === finalName)),
  }))

  if (format === 'single') {
    const built = buildSingleBracket(teams, results, 'se')
    return { rounds: toMatches(built), champion: built.champion, published: true, format }
  }

  if (format === 'double') {
    const { wbRounds, lbRounds, grandFinal, champion } = buildDoubleBracket(teams, results)
    const wb = wbRounds.map(rd => ({ name: `WB · ${rd.name}`, matches: rd.matches.map(m => pub(m)) }))
    const lb = lbRounds.map(rd => ({ name: rd.name, matches: rd.matches.map(m => pub(m)) }))
    const gf = { name: 'Gran Final', matches: [pub(grandFinal, true)] }
    return { rounds: [...wb, ...lb, gf], champion, published: true, format }
  }

  // Round robin / swiss / groups: muestra los resultados confirmados como una ronda.
  const played = Object.entries(results)
    .filter(([, r]) => r.confirmed)
    .map(([id, r]) => ({ id, teamA: r.a, teamB: r.b, scoreA: r.scoreA, scoreB: r.scoreB, winner: r.winner }))
  return {
    rounds: played.length ? [{ name: 'Resultados', matches: played }] : [],
    champion: null,
    published: true,
    format,
  }
}


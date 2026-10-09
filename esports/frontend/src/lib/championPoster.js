// Datos del "poster de campeon" a partir de la llave publica (buildPublicRounds)
// + lo guardado del bracket. Todo sale de resultados confirmados: si falta un
// dato (marcador, serie, titulos anteriores) ese campo queda vacio y el poster
// simplemente no lo pinta. Nunca se inventa.

import { seriesForRound } from './bracketStore.js'

const norm = (s) => String(s || '').trim().toLowerCase()
const PLACEHOLDERS = new Set(['bye', 'por definir', ''])

// 2 -> Bicampeon, 3 -> Tricampeon... Desde 6 ya no hay palabra comun.
const TITLE_WORDS = { 1: 'Campeón', 2: 'Bicampeón', 3: 'Tricampeón', 4: 'Tetracampeón', 5: 'Pentacampeón' }
export function championWord(titles) {
  const n = Number(titles) || 1
  return TITLE_WORDS[n] || `${n} veces campeón`
}

function hasScore(m) {
  return m.scoreA !== undefined && m.scoreA !== '' && m.scoreB !== undefined && m.scoreB !== ''
}

// Partidos jugados (confirmados, sin BYE) de un equipo, en orden de rondas.
// keyOf(nombre) -> clave de /equipos/:teamId del rival (vacia si no se sabe).
function pathOf(rounds, teamName, keyOf = () => '') {
  const out = []
  rounds.forEach(round => {
    round.matches.forEach(m => {
      const isA = norm(m.teamA) === norm(teamName)
      const isB = norm(m.teamB) === norm(teamName)
      if ((!isA && !isB) || !m.winner) return
      const opponent = isA ? m.teamB : m.teamA
      if (PLACEHOLDERS.has(norm(opponent))) return
      const scored = hasScore(m)
      out.push({
        id: m.id,
        round: round.name,
        opponent,
        opponentKey: keyOf(opponent),
        won: norm(m.winner) === norm(teamName),
        score: scored ? [isA ? m.scoreA : m.scoreB, isA ? m.scoreB : m.scoreA].map(Number) : null,
        isFinal: Boolean(m.isFinal),
      })
    })
  })
  return out
}

function summarize(path) {
  const wins = path.filter(p => p.won).length
  const scored = path.filter(p => p.score)
  return {
    series: path.length,
    wins,
    // Mapas/juegos solo si TODOS los partidos traen marcador; si no, el
    // total seria engañoso.
    games: scored.length && scored.length === path.length
      ? scored.reduce((acc, p) => [acc[0] + p.score[0], acc[1] + p.score[1]], [0, 0])
      : null,
  }
}

/**
 * @param {object} args
 * @param {{ rounds, champion, format }} args.bracket  resultado de buildPublicRounds
 * @param {object} args.stored        bracket guardado (getBracket), para la serie de la final
 * @param {object} args.competition   tournament.competition
 * @param {Array}  args.participants  mapTournamentParticipants (name, tag, logo, color)
 * @param {object} args.seriesChampion  { titles, editions } del backend (pendiente)
 */
export function buildChampionPoster({ bracket, stored, competition, participants = [], seriesChampion, sponsors = [] }) {
  const champion = bracket?.champion
  const rounds = Array.isArray(bracket?.rounds) ? bracket.rounds : []
  if (!champion || !rounds.length) return null

  const teamInfo = (name) => {
    const p = participants.find(item => norm(item.name) === norm(name) || norm(item.tag) === norm(name))
    return { name, tag: p?.tag || '', logo: p?.logo || '', color: p?.color || '', pageKey: p?.pageKey || '' }
  }

  const keyOf = (name) => teamInfo(name).pageKey
  const champPath = pathOf(rounds, champion, keyOf)
  const finalIdx = champPath.findIndex(p => p.isFinal)
  const finalEntry = finalIdx >= 0 ? champPath[finalIdx] : champPath[champPath.length - 1]
  if (!finalEntry) return null

  const runnerName = finalEntry.opponent
  const runnerPath = pathOf(rounds, runnerName, keyOf)
  const finalRound = rounds.find(r => r.matches.some(m => m.id === finalEntry.id))
  // Sin serie guardada ni configuracion de competencia no se sabe el BO:
  // mejor no mostrarlo que afirmar "partida unica" por defecto.
  const series = stored?.results?.[finalEntry.id]?.series || (competition ? seriesForRound(competition, finalRound?.name) : '')
  const bestOf = Number(String(series || '').replace(/\D/g, '')) || null

  // Tercer lugar: perdedores de semifinal (solo eliminacion simple, igual
  // que computePodium en el backend).
  let thirdPlace = []
  if (bracket.format === 'single' && rounds.length >= 2) {
    thirdPlace = rounds[rounds.length - 2].matches
      .filter(m => m.winner)
      .map(m => (norm(m.winner) === norm(m.teamA) ? m.teamB : m.teamA))
      .filter(name => !PLACEHOLDERS.has(norm(name)) && norm(name) !== norm(runnerName))
      .map(name => ({ name, pageKey: keyOf(name) }))
  }

  const titles = Number(seriesChampion?.titles) || 1
  const editions = Number(seriesChampion?.editions) || 0

  return {
    champion: {
      ...teamInfo(champion),
      path: champPath.filter(p => p !== finalEntry),
      stats: summarize(champPath),
    },
    runnerUp: {
      ...teamInfo(runnerName),
      path: runnerPath.filter(p => !p.isFinal && p.id !== finalEntry.id),
    },
    final: {
      round: finalRound?.name || 'Final',
      score: finalEntry.score,
      bestOf,
    },
    thirdPlace,
    titles,
    editions,
    headline: championWord(titles),
    sponsors: sponsors.filter(s => s && (s.name || s.logo)),
  }
}


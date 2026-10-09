// Titulos de torneo (podio) del equipo y de cada jugador que lo jugo, mas los
// puntos de ranking del equipo. Lo llama onResultsConfirmed
// (bracketSync.service.js) cada vez que cambia el podio: es idempotente y, si
// el organizador corrige la final, revierte lo anterior antes de otorgar.
//
// Escala aprobada (1/oct): Campeon +100, Subcampeon +60, 3.o +40 y +10 por
// cada serie ganada en el torneo; x nivel del circuito (sin nivel todavia: x1).
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { Tournament } from '../models/Tournament.js'

const PLACEMENT_PTS = { 1: 100, 2: 60, 3: 40 }
const SERIES_WON_PTS = 10

const idOf = value => String(value?._id || value || '')

/** Lista [nombre, puesto] del podio, solo equipos reales. */
export function podiumPlaces(podium) {
  if (!podium?.champion) return []
  return [
    [podium.champion, 1],
    [podium.runnerUp, 2],
    ...(podium.thirdPlace || []).map(name => [name, 3]),
  ].filter(([name]) => name && name !== 'BYE' && name !== 'Por definir')
}

function seriesWonBy(results, names) {
  return Object.values(results || {}).filter(m => m?.confirmed && names.includes(String(m.winner || ''))).length
}

// Quienes jugaron con ese equipo: el roster congelado en el check-in; si el
// torneo no tuvo check-in, los miembros actuales del equipo.
function playersOf(tournament, team) {
  const reg = (tournament.registrations || []).find(r => idOf(r.team) === idOf(team))
  const snapshot = (reg?.rosterSnapshot || []).map(p => idOf(p.userId)).filter(Boolean)
  if (snapshot.length) return [...new Set(snapshot)]
  return [...new Set([idOf(team.leader), ...(team.members || []).map(idOf)].filter(Boolean))]
}

// Campeon vigente: no hay otra edicion de la misma serie terminada despues.
async function isCurrentChampion(tournament) {
  if (!tournament.seriesId) return false
  const newer = await Tournament.exists({
    _id: { $ne: tournament._id },
    seriesId: tournament.seriesId,
    status: 'finished',
    date: { $gt: tournament.date || new Date(0) },
  })
  return !newer
}

async function revokeTitles(tournamentId) {
  const teams = await Team.find({ 'titles.tournament': tournamentId }).select('titles').lean()
  for (const team of teams) {
    const pts = (team.titles || [])
      .filter(title => idOf(title.tournament) === idOf(tournamentId))
      .reduce((sum, title) => sum + (Number(title.rankPts) || 0), 0)
    await Team.updateOne({ _id: team._id }, { $pull: { titles: { tournament: tournamentId } }, $inc: { rankPts: -pts } })
  }
  await User.updateMany({ 'titles.tournament': tournamentId }, { $pull: { titles: { tournament: tournamentId } } })
}

/**
 * Deja los titulos de `tournament` iguales al `podium` (null = sin campeon,
 * se quitan). `teamsByName` = mapa nombre/tag del bracket -> Team.
 */
export async function syncTournamentTitles(tournament, podium, teamsByName) {
  await revokeTitles(tournament._id)
  const places = podiumPlaces(podium)
  if (!places.length) return []

  const current = await isCurrentChampion(tournament)
  if (current) {
    // El nuevo campeon de la serie le quita lo "vigente" al anterior.
    const filter = { 't.seriesId': tournament.seriesId, 't.current': true }
    await Team.updateMany({ 'titles.seriesId': tournament.seriesId }, { $set: { 'titles.$[t].current': false } }, { arrayFilters: [filter] })
    await User.updateMany({ 'titles.seriesId': tournament.seriesId }, { $set: { 'titles.$[t].current': false } }, { arrayFilters: [filter] })
  }

  const results = tournament.bracketDoc?.results || {}
  const awarded = []
  for (const [name, placement] of places) {
    const team = teamsByName.get(name)
    if (!team) continue
    const rankPts = PLACEMENT_PTS[placement] + SERIES_WON_PTS * seriesWonBy(results, [team.name, team.tag].filter(Boolean))
    const title = {
      tournament: tournament._id,
      publicId: tournament.publicId || '',
      tournamentTitle: tournament.title || '',
      game: tournament.game || team.game || '',
      seriesId: tournament.seriesId || '',
      placement,
      rankPts,
      current: placement === 1 && current,
      date: new Date(),
    }
    await Team.updateOne({ _id: team._id }, { $push: { titles: title }, $inc: { rankPts } })
    const players = playersOf(tournament, team)
    if (players.length) {
      await User.updateMany({ _id: { $in: players } }, { $push: { titles: { ...title, team: team._id, teamName: team.name || '' } } })
    }
    awarded.push({ team: idOf(team), placement, rankPts, players: players.length })
  }
  return awarded
}

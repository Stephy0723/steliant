import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { PlayerMatch } from '../models/PlayerMatch.js'
import { isMobileLegends } from '../../../shared/matchStats.mjs'
import { isStaffSlotKey } from '../../../shared/teamRoles.mjs'
import { statsMatches } from './matchStats.service.js'
import { enqueueIntegrationEvent } from './integrationEvents.service.js'
import { tournamentLink, teamUserIds, notifyUsers } from './tournamentTeams.service.js'
import { syncTournamentTitles } from './tournamentTitles.service.js'
import {
  normalizeFormat, resolveBracketTeams, buildSingleBracket, buildDoubleBracket, computePodium, computeFormatPodium,
} from '../../../shared/bracketEngine.mjs'

// computePodium vive en shared/ (la web lo usa para la vitrina de titulos del
// equipo); se re-exporta para no romper a quien lo importe de aqui.
export { computePodium }

// Puente Discord -> bracket real (Tournament.bracketDoc). Antes de esto,
// TournamentMatch (check-in/report por Discord) y bracketDoc (lo que
// arma/edita el organizador en la web) eran dos mundos que nunca se
// hablaban: el bracket no se generaba solo y un resultado reportado por
// Discord no movia nada del bracket real. Este servicio conecta ambos,
// pero solo para lo que se puede automatizar con seguridad -- nunca decide
// un resultado por si solo, solo lo refleja una vez que AMBOS equipos
// coinciden (ver tryAutoSyncMatchReport en tournamentMatches.controller.js).

const norm = (s) => String(s || '').trim().toLowerCase()

/**
 * Si el bracket de este torneo todavia no fue armado/editado por el
 * organizador (sin resultados cargados, no publicado en 'running'/'finished'),
 * y ya hay 2+ equipos con check-in completo, genera y publica el bracket
 * inicial solo -- el organizador puede seguir editandolo o republicarlo
 * despues, esto solo evita arrancar de una pizarra en blanco cuando ya se
 * sabe quienes juegan. Nunca pisa un bracket que el organizador ya empezo
 * a trabajar.
 */
export async function autoGenerateBracketIfReady(tournamentId) {
  const tournament = await Tournament.findById(tournamentId)
    .populate('registrations.team', 'name tag')
  if (!tournament) return null

  const doc = tournament.bracketDoc || {}
  const alreadyBuilt = doc.status === 'running' || doc.status === 'finished' ||
    (doc.results && Object.keys(doc.results).length > 0) ||
    (Array.isArray(doc.teams) && doc.teams.length > 0)
  if (alreadyBuilt) return null

  const OUT = new Set(['withdrawn', 'rejected', 'disqualified', 'cancelled'])
  const registrations = (tournament.registrations || []).map(r => ({
    status: r.status,
    name: r.teamMeta?.name || r.team?.name || '',
    tag: r.teamMeta?.tag || r.team?.tag || '',
  }))
  const inPlay = registrations.filter(r => !OUT.has(r.status))
  const checkedInCount = inPlay.filter(r => r.status === 'checked_in').length
  // Espera a que TODOS los equipos que siguen en carrera hayan hecho
  // check-in (no solo los primeros 2) -- si dispara con los primeros que
  // llegan, deja afuera a los que se conectan un poco despues y arma un
  // bracket incompleto que el organizador tendria que rehacer a mano.
  if (inPlay.length < 2 || checkedInCount < inPlay.length) return null

  const teams = resolveBracketTeams(registrations, doc.seedOrder)
  if (teams.length < 2) return null

  tournament.bracketDoc = {
    ...doc,
    format: doc.format || normalizeFormat(tournament.format),
    teams,
    published: true,
    status: 'running',
    results: doc.results || {},
    updatedAt: new Date(),
  }
  tournament.markModified('bracketDoc.results')
  if (['open', 'registration_closed'].includes(tournament.status)) tournament.status = 'ongoing'
  await tournament.save()
  return tournament.bracketDoc
}

// Busca, dentro del bracket YA calculado con el estado actual de
// resultados, el partido pendiente cuyo par de equipos matchea (en
// cualquier orden) el par reportado. Solo 'single' por ahora -- doble
// eliminacion/round robin/swiss/groups quedan para el organizador hasta
// extender esto con cuidado (mas formas de calcular mal el id).
function findPendingMatch(format, teams, results, teamAName, teamBName) {
  if (format !== 'single' || !teams?.length) return null
  const { rounds } = buildSingleBracket(teams, results, 'se')
  for (const round of rounds) {
    for (const m of round.matches) {
      if (results[m.id]?.confirmed) continue
      const pair = new Set([norm(m.a), norm(m.b)])
      if (pair.size === 2 && pair.has(norm(teamAName)) && pair.has(norm(teamBName))) {
        return m
      }
    }
  }
  return null
}

/**
 * Escribe el resultado confirmado en bracketDoc.results del partido que
 * matchea a estos 2 equipos. No guarda el torneo (el caller decide cuando).
 * Devuelve { matchFound, matchId, justFinished, podium } para que el
 * caller sepa si hay que anunciar campeon.
 */
export function applyConfirmedResult(tournament, teamAName, teamBName, winnerName) {
  const doc = tournament.bracketDoc || {}
  const format = doc.format || normalizeFormat(tournament.format)
  const teams = Array.isArray(doc.teams) ? doc.teams : []
  const results = doc.results || {}

  const match = findPendingMatch(format, teams, results, teamAName, teamBName)
  if (!match) return { matchFound: false }

  const wasChampionAlready = Boolean(doc.champion)
  const nextResults = {
    ...results,
    [match.id]: { a: match.a, b: match.b, winner: winnerName, confirmed: true, source: 'discord-report', confirmedAt: new Date() },
  }

  const { rounds, champion } = buildSingleBracket(teams, nextResults, 'se')

  tournament.bracketDoc = { ...doc, results: nextResults, updatedAt: new Date() }
  tournament.markModified('bracketDoc.results')

  let podium = null
  const justFinished = Boolean(champion) && !wasChampionAlready
  if (justFinished) {
    podium = computePodium(rounds, champion)
    tournament.bracketDoc.champion = champion
    tournament.bracketDoc.status = 'finished'
    tournament.winner = champion
    tournament.status = 'finished'
  }

  return { matchFound: true, matchId: match.id, winner: winnerName, justFinished, podium }
}

/**
 * Se llama despues de guardar un reporte de Discord (/report). Busca si el
 * equipo RIVAL (segun el nombre que cada lider escribio) ya reporto tambien
 * -- solo cuando AMBOS coinciden en quien gano se escribe el bracket. Si no
 * hay reporte del rival todavia, o los reportes no coinciden, o el nombre
 * de equipo no matchea ninguno real del bracket, no toca nada (nunca
 * bloquea ni corrompe el reporte individual, que ya quedo guardado antes de
 * llamar esto).
 */
export async function tryAutoSyncMatchReport(doc) {
  if (!doc.result || !doc.rivalName) return { status: 'no_rival_named' }

  const myTeam = await Team.findById(doc.team).select('name').lean()
  if (!myTeam) return null

  const candidates = await TournamentMatch.find({
    tournament: doc.tournament,
    _id: { $ne: doc._id },
    result: { $nin: [null, ''] },
    rivalName: { $nin: [null, ''] },
  }).sort({ updatedAt: -1 }).limit(25).populate('team', 'name').lean()

  const rivalDoc = candidates.find(c =>
    norm(c.team?.name) === norm(doc.rivalName) && norm(c.rivalName) === norm(myTeam.name)
  )
  if (!rivalDoc) return { status: 'awaiting_rival' }

  const consistent =
    (doc.result === 'win' && rivalDoc.result === 'lose') ||
    (doc.result === 'lose' && rivalDoc.result === 'win') ||
    (doc.result === 'draw' && rivalDoc.result === 'draw')

  if (!consistent) {
    await TournamentMatch.updateMany(
      { _id: { $in: [doc._id, rivalDoc._id] } },
      { $set: { 'report.disputed': true, 'report.disputedAt': new Date() } },
    )
    return { status: 'disputed', rivalTeamName: rivalDoc.team?.name || '' }
  }

  if (doc.result === 'draw') return { status: 'draw_not_supported_in_bracket' }
  const winnerName = doc.result === 'win' ? myTeam.name : (rivalDoc.team?.name || '')
  if (!winnerName) return { status: 'no_winner_resolved' }

  const tournament = await Tournament.findById(doc.tournament)
  if (!tournament) return null

  const prevResults = { ...(tournament.bracketDoc?.results || {}) }
  const outcome = applyConfirmedResult(tournament, myTeam.name, rivalDoc.team?.name || '', winnerName)
  if (!outcome.matchFound) return { status: 'no_bracket_match', winnerName }

  await tournament.save()
  // Avisos web, stats, W/L del equipo y anuncios de Discord: lo mismo que
  // cuando el organizador confirma desde la web (saveBracket).
  await onResultsConfirmed(tournament, prevResults, { source: 'discord-report' }).catch((error) => {
    console.error('[bracket-sync] onResultsConfirmed fallo:', error.message)
  })

  return { status: 'synced', ...outcome }
}

// ─── Efectos de un resultado confirmado (#ganador-avisos) ─────────────────
// Los dos caminos que confirman resultados (organizador en la web y /report
// de Discord) llaman a onResultsConfirmed, asi hacen exactamente lo mismo.
//
// Que ya se proceso vive en bracketDoc.processedResults (matchId -> estado),
// no en flags dentro de results: el panel del organizador reenvia `results`
// entero desde el navegador y pisaria cualquier flag del servidor. Con esto:
// guardar 5 veces no avisa 5 veces, desconfirmar+reconfirmar igual no
// re-avisa, y si el organizador corrige el ganador se revierte el W/L viejo.

const isRealTeam = (name) => Boolean(name) && name !== 'BYE' && name !== 'Por definir'
const scoreOf = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v))

function prizeFor(tournament, placement) {
  const prize = (tournament.prizes || []).find(p =>
    (p.kind || 'placement') === 'placement' && String(p.place || '').trim().startsWith(String(placement)))
  if (!prize) return ''
  const money = Number(prize.amount) > 0 ? `${prize.currency || ''} ${Number(prize.amount).toLocaleString('es')}`.trim() : ''
  return [money, prize.items].filter(Boolean).join(' + ')
}

// Rondas del bracket ya resuelto + id de la final, segun el formato.
export function bracketShape(tournament) {
  const doc = tournament.bracketDoc || {}
  const format = doc.format || normalizeFormat(tournament.format)
  const teams = Array.isArray(doc.teams) ? doc.teams : []
  const results = doc.results || {}
  if (format === 'single' && teams.length >= 2) {
    const { rounds } = buildSingleBracket(teams, results, 'se')
    return { format, rounds, finalId: rounds[rounds.length - 1].matches[0].id }
  }
  if (format === 'double' && teams.length >= 2) {
    const { wbRounds, lbRounds } = buildDoubleBracket(teams, results)
    return { format, rounds: [...wbRounds, ...lbRounds], finalId: 'gf', noNextRound: true }
  }
  return { format, rounds: [], finalId: null }
}

function roundInfo(shape, matchId, winner) {
  const idx = shape.rounds.findIndex(r => r.matches.some(m => m.id === matchId))
  if (idx === -1) return {}
  const info = { roundLabel: shape.rounds[idx].name }
  const next = !shape.noNextRound && shape.rounds[idx + 1]
  if (next) {
    info.nextRoundLabel = next.name
    const nm = next.matches.find(m => m.a === winner || m.b === winner)
    const rival = nm && (nm.a === winner ? nm.b : nm.a)
    if (isRealTeam(rival)) info.nextOpponentName = rival
  }
  return info
}

// Mismo criterio que usaba saveBracket para las stats: el equipo se resuelve
// por nombre o tag de los inscritos.
async function teamsByBracketName(tournament) {
  const teamIds = (tournament.registrations || []).map(r => r.team?._id || r.team).filter(Boolean)
  if (!teamIds.length) return new Map()
  const teamDocs = await Team.find({ _id: { $in: teamIds } }).select('name tag leader members game rosterSlots').lean()
  const map = new Map()
  for (const td of teamDocs) {
    if (td.tag) map.set(td.tag, td)
    if (td.name) map.set(td.name, td)
  }
  return map
}

// PlayerMatch (historial/rendimiento del jugador) por cada jugador del roster
// de ambos equipos. Antes solo lo hacia saveBracket (#jugador-stats-sin-pipeline).
// Quienes juegan por el equipo: el roster congelado del check-in sin los
// puestos de staff; sin check-in, los miembros que no son staff. Antes iban
// TODOS los miembros: el coach/analista/manager sumaba partidas y winrate.
function matchPlayerIds(tournament, team) {
  const reg = (tournament.registrations || []).find(r => String(r.team?._id || r.team) === String(team._id))
  const snapshot = (reg?.rosterSnapshot || []).filter(p => p.userId && !isStaffSlotKey(p.slot)).map(p => String(p.userId))
  if (snapshot.length) return [...new Set(snapshot)]
  const staffIds = new Set(Object.entries(team.rosterSlots || {})
    .filter(([key, slot]) => isStaffSlotKey(key) && slot?.userId)
    .map(([, slot]) => String(slot.userId)))
  return team.members.map(String).filter(id => !staffIds.has(id))
}

function playerMatchesFor(tournament, m, teamsByName) {
  // MLBB records now represent individual games with human-reviewed stats.
  // Do not also create a zero-filled series record for those same players.
  if (isMobileLegends(tournament.game)) return []
  const out = []
  for (const [team, opponentName] of [[teamsByName.get(m.a), m.b], [teamsByName.get(m.b), m.a]]) {
    if (!team || !Array.isArray(team.members) || !team.members.length) continue
    const result = !m.winner ? 'draw' : (m.winner === team.name || m.winner === team.tag) ? 'win' : 'loss'
    for (const playerId of matchPlayerIds(tournament, team)) {
      out.push({
        player: playerId,
        team: team._id,
        tournament: tournament._id,
        game: tournament.game || team.game || 'Varios',
        mode: 'Torneo',
        opponentName: String(opponentName || ''),
        result,
        source: 'tournament',
        playedAt: m.time ? new Date(m.time) : new Date(),
        notes: `Partida de torneo: ${tournament.title}`,
      })
    }
  }
  return out
}

// Al quedar el campeon (una sola vez, junto con tournament_podium):
//  - tournament_finished a los demas equipos inscritos (no subieron al podio).
//  - tournament_prizes_pending al organizador: que premio va a quien.
async function notifyTournamentFinished(tournament, { podium, places, teamsByName, baseMeta, link }) {
  const podiumIds = new Set(places.map(([name]) => String(teamsByName.get(name)?._id || '')).filter(Boolean))
  const otherTeamIds = [...new Set((tournament.registrations || [])
    .filter(reg => reg.status !== 'withdrawn')
    .map(reg => String(reg.team?._id || reg.team || ''))
    .filter(id => id && !podiumIds.has(id)))]
  for (const teamId of otherTeamIds) {
    await notifyUsers(await teamUserIds(teamId), {
      type: 'tournament_finished',
      title: 'Torneo terminado',
      message: `${podium.champion} ganó ${tournament.title}. Gracias por competir.`,
      link: `${link}?tab=resumen#campeon`,
      meta: { ...baseMeta, champion: podium.champion, runnerUp: podium.runnerUp || '' },
    })
  }

  const pending = places
    .map(([name, placement]) => ({ placement, teamName: name, prize: prizeFor(tournament, placement) }))
    .filter(item => item.prize)
  if (tournament.organizer && pending.length) {
    await notifyUsers([String(tournament.organizer?._id || tournament.organizer)], {
      type: 'tournament_prizes_pending',
      title: 'Premios por entregar',
      message: `${tournament.title} terminó. Entrega ${pending.length === 1 ? 'el premio' : `los ${pending.length} premios`}: ${pending.map(item => `${item.placement}.º ${item.teamName} (${item.prize})`).join(', ')}.`,
      link: `/organizador/torneo/${tournament.publicId || tournament._id}/gestionar/prizepool`,
      meta: { ...baseMeta, prizes: pending, deadline: tournament.prizePayoutDeadline || '' },
    })
  }
}

async function incTeamRecord(team, field, by) {
  if (team?._id) await Team.updateOne({ _id: team._id }, { $inc: { [field]: by } })
}

export function titlesPodiumOf(tournament, shape, podium = null) {
  // Torneos viejos pueden tener el campeon solo en `winner` (cuando es nombre).
  const legacyWinner = tournament.status === 'finished' && typeof tournament.winner === 'string' ? tournament.winner : ''
  const champion = tournament.bracketDoc?.champion || legacyWinner
  if (!champion) return null
  if (podium) return podium
  return podiumOf(tournament, shape, champion)
}

// 2.º y 3.º en cualquier formato (antes solo eliminacion simple; el resto
// quedaba solo con campeon y sin titulos de podio).
function podiumOf(tournament, shape, champion) {
  const doc = tournament.bracketDoc || {}
  return computeFormatPodium(shape.format, doc.teams, doc.results, champion, tournament.competition || {})
}

/**
 * Otorga/actualiza los titulos y rankPts del torneo si el podio cambio desde
 * la ultima vez (bracketDoc.titlesKey). Lo usa onResultsConfirmed y el script
 * backfill-tournament-titles.js para los torneos terminados antes de esto.
 * Devuelve lo otorgado, o null si no cambio nada.
 */
export async function syncTitlesIfChanged(tournament, { shape = null, teamsByName = null, podium = null, dryRun = false } = {}) {
  const titlesPodium = titlesPodiumOf(tournament, shape || bracketShape(tournament), podium)
  const titlesKey = titlesPodium ? JSON.stringify([titlesPodium.champion, titlesPodium.runnerUp || '', titlesPodium.thirdPlace || []]) : ''
  if (titlesKey === (tournament.bracketDoc?.titlesKey || '')) return null
  if (dryRun) return { podium: titlesPodium }
  const awarded = await syncTournamentTitles(tournament, titlesPodium, teamsByName || await teamsByBracketName(tournament))
  await Tournament.updateOne({ _id: tournament._id }, { $set: { 'bracketDoc.titlesKey': titlesKey } })
  if (tournament.bracketDoc) tournament.bracketDoc.titlesKey = titlesKey
  return { podium: titlesPodium, awarded }
}

/**
 * Llamar DESPUES de guardar el bracket. `prevResults` = results antes de
 * este cambio (solo se usa la primera vez, para sembrar processedResults en
 * torneos que ya traian resultados de antes de este cambio sin re-avisarlos).
 */
export async function onResultsConfirmed(tournament, prevResults, { source }) {
  const doc = tournament.bracketDoc || {}
  const results = doc.results || {}
  let ledger = doc.processedResults
  const seeding = !ledger || typeof ledger !== 'object'
  if (seeding) {
    ledger = {}
    for (const [id, m] of Object.entries(prevResults || {})) {
      if (m?.confirmed) ledger[id] = { legacy: true, notifiedWinner: m.winner || '', statsRecorded: true }
    }
  }

  const shape = bracketShape(tournament)
  const teamsByName = await teamsByBracketName(tournament)
  const link = tournamentLink(tournament)
  const baseMeta = {
    tournamentId: String(tournament._id), tournamentPublicId: tournament.publicId || '',
    tournamentTitle: tournament.title, tournamentPath: link, source,
  }
  const discordOn = source === 'discord-report' || Boolean(tournament.discordEnabled)
  const playerMatches = []
  const updatedMatches = []
  let changed = false

  for (const id of new Set([...Object.keys(results), ...Object.keys(ledger)])) {
    const m = results[id]
    const confirmed = m?.confirmed === true && isRealTeam(m.a) && isRealTeam(m.b)
    const winner = confirmed ? String(m.winner || '') : ''
    const entry = { ...(ledger[id] || {}) }

    // W/L del equipo: revertir lo contado si ya no aplica (desconfirmado o
    // ganador corregido), y contar lo nuevo. Los empates no suman.
    if (entry.counted && entry.countedWinner !== winner) {
      await incTeamRecord(teamsByName.get(entry.countedWinner), 'wins', -1)
      await incTeamRecord(teamsByName.get(entry.countedLoser), 'losses', -1)
      entry.counted = false
    }
    if (winner && !entry.counted && !(entry.legacy && entry.notifiedWinner === winner)) {
      const loser = winner === m.a ? m.b : m.a
      await incTeamRecord(teamsByName.get(winner), 'wins', 1)
      await incTeamRecord(teamsByName.get(loser), 'losses', 1)
      Object.assign(entry, { counted: true, countedWinner: winner, countedLoser: loser })
    }

    if (confirmed && !entry.statsRecorded) {
      playerMatches.push(...playerMatchesFor(tournament, m, teamsByName))
      entry.statsRecorded = true
    }

    if (winner && entry.notifiedWinner !== winner) {
      entry.notifiedWinner = winner
      updatedMatches.push(id)
      // La final la cubre tournament_podium.
      if (id !== shape.finalId) {
        const loser = winner === m.a ? m.b : m.a
        const [mine, theirs] = winner === m.a ? [scoreOf(m.scoreA), scoreOf(m.scoreB)] : [scoreOf(m.scoreB), scoreOf(m.scoreA)]
        const scores = mine != null && theirs != null ? { teamScore: mine, opponentScore: theirs } : {}
        const team = teamsByName.get(winner)
        if (team) {
          await notifyUsers(await teamUserIds(team._id), {
            type: 'tournament_match_won',
            title: 'Victoria',
            message: `${winner} venció a ${loser} en ${tournament.title}.`,
            link,
            meta: { ...baseMeta, teamName: winner, opponentName: loser, matchId: id, ...scores, ...roundInfo(shape, id, winner) },
          })
        }
        // Eliminacion simple: perder una serie (que no sea la final, la cubre
        // tournament_podium) es quedar fuera. En otros formatos perder no
        // elimina necesariamente, asi que no se avisa.
        const loserTeam = shape.format === 'single' && teamsByName.get(loser)
        if (loserTeam && entry.eliminatedNotified !== loser) {
          entry.eliminatedNotified = loser
          const { roundLabel } = roundInfo(shape, id, winner)
          const loserScores = scores.teamScore != null ? { teamScore: scores.opponentScore, opponentScore: scores.teamScore } : {}
          await notifyUsers(await teamUserIds(loserTeam._id), {
            type: 'tournament_eliminated',
            title: 'Eliminados',
            message: `${loser} quedó fuera de ${tournament.title}${roundLabel ? ` en ${roundLabel}` : ''} tras perder contra ${winner}.`,
            link,
            meta: { ...baseMeta, teamName: loser, opponentName: winner, matchId: id, ...(roundLabel ? { roundLabel } : {}), ...loserScores },
          })
        }
      }
    }

    if (JSON.stringify(entry) !== JSON.stringify(ledger[id] || {})) {
      ledger[id] = entry
      changed = true
    }
  }

  if (playerMatches.length) await PlayerMatch.insertMany(playerMatches)

  // tournament_match_ready: una partida de ronda 2+ acaba de quedar con sus
  // dos equipos definidos. La 1a ronda la cubre tournament_bracket_ready
  // (checkinClose). Al sembrar un torneo previo solo se marcan, sin avisar.
  if (shape.format === 'single') {
    const regByTeamId = new Map((tournament.registrations || []).map(r => [String(r.team?._id || r.team), r]))
    const guildId = tournament.discordProvision?.guildId || ''
    for (const round of shape.rounds.slice(1)) {
      for (const match of round.matches) {
        if (!isRealTeam(match.a) || !isRealTeam(match.b) || results[match.id]?.confirmed) continue
        if (ledger[match.id]?.readyNotified) continue
        ledger[match.id] = { ...(ledger[match.id] || {}), readyNotified: true }
        changed = true
        if (seeding) continue
        for (const [name, opponent] of [[match.a, match.b], [match.b, match.a]]) {
          const team = teamsByName.get(name)
          if (!team) continue
          const reg = regByTeamId.get(String(team._id))
          const channelId = reg?.discordProvision?.textChannelId
          await notifyUsers(await teamUserIds(team._id), {
            type: 'tournament_match_ready',
            title: 'Tu siguiente partida está lista',
            message: `${name} juega contra ${opponent} en ${round.name} de ${tournament.title}.`,
            link: '/mi-equipo/enfrentamiento',
            meta: {
              ...baseMeta, teamName: name, opponentName: opponent, matchId: match.id, roundLabel: round.name,
              ...(results[match.id]?.series ? { bestOf: results[match.id].series } : {}),
              ...(guildId && channelId ? { matchChannelUrl: `https://discord.com/channels/${guildId}/${channelId}` } : {}),
            },
          })
        }
      }
    }
  }

  // Podio: una sola vez, cuando hay campeon.
  let podium = null
  if (doc.champion && !doc.podiumNotifiedAt) {
    podium = podiumOf(tournament, shape, doc.champion)
    // Liga y suizo se deciden por tabla: no hay "final" contra nadie.
    const byTable = ['roundrobin', 'swiss'].includes(shape.format)
    const places = [
      [podium.champion, 1, byTable ? '' : podium.runnerUp],
      [podium.runnerUp, 2, byTable ? '' : podium.champion],
      ...(podium.thirdPlace || []).map(name => [name, 3, '']),
    ].filter(([name]) => isRealTeam(name))
    for (const [name, placement, finalOpponentName] of places) {
      const team = teamsByName.get(name)
      if (!team) continue
      const prize = prizeFor(tournament, placement)
      await notifyUsers(await teamUserIds(team._id), {
        type: 'tournament_podium',
        title: placement === 1 ? 'Campeones' : placement === 2 ? 'Subcampeones' : 'Tercer lugar',
        message: placement === 1
          ? `${name} ganó ${tournament.title}.`
          : `${name} terminó en el puesto ${placement} de ${tournament.title}.`,
        link: `${link}?tab=resumen#campeon`,
        meta: { ...baseMeta, teamName: name, placement, ...(finalOpponentName ? { finalOpponentName } : {}), ...(prize ? { prize } : {}) },
      })
    }
    await notifyTournamentFinished(tournament, { podium, places, teamsByName, baseMeta, link })
  }

  if (discordOn) {
    for (const matchId of updatedMatches) {
      if (podium && matchId === shape.finalId) continue
      await enqueueIntegrationEvent({
        type: 'discord.bracket.updated',
        entityType: 'tournament',
        entityId: tournament._id,
        payload: { tournamentId: tournament._id, matchId, winnerName: results[matchId]?.winner },
        dedupe: false,
      })
    }
    if (podium) {
      await enqueueIntegrationEvent({
        type: 'discord.tournament.finished',
        entityType: 'tournament',
        entityId: tournament._id,
        payload: { tournamentId: tournament._id, champion: podium.champion, runnerUp: podium.runnerUp, thirdPlace: podium.thirdPlace || [] },
        dedupe: false,
      })
    }
  }

  // Titulos y rankPts: cada vez que el podio cambia (incluida una final
  // corregida despues de avisar), no solo la primera vez.
  await syncTitlesIfChanged(tournament, { shape, teamsByName, podium })

  const set = {}
  if (changed || !doc.processedResults) set['bracketDoc.processedResults'] = ledger
  if (podium) set['bracketDoc.podiumNotifiedAt'] = new Date()
  if (Object.keys(set).length) {
    await Tournament.updateOne({ _id: tournament._id }, { $set: set })
    if (tournament.bracketDoc) {
      tournament.bracketDoc.processedResults = ledger
      if (podium) tournament.bracketDoc.podiumNotifiedAt = set['bracketDoc.podiumNotifiedAt']
    }
  }
  return { updatedMatches, podium }
}

/**
 * Escribe el resultado de una serie ya decidida (lectura automatica o
 * arbitro) en bracketDoc.results[matchId], en cualquier formato. Nunca pisa
 * un resultado ya confirmado (por el organizador u otro proceso): la
 * escritura es condicional. Campeon automatico solo en eliminacion simple y
 * doble; liga/suizo/grupos los culmina el organizador.
 */
export async function writeSeriesResult(tournamentId, matchId, { winner, scoreA = null, scoreB = null, source }) {
  const tournament = await Tournament.findById(tournamentId).lean()
  if (!tournament) return { status: 'no_tournament' }
  const doc = tournament.bracketDoc || {}
  const results = doc.results || {}
  if (results[matchId]?.confirmed) return { status: 'already_confirmed' }
  const match = statsMatches(tournament).find(m => m.id === matchId)
  if (!match || ![match.a, match.b].includes(winner)) return { status: 'no_bracket_match' }

  const entry = { ...(results[matchId] || {}), a: match.a, b: match.b, scoreA, scoreB, winner, confirmed: true, source, confirmedAt: new Date() }
  const nextResults = { ...results, [matchId]: entry }
  const format = doc.format || normalizeFormat(tournament.format)
  const teams = Array.isArray(doc.teams) ? doc.teams : []
  const champion = format === 'single' ? buildSingleBracket(teams, nextResults, 'se').champion
    : format === 'double' ? buildDoubleBracket(teams, nextResults).champion : ''
  const justFinished = Boolean(champion) && !doc.champion

  const set = { [`bracketDoc.results.${matchId}`]: entry, 'bracketDoc.updatedAt': new Date() }
  if (justFinished) Object.assign(set, { 'bracketDoc.champion': champion, 'bracketDoc.status': 'finished', winner: champion, status: 'finished' })
  const written = await Tournament.updateOne({ _id: tournamentId, [`bracketDoc.results.${matchId}.confirmed`]: { $ne: true } }, { $set: set })
  if (!written.modifiedCount) return { status: 'already_confirmed' }

  const fresh = await Tournament.findById(tournamentId)
  await onResultsConfirmed(fresh, results, { source: 'discord-report' }).catch((error) => {
    console.error('[bracket-sync] onResultsConfirmed fallo:', error.message)
  })
  return { status: 'synced', matchId, winner, scoreA, scoreB, justFinished, podium: justFinished ? { champion } : null }
}

/**
 * Corrige una serie ya escrita (decisión tras una apelación). `winner` ''
 * deja la serie sin decidir. Se niega (status 'blocked') si con el cambio
 * alguna otra partida ya confirmada dejaría de tener los mismos dos equipos
 * (el ganador viejo ya avanzó y jugó): eso se corrige a mano en el bracket.
 */
export async function rewriteSeriesResult(tournamentId, matchId, { winner, scoreA = null, scoreB = null, source }, { dryRun = false } = {}) {
  const tournament = await Tournament.findById(tournamentId).lean()
  if (!tournament) return { status: 'no_tournament' }
  const doc = tournament.bracketDoc || {}
  const results = doc.results || {}
  const old = results[matchId]
  if (!old?.confirmed) return winner && !dryRun ? writeSeriesResult(tournamentId, matchId, { winner, scoreA, scoreB, source }) : { status: winner ? 'ok' : 'series_in_progress' }
  if (old.winner === winner && old.scoreA === scoreA && old.scoreB === scoreB) return { status: 'unchanged' }

  const entry = winner
    ? { ...old, winner, scoreA, scoreB, confirmed: true, source, confirmedAt: new Date() }
    : { ...old, winner: '', scoreA, scoreB, confirmed: false, source }
  const nextResults = { ...results, [matchId]: entry }
  const recomputed = statsMatches({ ...tournament, bracketDoc: { ...doc, results: nextResults } })
  const conflicts = recomputed.filter(m => m.id !== matchId && nextResults[m.id]?.confirmed && (nextResults[m.id].a !== m.a || nextResults[m.id].b !== m.b)).map(m => m.id)
  if (conflicts.length) return { status: 'blocked', conflicts }
  if (dryRun) return { status: 'ok' }

  const format = doc.format || normalizeFormat(tournament.format)
  const teams = Array.isArray(doc.teams) ? doc.teams : []
  const champion = format === 'single' ? buildSingleBracket(teams, nextResults, 'se').champion
    : format === 'double' ? buildDoubleBracket(teams, nextResults).champion : (doc.champion || '')
  const set = { [`bracketDoc.results.${matchId}`]: entry, 'bracketDoc.updatedAt': new Date() }
  if ((champion || '') !== (doc.champion || '')) {
    Object.assign(set, champion
      ? { 'bracketDoc.champion': champion, 'bracketDoc.status': 'finished', winner: champion, status: 'finished' }
      : { 'bracketDoc.champion': '', 'bracketDoc.status': 'running', winner: '', status: 'ongoing' })
  }
  const written = await Tournament.updateOne({ _id: tournamentId, [`bracketDoc.results.${matchId}.winner`]: old.winner }, { $set: set })
  if (!written.modifiedCount) return { status: 'conflict' }
  const fresh = await Tournament.findById(tournamentId)
  await onResultsConfirmed(fresh, results, { source: 'discord-report' }).catch((error) => {
    console.error('[bracket-sync] onResultsConfirmed fallo:', error.message)
  })
  return { status: 'rewritten', matchId, winner, scoreA, scoreB, previousWinner: old.winner, championChanged: (champion || '') !== (doc.champion || '') }
}

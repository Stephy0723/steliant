import mongoose from 'mongoose'
import { PlayerMatch } from '../models/PlayerMatch.js'
import { PlayerTournamentResult } from '../models/PlayerTournamentResult.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { Tournament } from '../models/Tournament.js'
import { canViewByVisibility } from './profile.controller.js'

const hasCompleteKda = { $and: ['kills', 'deaths', 'assists'].map(key => ({ $isNumber: `$${key}` })) }
const knownKdaTotals = {
  kdaMatches: { $sum: { $cond: [hasCompleteKda, 1, 0] } },
  ...Object.fromEntries(['kills', 'deaths', 'assists'].map(key => [key, { $sum: { $cond: [hasCompleteKda, `$${key}`, 0] } }])),
}

function objectId(value) {
  const id = String(value || '')
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null
}

function resolvePlayerId(req) {
  const raw = req.params.playerId === 'me' ? req.user?._id : req.params.playerId
  const id = objectId(raw)
  if (!id) throw Object.assign(new Error('Invalid player id'), { status: 400 })
  return id
}

// Las estadisticas de otro jugador respetan su privacidad (perfil privado,
// showStats/statsVisibility y tournamentsVisibility), igual que su perfil.
async function assertCanViewPlayer(req, playerId, visibilityKey = 'statsVisibility') {
  const viewer = req.user
  if (String(viewer?._id) === String(playerId) || viewer?.role === 'admin' || viewer?.isAdmin) return
  const target = await User.findById(playerId).select('privacy friends followers').lean()
  if (!target) throw Object.assign(new Error('Player not found'), { status: 404 })
  const privacy = target.privacy || {}
  const hidden = privacy.publicProfile === false
    || (visibilityKey === 'statsVisibility' && privacy.showStats === false)
    || !canViewByVisibility(target, viewer, privacy[visibilityKey])
  if (hidden) throw Object.assign(new Error('Estas estadisticas son privadas.'), { status: 403 })
}

function finiteCount(value, max = 1000) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.floor(n) : null
}

function pageMeta(req) {
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1)
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit)) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

function parseKda(value = '') {
  const parts = String(value).split('/').map(n => Number(n))
  if (parts.length < 3 || parts.some(Number.isNaN)) return null
  return { kills: parts[0], deaths: parts[1], assists: parts[2] }
}

function formatMatch(match) {
  return {
    id: match._id,
    result: match.result,
    vs: match.opponentName || '-',
    game: match.game,
    mode: match.mode || '-',
    map: match.map || '-',
    kda: match.kda || `${match.kills ?? '—'}/${match.deaths ?? '—'}/${match.assists ?? '—'}`,
    stats: match.statsDraft ? {
      kills: match.kills, deaths: match.deaths, assists: match.assists,
      damageDealt: match.damageDealt, damageTaken: match.damageTaken, towerDamage: match.towerDamage,
      teamfightParticipation: match.teamfightParticipation, gold: match.gold, mvp: match.mvp,
    } : null,
    gameNumber: match.gameNumber,
    team: match.team?.tag || match.team?.name || '-',
    rating: match.rating == null ? null : Number(match.rating),
    rp: Number(match.ratingChange || 0),
    date: match.playedAt,
    character: match.character,
    characterRole: match.characterRole,
    tournament: match.tournament,
  }
}

function dateRange(days) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

export async function listPlayerMatches(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId)
    const { page, limit, skip } = pageMeta(req)
    const filter = { player: playerId }
    if (req.query.game) filter.game = String(req.query.game)
    if (req.query.result) filter.result = String(req.query.result)

    const [matches, total] = await Promise.all([
      PlayerMatch.find(filter)
        .sort({ playedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('team', 'name tag color')
        .populate('tournament', 'title publicId game')
        .lean(),
      PlayerMatch.countDocuments(filter),
    ])

    res.json({
      matches: matches.map(formatMatch),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err) { next(err) }
}

export async function createMyMatch(req, res, next) {
  try {
    const parsed = parseKda(req.body.kda)
    const teamId = objectId(req.body.teamId || req.body.team)
    const tournamentId = objectId(req.body.tournamentId || req.body.tournament)
    const payload = {
      player: req.user._id,
      team: teamId,
      tournament: tournamentId,
      game: String(req.body.game || req.user.games?.[0] || '').trim(),
      mode: String(req.body.mode || 'Ranked').trim(),
      map: String(req.body.map || '').trim(),
      opponentName: String(req.body.opponentName || req.body.vs || '').trim(),
      result: req.body.result,
      character: String(req.body.character || '').trim(),
      characterRole: String(req.body.characterRole || '').trim(),
      kills: finiteCount(req.body.kills ?? parsed?.kills),
      deaths: finiteCount(req.body.deaths ?? parsed?.deaths),
      assists: finiteCount(req.body.assists ?? parsed?.assists),
      kda: String(req.body.kda || '').trim(),
      rating: Math.min(10, Math.max(0, Number(req.body.rating ?? 1) || 0)),
      // Es autoreportado: acotado, para que nadie se infle rankPts/gp a mano.
      ratingChange: Math.min(50, Math.max(-50, Number(req.body.ratingChange ?? req.body.rp ?? 0) || 0)),
      durationMinutes: Math.min(1440, Math.max(0, Number(req.body.durationMinutes ?? 0) || 0)),
      playedAt: req.body.playedAt ? new Date(req.body.playedAt) : new Date(),
      notes: String(req.body.notes || '').trim(),
      createdBy: req.user._id,
    }

    if (!payload.game) return res.status(400).json({ message: 'game is required' })
    if ([payload.kills, payload.deaths, payload.assists].some(v => v === null)) {
      return res.status(400).json({ message: 'kills, deaths y assists deben ser numeros entre 0 y 1000' })
    }
    if (Number.isNaN(payload.playedAt.getTime()) || payload.playedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return res.status(400).json({ message: 'playedAt debe ser una fecha valida que no este en el futuro' })
    }
    if (req.body.teamId || req.body.team) {
      if (!teamId || !await Team.exists({ _id: teamId, members: req.user._id })) {
        return res.status(403).json({ message: 'Solo puedes asociar partidos a un equipo del que eres miembro.' })
      }
    }
    if (req.body.tournamentId || req.body.tournament) {
      if (!tournamentId || !await Tournament.exists({ _id: tournamentId })) {
        return res.status(400).json({ message: 'Torneo no encontrado.' })
      }
    }
    if (!['win', 'loss', 'draw'].includes(payload.result)) {
      return res.status(400).json({ message: 'result must be win, loss, or draw' })
    }
    if (!payload.kda) payload.kda = `${payload.kills}/${payload.deaths}/${payload.assists}`

    const match = await PlayerMatch.create(payload)

    if (teamId) {
      const inc = payload.result === 'win'
        ? { wins: 1, rankPts: Math.max(0, payload.ratingChange || 10) }
        : payload.result === 'loss'
          ? { losses: 1, rankPts: Math.min(0, payload.ratingChange || -5) }
          : { rankPts: payload.ratingChange || 0 }
      await Team.updateOne(
        { _id: teamId, members: req.user._id },
        { $inc: inc }
      )
    }

    if (payload.ratingChange > 0) {
      await User.updateOne({ _id: req.user._id }, { $inc: { gp: payload.ratingChange } })
    }

    const saved = await PlayerMatch.findById(match._id)
      .populate('team', 'name tag color')
      .populate('tournament', 'title publicId game')
      .lean()
    res.status(201).json({ match: formatMatch(saved) })
  } catch (err) { next(err) }
}

export async function getGameStats(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId)
    const player = await User.findById(playerId).select('gamerProfile games').lean()
    const rows = await PlayerMatch.aggregate([
      { $match: { player: playerId } },
      {
        $group: {
          _id: '$game',
          matches: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] } },
          ...knownKdaTotals,
          hours: { $sum: '$durationMinutes' },
          durationMatches: { $sum: { $cond: [{ $isNumber: '$durationMinutes' }, 1, 0] } },
          avgRating: { $avg: '$rating' },
          lastPlayedAt: { $max: '$playedAt' },
          mainPick: { $first: '$character' },
        },
      },
      { $sort: { matches: -1, lastPlayedAt: -1 } },
    ])

    const stats = rows.map(row => {
      const deaths = Math.max(1, Number(row.deaths || 0))
      return {
        game: row._id,
        winrate: row.matches ? Math.round((row.wins / row.matches) * 100) : 0,
        matches: row.matches,
        wins: row.wins,
        losses: row.losses,
        kda: row.kdaMatches ? Number(((Number(row.kills || 0) + Number(row.assists || 0)) / deaths).toFixed(2)) : null,
        hours: row.durationMatches ? Math.round((Number(row.hours || 0) / 60) * 10) / 10 : null,
        peak: player?.gamerProfile?.rank || '',
        mainPick: row.mainPick || player?.gamerProfile?.mainCharacters?.[0] || '',
        rank: player?.gamerProfile?.rank || '',
        rating: row.avgRating == null ? null : Number(row.avgRating.toFixed(2)),
      }
    })

    res.json({ stats })
  } catch (err) { next(err) }
}

// Rendimiento por mapa (PlayerMatch.map), opcionalmente de un juego.
export async function getMapStats(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId)
    const match = { player: playerId, map: { $nin: ['', null] } }
    const game = String(req.query.game || '').trim()
    if (game) match.game = game
    const rows = await PlayerMatch.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$map',
          matches: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } },
          lastPlayedAt: { $max: '$playedAt' },
        },
      },
      { $sort: { matches: -1, lastPlayedAt: -1 } },
      { $limit: 12 },
    ])
    res.json({
      maps: rows.map(row => ({
        map: row._id,
        matches: row.matches,
        wins: row.wins,
        winrate: row.matches ? Math.round((row.wins / row.matches) * 100) : 0,
      })),
    })
  } catch (err) { next(err) }
}

export async function getWeeklyActivity(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId)
    const days = Math.min(31, Math.max(1, Number(req.query.days || 7)))
    const { start, end } = dateRange(days)
    const rows = await PlayerMatch.aggregate([
      { $match: { player: playerId, playedAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$playedAt' } }, matches: { $sum: 1 } } },
    ])
    const byDate = new Map(rows.map(row => [row._id, row.matches]))
    const activity = Array.from({ length: days }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const key = isoDate(date)
      return { date: key, matches: byDate.get(key) || 0 }
    })
    res.json({ activity })
  } catch (err) { next(err) }
}

export async function getDailyStats(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId)
    const days = Math.min(31, Math.max(1, Number(req.query.days || 7)))
    const { start, end } = dateRange(days)
    const rows = await PlayerMatch.aggregate([
      { $match: { player: playerId, playedAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$playedAt' } },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] } },
          matches: { $sum: 1 },
        },
      },
    ])
    const byDate = new Map(rows.map(row => [row._id, row]))
    const stats = Array.from({ length: days }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const key = isoDate(date)
      const row = byDate.get(key)
      return { date: key, wins: row?.wins || 0, losses: row?.losses || 0, matches: row?.matches || 0 }
    })
    res.json({ stats })
  } catch (err) { next(err) }
}

// GET /players/:playerId/rating/timeline?days=90 -- evolucion de rating dia
// por dia, con datos reales. El dato (ratingChange por partida) ya se
// guardaba desde createMyMatch; solo faltaba el endpoint que lo agregara.
// Ver BACKEND-PENDIENTE.md #jugador-rating-timeline.
export async function getRatingTimeline(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId)
    const days = Math.min(365, Math.max(1, Number(req.query.days || 90)))
    const { start, end } = dateRange(days)

    const rows = await PlayerMatch.aggregate([
      { $match: { player: playerId, playedAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$playedAt' } }, ratingChange: { $sum: '$ratingChange' } } },
    ])
    const byDate = new Map(rows.map(row => [row._id, row.ratingChange]))

    // El punto final de la serie tiene que coincidir con el rating actual
    // real del jugador (user.gp) -- se reconstruye hacia atras restando los
    // cambios del rango pedido, no se inventa un punto de partida.
    const user = await User.findById(playerId).select('gp').lean()
    const currentRating = Number(user?.gp || 0)
    const totalChangeInRange = rows.reduce((sum, row) => sum + Number(row.ratingChange || 0), 0)
    let running = currentRating - totalChangeInRange

    const timeline = Array.from({ length: days }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const key = isoDate(date)
      const change = byDate.get(key) || 0
      running += change
      return { date: key, ratingChange: change, rating: running }
    })
    res.json({ timeline, currentRating })
  } catch (err) { next(err) }
}

export async function getTopCharacters(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId)
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 8)))
    const rows = await PlayerMatch.aggregate([
      { $match: { player: playerId, character: { $nin: ['', null] } } },
      {
        $group: {
          _id: '$character',
          role: { $first: '$characterRole' },
          matches: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } },
          ...knownKdaTotals,
        },
      },
      { $sort: { matches: -1, wins: -1 } },
      { $limit: limit },
    ])
    const characters = rows.map(row => ({
      name: row._id,
      role: row.role || '',
      winrate: row.matches ? Math.round((row.wins / row.matches) * 100) : 0,
      matches: row.matches,
      kda: row.kdaMatches ? Number(((Number(row.kills || 0) + Number(row.assists || 0)) / Math.max(1, Number(row.deaths || 0))).toFixed(2)) : null,
    }))
    res.json({ characters })
  } catch (err) { next(err) }
}

export async function listTournamentResults(req, res, next) {
  try {
    const playerId = resolvePlayerId(req)
    await assertCanViewPlayer(req, playerId, 'tournamentsVisibility')
    const { page, limit, skip } = pageMeta(req)
    const filter = { player: playerId }
    if (req.query.game) filter.game = String(req.query.game)
    const [items, total] = await Promise.all([
      PlayerTournamentResult.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('team', 'name tag color')
        .populate('tournament', 'title publicId game prizePool')
        .lean(),
      PlayerTournamentResult.countDocuments(filter),
    ])

    res.json({
      results: items.map(item => ({
        id: item._id,
        placement: item.placement,
        name: item.tournament?.title || item.name,
        game: item.game || item.tournament?.game,
        team: item.team?.tag || item.teamName || '-',
        date: item.date,
        of: item.totalTeams,
        prize: item.prize,
        currency: item.currency,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err) { next(err) }
}

export async function createMyTournamentResult(req, res, next) {
  try {
    const teamId = objectId(req.body.teamId || req.body.team)
    const tournamentId = objectId(req.body.tournamentId || req.body.tournament)
    const payload = {
      player: req.user._id,
      team: teamId,
      tournament: tournamentId,
      name: String(req.body.name || '').trim(),
      game: String(req.body.game || req.user.games?.[0] || '').trim(),
      teamName: String(req.body.teamName || '').trim(),
      placement: Number(req.body.placement),
      totalTeams: Number(req.body.totalTeams || req.body.of || 0),
      prize: Number(req.body.prize || 0),
      currency: String(req.body.currency || 'USD').trim().toUpperCase(),
      date: req.body.date ? new Date(req.body.date) : new Date(),
      createdBy: req.user._id,
    }
    if (!payload.name) return res.status(400).json({ message: 'name is required' })
    if (!payload.game) return res.status(400).json({ message: 'game is required' })
    if (!Number.isInteger(payload.placement) || payload.placement < 1) return res.status(400).json({ message: 'placement is required' })
    if (payload.totalTeams > 0 && payload.placement > payload.totalTeams) {
      return res.status(400).json({ message: 'placement no puede ser mayor que el total de equipos' })
    }
    if (!Number.isFinite(payload.prize) || payload.prize < 0) return res.status(400).json({ message: 'prize invalido' })

    // Autoreportado: solo cuenta un premio si ese torneo existe y el jugador
    // estuvo inscrito con un equipo suyo, y nunca mayor al prizePool.
    if (teamId && !await Team.exists({ _id: teamId, members: req.user._id })) {
      return res.status(403).json({ message: 'Solo puedes asociar resultados a un equipo del que eres miembro.' })
    }
    let verified = false
    if (tournamentId) {
      const tournament = await Tournament.findById(tournamentId).select('prizePool registrations.team').lean()
      if (!tournament) return res.status(400).json({ message: 'Torneo no encontrado.' })
      const myTeams = await Team.find({ members: req.user._id }).select('_id').lean()
      const mine = new Set(myTeams.map(t => String(t._id)))
      verified = (tournament.registrations || []).some(reg => reg.team && mine.has(String(reg.team)))
      if (verified) payload.prize = Math.min(payload.prize, Number(tournament.prizePool) || 0)
    }
    if (!verified) payload.prize = 0

    const result = await PlayerTournamentResult.create(payload)
    res.status(201).json({ result })
  } catch (err) { next(err) }
}

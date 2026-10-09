import { User } from '../models/User.js'
import { Team } from '../models/Team.js'

export async function getGlobalRanking(req, res, next) {
  try {
    const { game, page = 1, limit = 50, region } = req.query
    const filter = {}
    if (game) filter.games = game
    if (region) {
      const value = String(region).trim().toUpperCase()
      filter.$or = [{ region: value }, { countryCode: value }]
    }

    const players = await User.find(filter)
      .sort({ gp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('nick avatar playerCode countryCode region gp plan games team')
      .populate('team', 'name tag color')
      .lean()

    const total = await User.countDocuments(filter)
    const ranking = players.map((p, i) => ({
      rank: (page - 1) * limit + i + 1,
      playerCode: p.playerCode,
      nick: p.nick,
      avatar: p.avatar,
      countryCode: p.countryCode,
      region: p.region || p.countryCode,
      gp: p.gp,
      plan: p.plan,
      games: p.games,
      team: p.team,
      isMe: p._id.toString() === req.user._id.toString(),
    }))

    res.json({ ranking, total, page: Number(page), pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// Mi posición en el ranking global y regional -- no requiere paginar toda la
// tabla, cuenta cuántos jugadores tienen más gp que yo.
export async function getMyRanking(req, res, next) {
  try {
    const me = await User.findById(req.user._id)
      .select('nick avatar playerCode countryCode region gp plan games')
      .lean()
    if (!me) return res.status(404).json({ message: 'Player not found' })

    const gp = Number(me.gp || 0)
    const region = me.region || me.countryCode || ''
    const globalHigher = await User.countDocuments({ gp: { $gt: gp } })
    const regionalFilter = region
      ? { gp: { $gt: gp }, $or: [{ region }, { countryCode: region }] }
      : null
    const regionalHigher = regionalFilter ? await User.countDocuments(regionalFilter) : null
    const total = await User.countDocuments()
    const regionalTotal = region
      ? await User.countDocuments({ $or: [{ region }, { countryCode: region }] })
      : 0

    const myTeams = await Team.find({ members: req.user._id }).select('name tag color game').lean()

    res.json({
      player: {
        id: me._id, playerCode: me.playerCode, nick: me.nick, avatar: me.avatar,
        countryCode: me.countryCode, region, gp: me.gp, plan: me.plan, games: me.games,
        teams: myTeams.map(t => ({ name: t.name, tag: t.tag, color: t.color, game: t.game })),
      },
      globalRank: globalHigher + 1,
      regionalRank: regionalHigher == null ? null : regionalHigher + 1,
      total,
      regionalTotal,
    })
  } catch (err) { next(err) }
}

// Ranking filtrado a mi propia región/país -- prioriza `region` (con fallback
// a countryCode) y solo cae al agrupamiento LATAM si el usuario no tiene
// ninguno de los dos.
export async function getRegionalRanking(req, res, next) {
  const region = req.user?.region || req.user?.countryCode
  if (region) req.query.region = region
  else if (req.user?.countryCode) req.query.country = req.user.countryCode
  return getGlobalRanking(req, res, next)
}

export async function getTeamRanking(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query

    const teams = await Team.find()
      .sort({ rankPts: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('leader', 'nick avatar')
      .lean()

    const total = await Team.countDocuments()
    const ranking = teams.map((t, i) => ({
      rank: (page - 1) * limit + i + 1,
      name: t.name, tag: t.tag, color: t.color,
      pts: t.rankPts, wins: t.wins, losses: t.losses,
      game: t.game, logo: t.logo,
      leader: t.leader,
      memberCount: t.members?.length ?? 0,
      mine: t.members?.some(m => m.toString() === req.user._id.toString()) ?? false,
    }))

    res.json({ ranking, total, page: Number(page), pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

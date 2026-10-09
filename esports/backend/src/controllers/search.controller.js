import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { UniversityCatalog } from '../models/UniversityCatalog.js'
import { escapeRegex } from '../utils/regex.js'

const PER_TYPE = 5
// Se traen mas candidatos de los que se muestran para poder ordenar por
// relevancia: con limit(5) directo + orden de Mongo, "Kai" podia quedar
// fuera detras de 5 nicks que solo lo contenian ("Makaio", "Kaiser"...).
const CANDIDATES = 25

// 0 = exacto, 1 = empieza por, 2 = alguna palabra empieza por, 3 = contiene.
// (La usa tambien el autocompletado de invitar a un equipo.)
export function score(term, ...fields) {
  let best = 9
  for (const raw of fields) {
    const value = String(raw || '').toLowerCase()
    if (!value) continue
    if (value === term) return 0
    if (value.startsWith(term)) best = Math.min(best, 1)
    else if (value.split(/[\s\-_.]+/).some(word => word.startsWith(term))) best = Math.min(best, 2)
    else if (value.includes(term)) best = Math.min(best, 3)
  }
  return best
}

function rank(items, term, fieldsOf) {
  return items
    .map(item => ({ item, s: score(term, ...fieldsOf(item)) }))
    .sort((a, b) => a.s - b.s || String(fieldsOf(a.item)[0]).localeCompare(String(fieldsOf(b.item)[0])))
    .slice(0, PER_TYPE)
    .map(({ item }) => item)
}

// GET /search?q= — búsqueda global del topbar: jugadores, equipos, torneos y
// universidades reales. Mismas reglas que las búsquedas de cada modulo:
// jugadores sin baneados/borrados/bloqueados (en ambos sentidos), equipos
// sin eliminados, torneos solo publicos y publicados (nunca borradores) y
// universidades activas del catalogo.
export async function globalSearch(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().replace(/^#/, '').slice(0, 60)
    const empty = { users: [], teams: [], tournaments: [], universities: [] }
    if (q.length < 2) return res.json(empty)

    const term = q.toLowerCase()
    const rx = new RegExp(escapeRegex(q), 'i')
    const myId = String(req.user._id)
    const blockedByMe = (req.user.blockedUsers || []).map(String)

    const [users, teams, tournaments, universities] = await Promise.all([
      User.find({
        _id: { $nin: [myId, ...blockedByMe] },
        blockedUsers: { $ne: req.user._id },
        deleted: { $ne: true },
        isBanned: { $ne: true },
        $or: [{ nick: rx }, { playerCode: rx }],
      }).select('nick avatar playerCode countryCode gamerProfile.mainGame').limit(CANDIDATES).lean(),
      Team.find({
        status: { $ne: 'Eliminado' },
        $or: [{ name: rx }, { tag: rx }, { publicCode: rx }],
      }).select('name tag logo game publicCode members').limit(CANDIDATES).lean(),
      Tournament.find({
        visibility: 'public',
        status: { $ne: 'draft' },
        $or: [{ title: rx }, { publicId: rx }],
      }).select('title game status date logo banner publicId').limit(CANDIDATES).lean(),
      UniversityCatalog.find({
        id: { $exists: true },
        active: { $ne: false },
        $or: [{ name: rx }, { tag: rx }],
      }).select('id tag name logo city verified').limit(CANDIDATES).lean(),
    ])

    res.json({
      users: rank(users, term, u => [u.nick, u.playerCode]).map(u => ({
        id: String(u._id),
        nick: u.nick,
        avatar: u.avatar || '',
        playerCode: u.playerCode || '',
        countryCode: u.countryCode || '',
        game: u.gamerProfile?.mainGame || '',
      })),
      teams: rank(teams, term, t => [t.name, t.tag, t.publicCode]).map(t => ({
        id: String(t._id),
        name: t.name,
        tag: t.tag,
        logo: t.logo || '',
        game: t.game || '',
        members: (t.members || []).length,
      })),
      // Torneos: a igual relevancia, primero los vigentes (no terminados).
      tournaments: rank(tournaments, term, t => [t.title, t.publicId])
        .sort((a, b) => score(term, a.title, a.publicId) - score(term, b.title, b.publicId)
          || Number(['finished', 'cancelled'].includes(a.status)) - Number(['finished', 'cancelled'].includes(b.status)))
        .map(t => ({
          id: t.publicId || String(t._id),
          title: t.title,
          game: t.game || '',
          status: t.status,
          date: t.date || null,
          logo: t.logo || t.banner || '',
        })),
      universities: rank(universities, term, u => [u.name, u.tag]).map(u => ({
        id: u.id,
        name: u.name,
        tag: u.tag,
        logo: u.logo || '',
        city: u.city || '',
        verified: Boolean(u.verified),
      })),
    })
  } catch (err) { next(err) }
}

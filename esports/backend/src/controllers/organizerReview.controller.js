import mongoose from 'mongoose'
import { OrganizerReview } from '../models/OrganizerReview.js'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'

// POST /api/organizers/:organizerId/reviews -- crea o edita (upsert) la
// resena del EQUIPO del usuario para un torneo puntual de ese organizador.
// Solo se puede calificar un torneo que de verdad se jugo (finished) y en el
// que el equipo estuvo inscrito -- no cualquiera puede calificar a cualquiera.
export async function upsertOrganizerReview(req, res, next) {
  try {
    const { organizerId } = req.params
    const { tournamentId, teamId, rating, comment } = req.body || {}

    const ratingNum = Math.round(Number(rating))
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'rating debe ser un numero entero entre 1 y 5' })
    }
    if (!mongoose.Types.ObjectId.isValid(String(teamId || ''))) {
      return res.status(400).json({ message: 'teamId invalido' })
    }

    const team = await Team.findById(teamId).select('leader members name tag')
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado' })
    const userId = String(req.user._id)
    const isTeamMember = String(team.leader) === userId || (team.members || []).some(m => String(m) === userId)
    if (!isTeamMember) return res.status(403).json({ message: 'Solo un integrante del equipo puede calificar en su nombre' })

    const tournament = await Tournament.findOne({
      _id: tournamentId,
      organizer: organizerId,
      status: 'finished',
      'registrations.team': teamId,
    }).select('_id')
    if (!tournament) {
      return res.status(403).json({ message: 'Solo se puede calificar un torneo finalizado en el que tu equipo estuvo inscrito' })
    }

    const review = await OrganizerReview.findOneAndUpdate(
      { team: teamId, tournament: tournamentId },
      { $set: { organizer: organizerId, reviewer: req.user._id, rating: ratingNum, comment: String(comment || '').trim().slice(0, 800) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )

    res.status(201).json({ review })
  } catch (err) { next(err) }
}

// GET /api/organizers/:organizerId/reviews -- lista publica + promedio.
export async function listOrganizerReviews(req, res, next) {
  try {
    const { organizerId } = req.params
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1)
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit)) || 20))

    const [reviews, total, agg] = await Promise.all([
      OrganizerReview.find({ organizer: organizerId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('reviewer', 'nick avatar')
        .populate('team', 'name tag logo color')
        .populate('tournament', 'title publicId')
        .lean(),
      OrganizerReview.countDocuments({ organizer: organizerId }),
      OrganizerReview.aggregate([
        { $match: { organizer: new mongoose.Types.ObjectId(organizerId) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ])

    res.json({
      reviews,
      total,
      page,
      pages: Math.ceil(total / limit),
      average: agg[0]?.avg || 0,
      count: agg[0]?.count || 0,
    })
  } catch (err) { next(err) }
}

// GET /api/organizers/reviews/summary?ids=a,b,c -- promedio+cantidad para
// varios organizadores de una sola vez (el directorio de BrandOrganizers.jsx
// pinta N tarjetas y no queremos N requests).
export async function organizerReviewsSummary(req, res, next) {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => mongoose.Types.ObjectId.isValid(id))
    if (!ids.length) return res.json({ summaries: {} })

    const agg = await OrganizerReview.aggregate([
      { $match: { organizer: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: '$organizer', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ])
    const summaries = Object.fromEntries(agg.map(a => [String(a._id), { average: a.avg, count: a.count }]))
    res.json({ summaries })
  } catch (err) { next(err) }
}

// GET /api/organizers/:organizerId/reviews/mine?tournamentId=&teamId= -- la
// propia resena (si existe) para que el frontend sepa si mostrar "calificar"
// o "editar tu calificacion".
export async function getMyOrganizerReview(req, res, next) {
  try {
    const { organizerId } = req.params
    const { tournamentId, teamId } = req.query
    if (!mongoose.Types.ObjectId.isValid(String(tournamentId || '')) || !mongoose.Types.ObjectId.isValid(String(teamId || ''))) {
      return res.status(400).json({ message: 'tournamentId y teamId son requeridos' })
    }
    const review = await OrganizerReview.findOne({ organizer: organizerId, tournament: tournamentId, team: teamId }).lean()
    res.json({ review: review || null })
  } catch (err) { next(err) }
}

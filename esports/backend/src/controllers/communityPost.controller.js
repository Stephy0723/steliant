import mongoose from 'mongoose'
import { CommunityPost, REPORT_REASONS } from '../models/CommunityPost.js'
import { Community } from '../models/Community.js'
import { Tournament } from '../models/Tournament.js'
import { sendNotif } from '../services/notifications.service.js'

const MAX_TEXT = 2000
const MAX_COMMENT = 500
const MAX_POLL_OPTIONS = 6
const MIN_POLL_OPTIONS = 2

const TOURNAMENT_FIELDS = 'title game modality prizePool currency date maxSlots currentSlots status entryFee'

// ── Scope resolvers ──────────────────────────────────────────────
// A "scope" identifies which feed a post belongs to — either a verified
// university (string universityId) or a hub Community (ObjectId). Every
// core function below is scope-agnostic: it just merges `scope` into its
// Mongo filter, so the same logic serves both feeds without duplication.

function resolveUniversityScope(req, res) {
  const uni = req.user?.university
  if (!uni?.universityId || uni.verificationStatus !== 'verified') {
    res.status(403).json({ message: 'Tu universidad debe estar verificada para usar la comunidad.' })
    return null
  }
  return { filter: { universityId: uni.universityId }, notifyLink: '/universidad', notifyType: 'university' }
}

async function resolveCommunityScope(req, res, { requireMembership = true } = {}) {
  const community = await Community.findById(req.params.id).select('members privacy creator')
  if (!community) {
    res.status(404).json({ message: 'Comunidad no encontrada.' })
    return null
  }
  const isMember = !!req.user && community.members.some(id => String(id) === String(req.user._id))
  if (community.privacy === 'private' && !isMember) {
    res.status(403).json({ message: 'Esta comunidad es privada.' })
    return null
  }
  if (requireMembership && !isMember) {
    res.status(403).json({ message: 'Debes unirte a esta comunidad para participar.' })
    return null
  }
  return {
    filter: { communityId: community._id },
    notifyLink: `/comunidad/c/${community._id}`,
    notifyType: 'community',
    creatorId: community.creator,
  }
}

function decoratePost(p, userId) {
  const { reports, ...rest } = p
  return {
    ...rest,
    likesCount: (p.likes || []).length,
    likedByMe: (p.likes || []).some(id => String(id) === String(userId)),
    interestedCount: (p.interested || []).length,
    iAmInterested: (p.interested || []).some(id => String(id) === String(userId)),
    reportsCount: (reports || []).length,
    reportedByMe: (reports || []).some(r => String(r.user) === String(userId)),
  }
}

// ── Core logic (scope-agnostic) ──────────────────────────────────

async function getFeedCore(scope, req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
  const filter = { ...scope.filter }
  if (req.query.before) {
    const before = new Date(req.query.before)
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before }
  }

  const posts = await CommunityPost.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('tournamentId', TOURNAMENT_FIELDS)
    .lean()

  res.json({
    ...scope.filter,
    posts: posts.map(p => decoratePost(p, req.user?._id)),
    nextCursor: posts.length === limit ? posts[posts.length - 1].createdAt : null,
  })
}

async function createPostCore(scope, req, res) {
  const kind = ['text', 'poll', 'event', 'tournament'].includes(req.body?.kind) ? req.body.kind : 'text'
  const text = String(req.body?.text || '').trim()
  if (text.length > MAX_TEXT) return res.status(400).json({ message: `Máximo ${MAX_TEXT} caracteres.` })

  const doc = {
    ...scope.filter,
    author: req.user._id,
    authorNick: req.user.nick || '',
    authorAvatar: req.user.avatar || '',
    kind,
    text,
  }

  if (kind === 'text') {
    if (!text) return res.status(400).json({ message: 'El texto no puede estar vacío.' })
  }

  if (kind === 'poll') {
    if (!text) return res.status(400).json({ message: 'La pregunta de la encuesta no puede estar vacía.' })
    const options = Array.isArray(req.body?.pollOptions)
      ? req.body.pollOptions.map(o => String(o || '').trim()).filter(Boolean).slice(0, MAX_POLL_OPTIONS)
      : []
    if (options.length < MIN_POLL_OPTIONS) {
      return res.status(400).json({ message: `Agrega al menos ${MIN_POLL_OPTIONS} opciones.` })
    }
    doc.pollOptions = options.map(t => ({ text: t, votes: [] }))
  }

  if (kind === 'event') {
    const eventTitle = String(req.body?.eventTitle || '').trim()
    if (!eventTitle) return res.status(400).json({ message: 'El evento necesita un título.' })
    const eventDate = new Date(req.body?.eventDate)
    if (Number.isNaN(eventDate.getTime())) return res.status(400).json({ message: 'La fecha del evento no es válida.' })
    doc.eventTitle = eventTitle
    doc.eventDate = eventDate
    doc.eventLocation = String(req.body?.eventLocation || '').trim().slice(0, 160)
  }

  if (kind === 'tournament') {
    const tournamentId = String(req.body?.tournamentId || '')
    const tournament = await Tournament.findById(tournamentId).select('_id').lean().catch(() => null)
    if (!tournament) return res.status(400).json({ message: 'Selecciona un torneo válido.' })
    doc.tournamentId = tournamentId
  }

  let post = await CommunityPost.create(doc)
  if (kind === 'tournament') post = await post.populate('tournamentId', TOURNAMENT_FIELDS)

  res.status(201).json({ post: decoratePost(post.toObject(), req.user._id) })
}

async function updatePostCore(scope, postId, req, res) {
  const post = await CommunityPost.findOne({ _id: postId, ...scope.filter })
  if (!post) return res.status(404).json({ message: 'Publicación no encontrada.' })
  if (String(post.author) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Solo puedes editar tus propias publicaciones.' })
  }

  const text = String(req.body?.text || '').trim()
  if (text.length > MAX_TEXT) return res.status(400).json({ message: `Máximo ${MAX_TEXT} caracteres.` })

  if (post.kind === 'text' || post.kind === 'poll') {
    if (!text) return res.status(400).json({ message: 'El texto no puede estar vacío.' })
  }

  if (post.kind === 'event') {
    const eventTitle = String(req.body?.eventTitle || '').trim()
    if (!eventTitle) return res.status(400).json({ message: 'El evento necesita un título.' })
    const eventDate = new Date(req.body?.eventDate)
    if (Number.isNaN(eventDate.getTime())) return res.status(400).json({ message: 'La fecha del evento no es válida.' })
    post.eventTitle = eventTitle
    post.eventDate = eventDate
    post.eventLocation = String(req.body?.eventLocation || '').trim().slice(0, 160)
  }

  post.text = text
  post.editedAt = new Date()
  await post.save()

  if (post.kind === 'tournament') await post.populate('tournamentId', TOURNAMENT_FIELDS)
  res.json({ post: decoratePost(post.toObject(), req.user._id) })
}

/**
 * Votar (o cambiar voto) en una encuesta. Se hace con UNA sola operación de
 * pipeline (agregación) en vez de "quitar de todas + agregar a la elegida"
 * en dos updates separados: dos updates separados NO son atómicos como
 * conjunto -- dos votos concurrentes del mismo usuario en opciones
 * distintas podían intercalarse y dejar el voto duplicado en ambas
 * opciones (se detectó con un test de concurrencia real, no era hipotético).
 */
async function votePollCore(scope, postId, req, res) {
  const optionId = String(req.body?.optionId || '')
  if (!mongoose.Types.ObjectId.isValid(optionId)) {
    return res.status(400).json({ message: 'Opción no válida.' })
  }

  const uid = req.user._id
  const optObjId = new mongoose.Types.ObjectId(optionId)

  const updated = await CommunityPost.findOneAndUpdate(
    { _id: postId, ...scope.filter, kind: 'poll', 'pollOptions._id': optObjId },
    [{
      $set: {
        pollOptions: {
          $map: {
            input: '$pollOptions',
            as: 'opt',
            in: {
              $mergeObjects: ['$$opt', {
                votes: {
                  $cond: [
                    { $eq: ['$$opt._id', optObjId] },
                    { $setUnion: ['$$opt.votes', [uid]] },
                    { $setDifference: ['$$opt.votes', [uid]] },
                  ],
                },
              }],
            },
          },
        },
      },
    }],
    { new: true },
  ).select('pollOptions')

  if (!updated) return res.status(404).json({ message: 'Encuesta u opción no encontrada.' })
  res.json({ pollOptions: updated.pollOptions })
}

/** Toggle "me interesa" en un evento. Atómico ($addToSet/$pull). */
async function toggleInterestedCore(scope, postId, req, res) {
  const uid = req.user._id
  const post = await CommunityPost.findOne({ _id: postId, ...scope.filter, kind: 'event' }).select('interested')
  if (!post) return res.status(404).json({ message: 'Evento no encontrado.' })

  const already = post.interested.some(id => String(id) === String(uid))
  const updated = await CommunityPost.findOneAndUpdate(
    { _id: post._id },
    already ? { $pull: { interested: uid } } : { $addToSet: { interested: uid } },
    { new: true },
  ).select('interested')

  res.json({ interestedCount: updated.interested.length, iAmInterested: !already })
}

/** Reportar contenido abusivo. Un reporte por usuario (repetir reemplaza el motivo). */
async function reportPostCore(scope, postId, req, res) {
  const reason = REPORT_REASONS.includes(req.body?.reason) ? req.body.reason : 'otro'
  const post = await CommunityPost.findOne({ _id: postId, ...scope.filter })
  if (!post) return res.status(404).json({ message: 'Publicación no encontrada.' })

  if (String(post.author) === String(req.user._id)) {
    return res.status(400).json({ message: 'No puedes reportar tu propia publicación.' })
  }

  post.reports = post.reports.filter(r => String(r.user) !== String(req.user._id))
  post.reports.push({ user: req.user._id, reason })
  await post.save()

  res.status(201).json({ reportsCount: post.reports.length, reportedByMe: true })
}

/** Toggle like en un post. Atómico ($addToSet/$pull). */
async function toggleLikeCore(scope, postId, req, res) {
  const uid = req.user._id
  const post = await CommunityPost.findOne({ _id: postId, ...scope.filter }).select('likes author')
  if (!post) return res.status(404).json({ message: 'Publicación no encontrada.' })

  const already = post.likes.some(id => String(id) === String(uid))
  const updated = await CommunityPost.findOneAndUpdate(
    { _id: post._id },
    already ? { $pull: { likes: uid } } : { $addToSet: { likes: uid } },
    { new: true },
  ).select('likes')

  if (!already && String(post.author) !== String(uid)) {
    sendNotif(post.author, {
      type: scope.notifyType,
      title: 'Nuevo like en tu publicación',
      message: `${req.user.nick || 'Alguien'} le dio like a tu publicación en la comunidad.`,
      link: scope.notifyLink,
      meta: { kind: 'like', postId: String(post._id), actorId: String(uid), actorNick: req.user.nick || '', actorAvatar: req.user.avatar || '' },
    })
  }

  res.json({ likesCount: updated.likes.length, likedByMe: !already })
}

/** Comentar un post. */
async function addCommentCore(scope, postId, req, res) {
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ message: 'El comentario no puede estar vacío.' })
  if (text.length > MAX_COMMENT) return res.status(400).json({ message: `Máximo ${MAX_COMMENT} caracteres.` })

  const post = await CommunityPost.findOne({ _id: postId, ...scope.filter })
  if (!post) return res.status(404).json({ message: 'Publicación no encontrada.' })

  post.comments.push({
    author: req.user._id,
    authorNick: req.user.nick || '',
    authorAvatar: req.user.avatar || '',
    text,
  })
  await post.save()

  if (String(post.author) !== String(req.user._id)) {
    sendNotif(post.author, {
      type: scope.notifyType,
      title: 'Nuevo comentario en tu publicación',
      message: `${req.user.nick || 'Alguien'} comentó tu publicación en la comunidad.`,
      link: scope.notifyLink,
      meta: { kind: 'comment', postId: String(post._id), actorId: String(req.user._id), actorNick: req.user.nick || '', actorAvatar: req.user.avatar || '' },
    })
  }

  res.status(201).json({ comments: post.comments })
}

/** Borrar un post: su autor, un admin del sitio, o el creador de la comunidad (si aplica). */
async function deletePostCore(scope, postId, req, res) {
  const post = await CommunityPost.findOne({ _id: postId, ...scope.filter })
  if (!post) return res.status(404).json({ message: 'Publicación no encontrada.' })

  const isAuthor = String(post.author) === String(req.user._id)
  const isCommunityCreator = scope.creatorId && String(scope.creatorId) === String(req.user._id)
  if (!isAuthor && !isCommunityCreator && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'No puedes borrar esta publicación.' })
  }

  await post.deleteOne()
  res.json({ ok: true })
}

// ── University-scoped routes (existing, behavior unchanged) ─────

export async function getMyUniversityFeed(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await getFeedCore(scope, req, res)
  } catch (err) { next(err) }
}

export async function createCommunityPost(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await createPostCore(scope, req, res)
  } catch (err) { next(err) }
}

export async function updateCommunityPost(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await updatePostCore(scope, req.params.id, req, res)
  } catch (err) { next(err) }
}

export async function votePoll(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await votePollCore(scope, req.params.id, req, res)
  } catch (err) { next(err) }
}

export async function toggleInterested(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await toggleInterestedCore(scope, req.params.id, req, res)
  } catch (err) { next(err) }
}

export async function reportCommunityPost(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await reportPostCore(scope, req.params.id, req, res)
  } catch (err) { next(err) }
}

export async function toggleCommunityPostLike(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await toggleLikeCore(scope, req.params.id, req, res)
  } catch (err) { next(err) }
}

export async function addCommunityPostComment(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await addCommentCore(scope, req.params.id, req, res)
  } catch (err) { next(err) }
}

export async function deleteCommunityPost(req, res, next) {
  try {
    const scope = resolveUniversityScope(req, res)
    if (!scope) return
    await deletePostCore(scope, req.params.id, req, res)
  } catch (err) { next(err) }
}

// ── Community-scoped routes (hub /comunidad communities) ─────────
// :id in these routes is the community id; the post id is :postId.

export async function getCommunityFeed(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res, { requireMembership: false })
    if (!scope) return
    await getFeedCore(scope, req, res)
  } catch (err) { next(err) }
}

export async function createCommunityFeedPost(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await createPostCore(scope, req, res)
  } catch (err) { next(err) }
}

export async function updateCommunityFeedPost(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await updatePostCore(scope, req.params.postId, req, res)
  } catch (err) { next(err) }
}

export async function voteCommunityFeedPoll(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await votePollCore(scope, req.params.postId, req, res)
  } catch (err) { next(err) }
}

export async function toggleCommunityFeedInterested(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await toggleInterestedCore(scope, req.params.postId, req, res)
  } catch (err) { next(err) }
}

export async function reportCommunityFeedPost(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await reportPostCore(scope, req.params.postId, req, res)
  } catch (err) { next(err) }
}

export async function toggleCommunityFeedPostLike(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await toggleLikeCore(scope, req.params.postId, req, res)
  } catch (err) { next(err) }
}

export async function addCommunityFeedPostComment(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await addCommentCore(scope, req.params.postId, req, res)
  } catch (err) { next(err) }
}

export async function deleteCommunityFeedPost(req, res, next) {
  try {
    const scope = await resolveCommunityScope(req, res)
    if (!scope) return
    await deletePostCore(scope, req.params.postId, req, res)
  } catch (err) { next(err) }
}

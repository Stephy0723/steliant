import mongoose from 'mongoose'
import { Post } from '../models/Post.js'
import { Community } from '../models/Community.js'
import { Comment } from '../models/Comment.js'
import { User } from '../models/User.js'

// Autores que el usuario no debe ver: los que bloqueo y los que lo bloquearon.
async function excludedAuthorIds(user) {
  const blockedByMe = (user.blockedUsers || []).map(String)
  const usersBlockingMe = await User.find({ blockedUsers: user._id }).select('_id').lean()
  return [...new Set([...blockedByMe, ...usersBlockingMe.map(u => String(u._id))])]
}

function mapPost(p, viewerId) {
  return {
    id: p._id,
    kind: p.kind,
    author: p.authorNick,
    authorId: p.author?._id || p.author,
    avatar: p.author?.avatar || p.authorAvatar || '',
    pinned: p.pinned,
    text: p.text,
    title: p.title,
    likes: p.likes || 0,
    likedBy: p.likedBy || [],
    savedBy: p.savedBy || [],
    comments: p.comments || 0,
    time: p.timeString || 'Ahora',
    createdAt: p.createdAt,
    photoUrl: p.photoUrl,
    fileUrl: p.fileUrl,
    fileName: p.fileName,
    pollOptions: p.pollOptions ? p.pollOptions.map(o => ({
      text: o.text,
      votes: o.votes || 0,
      voted: o.votedBy?.some(u => String(u) === String(viewerId))
    })) : [],
    communitySlug: p.communitySlug,
    eventData: p.eventData,
    tournamentData: p.tournamentData,
    challengeData: p.challengeData,
    recruitmentData: p.recruitmentData,
    teamData: p.teamData,
    teamId: p.teamId
  }
}

export async function listPosts(req, res, next) {
  try {
    const { author, authorId, community } = req.query
    const filter = {}
    
    if (authorId && mongoose.Types.ObjectId.isValid(String(authorId))) {
      filter.author = authorId
    }
    if (author) {
      filter.authorNick = author
    }
    if (community) {
      filter.communitySlug = community
    }
    
    // Hide posts blocked by the authenticated user
    if (req.user) {
      filter.blockedBy = { $ne: req.user._id }
      const excludedAuthors = await excludedAuthorIds(req.user)
      if (excludedAuthors.length) {
        if (filter.author) filter.author = { $eq: filter.author, $nin: excludedAuthors }
        else filter.author = { $nin: excludedAuthors }
      }
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate('author', 'nick avatar emailVerified')
      .lean()

    res.json({ posts: posts.map(p => mapPost(p, req.user?._id)) })
  } catch (err) { next(err) }
}

// GET /posts/saved -- pestaña "Guardados" del Perfil. Mismo formato y mismos
// filtros de bloqueo que listPosts; mas recientes primero.
export async function listSavedPosts(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
    const filter = { savedBy: req.user._id, blockedBy: { $ne: req.user._id } }
    const excludedAuthors = await excludedAuthorIds(req.user)
    if (excludedAuthors.length) filter.author = { $nin: excludedAuthors }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', 'nick avatar emailVerified')
      .lean()

    res.json({ posts: posts.map(p => mapPost(p, req.user._id)) })
  } catch (err) { next(err) }
}

export async function createPost(req, res, next) {
  try {
    const { 
      text, kind, title, photoUrl, fileUrl, fileName, 
      pollOptions, eventData, tournamentData, communitySlug,
      tournamentId, eventId, challengeData, recruitmentData, teamId
    } = req.body

    // "Quién puede publicar" de la comunidad (CommunityCreate → whoPublishes).
    // Antes se guardaba pero nadie lo aplicaba: cualquiera publicaba igual.
    if (communitySlug) {
      const community = await Community.findOne({ slug: String(communitySlug).toLowerCase() })
        .select('whoPublishes creator owner staff').lean()
      const rule = community?.whoPublishes || 'Todos'
      if (community && rule !== 'Todos' && req.user.role !== 'admin') {
        const uid = String(req.user._id)
        const isOwner = [community.creator, community.owner].some(id => id && String(id) === uid)
        const handles = [req.user.nick, req.user.playerCode].filter(Boolean).map(v => String(v).toLowerCase())
        const isStaff = (community.staff || []).some(s => handles.includes(String(s.username || '').replace(/^@/, '').toLowerCase()))
        const allowed = rule === 'Solo dueño' ? isOwner : (isOwner || isStaff)
        if (!allowed) {
          return res.status(403).json({ message: rule === 'Solo dueño' ? 'En esta comunidad solo publica el dueño.' : 'En esta comunidad solo publica el staff.' })
        }
      }
    }

    let postText = text ? text.trim() : ''
    if (!postText) {
      if (kind === 'torneo' && tournamentId) {
        postText = '¡Mira este torneo!'
      } else if (kind === 'evento' && eventId) {
        postText = '¡Mira este evento!'
      } else if (kind === 'compartir_equipo' && teamId) {
        postText = '¡Mira este equipo!'
      } else {
        return res.status(400).json({ message: 'text is required' })
      }
    }

    const postData = {
      author: req.user._id,
      authorNick: req.user.nick,
      authorAvatar: req.user.avatar,
      text: postText,
      kind: kind || 'mensaje',
      title,
      photoUrl,
      fileUrl,
      fileName,
      communitySlug,
      likes: 0,
      comments: 0,
      timeString: 'Ahora'
    }

    if (kind === 'encuesta' && Array.isArray(pollOptions)) {
      postData.pollOptions = pollOptions.map(opt => ({
        text: opt,
        votes: 0,
        votedBy: []
      }))
    }

    if (kind === 'evento') {
      if (eventId) {
        const eventPost = mongoose.Types.ObjectId.isValid(eventId) ? await Post.findById(eventId) : null
        if (!eventPost || eventPost.kind !== 'evento') {
          return res.status(404).json({ message: 'Event not found' })
        }
        postData.title = eventPost.title
        postData.eventData = eventPost.eventData
      } else if (eventData) {
        postData.eventData = eventData
      }
    }

    if (kind === 'torneo') {
      if (tournamentId) {
        const { Tournament } = await import('../models/Tournament.js')
        let tournament = null
        
        // 1. Try finding by MongoDB ObjectId
        if (mongoose.Types.ObjectId.isValid(tournamentId)) {
          tournament = await Tournament.findById(tournamentId)
        }
        
        // 2. Try finding by publicId or tournamentCode (case-insensitive)
        if (!tournament) {
          const searchCode = String(tournamentId).trim().toUpperCase()
          tournament = await Tournament.findOne({
            $or: [
              { publicId: searchCode },
              { tournamentCode: searchCode }
            ]
          })
        }

        if (!tournament) {
          return res.status(404).json({ message: 'Tournament not found' })
        }

        postData.tournamentId = tournament._id
        postData.title = tournament.title
        postData.tournamentData = {
          game: tournament.game || 'Varios',
          format: tournament.format || 'Torneo',
          slots: tournament.maxSlots || 16,
          filledSlots: tournament.registrations?.length || 0,
          prize: tournament.prizePool ? `${tournament.prizePool} ${tournament.currency}` : 'Sin premio',
          date: tournament.date,
          publicId: tournament.publicId
        }
      } else if (tournamentData) {
        postData.tournamentData = tournamentData
      }
    }

    // Retos, Reclutamiento & Compartido de Equipo
    if (kind === 'reto' && challengeData) {
      postData.challengeData = challengeData
      postData.title = title || '¡Reto Competitivo!'
    }

    if (kind === 'reclutamiento' && recruitmentData) {
      postData.recruitmentData = recruitmentData
      postData.title = title || '¡Reclutamiento de Equipo!'
    }

    if (kind === 'compartir_equipo' && teamId) {
      const { Team } = await import('../models/Team.js')
      let team = null
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId)
      }
      if (!team) {
        // Try finding by tag or name
        team = await Team.findOne({
          $or: [
            { tag: String(teamId).trim().toUpperCase() },
            { name: new RegExp('^' + String(teamId).trim() + '$', 'i') }
          ]
        })
      }
      if (!team) {
        return res.status(404).json({ message: 'Team not found' })
      }
      postData.teamId = team._id
      postData.title = `Equipo: ${team.name}`
      postData.teamData = {
        name: team.name,
        tag: team.tag || '',
        logo: team.logo || '',
        game: team.game || 'Varios'
      }
    }

    const post = await Post.create(postData)

    res.status(201).json({
      id: post._id,
      kind: post.kind,
      author: post.authorNick,
      authorId: req.user._id,
      avatar: req.user.avatar || '',
      pinned: post.pinned,
      text: post.text,
      title: post.title,
      likes: post.likes,
      likedBy: post.likedBy || [],
      savedBy: post.savedBy || [],
      comments: post.comments,
      time: 'Ahora',
      createdAt: post.createdAt,
      photoUrl: post.photoUrl,
      fileUrl: post.fileUrl,
      fileName: post.fileName,
      pollOptions: post.pollOptions ? post.pollOptions.map(o => ({
        text: o.text,
        votes: o.votes || 0,
        voted: false
      })) : [],
      communitySlug: post.communitySlug,
      eventData: post.eventData,
      tournamentData: post.tournamentData,
      challengeData: post.challengeData,
      recruitmentData: post.recruitmentData,
      teamData: post.teamData,
      teamId: post.teamId
    })
  } catch (err) { next(err) }
}

export async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    // Check permissions (only author or admin can delete)
    if (String(post.author) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized to delete this post' })
    }

    await Post.deleteOne({ _id: req.params.id })
    // Also delete associated comments
    await Comment.deleteMany({ post: req.params.id })

    res.json({ message: 'Post deleted successfully' })
  } catch (err) { next(err) }
}

export async function likePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    const userId = req.user._id
    const likedIdx = post.likedBy.indexOf(userId)
    if (likedIdx > -1) {
      post.likedBy.splice(likedIdx, 1)
      post.likes = Math.max(0, post.likes - 1)
    } else {
      post.likedBy.push(userId)
      post.likes += 1
    }

    await post.save()

    res.json({
      id: post._id,
      likes: post.likes,
      likedBy: post.likedBy
    })
  } catch (err) { next(err) }
}

export async function savePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    const userId = req.user._id
    const idx = post.savedBy.indexOf(userId)
    if (idx > -1) {
      post.savedBy.splice(idx, 1)
    } else {
      post.savedBy.push(userId)
    }

    await post.save()
    res.json({ id: post._id, savedBy: post.savedBy })
  } catch (err) { next(err) }
}

export async function reportPost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    const { reason } = req.body
    post.reports.push({ reporter: req.user._id, reason: reason || 'Reporte general' })
    post.reported = true
    await post.save()

    res.json({ message: 'Post reported successfully' })
  } catch (err) { next(err) }
}

export async function blockPost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    const { blockAuthor } = req.body
    if (blockAuthor) {
      await Post.updateMany(
        { author: post.author },
        { $addToSet: { blockedBy: req.user._id } }
      )
    } else {
      if (!post.blockedBy.includes(req.user._id)) {
        post.blockedBy.push(req.user._id)
        await post.save()
      }
    }
    res.json({ message: 'Blocked successfully' })
  } catch (err) { next(err) }
}

export async function votePoll(req, res, next) {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post not found' })
    const { optionIndex } = req.body

    if (optionIndex === undefined || optionIndex < 0 || optionIndex >= post.pollOptions.length) {
      return res.status(400).json({ message: 'Invalid option index' })
    }

    const alreadyVoted = post.pollOptions.some(opt => opt.votedBy.includes(req.user._id))
    if (alreadyVoted) {
      return res.status(400).json({ message: 'You have already voted in this poll' })
    }

    post.pollOptions[optionIndex].votes += 1
    post.pollOptions[optionIndex].votedBy.push(req.user._id)
    await post.save()

    res.json({
      id: post._id,
      pollOptions: post.pollOptions.map(o => ({
        text: o.text,
        votes: o.votes,
        voted: o.votedBy.some(u => String(u) === String(req.user._id))
      }))
    })
  } catch (err) { next(err) }
}

// ── Comentarios ──

export async function listComments(req, res, next) {
  try {
    const filter = { post: req.params.id }
    if (req.user) {
      filter.blockedBy = { $ne: req.user._id }
    }

    const comments = await Comment.find(filter)
      .sort({ createdAt: 1 })
      .populate('author', 'nick avatar')
      .lean()

    res.json({
      comments: comments.map(c => ({
        id: c._id,
        post: c.post,
        author: c.authorNick,
        authorId: c.author?._id || c.author,
        avatar: c.author?.avatar || c.authorAvatar || '',
        text: c.text,
        parentId: c.parentId,
        likes: c.likes || 0,
        likedBy: c.likedBy || [],
        createdAt: c.createdAt
      }))
    })
  } catch (err) { next(err) }
}

export async function createComment(req, res, next) {
  try {
    const { text, parentId } = req.body
    if (!text) return res.status(400).json({ message: 'Text is required' })

    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      authorNick: req.user.nick,
      authorAvatar: req.user.avatar,
      text,
      parentId: parentId || null
    })

    post.comments += 1
    await post.save()

    res.status(201).json({
      id: comment._id,
      post: comment.post,
      author: comment.authorNick,
      authorId: req.user._id,
      avatar: req.user.avatar || '',
      text: comment.text,
      parentId: comment.parentId,
      likes: comment.likes,
      likedBy: comment.likedBy || [],
      createdAt: comment.createdAt
    })
  } catch (err) { next(err) }
}

export async function likeComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId)
    if (!comment) return res.status(404).json({ message: 'Comment not found' })

    const userId = req.user._id
    const idx = comment.likedBy.indexOf(userId)
    if (idx > -1) {
      comment.likedBy.splice(idx, 1)
      comment.likes = Math.max(0, comment.likes - 1)
    } else {
      comment.likedBy.push(userId)
      comment.likes += 1
    }

    await comment.save()
    res.json({ id: comment._id, likes: comment.likes, likedBy: comment.likedBy })
  } catch (err) { next(err) }
}

export async function reportComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId)
    if (!comment) return res.status(404).json({ message: 'Comment not found' })

    const { reason } = req.body
    comment.reports.push({ reporter: req.user._id, reason: reason || 'Reporte general' })
    comment.reported = true
    await comment.save()

    res.json({ message: 'Comment reported successfully' })
  } catch (err) { next(err) }
}

export async function deleteComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId)
    if (!comment) return res.status(404).json({ message: 'Comment not found' })

    if (String(comment.author) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    await Comment.deleteOne({ _id: comment._id })
    await Post.updateOne({ _id: comment.post }, { $inc: { comments: -1 } })

    res.json({ message: 'Comment deleted successfully' })
  } catch (err) { next(err) }
}

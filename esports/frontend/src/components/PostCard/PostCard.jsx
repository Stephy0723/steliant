import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { useShareDestinations } from '../../hooks/useShareDestinations.js'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { useLang } from '../../i18n/LangContext.jsx'
import { Icon } from '../icons/Icons.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import RoleBadge from '../RoleBadge/RoleBadge.jsx'
import ShareModal from '../ShareModal/ShareModal.jsx'
import ReportUserModal from '../UserActions/ReportUserModal.jsx'
import { useRelationship } from '../UserActions/useRelationship.js'
import './PostCard.css'

// El endpoint de subida de fotos/archivos del Composer (POST /uploads) devuelve
// una URL absoluta con el host del backend en vez de una ruta relativa (a
// diferencia de avatares/logos/banners) -- esto la normaliza a ruta relativa
// para que cargue desde el origen actual, igual que ya se hace en Profile.jsx.
function resolveUploadUrl(value) {
  if (!value) return value
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

const POST_COPY = {
  es: {
    loginLike: 'Inicia sesión para dar me gusta',
    loginSave: 'Inicia sesión para guardar esta publicación',
    loginReport: 'Inicia sesión para reportar',
    loginBlock: 'Inicia sesión para bloquear',
    loginVote: 'Inicia sesión para votar',
    loginComment: 'Inicia sesión para comentar',
    saved: 'Publicación guardada',
    unsaved: 'Publicación eliminada de guardados',
    shareCopied: 'Enlace del perfil del autor copiado al portapapeles',
    shareError: 'Error al copiar el enlace',
    reportLocal: 'Publicación de prueba reportada (local)',
    reportPrompt: 'Escribe el motivo del reporte:',
    reportDefault: 'Reporte general',
    reportSent: 'Publicación reportada a los moderadores',
    reportError: 'Error al enviar reporte',
    blockLocalAuthor: 'Autor bloqueado (local)',
    blockLocalPost: 'Publicación oculta (local)',
    blockAuthorConfirm: nick => `¿Estás seguro de que quieres bloquear a ${nick}? No verás ninguna de sus publicaciones.`,
    blockPostConfirm: '¿Estás seguro de que quieres ocultar esta publicación?',
    blockedUser: 'Usuario bloqueado',
    hiddenPost: 'Publicación oculta',
    blockError: 'Error al bloquear',
    deleteLocal: 'Publicación eliminada (local)',
    deletePostConfirm: '¿Estás seguro de que quieres eliminar esta publicación?',
    deletePost: 'Publicación eliminada',
    deleteError: 'Error al eliminar',
    voteLocal: 'Voto registrado (local)',
    voteSaved: 'Voto registrado',
    voteError: 'Error al registrar voto',
    commentLocal: 'Comentario agregado (local)',
    commentAdded: 'Comentario agregado',
    commentError: 'Error al comentar',
    deleteCommentConfirm: '¿Eliminar este comentario?',
    commentDeletedLocal: 'Comentario eliminado (local)',
    commentDeleted: 'Comentario eliminado',
    deleteCommentError: 'Error al eliminar comentario',
    you: 'Tú',
    now: 'Ahora',
    pinned: 'Fijado',
    reportPost: 'Reportar publicación',
    hidePost: 'Ocultar esta publicación',
    blockAuthor: nick => `Bloquear a ${nick}`,
    deletePostAction: 'Eliminar publicación',
    teamKind: 'EQUIPO',
    voteLoginHint: 'Inicia sesión para votar',
    voteSelectHint: 'Selecciona una opción para votar',
    attachmentAlt: 'Adjunto',
    downloadDocument: 'Descargar documento',
    clickDownload: 'Haz clic para descargar',
    achievementUnlocked: 'LOGRO DESBLOQUEADO',
    achievementFallback: '¡Victoria impresionante!',
    registeredTeams: 'Equipos inscritos',
    publicId: 'ID público',
    creatorId: 'ID extenso (creador)',
    join: 'Inscribirse',
    communityEvent: 'EVENTO DE LA COMUNIDAD',
    joinEvent: 'Unirse',
    challengeActive: 'RETO ACTIVADO',
    game: 'Juego',
    stake: 'Recompensa/Apuesta',
    justForFun: 'Por diversión',
    recruitment: 'BÚSQUEDA DE JUGADOR',
    requiredRole: 'Rol requerido',
    communityTeam: 'EQUIPO DE LA COMUNIDAD',
    viewSquad: 'Ver escuadra',
    save: 'Guardar',
    savedShort: 'Guardado',
    share: 'Compartir',
    commentPlaceholder: 'Escribe un comentario...',
    send: 'Enviar',
    loginConversation: 'Inicia sesión para participar en la conversación.',
    loadingComments: 'Cargando comentarios...',
    emptyComments: 'Sé el primero en comentar esta publicación.',
    reply: 'Responder',
    delete: 'Eliminar',
    replyTo: author => `Responder a ${author}...`,
    cancel: 'Cancelar',
    confirmAction: 'Confirmar',
    sendReport: 'Enviar reporte',
    reportTitle: 'Reportar publicación',
    reportHint: 'Contale a moderación qué está mal con esta publicación (opcional, pero ayuda a resolverlo más rápido).',
  },
  en: {
    loginLike: 'Sign in to like',
    loginSave: 'Sign in to save this post',
    loginReport: 'Sign in to report',
    loginBlock: 'Sign in to block',
    loginVote: 'Sign in to vote',
    loginComment: 'Sign in to comment',
    saved: 'Post saved',
    unsaved: 'Post removed from saved',
    shareCopied: 'Author profile link copied to clipboard',
    shareError: 'Could not copy the link',
    reportLocal: 'Test post reported locally',
    reportPrompt: 'Write the report reason:',
    reportDefault: 'General report',
    reportSent: 'Post reported to moderators',
    reportError: 'Could not send report',
    blockLocalAuthor: 'Author blocked locally',
    blockLocalPost: 'Post hidden locally',
    blockAuthorConfirm: nick => `Are you sure you want to block ${nick}? You will not see any of their posts.`,
    blockPostConfirm: 'Are you sure you want to hide this post?',
    blockedUser: 'User blocked',
    hiddenPost: 'Post hidden',
    blockError: 'Could not block',
    deleteLocal: 'Post deleted locally',
    deletePostConfirm: 'Are you sure you want to delete this post?',
    deletePost: 'Post deleted',
    deleteError: 'Could not delete',
    voteLocal: 'Vote registered locally',
    voteSaved: 'Vote registered',
    voteError: 'Could not register vote',
    commentLocal: 'Comment added locally',
    commentAdded: 'Comment added',
    commentError: 'Could not comment',
    deleteCommentConfirm: 'Delete this comment?',
    commentDeletedLocal: 'Comment deleted locally',
    commentDeleted: 'Comment deleted',
    deleteCommentError: 'Could not delete comment',
    you: 'You',
    now: 'Now',
    pinned: 'Pinned',
    reportPost: 'Report post',
    hidePost: 'Hide this post',
    blockAuthor: nick => `Block ${nick}`,
    deletePostAction: 'Delete post',
    teamKind: 'TEAM',
    voteLoginHint: 'Sign in to vote',
    voteSelectHint: 'Select an option to vote',
    attachmentAlt: 'Attachment',
    downloadDocument: 'Download document',
    clickDownload: 'Click to download',
    achievementUnlocked: 'ACHIEVEMENT UNLOCKED',
    achievementFallback: 'Impressive victory!',
    registeredTeams: 'Registered teams',
    publicId: 'Public ID',
    creatorId: 'Extended ID (creator)',
    join: 'Register',
    communityEvent: 'COMMUNITY EVENT',
    joinEvent: 'Join',
    challengeActive: 'CHALLENGE ACTIVE',
    game: 'Game',
    stake: 'Reward/Wager',
    justForFun: 'Just for fun',
    recruitment: 'LOOKING FOR PLAYER',
    requiredRole: 'Required role',
    communityTeam: 'COMMUNITY TEAM',
    viewSquad: 'View squad',
    save: 'Save',
    savedShort: 'Saved',
    share: 'Share',
    commentPlaceholder: 'Write a comment...',
    send: 'Send',
    loginConversation: 'Sign in to join the conversation.',
    loadingComments: 'Loading comments...',
    emptyComments: 'Be the first to comment on this post.',
    reply: 'Reply',
    delete: 'Delete',
    replyTo: author => `Reply to ${author}...`,
    cancel: 'Cancel',
    confirmAction: 'Confirm',
    sendReport: 'Send report',
    reportTitle: 'Report post',
    reportHint: 'Tell moderation what\'s wrong with this post (optional, but it helps resolve it faster).',
  },
}

export default function PostCard({ post: initialPost, onDelete, onBlock, onSaveChange }) {
  const { user } = useAuth()
  const { lang } = useLang()
  const copy = POST_COPY[lang] || POST_COPY.es
  const [post, setPost] = useState(initialPost)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const { friends: shareFriends } = useShareDestinations(shareOpen)
  // Reemplaza los confirm()/prompt() nativos del navegador (se veian fuera
  // de lugar en una app con su propia UI) por modales propias.
  const [confirmState, setConfirmState] = useState(null) // { message, confirmLabel, danger, onConfirm }
  const [reportOpen, setReportOpen] = useState(false)
  const [reportUserOpen, setReportUserOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const menuRef = useRef(null)

  // Sync state with prop if it changes
  useEffect(() => {
    setPost(initialPost)
  }, [initialPost])

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Check if this is a real MongoDB ID or mock data
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(post.id || post._id)
  const getPostId = () => post.id || post._id

  // Map legacy mock types to backend enum kinds
  const rawKind = post.kind || post.type || 'mensaje'
  const kindMap = {
    post: 'mensaje',
    poll: 'encuesta',
    photo: 'foto',
    image: 'foto',
    document: 'documento',
    achievement: 'logro',
    tournament: 'torneo',
    event: 'evento'
  }
  const kind = kindMap[rawKind] || rawKind

  const isLiked = user && post.likedBy?.includes(user._id)
  const isSaved = user && post.savedBy?.includes(user._id)

  const handleLike = async () => {
    if (!isMongoId) {
      toast('Este post es demo y no puede guardar likes reales.', 'info')
      return
    }

    if (!user) {
      toast(copy.loginLike, 'info')
      return
    }
    try {
      const res = await api(`/posts/${getPostId()}/like`, { method: 'POST' })
      setPost(prev => ({ ...prev, likes: res.likes, likedBy: res.likedBy }))
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async () => {
    if (!isMongoId) {
      toast('Este post es demo y no puede guardarse como dato real.', 'info')
      return
    }

    if (!user) {
      toast(copy.loginSave, 'info')
      return
    }
    try {
      const res = await api(`/posts/${getPostId()}/save`, { method: 'POST' })
      setPost(prev => ({ ...prev, savedBy: res.savedBy }))
      const nowSaved = res.savedBy.includes(user._id)
      toast(nowSaved ? copy.saved : copy.unsaved, 'success')
      onSaveChange?.(getPostId(), nowSaved)
    } catch (err) {
      console.error(err)
    }
  }

  const handleShare = () => {
    setShareOpen(true)
  }

  const handleReport = () => {
    if (!isMongoId) {
      toast('Este post es demo y no puede generar reporte real.', 'info')
      setShowMenu(false)
      return
    }

    if (!user) {
      toast(copy.loginReport, 'info')
      return
    }
    setReportReason('')
    setReportOpen(true)
  }

  const submitReport = async () => {
    try {
      await api(`/posts/${getPostId()}/report`, {
        method: 'POST',
        body: { reason: reportReason.trim() || copy.reportDefault }
      })
      toast(copy.reportSent, 'success')
      setReportOpen(false)
      setShowMenu(false)
    } catch (err) {
      toast(copy.reportError, 'error')
    }
  }

  const handleBlock = (blockAuthor = false) => {
    if (!isMongoId) {
      toast('Este post es demo y no puede bloquearse como dato real.', 'info')
      setShowMenu(false)
      return
    }

    if (!user) {
      toast(copy.loginBlock, 'info')
      return
    }
    const authorNick = typeof post.author === 'string' ? post.author : (post.author?.nick || 'user')
    const msg = blockAuthor
      ? copy.blockAuthorConfirm(authorNick)
      : copy.blockPostConfirm
    setConfirmState({
      message: msg,
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/posts/${getPostId()}/block`, {
            method: 'POST',
            body: { blockAuthor }
          })
          toast(blockAuthor ? copy.blockedUser : copy.hiddenPost, 'success')
          setShowMenu(false)
          onBlock?.(getPostId(), blockAuthor)
        } catch (err) {
          toast(copy.blockError, 'error')
        }
      },
    })
  }

  const handleDelete = () => {
    if (!isMongoId) {
      toast('Este post es demo y no puede eliminarse como dato real.', 'info')
      return
    }

    setConfirmState({
      message: copy.deletePostConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/posts/${getPostId()}`, { method: 'DELETE' })
          toast(copy.deletePost, 'success')
          onDelete?.(getPostId())
        } catch (err) {
          toast(copy.deleteError, 'error')
        }
      },
    })
  }

  const handleVote = async (optionIndex) => {
    if (!isMongoId) {
      toast('Esta encuesta es demo y no puede guardar votos reales.', 'info')
      return
    }

    if (!user) {
      toast(copy.loginVote, 'info')
      return
    }
    try {
      const res = await api(`/posts/${getPostId()}/vote`, {
        method: 'POST',
        body: { optionIndex }
      })
      setPost(prev => ({ ...prev, pollOptions: res.pollOptions }))
      toast(copy.voteSaved, 'success')
    } catch (err) {
      toast(err.message || copy.voteError, 'error')
    }
  }

  // Comments logic
  const fetchComments = async () => {
    if (!isMongoId) {
      setComments([])
      return
    }

    setLoadingComments(true)
    try {
      const res = await api(`/posts/${getPostId()}/comments`)
      setComments(res.comments || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingComments(false)
    }
  }

  const toggleComments = () => {
    const nextState = !showComments
    setShowComments(nextState)
    if (nextState) {
      fetchComments()
    }
  }

  const handleAddComment = async (e, parentId = null) => {
    e.preventDefault()
    const commentText = parentId ? replyText.trim() : newCommentText.trim()
    if (!commentText) return

    if (!isMongoId) {
      toast('Este post es demo y no puede recibir comentarios reales.', 'info')
      return
    }

    if (!user) {
      toast(copy.loginComment, 'info')
      return
    }

    try {
      const newComment = await api(`/posts/${getPostId()}/comments`, {
        method: 'POST',
        body: { text: commentText, parentId }
      })
      setComments(prev => [...prev, newComment])
      setPost(prev => ({ ...prev, comments: prev.comments + 1 }))
      if (parentId) {
        setReplyText('')
        setReplyingToId(null)
      } else {
        setNewCommentText('')
      }
      toast(copy.commentAdded, 'success')
    } catch (err) {
      toast(copy.commentError, 'error')
    }
  }

  const handleDeleteComment = (commentId) => {
    if (!isMongoId) {
      toast('Este comentario es demo y no puede eliminarse como dato real.', 'info')
      return
    }

    setConfirmState({
      message: copy.deleteCommentConfirm,
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/posts/comments/${commentId}`, { method: 'DELETE' })
          setComments(prev => prev.filter(c => c.id !== commentId))
          setPost(prev => ({ ...prev, comments: Math.max(0, prev.comments - 1) }))
          toast(copy.commentDeleted, 'success')
        } catch (err) {
          toast(copy.deleteCommentError, 'error')
        }
      },
    })
  }

  // Organize comments into root comments and replies
  const rootComments = comments.filter(c => !c.parentId)
  const getReplies = (parentId) => comments.filter(c => c.parentId === parentId)

  // Native Emoji helper
  const addEmojiToComposer = (emoji) => {
    setNewCommentText(prev => prev + emoji)
  }

  const addEmojiToReply = (emoji) => {
    setReplyText(prev => prev + emoji)
  }

  const EMOJIS = ['🎮', '🏆', '👑', '👾', '⚔️', '🛡️', '⚡', '🎯', '🔥', '💎', '🌟', '🚀', '📢', '🤝', '🥇', '🥈', '🥉', '📈', '😎', '💪']

  const authorNick = typeof post.author === 'string' ? post.author : (post.author?.nick || 'user')
  const authorAvatar = typeof post.author === 'object' ? post.author?.avatar : (post.avatar || '')
  const authorRole = typeof post.author === 'object' ? post.author?.role : null
  // Solo conocemos el estado (activeStatus) en vivo del usuario logueado --
  // para el autor de un post ajeno no tenemos ese dato todavia.
  const authorId = post.authorId || post.author?._id
  const authorUser = authorId ? { _id: authorId, nick: authorNick, avatar: authorAvatar } : null
  const authorRelationship = useRelationship(authorUser)
  const isOwnPost = Boolean(user) && (authorId ? String(authorId) === String(user._id) : authorNick === user.nick)
  const authorStatus = isOwnPost ? user?.activeStatus : null
  const postText = post.text || post.content
  const shareData = useMemo(() => {
    const pollOptions = post.pollOptions || post.options || []
    const tournament = post.tournamentData || {}
    const team = post.teamData || {}
    const event = post.eventData || {}
    const challenge = post.challengeData || {}
    const recruitment = post.recruitmentData || {}
    const id = getPostId() || post.localId || post.slug || `${authorNick}-${post.time || Date.now()}`
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const route = kind === 'torneo' && (post.tournamentId || tournament.publicId)
      ? `/torneos/${encodeURIComponent(post.tournamentId || tournament.publicId)}`
      : `/comunidad?post=${encodeURIComponent(id)}`
    const titleByKind = {
      encuesta: post.title || postText || (lang === 'en' ? 'Community poll' : 'Encuesta de la comunidad'),
      torneo: post.title || tournament.name || (lang === 'en' ? 'Tournament' : 'Torneo'),
      evento: event.title || post.title || (lang === 'en' ? 'Community event' : 'Evento de comunidad'),
      reto: post.title || (lang === 'en' ? 'Challenge' : 'Reto'),
      reclutamiento: post.title || (lang === 'en' ? 'Player recruitment' : 'Busqueda de jugador'),
      compartir_equipo: team.name || post.title || (lang === 'en' ? 'Team' : 'Equipo'),
      logro: post.title || (lang === 'en' ? 'Achievement' : 'Logro'),
    }
    const game = tournament.game || team.game || challenge.game || recruitment.game || post.game || ''
    const title = titleByKind[kind] || post.title || (lang === 'en' ? `Post by ${authorNick}` : `Publicacion de ${authorNick}`)
    const summaryByKind = {
      encuesta: `${postText || title}${pollOptions.length ? ` · ${pollOptions.length} opciones` : ''}`,
      torneo: [
        tournament.prize || post.prize,
        tournament.date || post.date,
        tournament.slots || post.slots ? `${tournament.filledSlots || post.filledSlots || 0}/${tournament.slots || post.slots} equipos` : '',
      ].filter(Boolean).join(' · '),
      compartir_equipo: `${team.name || title}${game ? ` compite en ${game}` : ''}.`,
      logro: postText || (lang === 'en' ? 'Achievement shared on GlitchGang.' : 'Logro compartido en GlitchGang.'),
    }
    const summary = summaryByKind[kind] || postText || post.description || event.description || (lang === 'en' ? 'Shared from GlitchGang.' : 'Compartido desde GlitchGang.')
    const image = resolveUploadUrl(post.photoUrl || post.photo) || post.image || post.cover || tournament.image || tournament.banner || tournament.cover || team.banner || team.cover || ''
    const logo = team.logo || tournament.logo || post.logo || authorAvatar || ''
    // Amigos reales (poblados al abrir el modal); user.friends son solo IDs.
    const contacts = shareFriends
    const teams = team.name ? [{
      id: team.id || team._id || team.slug || team.name,
      name: team.name,
      subtitle: game || team.tag || 'Equipo',
      avatar: team.logo || '',
      logo: team.logo || '',
      cover: team.banner || team.cover || image,
    }] : []

    return {
      title,
      subtitle: lang === 'en'
        ? 'Share this post in chats, teams and communities.'
        : 'Comparte esta publicacion en chats, equipos y comunidades.',
      url: `${origin}${route}`,
      text: lang === 'en'
        ? `Check this out on GlitchGang: ${title}`
        : `Mira esto en GlitchGang: ${title}`,
      game,
      summary,
      image,
      logo,
      contacts,
      teams,
    }
  }, [authorAvatar, authorNick, kind, lang, post, postText, shareFriends])

  const handleBlockAuthorUser = async () => {
    if (!user) {
      toast(copy.loginBlock, 'info')
      return
    }
    if (!authorId || isOwnPost) return
    try {
      await authorRelationship.block()
      toast(copy.blockedUser, 'success')
      setShowMenu(false)
      onBlock?.(getPostId(), true)
    } catch (err) {
      toast(err.message || copy.blockError, 'error')
    }
  }

  const submitUserReport = async (payload) => {
    try {
      const result = await authorRelationship.report(payload)
      toast(`${lang === 'en' ? 'Report sent. The moderation team will review it.' : 'Reporte enviado. El equipo de moderación lo revisará.'}${result?.ticketCode ? ` ${result.ticketCode}` : ''}`, 'success')
      setReportUserOpen(false)
      setShowMenu(false)
    } catch (err) {
      toast(err.message || copy.reportError, 'error')
    }
  }

  return (
    <>
      <motion.div 
        className={`gg-post-card ${post.pinned ? 'pinned' : ''} ${kind === 'logro' ? 'achievement-card' : ''}`}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.22 }}
      >
      {kind === 'logro' && <div className="gg-post-card__achievement-glow" />}

      {/* Header */}
      <div className="gg-post-card__head">
        <div className="gg-post-card__author-info">
          <Avatar src={authorAvatar} size={40} status={authorStatus} />
          <div className="gg-post-card__author-meta">
            <div className="gg-post-card__author-row">
              <span className="gg-post-card__nick" data-no-translate>{authorNick}</span>
              {authorRole && <RoleBadge role={authorRole} compact />}
            </div>
            <span className="gg-post-card__time">{post.time || copy.now}</span>
          </div>
        </div>

        <div className="gg-post-card__actions-right">
          {post.pinned && <span className="gg-post-card__pin-badge">{Icon.bolt} {copy.pinned}</span>}
          
          <span className={`gg-post-card__kind-badge ${kind}`}>
            {kind === 'torneo' && Icon.trophy}
            {kind === 'evento' && Icon.calendar}
            {kind === 'encuesta' && Icon.chartBar}
            {kind === 'foto' && Icon.camera}
            {kind === 'documento' && Icon.fileText}
            {kind === 'logro' && Icon.award}
            {kind === 'reto' && Icon.target}
            {kind === 'reclutamiento' && Icon.users}
            {kind === 'compartir_equipo' && Icon.team}
            {kind === 'compartir_equipo' ? copy.teamKind : kind?.toUpperCase()}
          </span>

          {/* Context Dropdown Menu */}
          <div className="gg-post-card__menu-container" ref={menuRef}>
            <button className="gg-post-card__menu-trigger" onClick={() => setShowMenu(!showMenu)}>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <motion.div 
                  className="gg-post-card__dropdown"
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.1 }}
                >
                  <button onClick={handleReport}>{Icon.bell} {copy.reportPost}</button>
                  {user && String(post.authorId || post.author?._id) !== String(user._id) && (
                    <>
                      <button onClick={() => setReportUserOpen(true)}>{Icon.alert} {lang === 'en' ? 'Report user' : 'Reportar usuario'}</button>
                      <button onClick={() => handleBlock(false)}>{Icon.x} {copy.hidePost}</button>
                      <button onClick={handleBlockAuthorUser} className="danger">{Icon.shield} {copy.blockAuthor(authorNick)}</button>
                    </>
                  )}
                  {user && (String(post.authorId || post.author?._id) === String(user._id) || user.role === 'admin') && (
                    <button onClick={handleDelete} className="danger">{Icon.trash} {copy.deletePostAction}</button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="gg-post-card__body">
        {/* Title if present */}
        {post.title && <h3 className="gg-post-card__title" data-no-translate>{post.title}</h3>}

        {/* Text */}
        {postText && <p className="gg-post-card__text" data-no-translate>{postText}</p>}

        {/* ── Poll Render ── */}
        {kind === 'encuesta' && (post.pollOptions || post.options) && (
          <div className="gg-post-card__poll">
            {(() => {
              const opts = post.pollOptions || post.options || []
              const totalVotes = opts.reduce((sum, o) => sum + (o.votes || 0), 0) || 1
              const hasVoted = opts.some(o => o.voted)
              
              return opts.map((opt, idx) => {
                const percent = Math.round(((opt.votes || 0) / totalVotes) * 100)
                return (
                  <button 
                    key={idx} 
                    className={`gg-post-card__poll-opt ${opt.voted ? 'voted' : ''}`}
                    disabled={hasVoted || !user}
                    onClick={() => handleVote(idx)}
                  >
                    <span className="fill" style={{ width: `${hasVoted ? percent : 0}%` }} />
                    <span className="text">{opt.text}</span>
                    {hasVoted && <span className="pct">{percent}% ({opt.votes})</span>}
                  </button>
                )
              })
            })()}
            {!user && <small className="gg-post-card__poll-hint">{copy.voteLoginHint}</small>}
            {user && !((post.pollOptions || post.options || []).some(o => o.voted)) && <small className="gg-post-card__poll-hint">{copy.voteSelectHint}</small>}
          </div>
        )}

        {/* ── Photo Render ── */}
        {kind === 'foto' && (post.photoUrl || post.photo) && (
          <div className="gg-post-card__image-container">
            <img src={resolveUploadUrl(post.photoUrl || post.photo)} alt={copy.attachmentAlt} className="gg-post-card__image" />
          </div>
        )}

        {/* ── Document Render ── */}
        {kind === 'documento' && post.fileUrl && (
          <a href={resolveUploadUrl(post.fileUrl)} download={post.fileName || 'documento'} className="gg-post-card__document-attachment">
            <span className="doc-icon">{Icon.fileText}</span>
            <div className="doc-info">
              <span className="doc-name">{post.fileName || copy.downloadDocument}</span>
              <span className="doc-action">{copy.clickDownload}</span>
            </div>
            <span className="download-arrow">{Icon.download}</span>
          </a>
        )}

        {/* ── Achievement Render ── */}
        {kind === 'logro' && (
          <div className="gg-post-card__achievement-banner">
            <span className="trophy">🏆</span>
            <div className="ach-details">
              <h5>{copy.achievementUnlocked}</h5>
              <h4>{post.title || copy.achievementFallback}</h4>
            </div>
          </div>
        )}

        {/* ── Tournament Render ── */}
        {kind === 'torneo' && (post.tournamentData || post.slots) && (
          <div className="gg-post-card__esports-ticket">
            <div className="ticket-body">
              <h4>{post.title}</h4>
              <div className="ticket-grid">
                <span>🎮 <b>{post.tournamentData?.game || post.game}</b></span>
                <span>👥 <b>{post.tournamentData?.format || post.format}</b></span>
                <span>🏆 <b>{post.tournamentData?.prize || post.prize}</b></span>
                <span>📅 <b>{new Date(post.tournamentData?.date || post.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES')}</b></span>
              </div>
              <div className="ticket-slots">
                <div className="slots-progress">
                  <div className="fill" style={{ width: `${((post.tournamentData?.filledSlots || post.filledSlots || 0) / (post.tournamentData?.slots || post.slots || 8)) * 100}%` }} />
                </div>
                <span>{post.tournamentData?.filledSlots || post.filledSlots || 0}/{post.tournamentData?.slots || post.slots || 8} {copy.registeredTeams}</span>
              </div>
              <div className="ticket-ids" style={{ marginTop: '10px', fontSize: '10.5px', display: 'flex', flexWrap: 'wrap', gap: '12px', opacity: 0.8, borderTop: '1px dashed color-mix(in srgb, var(--line) 76%, transparent)', paddingTop: '8px' }}>
                <span>{copy.publicId}: <code style={{ color: 'var(--accent)', background: 'rgba(var(--accent-rgb),0.1)', padding: '2px 4px', borderRadius: '4px' }}>{post.tournamentData?.publicId || 'TOR-VAL-ORG100-001-01'}</code></span>
                {user && (String(post.authorId || post.author?._id) === String(user._id) || user.role === 'admin') && (
                  <span>{copy.creatorId}: <code style={{ color: 'var(--text-dim)', background: 'color-mix(in srgb, var(--bg-card) 86%, var(--text) 6%)', padding: '2px 4px', borderRadius: '4px' }}>{post.tournamentId || getPostId()}</code></span>
                )}
              </div>
            </div>
            <button className="gg-btn gg-btn--primary gg-btn--sm">{copy.join}</button>
          </div>
        )}

        {/* ── Event Render ── */}
        {kind === 'evento' && (post.eventData || post.description || post.date) && (
          <div className="gg-post-card__event-box">
            <div className="event-header">
              <span className="event-badge">📅 {copy.communityEvent}</span>
              <h4>{post.eventData?.title || post.title}</h4>
            </div>
            <p>{post.eventData?.description || post.description}</p>
            <div className="event-meta">
              <span>📅 {new Date(post.eventData?.date || post.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES')}</span>
              <span>⏰ {post.eventData?.time || post.time_str || post.time}</span>
              {(post.eventData?.link || post.link) && (
                <a href={String(post.eventData?.link || post.link).startsWith('http') ? (post.eventData?.link || post.link) : `https://${post.eventData?.link || post.link}`} target="_blank" rel="noopener noreferrer">
                  {Icon.share} {copy.joinEvent}
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Reto Render ── */}
        {kind === 'reto' && post.challengeData && (
          <div className="gg-post-card__challenge-box">
            <div className="challenge-header">
              <span className="challenge-badge">🎯 {copy.challengeActive}</span>
              <h4>{post.title}</h4>
            </div>
            <div className="challenge-meta">
              <span>🎮 {copy.game}: <b>{post.challengeData.game}</b></span>
              <span>💰 {copy.stake}: <b>{post.challengeData.stake || copy.justForFun}</b></span>
            </div>
          </div>
        )}

        {/* ── Reclutamiento Render ── */}
        {kind === 'reclutamiento' && post.recruitmentData && (
          <div className="gg-post-card__recruitment-box">
            <div className="recruitment-header">
              <span className="recruitment-badge">👥 {copy.recruitment}</span>
              <h4>{post.title}</h4>
            </div>
            <div className="recruitment-meta">
              <span>🎮 {copy.game}: <b>{post.recruitmentData.game}</b></span>
              <span>⚡ {copy.requiredRole}: <b>{post.recruitmentData.roleNeeded}</b></span>
            </div>
          </div>
        )}

        {/* ── Compartir Equipo Render ── */}
        {kind === 'compartir_equipo' && post.teamData && (
          <div className="gg-post-card__team-showcase">
            <div className="team-info-row">
              {post.teamData.logo && <img src={post.teamData.logo} alt="Logo" className="team-logo-img" />}
              <div className="team-text-meta">
                <span className="team-badge">👥 {copy.communityTeam}</span>
                <h4>{post.teamData.name} [{post.teamData.tag}]</h4>
                <span>🎮 {post.teamData.game}</span>
              </div>
            </div>
            <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => window.location.href = `/equipos`}>
              {copy.viewSquad}
            </button>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="gg-post-card__foot">
        <button className={`gg-post-card__action-btn like ${isLiked ? 'active' : ''}`} onClick={handleLike}>
          {Icon.heart} {post.likes || 0}
        </button>

        <button className={`gg-post-card__action-btn comment ${showComments ? 'active' : ''}`} onClick={toggleComments}>
          {Icon.chat} {post.comments || 0}
        </button>

        <button className={`gg-post-card__action-btn save ${isSaved ? 'active' : ''}`} onClick={handleSave}>
          {Icon.bookmark} {isSaved ? copy.savedShort : copy.save}
        </button>

        <button className="gg-post-card__action-btn share" onClick={handleShare}>
          {Icon.share} {copy.share}
        </button>
      </div>

      {/* ── Comments Drawer ── */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            className="gg-post-card__comments-section"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="gg-post-card__comments-divider" />

            {/* Comment Composer */}
            {user ? (
              <form className="gg-post-card__comment-composer" onSubmit={(e) => handleAddComment(e, null)}>
                <Avatar src={user.avatar} size={30} status={user.activeStatus} />
                <div className="composer-input-wrap">
                  <input
                    type="text"
                    placeholder={copy.commentPlaceholder}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                  />
                </div>
                <button type="submit" className="gg-btn gg-btn--primary gg-btn--sm" disabled={!newCommentText.trim()}>
                  {copy.send}
                </button>
              </form>
            ) : (
              <p className="gg-post-card__comments-login-hint">{copy.loginConversation}</p>
            )}

            {/* Comments List */}
            {loadingComments ? (
              <div className="gg-post-card__comments-loading">{copy.loadingComments}</div>
            ) : rootComments.length === 0 ? (
              <div className="gg-post-card__comments-empty">{copy.emptyComments}</div>
            ) : (
              <div className="gg-post-card__comments-list">
                {rootComments.map(comment => {
                  const replies = getReplies(comment.id)

                  return (
                    <div key={comment.id} className="gg-post-card__comment-item">
                      <div className="comment-main">
                        <Avatar src={comment.avatar} size={28} />
                        <div className="comment-body">
                          <div className="comment-author-row">
                            <span className="comment-author" data-no-translate>{comment.author}</span>
                            <span className="comment-date">{new Date(comment.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="comment-text" data-no-translate>{comment.text}</p>
                          
                          {/* Comment actions */}
                          <div className="comment-actions">
                            {user && (
                              <button className="comment-act" onClick={() => setReplyingToId(comment.id)}>
                                {copy.reply}
                              </button>
                            )}
                            {user && (String(comment.authorId) === String(user._id) || user.role === 'admin') && (
                              <button className="comment-act danger" onClick={() => handleDeleteComment(comment.id)}>
                                {copy.delete}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Nested Replies */}
                      {replies.length > 0 && (
                        <div className="comment-replies">
                          {replies.map(reply => {
                            return (
                              <div key={reply.id} className="reply-item">
                                <Avatar src={reply.avatar} size={24} />
                                <div className="reply-body">
                                  <div className="comment-author-row">
                                    <span className="comment-author" data-no-translate>{reply.author}</span>
                                    <span className="comment-date">{new Date(reply.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <p className="comment-text" data-no-translate>{reply.text}</p>
                                  <div className="comment-actions">
                                    {user && (String(reply.authorId) === String(user._id) || user.role === 'admin') && (
                                      <button className="comment-act danger" onClick={() => handleDeleteComment(reply.id)}>
                                        {copy.delete}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Inline Reply Composer */}
                      <AnimatePresence>
                        {replyingToId === comment.id && (
                          <motion.form 
                            className="gg-post-card__reply-composer"
                            onSubmit={(e) => handleAddComment(e, comment.id)}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                          >
                            <span className="reply-indicator">↳</span>
                            <div className="reply-input-wrap">
                              <input 
                                type="text" 
                                placeholder={copy.replyTo(comment.author)} 
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                autoFocus
                              />
                              <div className="emoji-quick-select">
                                {EMOJIS.slice(0, 5).map(em => (
                                  <button key={em} type="button" onClick={() => addEmojiToReply(em)}>{em}</button>
                                ))}
                              </div>
                            </div>
                            <button type="submit" className="gg-btn gg-btn--primary gg-btn--sm" disabled={!replyText.trim()}>
                              {copy.reply}
                            </button>
                            <button type="button" className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => setReplyingToId(null)}>
                              {copy.cancel}
                            </button>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={shareData.title}
        subtitle={shareData.subtitle}
        url={shareData.url}
        text={shareData.text}
        game={shareData.game}
        summary={shareData.summary}
        image={shareData.image}
        logo={shareData.logo}
        contacts={shareData.contacts}
        teams={shareData.teams}
        shareKind="post"
      />

      <AnimatePresence>
        {confirmState && (
          <div className="gg-post-confirm-overlay" onClick={() => setConfirmState(null)}>
            <motion.div
              className="gg-post-confirm"
              onClick={event => event.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: .97 }}
              transition={{ duration: .18 }}
              role="alertdialog"
              aria-modal="true"
            >
              <p>{confirmState.message}</p>
              <div className="gg-post-confirm__actions">
                <button type="button" className="ghost" onClick={() => setConfirmState(null)}>{copy.cancel}</button>
                <button
                  type="button"
                  className={confirmState.danger ? 'danger' : 'primary'}
                  onClick={() => { confirmState.onConfirm(); setConfirmState(null) }}
                >
                  {copy.confirmAction}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportOpen && (
          <div className="gg-post-confirm-overlay" onClick={() => setReportOpen(false)}>
            <motion.div
              className="gg-post-confirm gg-post-report"
              onClick={event => event.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: .97 }}
              transition={{ duration: .18 }}
              role="dialog"
              aria-modal="true"
            >
              <h3>{Icon.bell} {copy.reportTitle}</h3>
              <p>{copy.reportHint}</p>
              <textarea
                rows={3}
                value={reportReason}
                onChange={event => setReportReason(event.target.value)}
                placeholder={copy.reportPrompt}
                autoFocus
              />
              <div className="gg-post-confirm__actions">
                <button type="button" className="ghost" onClick={() => setReportOpen(false)}>{copy.cancel}</button>
                <button type="button" className="danger" onClick={submitReport}>{copy.sendReport}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ReportUserModal
        user={authorUser}
        open={reportUserOpen}
        busy={authorRelationship.busy === 'report'}
        context={{ type: 'post', id: getPostId() }}
        onCancel={() => setReportUserOpen(false)}
        onSubmit={submitUserReport}
      />
    </>
  )
}


import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import Tabs from '../../components/Tabs/Tabs.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import RoleIdentityCorner from '../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import PlayerCard, { resolveCardModel } from '../../components/PlayerCard/PlayerCard.jsx'
import ProfileCardShowcase from '../../components/RoleProfileCard/ProfileCardShowcase.jsx'
import GGTeamCard, { teamTierIds } from '../../components/GGTeamCard/GGTeamCard.jsx'
import ProfileBanner from '../../components/ProfileBanner/ProfileBanner.jsx'
import ShareSheet from '../../components/ShareSheet/ShareSheet.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { FRAME_BY_ID, PLATE_BY_ID, resolveFrameId, resolvePlateId } from '../../data/cosmetics.js'
import { displayStatus } from '../../lib/cosmeticUnlocks.js'
import { presenceInfo } from '../../lib/presence.js'
import { PROFILE_BACKGROUNDS } from '../../data/backgrounds.js'
import { getCardTheme } from '../../data/cardThemes.js'
import { getEquippedBannerGift, isBannerGiftUnlocked } from '../../data/bannerGift.js'
import { GAMES, GAME_BY_ID, normalizeGameId } from '../../data/games.js'
import { getAllCommunities, withRemoteCommunity } from '../../data/communities.js'
import { listAllCommunities } from '../../lib/communitiesApi.js'
import { SOCIAL_PLATFORMS } from '../../data/socialPlatforms.js'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import Composer from '../../components/Composer/Composer.jsx'
import PostCard from '../../components/PostCard/PostCard.jsx'
import UserActionsMenu from '../../components/UserActions/UserActionsMenu.jsx'
import './Profile.css'

const GAME_MAP = GAMES.reduce((m, g) => {
  m[g.id] = g.name
  m[g.name] = g.name
  return m
}, {})
const getGameName = game => GAME_MAP[game] || game || '—'
const GAME_ART_BY_KEY = GAMES.reduce((map, game) => {
  map[game.id] = game
  map[game.slug] = game
  map[game.name] = game
  map[String(game.name).toLowerCase()] = game
  return map
}, {})
const getGameArt = game => {
  const raw = String(game || '').trim()
  const normalized = normalizeGameId(raw, '')
  return GAME_ART_BY_KEY[raw] || GAME_ART_BY_KEY[raw.toLowerCase()] || GAME_BY_ID[normalized] || null
}
const COMMUNITY_LOGO_FALLBACKS = {
  valorant: '/demos/steliant-esports/Logo/Valorant.png',
  cs2: '/demos/steliant-esports/Logo/cs2.png',
  lol: '/demos/steliant-esports/Logo/lol.png',
  mlbb: '/demos/steliant-esports/Logo/mlbb.png',
  freefire: '/demos/steliant-esports/Logo/FF.png',
  'free-fire': '/demos/steliant-esports/Logo/FF.png',
  'mobile-legends-bang-bang': '/demos/steliant-esports/Logo/mlbb.png',
  'league-of-legends-wild-rift': '/demos/steliant-esports/Logo/lol.png',
  rocketleague: '/demos/steliant-esports/Logo/RocketLeague.png',
  apex: '/demos/steliant-esports/Logo/Apex_Legends_logo.png',
  dota2: '/demos/steliant-esports/Logo/Dota2.png',
}

function splitProfileGameTags(value) {
  return String(value || '')
    .split(/\s*\/\s*|\s+-\s+|\s+\/\s+|\s*,\s*/)
    .map(tag => tag.trim())
    .filter(Boolean)
}

const PLATFORM_ROLES = {
  admin:     { label: 'Admin',       color: '#f87171' },
  organizer: { label: 'Organizador', color: '#00E676' },
  creator:   { label: 'Creador',     color: '#818cf8' },
  coach:     { label: 'Coach',       color: '#F59E0B' },
  caster:    { label: 'Caster',      color: '#EF4444' },
  analyst:   { label: 'Analista',    color: '#06B6D4' },
  brand:     { label: 'Marca',       color: '#F0A500' },
  sponsor:   { label: 'Sponsor',     color: '#22c55e' },
  player:    { label: 'Jugador',     color: '#8b938e' },
}

const GENDER_LABELS = {
  es: { male: 'Masculino', female: 'Femenino', non_binary: 'No binario', prefer_not_to_say: 'Prefiero no decir', other: 'Otro' },
  en: { male: 'Male', female: 'Female', non_binary: 'Non-binary', prefer_not_to_say: 'Prefer not to say', other: 'Other' },
}

const EXP_LABELS = {
  es: { rookie: 'Novato', mid: 'Intermedio', pro: 'Profesional' },
  en: { rookie: 'Rookie', mid: 'Intermediate', pro: 'Professional' },
}

const PLATFORM_LABELS = {
  pc: 'PC',
  mobile: 'Mobile',
  console: 'Console',
}

const LOOKING_FOR_LABELS = {
  es: { tournaments: 'Torneos', team_duo: 'Equipo / duo', fun: 'Casual' },
  en: { tournaments: 'Tournaments', team_duo: 'Team / duo', fun: 'Casual' },
}

function resolveUploadUrl(value) {
  if (!value) return value
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

const ACH_ICONS = {
  email: Icon.check,
  role: Icon.shield,
  university: Icon.globe,
  twoFactor: Icon.lock,
  profile: Icon.user,
  first_blood: Icon.award,
  active_glitcher: Icon.bolt,
  certified_gamer: Icon.gamepad,
  glitch_legend: Icon.gem,
  competitor: Icon.trophy,
}

function formatDate(value, lang, options = { month: 'long', year: 'numeric' }) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-DO', options)
}

function maskEmail(email = '') {
  if (!email || !email.includes('@')) return '—'
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}•••@${domain}`
}

function sameId(a, b) {
  if (!a || !b) return false
  const av = typeof a === 'object' ? (a._id || a.id) : a
  const bv = typeof b === 'object' ? (b._id || b.id) : b
  return String(av) === String(bv)
}

function getRoleList(user) {
  const roles = new Set(['player'])
  if (user?.role) roles.add(user.role)
  ;(user?.roles || []).forEach(role => roles.add(role))
  return [...roles].filter(Boolean)
}

function getSpecializedIds(user) {
  if (!user?.roleProfiles) return []
  return Object.entries(user.roleProfiles).flatMap(([roleName, profile]) => {
    const code = profile?.[`${roleName}Code`]
    if (!code) return []
    const cfg = PLATFORM_ROLES[roleName] || PLATFORM_ROLES.player
    return [{ roleName, label: cfg.label, color: cfg.color, code, approvedAt: profile?.approvedAt }]
  })
}

function normalizeProfileRole(role) {
  const value = String(role || '').toLowerCase()
  const map = {
    jugador: 'player',
    miembro: 'player',
    lider: 'organizer',
    'líder': 'organizer',
    organizador: 'organizer',
    creador: 'creator',
    analista: 'analyst',
    marca: 'brand',
  }
  return map[value] || value
}

function roleLabel(role, isEs = true) {
  const normalized = normalizeProfileRole(role)
  const labels = {
    player: isEs ? 'Jugador' : 'Player',
    organizer: isEs ? 'Lider / Organizador' : 'Leader / Organizer',
    creator: isEs ? 'Creador' : 'Creator',
    coach: 'Coach',
    analyst: isEs ? 'Analista' : 'Analyst',
    caster: 'Caster',
    manager: 'Manager',
    admin: 'Admin',
    brand: isEs ? 'Marca' : 'Brand',
  }
  return labels[normalized] || role || (isEs ? 'Miembro' : 'Member')
}

function buildTeamRolePreview(team, isEs = true) {
  return (team?.roster || []).map((member, index) => {
    const teamRole = /l.der|lider|leader/i.test(String(member.role || '')) ? (isEs ? 'Lider' : 'Leader') : (isEs ? 'Miembro' : 'Member')
    return {
      ...member,
      previewId: member.id || `member-${index}`,
      roleKey: 'player',
      roleLabel: teamRole,
      isVirtual: false,
    }
  })
}

function profileTeamCard(team, rosterPreview, isEs) {
  const wins = Number(team?.wins || 0)
  const losses = Number(team?.losses || 0)
  const total = wins + losses
  const winrate = total ? Math.round((wins / total) * 100) : 0
  const roster = (rosterPreview || []).map((member, index) => ({
    nick: member.nick || member.name || `${isEs ? 'Jugador' : 'Player'} ${index + 1}`,
    role: member.roleLabel || member.role || (isEs ? 'Miembro' : 'Member'),
    avatar: member.avatar || '/demos/steliant-esports/avatar-default.svg',
  }))

  return {
    name: team?.name || 'Equipo',
    country: team?.country || '',
    gender: team?.gender || '',
    crest: team?.logo || '',
    initials: String(team?.tag || team?.name || 'GG').slice(0, 2).toUpperCase(),
    code: team?.publicCode || team?.tag || '',
    longCode: team?.internalCode || '',
    shortCode: String(team?.tag || team?.name || 'GG').slice(0, 3).toUpperCase(),
    game: getGameName(team?.game),
    region: team?.region || 'Global',
    bio: team?.slogan || `${wins}W - ${losses}L / ${winrate}% WR`,
    tags: [
      { label: `${wins}W - ${losses}L`, on: true },
      `${winrate}% WR`,
      `${team?.rankPts || 1000} XP`,
      team?.university?.isUniversityTeam ? team.university.universityTag : '',
    ].filter(Boolean),
    members: roster.length ? roster.map(row => row.avatar) : [team?.logo || '/demos/steliant-esports/avatar-default.svg'],
    capacity: Math.min(Math.max(roster.length, Number(team?.maxMembers || team?.playerCount) || 5, 5), 7),
    roster,
  }
}


function tournamentImage(tournament, gameObj) {
  return tournament?.banner ||
    tournament?.image ||
    tournament?.cover ||
    tournament?.poster ||
    tournament?.thumbnail ||
    tournament?.imageUrl ||
    gameObj?.images?.horizontal ||
    gameObj?.image ||
    '/demos/steliant-esports/ImaHorizontal/Valo.jpg'
}

export default function Profile() {
  const { user: authUser, updateUser, refreshUser } = useAuth()
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false)
  const { lang } = useLang()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEs = lang === 'es'
  const [tab, setTab] = useState('overview')
  const [myPosts, setMyPosts] = useState([])
  const [savedPosts, setSavedPosts] = useState([])
  // 'loading' | 'ready' | 'pending' (endpoint GET /posts/saved aún no existe en el backend)
  const [savedState, setSavedState] = useState('loading')
  const [shareOpen, setShareOpen] = useState(false)
  // Amigos para el sheet de compartir. authUser.friends solo trae IDs, así que
  // se piden poblados (nick/avatar) al abrirlo -- mismo endpoint que /amigos.
  const [shareFriends, setShareFriends] = useState(null) // null = cargando
  const [sentShareKeys, setSentShareKeys] = useState([])

  const [dbTournaments, setDbTournaments] = useState([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [myTeamData, setMyTeamData] = useState(null)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const profileQuery = String(searchParams.get('user') || '').trim()
  const [publicUser, setPublicUser] = useState(null)
  const [loadingPublicUser, setLoadingPublicUser] = useState(false)
  // null | { status, detail } -- se guarda el motivo real (codigo HTTP y
  // mensaje del servidor) en vez de un texto generico: antes todo fallo
  // salia como "No se pudo cargar ese perfil" y no habia forma de saber si
  // era un 404, un 500 o que el servidor no respondia.
  const [publicUserError, setPublicUserError] = useState(null)
  const [publicUserReload, setPublicUserReload] = useState(0)

  useEffect(() => {
    if (!profileQuery || profileQuery === authUser?.nick || profileQuery === authUser?.playerCode || profileQuery === authUser?.id || profileQuery === authUser?._id) {
      setPublicUser(null)
      setPublicUserError(null)
      return
    }

    setLoadingPublicUser(true)
    setPublicUserError(null)
    api(`/profile/lookup/${encodeURIComponent(profileQuery)}`)
      .then(res => setPublicUser(res.user || null))
      .catch(err => {
        setPublicUser(null)
        setPublicUserError({ status: err.status || 0, detail: err.message || '' })
      })
      .finally(() => setLoadingPublicUser(false))
  }, [profileQuery, authUser?.nick, authUser?.playerCode, authUser?.id, authUser?._id, publicUserReload])

  // Perfil ajeno se decide por la URL desde el primer render: antes era
  // "!publicUser", asi que mientras cargaba el ajeno la pagina se creia la
  // propia y pedia TUS equipos; si esa respuesta llegaba tarde, el perfil de
  // otra persona quedaba mostrando tu equipo.
  const viewingOther = Boolean(profileQuery) && ![authUser?.nick, authUser?.playerCode, authUser?.id, authUser?._id].filter(Boolean).map(String).includes(profileQuery)
  const user = viewingOther ? publicUser : authUser
  const isOwnerProfile = !viewingOther
  const privateLabel = isEs ? 'Privado' : 'Private'
  const privateText = isEs ? 'Esta seccion del perfil esta privada.' : 'This profile section is private.'
  const isPrivateSection = section => !isOwnerProfile && Boolean(user?.privateSections?.[section])

  // Los links de esta caja se armaban a mano concatenando texto crudo
  // (`https://instagram.com/${user.social?.instagram}`), asumiendo que el
  // campo guardado siempre era un handle corto. EditProfile en cambio deja
  // pegar la URL completa (build() de SOCIAL_PLATFORMS ya la detecta y la
  // usa tal cual) -- si alguien guardo su perfil pegando la URL entera, el
  // link quedaba duplicado y roto: https://instagram.com/https://instagram.com/x.
  // Reusar el mismo build() que ya usa organizerSocialLinks (TorneoDetalle)
  // arregla eso y de paso suma las redes que EditProfile ya permite cargar
  // pero esta pagina nunca mostraba (TikTok, Kick, Facebook, Telegram).
  const socialLinks = useMemo(() => (
    SOCIAL_PLATFORMS
      .filter(p => p.id !== 'discord' && p.id !== 'whatsapp')
      .map(p => ({ ...p, url: p.build(user?.social?.[p.id]) }))
      .filter(p => p.url)
  ), [user?.social])

  const viewedUserId = publicUser?._id || publicUser?.id
  const friendStatus = (() => {
    if (isOwnerProfile || !viewedUserId || !authUser) return null
    const idsInclude = (list) => (list || []).some(entry => String(entry?._id || entry) === String(viewedUserId))
    if (idsInclude(authUser.friends)) return 'friends'
    if (idsInclude(authUser.friendRequests?.sent)) return 'sent'
    if (idsInclude(authUser.friendRequests?.received)) return 'received'
    return 'none'
  })()

  const sendFriendRequest = async () => {
    if (!viewedUserId || sendingFriendRequest) return
    setSendingFriendRequest(true)
    try {
      await api(`/profile/me/friends/request/${viewedUserId}`, { method: 'POST' })
      updateUser?.({ friendRequests: { ...authUser.friendRequests, sent: [...(authUser.friendRequests?.sent || []), viewedUserId] } })
      toast(isEs ? 'Solicitud de amistad enviada' : 'Friend request sent', 'success')
    } catch (err) {
      toast(err.message || (isEs ? 'No se pudo enviar la solicitud' : 'Could not send the request'), 'error')
    } finally {
      setSendingFriendRequest(false)
    }
  }

  const respondToFriendRequest = async (action) => {
    if (!viewedUserId || sendingFriendRequest) return
    setSendingFriendRequest(true)
    try {
      await api(`/profile/me/friends/${viewedUserId}`, { method: 'PATCH', body: JSON.stringify({ action }) })
      updateUser?.({
        friendRequests: { ...authUser.friendRequests, received: (authUser.friendRequests?.received || []).filter(entry => String(entry?._id || entry) !== String(viewedUserId)) },
        friends: action === 'accept' ? [...(authUser.friends || []), viewedUserId] : authUser.friends,
      })
      toast(action === 'accept' ? (isEs ? 'Ahora son amigos' : 'You are now friends') : (isEs ? 'Solicitud rechazada' : 'Request declined'), 'success')
    } catch (err) {
      toast(err.message || (isEs ? 'No se pudo procesar la solicitud' : 'Could not process the request'), 'error')
    } finally {
      setSendingFriendRequest(false)
    }
  }

  const cancelFriendRequest = async () => {
    if (!viewedUserId || sendingFriendRequest) return
    setSendingFriendRequest(true)
    try {
      await api(`/profile/me/friends/request/${viewedUserId}`, { method: 'DELETE' })
      updateUser?.({
        friendRequests: { ...authUser.friendRequests, sent: (authUser.friendRequests?.sent || []).filter(entry => String(entry?._id || entry) !== String(viewedUserId)) },
      })
      toast(isEs ? 'Solicitud cancelada' : 'Request canceled', 'success')
    } catch (err) {
      toast(err.message || (isEs ? 'No se pudo cancelar la solicitud' : 'Could not cancel the request'), 'error')
    } finally {
      setSendingFriendRequest(false)
    }
  }

  const unblockViewedUser = async () => {
    if (!viewedUserId || sendingFriendRequest) return
    setSendingFriendRequest(true)
    try {
      await api(`/profile/me/block/${viewedUserId}`, { method: 'DELETE' })
      updateUser?.({ blockedUsers: (authUser.blockedUsers || []).filter(entry => String(entry?._id || entry) !== String(viewedUserId)) })
      setPublicUser(prev => prev ? { ...prev, blockedByMe: false } : prev)
      toast(isEs ? 'Usuario desbloqueado' : 'User unblocked', 'success')
    } catch (err) {
      toast(err.message || (isEs ? 'No se pudo desbloquear' : 'Could not unblock'), 'error')
    } finally {
      setSendingFriendRequest(false)
    }
  }

  const activeBg = user?.activeBg || 'banner-basic-1'
  const activeCardDesign = resolveCardModel(user?.activeCardDesign)
  const activeCardBg = user?.activeCardBg || 'tech-orange'
  const currentFrame = FRAME_BY_ID[resolveFrameId(user?.activeFrame)]
  const currentBg = activeBg === 'custom'
    ? { id: 'custom', image: resolveUploadUrl(user?.activeCustomBg) }
    : (PROFILE_BACKGROUNDS.find(b => b.id === activeBg) || PROFILE_BACKGROUNDS[0])
  const currentCardImageBg = PROFILE_BACKGROUNDS.find(b => b.id === activeCardBg)
  const currentCardTheme = getCardTheme(activeCardBg)
  // Perfil propio: el estado que elegiste. Ajeno: el que eligio si esta
  // conectado; si no (o si se puso Invisible), "Desconectado" -- antes un
  // perfil ajeno mostraba siempre "En linea".
  const otherPresence = isOwnerProfile ? null : presenceInfo(user, lang)
  const currentStatus = isOwnerProfile
    ? displayStatus(user)
    : otherPresence.online
      ? (displayStatus({ ...user, activeStatus: otherPresence.id }) || otherPresence)
      : { id: 'offline', label: otherPresence.label, color: otherPresence.color, desc: '', fx: '' }
  // activeBadge 0 = el jugador quitó la placa en Editar perfil.
  const currentBadge = PLATE_BY_ID[resolvePlateId(user?.activeBadge)] || null
  const giftBanner = isBannerGiftUnlocked() ? getEquippedBannerGift() : null
  const bannerVideo = currentBg?.isVideo ? currentBg.image : null
  const bannerImg = bannerVideo ? null : (currentBg?.image || currentBg?.poster || giftBanner?.src || null)

  const roles = useMemo(() => getRoleList(user), [user])
  const specializedIds = useMemo(() => getSpecializedIds(user), [user])
  const userGames = useMemo(() => [...new Set(user?.games || [])].filter(Boolean), [user])
  // Comunidades reales donde ESTE perfil es miembro (members del backend), no
  // el "unido" de quien mira ni el de localStorage de antes.
  const [remoteCommunities, setRemoteCommunities] = useState([])
  useEffect(() => {
    let cancelled = false
    listAllCommunities()
      .then(list => { if (!cancelled) setRemoteCommunities(list) })
      .catch(() => { if (!cancelled) setRemoteCommunities([]) })
    return () => { cancelled = true }
  }, [])
  const joinedCommunities = useMemo(() => {
    const profileId = String(user?._id || user?.id || '')
    if (!profileId) return []
    const localBySlug = new Map(getAllCommunities().map(c => [c.slug, c]))
    return remoteCommunities
      .filter(remote => (remote.members || []).some(id => String(id?._id || id) === profileId))
      .map(remote => withRemoteCommunity(localBySlug.get(remote.slug) || { genre: remote.game }, remote))
  }, [remoteCommunities, user?._id, user?.id])
  const teamRolePreview = useMemo(() => buildTeamRolePreview(myTeamData, isEs), [myTeamData, isEs])
  const profileGameCards = useMemo(() => {
    const communityByGame = new Map()
    for (const community of joinedCommunities) {
      const normalizedSlug = normalizeGameId(community.slug, '')
      if (normalizedSlug) communityByGame.set(normalizedSlug, community)
      communityByGame.set(community.slug, community)
    }

    const cards = userGames.map(game => {
      const normalizedGame = normalizeGameId(game, game)
      const gameObj = GAME_BY_ID[normalizedGame] || GAME_BY_ID[game]
      const community = communityByGame.get(normalizedGame) || communityByGame.get(game)
      const catalogLogo = gameObj?.images?.logo || null
      return {
        id: `game-${game}`,
        game: normalizedGame,
        originalGame: game,
        gameObj,
        community,
        name: community?.name || getGameName(normalizedGame || game),
        slug: community?.slug || gameObj?.slug || game,
        color: community?.color || gameObj?.color || 'var(--accent)',
        image: community?.poster || gameObj?.images?.horizontal,
        logo: catalogLogo || COMMUNITY_LOGO_FALLBACKS[community?.slug] || COMMUNITY_LOGO_FALLBACKS[normalizedGame] || COMMUNITY_LOGO_FALLBACKS[game],
        category: community?.genre || gameObj?.category,
      }
    })

    return cards
  }, [joinedCommunities, userGames])
  const profileName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'
  const userId = user?.id || user?._id
  const profileCommunities = useMemo(() => {
    if (!userGames.length) return []
    const gameKeys = new Set(userGames.map(game => normalizeGameId(game, game)).filter(Boolean))
    return joinedCommunities.filter(community => (
      gameKeys.has(normalizeGameId(community.slug, community.slug)) ||
      gameKeys.has(normalizeGameId(community.id, community.id))
    ))
  }, [joinedCommunities, userGames])
  const publicPhone = [user?.phoneCountryDial, user?.phoneNumber].filter(Boolean).join(' ').trim()
  const hasPublicContact = Boolean(
    socialLinks.length ||
    user?.social?.discord ||
    user?.discord?.username ||
    user?.social?.contactEmail ||
    user?.social?.whatsapp ||
    user?.social?.city ||
    user?.website ||
    publicPhone
  )

  const TABS = [
    { id: 'overview',     label: isEs ? 'Resumen' : 'Overview' },
    { id: 'posts',        label: isEs ? 'Publicaciones' : 'Posts' },
    ...(isOwnerProfile ? [{ id: 'saved', label: isEs ? 'Guardados' : 'Saved' }] : []),
    { id: 'communities', label: isEs ? 'Comunidades' : 'Communities' },
    { id: 'achievements', label: isEs ? 'Vitrina de Trofeos' : 'Trophy Case' },
    { id: 'teams',        label: isEs ? 'Equipos' : 'Teams' },
    { id: 'tournaments',  label: isEs ? 'Torneos' : 'Tournaments' },
  ]

  useEffect(() => {
    if (!userId && !user?.nick) return
    const query = userId
      ? `authorId=${encodeURIComponent(userId)}`
      : `author=${encodeURIComponent(user.nick)}`
    api(`/posts?${query}`)
      .then(res => setMyPosts(res.posts || []))
      .catch(() => setMyPosts([]))
  }, [userId, user?.nick])

  useEffect(() => {
    if (!isOwnerProfile || !user) return
    setSavedState('loading')
    api('/posts/saved')
      .then(res => { setSavedPosts(res.posts || []); setSavedState('ready') })
      .catch(() => { setSavedPosts([]); setSavedState('pending') })
  }, [isOwnerProfile, user?._id])

  const handleSaveChange = (id, nowSaved) => {
    if (!nowSaved) setSavedPosts(prev => prev.filter(p => (p.id || p._id) !== id))
  }

  useEffect(() => {
    setLoadingTournaments(true)
    api('/tournaments?limit=100')
      .then(({ tournaments: data = [] }) => setDbTournaments(data))
      .catch(() => setDbTournaments([]))
      .finally(() => setLoadingTournaments(false))
  }, [])

  useEffect(() => {
    // El equipo es roster-based (Team.members). Perfil propio: GET /teams/mine
    // ({ teams: [...] }, se muestra el primero). Perfil ajeno: sus equipos
    // reales con GET /teams/of/:id (respeta su privacidad "Equipos").
    // `alive` descarta respuestas de un perfil anterior.
    let alive = true
    setMyTeamData(null)
    const otherId = viewingOther ? (publicUser?._id || publicUser?.id) : null
    if (viewingOther && !otherId) return () => { alive = false }
    setLoadingTeam(true)
    api(viewingOther ? `/teams/of/${encodeURIComponent(otherId)}` : '/teams/mine')
      .then(res => { if (alive) setMyTeamData(res.teams?.[0] || null) })
      .catch(() => { if (alive) setMyTeamData(null) })
      .finally(() => { if (alive) setLoadingTeam(false) })
    return () => { alive = false }
  }, [viewingOther, publicUser?._id, publicUser?.id])

  const registeredTournaments = useMemo(() => {
    const myTeamId = myTeamData?._id || myTeamData?.id
    return dbTournaments.filter(tournament => {
      const registrations = tournament.registrations || []
      return registrations.some(reg => (
        sameId(reg.registeredBy, userId) ||
        sameId(reg.user, userId) ||
        sameId(reg.player, userId) ||
        sameId(reg.team, myTeamId)
      ))
    })
  }, [dbTournaments, userId, myTeamData])

  const availableTournaments = useMemo(() => {
    return dbTournaments
      .filter(tournament => !registeredTournaments.some(item => sameId(item, tournament)))
      .filter(tournament => ['open', 'registration_open', 'registration_closed', 'ongoing'].includes(String(tournament.status || '').toLowerCase()))
  }, [dbTournaments, registeredTournaments])

  const credentials = useMemo(() => {
    const list = [
      // Cuenta & Seguridad
      {
        id: 'email',
        icon: 'email',
        category: isEs ? 'Seguridad' : 'Security',
        name: isEs ? 'Email verificado' : 'Verified email',
        desc: user?.emailVerified
          ? (isEs ? 'La cuenta tiene correo confirmado.' : 'The account email is confirmed.')
          : (isEs ? 'Pendiente de confirmar correo.' : 'Email confirmation pending.'),
        unlocked: Boolean(user?.emailVerified),
        date: user?.emailVerified ? formatDate(user?.updatedAt || user?.createdAt, lang) : '—',
      },
      {
        id: 'twoFactor',
        icon: 'twoFactor',
        category: isEs ? 'Seguridad' : 'Security',
        name: '2FA Habilitado',
        desc: user?.twoFactorEnabled
          ? (isEs ? 'Autenticación de dos factores activa.' : 'Two-factor authentication enabled.')
          : (isEs ? 'Seguridad adicional no activada.' : 'Additional security is not enabled.'),
        unlocked: Boolean(user?.twoFactorEnabled),
        date: user?.twoFactorEnabled ? (isEs ? 'Activo' : 'Active') : '—',
      },
      {
        id: 'university',
        icon: 'university',
        category: isEs ? 'Acreditación' : 'Accreditation',
        name: isEs ? 'Universidad verificada' : 'Verified university',
        desc: user?.university?.verified
          ? (user.university.universityName || (isEs ? 'Afiliación universitaria verificada.' : 'University affiliation verified.'))
          : (isEs ? 'Sin universidad verificada.' : 'No verified university.'),
        unlocked: Boolean(user?.university?.verified),
        date: user?.university?.verifiedAt ? formatDate(user.university.verifiedAt, lang) : '—',
      },
      {
        id: 'role',
        icon: 'role',
        category: isEs ? 'Acreditación' : 'Accreditation',
        name: isEs ? 'Rol especializado' : 'Specialized role',
        desc: specializedIds.length
          ? (isEs ? `${specializedIds.length} ID especializado asignado.` : `${specializedIds.length} specialized ID assigned.`)
          : (isEs ? 'Sin rol especializado aprobado.' : 'No approved specialized role.'),
        unlocked: specializedIds.length > 0,
        date: specializedIds[0]?.approvedAt ? formatDate(specializedIds[0].approvedAt, lang) : '—',
      },
      // Logros Competitivos
      {
        id: 'first_blood',
        icon: 'first_blood',
        category: isEs ? 'Competitivo' : 'Competitive',
        name: isEs ? 'Primera Sangre' : 'First Blood',
        desc: isEs ? 'Completa tu biografía, juego principal y otros juegos.' : 'Complete your bio, main game and other games.',
        unlocked: Boolean(user?.bio && userGames.length && user?.gamerProfile?.mainGame),
        date: user?.updatedAt ? formatDate(user.updatedAt, lang) : '—',
      },
      {
        id: 'active_glitcher',
        icon: 'active_glitcher',
        category: isEs ? 'Social' : 'Social',
        name: isEs ? 'Glitcher Activo' : 'Active Glitcher',
        desc: isEs ? 'Publica tu primer post en la comunidad.' : 'Publish your first post in the community.',
        unlocked: myPosts.length > 0,
        date: myPosts.length > 0 ? (isEs ? 'Desbloqueado' : 'Unlocked') : '—',
      },
      {
        id: 'certified_gamer',
        icon: 'certified_gamer',
        category: isEs ? 'Competitivo' : 'Competitive',
        name: isEs ? 'Gamer Certificado' : 'Certified Gamer',
        desc: isEs ? 'Registra 2 o más videojuegos en tu perfil.' : 'Register 2 or more video games in your profile.',
        unlocked: userGames.length >= 2,
        date: userGames.length >= 2 ? (isEs ? 'Desbloqueado' : 'Unlocked') : '—',
      },
      {
        id: 'glitch_legend',
        icon: 'glitch_legend',
        category: isEs ? 'Economía' : 'Economy',
        name: isEs ? 'Leyenda Glitch' : 'Glitch Legend',
        desc: isEs ? 'Consigue más de 2,000 GP en la plataforma.' : 'Get more than 2,000 GP on the platform.',
        unlocked: Number(user?.gp || 0) >= 2000,
        date: Number(user?.gp || 0) >= 2000 ? (isEs ? 'Desbloqueado' : 'Unlocked') : '—',
      },
      {
        id: 'competitor',
        icon: 'competitor',
        category: isEs ? 'Competitivo' : 'Competitive',
        name: isEs ? 'Competidor' : 'Competitor',
        desc: isEs ? 'Inscríbete en al menos 1 torneo de la plataforma.' : 'Register in at least 1 tournament on the platform.',
        unlocked: registeredTournaments.length > 0,
        date: registeredTournaments.length > 0 ? (isEs ? 'Desbloqueado' : 'Unlocked') : '—',
      },
    ]
    return list
  }, [isEs, lang, specializedIds, user, userGames, myPosts.length, registeredTournaments.length])

  const verifiedCredentialCount = credentials.filter(item => item.unlocked).length
  const issuedDate = formatDate(user?.createdAt, lang)
  const playerCardBackground = activeCardBg === 'custom' && user?.activeCardCustomBg
    ? { image: resolveUploadUrl(user.activeCardCustomBg), collection: 'Personalizado' }
    : currentCardImageBg
      ? {
          image: currentCardImageBg.image,
          poster: currentCardImageBg.poster,
          isVideo: currentCardImageBg.isVideo,
          collection: currentCardImageBg.collection || currentCardImageBg.name,
        }
      : {
          gradient: `linear-gradient(145deg, ${currentCardTheme.dark}, color-mix(in srgb, ${currentCardTheme.accent} 34%, ${currentCardTheme.dark}) 58%, ${currentCardTheme.dark})`,
          collection: currentCardTheme.name,
        }
  const playerCardData = {
    nick: user?.nick || 'Jugador',
    avatar: resolveUploadUrl(user?.avatar),
    role: normalizeProfileRole(user?.role || 'player'),
    roles: roles.map(role => roleLabel(role, isEs)),
    tags: [...roles.map(role => roleLabel(role, isEs)), user?.plan || 'Free'],
    bio: user?.bio,
    platform: PLATFORM_LABELS[user?.mainPlatform] || '—',
    region: user?.countryCode || '—',
    team: myTeamData ? `${myTeamData.name}${myTeamData.tag ? ` [${myTeamData.tag}]` : ''}` : '—',
    gamer: {
      rank: user?.gamerProfile?.rank,
      mainRole: user?.gamerProfile?.mainRole,
      game: getGameName(user?.gamerProfile?.mainGame || userGames[0]),
      secondGame: getGameName(user?.gamerProfile?.secondGame),
      sensitivity: user?.gamerProfile?.sensitivity,
      dpi: user?.gamerProfile?.dpi,
    },
    legalName: profileName,
    sex: (GENDER_LABELS[lang] || GENDER_LABELS.es)[user?.gender] || '—',
    birth: formatDate(user?.birthDate, lang, { day: 'numeric', month: 'long', year: 'numeric' }),
    level: (EXP_LABELS[lang] || EXP_LABELS.es)[user?.experienceLevel] || '—',
    email: maskEmail(user?.email),
    code: user?.playerCode || '—',
    internalLabel: isEs ? 'ID interno admin' : 'Admin internal ID',
    internalId: user?.role === 'admin' ? user?.internalCode : '',
    specialIds: specializedIds.map(item => ({ label: item.label, value: item.code })),
    security: user?.twoFactorEnabled ? '2FA' : '—',
    joined: issuedDate,
    uid: userId,
  }

  const handleViewTeam = () => {
    if (myTeamData?._id || myTeamData?.id) {
      navigate(`/equipos/${myTeamData._id || myTeamData.id}`)
    } else if (myTeamData?.name) {
      navigate(`/equipos`)
    }
  }

  // No existe "seguir equipo" en el backend: antes cambiaba un estado local y
  // decía "Ahora sigues el equipo" sin guardar nada.
  const handleFollowTeam = () => {
    toast(isEs ? 'Seguir equipos se habilitará en la próxima versión.' : 'Following teams will be enabled in the next version.', 'info')
  }

  const handleLeaveTeam = async () => {
    if (!window.confirm(isEs ? '¿Salir del equipo?' : 'Leave team?')) return
    try {
      // teamId: sin él el backend sale del primer equipo de la persona.
      await api('/teams/leave', { method: 'POST', body: { teamId: String(myTeamData?._id || myTeamData?.id || '') } })
      setMyTeamData(null)
      await refreshUser()
      toast(isEs ? 'Saliste del equipo' : 'Left team', 'success')
    } catch (err) {
      toast(isEs ? 'No se pudo salir del equipo' : 'Could not leave team', 'error')
    }
  }

  const isInTeam = useMemo(() => {
    if (!myTeamData || !authUser) return false
    const rosterIds = (myTeamData.roster || []).map(m => String(m.id || m._id || m.user || ''))
    const memberIds = (myTeamData.members || []).map(m => String(m.id || m._id || m.user || ''))
    const allIds = [...new Set([...rosterIds, ...memberIds])]
    return allIds.includes(String(authUser.id || authUser._id || ''))
  }, [myTeamData, authUser])

  const handleDeletePost = id => {
    setMyPosts(prev => prev.filter(p => (p.id || p._id) !== id))
  }

  const authUserId = authUser?._id || authUser?.id
  useEffect(() => {
    if (!shareOpen || !authUserId) return
    let alive = true
    setShareFriends(null)
    setSentShareKeys([])
    api(`/profile/${authUserId}`)
      .then(({ user: me }) => { if (alive) setShareFriends((me?.friends || []).filter(f => f && typeof f === 'object' && f.nick)) })
      .catch(() => { if (alive) setShareFriends([]) })
    return () => { alive = false }
  }, [shareOpen, authUserId])

  // Perfil ajeno que todavia no llego: nunca pintar el propio en su lugar.
  if (loadingPublicUser || (viewingOther && !publicUser && !publicUserError)) {
    return (
      <div className="gg-page gp-page">
        <div className="gp-feed__empty">
          <p>{isEs ? 'Cargando perfil publico...' : 'Loading public profile...'}</p>
        </div>
      </div>
    )
  }

  if (profileQuery && publicUserError) {
    const { status, detail } = publicUserError
    const who = `@${profileQuery}`
    const view = status === 403
      ? { icon: Icon.lock, title: isEs ? 'Este perfil es privado' : 'This profile is private', text: isEs ? `${who} decidió no mostrar su perfil públicamente.` : `${who} chose not to show their profile publicly.`, retry: false }
      : status === 404
        ? { icon: Icon.search, title: isEs ? 'No encontramos a este jugador' : 'We could not find this player', text: isEs ? `No hay ningún jugador con el nick o ID ${who}. Puede que haya cambiado su nick o eliminado su cuenta.` : `There is no player with the nick or ID ${who}. They may have changed their nick or deleted their account.`, retry: false }
        : !status
          ? { icon: Icon.alert, title: isEs ? 'No hay conexión con el servidor' : 'No connection to the server', text: isEs ? `No pudimos contactar con GlitchGang para abrir el perfil de ${who}. Revisa tu internet y vuelve a intentarlo.` : `We could not reach GlitchGang to open ${who}'s profile. Check your internet and try again.`, retry: true }
          : { icon: Icon.alert, title: isEs ? 'El servidor no pudo cargar este perfil' : 'The server could not load this profile', text: isEs ? `Hubo un error en el servidor al abrir el perfil de ${who}. No es un problema tuyo; vuelve a intentarlo en un momento.` : `The server hit an error opening ${who}'s profile. It's not on your side; try again in a moment.`, retry: true }
    return (
      <div className="gg-page gp-page">
        <div className="gp-feed__empty gp-load-error" role="alert">
          <span className="gp-load-error__icon" aria-hidden="true">{view.icon}</span>
          <h3>{view.title}</h3>
          <p>{view.text}</p>
          {status !== 403 && status !== 404 && (
            <code className="gp-load-error__detail" data-no-translate>
              {status ? `HTTP ${status}` : (isEs ? 'Sin respuesta' : 'No response')}{detail ? ` · ${detail}` : ''}
            </code>
          )}
          <div className="gp-load-error__actions">
            {view.retry && (
              <button className="gp-edit-btn" onClick={() => setPublicUserReload(n => n + 1)}>
                {Icon.refresh}
                <span>{isEs ? 'Reintentar' : 'Try again'}</span>
              </button>
            )}
            <button className="gp-edit-btn" onClick={() => navigate('/perfil')}>
              {Icon.chevronRight}
              <span>{isEs ? 'Volver a mi perfil' : 'Back to my profile'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (publicUser?.blockedByMe) {
    return (
      <div className="gg-page gp-page">
        <div className="gp-feed__empty">
          <p>{isEs ? 'Bloqueaste a este usuario.' : 'You blocked this user.'}</p>
          <button className="gp-edit-btn" type="button" disabled={sendingFriendRequest} onClick={unblockViewedUser}>
            {Icon.shield}
            <span>{isEs ? 'Desbloquear' : 'Unblock'}</span>
          </button>
        </div>
      </div>
    )
  }

  const handleBlockPost = (id, blockAuthor) => {
    if (blockAuthor) {
      const blockedPost = myPosts.find(p => (p.id || p._id) === id)
      if (blockedPost) {
        setMyPosts(prev => prev.filter(p => p.author !== blockedPost.author))
      }
    } else {
      setMyPosts(prev => prev.filter(p => (p.id || p._id) !== id))
    }
  }

  const profileShareId = user?.nick || user?.playerCode || user?.id || user?._id || ''
  const profileShareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/perfil${profileShareId ? `?user=${encodeURIComponent(profileShareId)}` : ''}`
    : ''
  const sentLabel = isEs ? 'Enviado ✓' : 'Sent ✓'
  const friendItems = (shareFriends || []).map(friend => {
    const key = `friend:${friend._id || friend.id}`
    return {
      key,
      kind: 'friend',
      id: String(friend._id || friend.id),
      name: friend.nick,
      meta: sentShareKeys.includes(key) ? sentLabel : (isEs ? 'Mensaje directo' : 'Direct message'),
      avatar: resolveUploadUrl(friend.avatar) || '/demos/steliant-esports/avatar-default.svg',
    }
  })
  const teamKey = myTeamData ? `team:${myTeamData._id || myTeamData.id || myTeamData.publicCode}` : ''
  const shareTabs = [
    {
      label: isEs ? 'Amigos' : 'Friends',
      icon: 'users',
      count: friendItems.length,
      items: friendItems,
    },
    {
      label: isEs ? 'Equipos' : 'Teams',
      icon: 'team',
      count: myTeamData ? 1 : 0,
      items: myTeamData ? [{
        key: teamKey,
        kind: 'team',
        id: String(myTeamData._id || myTeamData.id || myTeamData.publicCode || ''),
        name: myTeamData.name,
        meta: sentShareKeys.includes(teamKey) ? sentLabel : (myTeamData.tag || 'Equipo'),
        avatar: resolveUploadUrl(myTeamData.logo) || '/demos/steliant-esports/avatar-default.svg',
      }] : [],
    },
  ]

  // Envío real: crea/usa la conversación y deja el perfil como tarjeta en Mensajes.
  const sendProfileShare = async dest => {
    if (!dest?.key || sentShareKeys.includes(dest.key)) return
    setSentShareKeys(keys => [...keys, dest.key])
    try {
      await api('/messages/share', {
        method: 'POST',
        body: {
          destinations: [{ kind: dest.kind, id: dest.id, name: dest.name, avatar: dest.avatar }],
          payload: {
            url: profileShareUrl,
            title: user?.nick || 'GlitchGang',
            message: `${isEs ? 'Mira este perfil en GlitchGang' : 'Check out this GlitchGang profile'}: ${profileShareUrl}`,
            summary: getGameName(user?.gamerProfile?.mainGame || userGames[0]),
            image: resolveUploadUrl(user?.avatar) || '',
          },
          shareKind: 'share',
        },
      })
      toast(`${isEs ? 'Enviado a' : 'Sent to'} ${dest.name}`, 'success')
    } catch {
      setSentShareKeys(keys => keys.filter(k => k !== dest.key))
      toast(isEs ? `No se pudo enviar a ${dest.name}` : `Could not send to ${dest.name}`, 'error')
    }
  }

  const copyProfileUrl = () => {
    toast(isEs ? 'Enlace de perfil copiado' : 'Profile link copied', 'success')
  }

  const shareProfile = async () => {
    const payload = {
      title: user?.nick || 'GlitchGang',
      text: isEs ? 'Mira este perfil en GlitchGang' : 'View this GlitchGang profile',
      url: profileShareUrl,
    }
    if (navigator.share) {
      try {
        await navigator.share(payload)
        return
      } catch {}
    }
    if (navigator.clipboard) await navigator.clipboard.writeText(profileShareUrl).catch(() => {})
    copyProfileUrl()
  }

  return (
    <div className="gp">
      <div className="gp-profile-banner-shell">
        <ProfileBanner
          eyebrow={isOwnerProfile ? (isEs ? 'Mi perfil' : 'My profile') : (isEs ? 'Perfil publico' : 'Public profile')}
          name={user?.nick || 'Jugador'}
          game={getGameName(user?.gamerProfile?.mainGame || userGames[0])}
          cover={bannerImg}
          code={`PLAYER ID // ${user?.playerCode || '-'}`}
          rail="Steliant Esports"
          status={currentStatus?.label || 'Live'}
          accent="var(--accent)"
          stats={[
            { label: isEs ? 'Juegos' : 'Games', value: isPrivateSection('games') ? privateLabel : userGames.length },
            { label: isEs ? 'Roles' : 'Roles', value: roles.length },
            { label: 'GP', value: isPrivateSection('stats') ? privateLabel : Number(user?.gp || 0).toLocaleString() },
          ]}
          editLabel={isEs ? 'Editar perfil' : 'Edit profile'}
          onEdit={isOwnerProfile ? () => navigate('/editar-perfil') : null}
        />
        <RoleIdentityCorner role={user?.role} profile={user} isOwner={isOwnerProfile} />
      </div>

      <div className="gp-profile-actions">
        <button className="gp-edit-btn" type="button" onClick={() => setShareOpen(true)}>
          {Icon.send}
          <span>{isEs ? 'Compartir perfil' : 'Share profile'}</span>
        </button>
        {!isOwnerProfile && friendStatus === 'none' && (
          <button className="gp-edit-btn" onClick={sendFriendRequest} disabled={sendingFriendRequest}>
            {Icon.friends}
            <span>{isEs ? 'Agregar amigo' : 'Add friend'}</span>
          </button>
        )}
        {!isOwnerProfile && friendStatus === 'sent' && (
          <button className="gp-edit-btn" onClick={cancelFriendRequest} disabled={sendingFriendRequest}>
            {Icon.x}
            <span>{isEs ? 'Cancelar solicitud' : 'Cancel request'}</span>
          </button>
        )}
        {!isOwnerProfile && friendStatus === 'received' && (
          <button className="gp-edit-btn" onClick={() => respondToFriendRequest('accept')} disabled={sendingFriendRequest}>
            {Icon.check}
            <span>{isEs ? 'Aceptar solicitud' : 'Accept request'}</span>
          </button>
        )}
        {!isOwnerProfile && friendStatus === 'friends' && (
          <button className="gp-edit-btn" disabled>
            {Icon.check}
            <span>{isEs ? 'Ya son amigos' : 'Already friends'}</span>
          </button>
        )}
        {!isOwnerProfile && user && (
          <UserActionsMenu user={{ _id: viewedUserId, nick: user.nick, avatar: user.avatar }} context={{ type: 'profile', id: viewedUserId }} />
        )}
      </div>

      <AnimatePresence>
        {shareOpen && (
          <div className="gp-share-overlay" onClick={() => setShareOpen(false)}>
            <motion.div
              className="gp-share-overlay__sheet"
              onClick={event => event.stopPropagation()}
              initial={{ opacity: 0, y: 18, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: .96 }}
              transition={{ duration: .18 }}
            >
              <ShareSheet
                kicker={isEs ? 'Compartir' : 'Share'}
                title={isEs ? `Compartir perfil de ${user?.nick || 'Jugador'}` : `Share ${user?.nick || 'Player'} profile`}
                subtitle={isEs ? 'Comparte este perfil con amigos, chats y equipos.' : 'Share this profile with friends, chats and teams.'}
                post={{
                  brand: 'GlitchGang',
                  title: user?.nick || 'Jugador',
                  line: `${getGameName(user?.gamerProfile?.mainGame || userGames[0])} - ${user?.playerCode || 'PLAYER'}`,
                  thumb: resolveUploadUrl(user?.avatar),
                }}
                url={profileShareUrl}
                tabs={shareTabs}
                linkLabel={isEs ? 'Compartir el enlace' : 'Share the link'}
                sendLabel={isEs ? 'Enviar dentro de GlitchGang' : 'Send inside GlitchGang'}
                fullLabel={isEs ? 'Compartir mensaje completo' : 'Share full message'}
                emptyText={shareFriends === null
                  ? (isEs ? 'Cargando tus amigos…' : 'Loading your friends…')
                  : (isEs ? 'No hay destinos en esta categoría. Prueba otra pestaña o copia el enlace.' : 'No destinations in this category yet. Try another tab or copy the link.')}
                accent="var(--accent)"
                onClose={() => setShareOpen(false)}
                onCopy={copyProfileUrl}
                onShare={shareProfile}
                onSend={sendProfileShare}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Antes había un segundo header ("Mi Perfil" + editar) y un tercer
          banner (glitch/corners/ticks) que repetían la misma info que ya
          muestra ProfileBanner de arriba -- se sacaron los dos, se quedó
          solo el más completo (tiene ecualizador animado, marco con
          esquinas cortadas y ya trae su propio botón de editar). */}

      <div className="gp-layout">
        <aside className="gp-sidebar">
          {/* Cédula 3D: la de jugador y/o la tarjeta profesional de cada rol
              (ver ProfileCardShowcase) */}
          <ProfileCardShowcase
            user={user}
            isOwner={isOwnerProfile}
            updateUser={updateUser}
            playerCard={(
              <PlayerCard
                model={activeCardDesign}
                frame={currentFrame}
                badge={currentBadge}
                status={currentStatus}
                background={playerCardBackground}
                player={playerCardData}
                width={300}
              />
            )}
          />

          {/* Antes había una segunda cédula acá (flip 3D con "STELIANT ESPORTS ID")
              que repetía lo mismo que ya muestra <PlayerCard> de arriba, y
              encima se veía rota (las dos caras del flip quedaban visibles
              al mismo tiempo, superpuestas). PlayerCard es el componente
              real (se reusa también en Editar Perfil), así que se sacó el
              duplicado en vez de arreglarlo. */}

          {/* Caja de Redes Sociales */}
          {(hasPublicContact || isPrivateSection('social')) && (
            <div className="gp-bio-box gp-social-box">
              <h4>{isEs ? 'Conectividad & Redes' : 'Connectivity & Social'}</h4>
              {isPrivateSection('social') ? (
                <div className="gp-private-note">{Icon.lock}<b>{privateLabel}</b><span>{privateText}</span></div>
              ) : (
                <>
                  <div className="gp-social-links">
                    {socialLinks.map(p => (
                      <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className={`gp-social-link ${p.id}`} title={p.label}>
                        {Icon[p.icon] || Icon.globe}
                      </a>
                    ))}
                    {(user.discord?.username || user.social?.discord) && (
                      <div
                        className="gp-social-link discord"
                        title={user.discord?.username
                          ? `Discord vinculado: ${user.discord.username}`
                          : `Discord: ${user.social?.discord}`}
                        onClick={() => {
                          const value = user.discord?.username || user.social?.discord
                          navigator.clipboard.writeText(value)
                          toast(isEs ? 'Usuario de Discord copiado' : 'Discord username copied', 'success')
                        }}
                      >
                        {Icon.discord}
                      </div>
                    )}
                  </div>
                  <div className="gp-contact-list">
                    {user?.social?.contactEmail && (
                      <a href={"mailto:demo@steliant.example"} className="gp-contact-row">
                        <span>{Icon.mail}</span>
                        <b>{user.social?.contactEmail}</b>
                      </a>
                    )}
                    {publicPhone && (
                      <a href={`tel:${publicPhone.replace(/\s+/g, '')}`} className="gp-contact-row">
                        <span>{Icon.phone}</span>
                        <b>{publicPhone}</b>
                      </a>
                    )}
                    {user?.social?.whatsapp && (
                      <a href={`https://wa.me/${String(user.social?.whatsapp).replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="gp-contact-row">
                        <span>{Icon.whatsapp}</span>
                        <b>{user.social?.whatsapp}</b>
                      </a>
                    )}
                    {user?.social?.city && (
                      <div className="gp-contact-row">
                        <span>{Icon.globe}</span>
                        <b>{user.social?.city}</b>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Caja de Acerca de */}
          <div className="gp-bio-box">
            <h4>{isEs ? 'Acerca de' : 'About'}</h4>
            {isPrivateSection('personal') ? (
              <div className="gp-private-note">{Icon.lock}<b>{privateLabel}</b><span>{privateText}</span></div>
            ) : (
              <p {...(user?.bio ? { 'data-no-translate': true } : {})}>{user?.bio || (isEs ? 'Sin biografia publicada.' : 'No public bio yet.')}</p>
            )}
            <div className="gp-bio-meta">
              <span>{Icon.gamepad} {getGameName(user?.gamerProfile?.mainGame || userGames[0])}</span>
              <span>{Icon.calendar} {issuedDate}</span>
              {user?.university?.verified && <span>{Icon.globe} {user.university.universityTag || user.university.universityName}</span>}
              {user?.website && <span>{Icon.globe} <a href={user.website.startsWith('http') ? user.website : `https://${user.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{user.website.replace(/^https?:\/\//, '')}</a></span>}
            </div>
          </div>
        </aside>

        <main className="gp-main">
          {/* Stats Bar */}
          <div className="gp-stats">
            <div className="gp-stat">
              <span className="gp-stat__icon">{Icon.gamepad}</span>
              <div><b>{isPrivateSection('games') ? privateLabel : userGames.length}</b><span>{isEs ? 'Juegos' : 'Games'}</span></div>
            </div>
            <div className="gp-stat">
              <span className="gp-stat__icon">{Icon.shield}</span>
              <div><b>{roles.length}</b><span>{isEs ? 'Roles' : 'Roles'}</span></div>
            </div>
            <div className="gp-stat">
              <span className="gp-stat__icon">{Icon.trophy}</span>
              <div><b>{isPrivateSection('tournaments') ? privateLabel : registeredTournaments.length}</b><span>{isEs ? 'Torneos' : 'Tournaments'}</span></div>
            </div>
            <div className="gp-stat">
              <span className="gp-stat__icon">{Icon.trend}</span>
              <div><b>{isPrivateSection('stats') ? privateLabel : Number(user?.gp || 0).toLocaleString()}</b><span>GP</span></div>
            </div>
          </div>

          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          <div className="gp-content">
            <AnimatePresence mode="wait">
              {tab === 'overview' && (
                <motion.div key="ov" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .18 }}>
                  {/* Perfil Competitivo */}
                  <section className="gp-section">
                    <h3 className="gp-section__title"><span className="gp-section__icon">{Icon.shield}</span>{isEs ? 'Ficha de Jugador' : 'Gamer Plate'}</h3>
                    {isPrivateSection('games') ? (
                      <div className="gp-empty gp-private-empty">{Icon.lock}<b>{privateLabel}</b><span>{privateText}</span></div>
                    ) : (
                    <div className="gp-gamer-stats-grid">
                      <div className="gp-gamer-stat-card">
                        <span>{isEs ? 'Juego principal' : 'Main game'}</span>
                        <b>{getGameName(user?.gamerProfile?.mainGame)}</b>
                        <small>{user?.gamerProfile?.mainRole || '—'}</small>
                      </div>
                      <div className="gp-gamer-stat-card">
                        <span>{isEs ? 'Juego secundario' : 'Secondary game'}</span>
                        <b>{getGameName(user?.gamerProfile?.secondGame)}</b>
                        <small>Competidor</small>
                      </div>
                      <div className="gp-gamer-stat-card">
                        <span>{isEs ? 'Rango Competitivo' : 'Competitive Rank'}</span>
                        <b>{user?.gamerProfile?.rank || '—'}</b>
                        <small>{isEs ? 'Rango Declarado' : 'Declared Rank'}</small>
                      </div>
                      <div className="gp-gamer-stat-card">
                        <span>{isEs ? 'Sensibilidad / DPI' : 'Sensitivity / DPI'}</span>
                        <b>{user?.gamerProfile?.sensitivity ? `${user.gamerProfile.sensitivity} Sens` : '—'}</b>
                        <small>{user?.gamerProfile?.dpi ? `${user.gamerProfile.dpi} DPI` : '—'}</small>
                      </div>
                      <div className="gp-gamer-stat-card">
                        <span>{isEs ? 'Personajes / agentes' : 'Characters / agents'}</span>
                        <b>{Array.isArray(user?.gamerProfile?.mainCharacters) && user.gamerProfile.mainCharacters.length ? user.gamerProfile.mainCharacters.slice(0, 2).join(', ') : '—'}</b>
                        <small>{Array.isArray(user?.gamerProfile?.mainCharacters) && user.gamerProfile.mainCharacters.length > 2 ? `+${user.gamerProfile.mainCharacters.length - 2}` : (isEs ? 'Del jugador' : 'Player owned')}</small>
                      </div>
                    </div>
                    )}
                  </section>

                  {/* Showcase de Juegos */}
                  <section className="gp-section">
                    <h3 className="gp-section__title"><span className="gp-section__icon">{Icon.gamepad}</span>{isEs ? 'Mis Juegos' : 'My Games'}</h3>
                    {isPrivateSection('games') ? (
                      <div className="gp-empty gp-private-empty">{Icon.lock}<b>{privateLabel}</b><span>{privateText}</span></div>
                    ) : profileGameCards.length === 0 ? (
                      <div className="gp-empty">{isEs ? 'No hay juegos registrados en este perfil.' : 'No games registered on this profile.'}</div>
                    ) : (
                      <div className="gp-showcase-games-grid">
                        {profileGameCards.map(card => {
                          const mainGame = normalizeGameId(user?.gamerProfile?.mainGame, user?.gamerProfile?.mainGame)
                          const secondGame = normalizeGameId(user?.gamerProfile?.secondGame, user?.gamerProfile?.secondGame)
                          const isMain = mainGame === card.game || user?.gamerProfile?.mainGame === card.originalGame
                          const isSecond = secondGame === card.game || user?.gamerProfile?.secondGame === card.originalGame
                          const cardTags = splitProfileGameTags(card.category || (isEs ? 'Videojuego' : 'Game'))
                          
                          return (
                            <Link
                              to={`/comunidad/${card.slug}`}
                              className="gp-showcase-game-card"
                              key={card.id}
                              style={{
                                '--game-accent': card.color,
                                backgroundImage: card.image ? `linear-gradient(180deg, rgba(12,15,28,0.2) 0%, rgba(12,15,28,0.95) 100%), url(${card.image})` : 'none',
                                textDecoration: 'none'
                              }}
                            >
                              <div className="gp-showcase-game-card__logo">
                                {card.logo ? (
                                  <img src={card.logo} alt="" />
                                ) : (
                                  <span>{Icon.gamepad}</span>
                                )}
                              </div>
                              <div className="gp-showcase-game-card__body">
                                <h4>{card.name}</h4>
                                <div className="gp-showcase-game-card__badges">
                                  {isMain && <span className="gp-showcase-game-card__badge main">{isEs ? 'Principal' : 'Main'}</span>}
                                  {isSecond && <span className="gp-showcase-game-card__badge second">{isEs ? 'Secundario' : 'Secondary'}</span>}
                                  {card.community && <span className="gp-showcase-game-card__badge second">{isEs ? 'Miembro' : 'Member'}</span>}
                                  {cardTags.map(tag => (
                                    <span className="gp-showcase-game-card__category" key={`${card.id}-${tag}`}>{tag}</span>
                                  ))}
                                </div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {/* Mi Equipo / LFG */}
                  <section className="gp-section">
                    <h3 className="gp-section__title"><span className="gp-section__icon">{Icon.users}</span>{isEs ? 'Club & Equipo' : 'Club & Team'}</h3>
                    {isPrivateSection('teams') ? (
                      <div className="gp-empty gp-private-empty">{Icon.lock}<b>{privateLabel}</b><span>{privateText}</span></div>
                    ) : myTeamData ? (
                      <GGTeamCard
                        team={profileTeamCard(myTeamData, teamRolePreview, isEs)}
                        tiers={teamTierIds(myTeamData)}
                        layout="row"
                        defaultOpen
                        hideJoin
                        width={860}
                        viewLabel={isEs ? 'Ver equipo' : 'View team'}
                        onView={handleViewTeam}
                        actions={[
                          {
                            key: 'view',
                            label: isEs ? 'Ver equipo' : 'View team',
                            primary: true,
                            onClick: handleViewTeam,
                          },
                          isOwnerProfile ? {
                            key: 'leave',
                            label: isEs ? 'Salir' : 'Leave',
                            onClick: handleLeaveTeam,
                          } : {
                            key: 'follow',
                            label: isEs ? 'Seguir equipo' : 'Follow team',
                            onClick: handleFollowTeam,
                          },
                        ]}
                      />
                    ) : (
                      <div className="gp-lfg-card">
                        <div className="gp-lfg-card__content">
                          <div className="gp-lfg-card__icon">{Icon.search}</div>
                          <div className="gp-lfg-card__text">
                            <h4>{isEs ? 'Buscando Equipo (LFG)' : 'Looking for Group (LFG)'}</h4>
                            <p>{isEs ? 'Este jugador está disponible para unirse a escuadras competitivas.' : 'This player is available to join competitive rosters.'}</p>
                            <div className="gp-lfg-card__preferences">
                              {(user?.lookingFor || []).map(v => (
                                <span key={v} className="gp-lfg-preference-tag">
                                  {Icon.check} {(LOOKING_FOR_LABELS[lang] || LOOKING_FOR_LABELS.es)[v] || v}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </motion.div>
              )}

              {tab === 'posts' && (
                <motion.div key="posts" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .18 }}>
                  {user && isOwnerProfile && (
                    <Composer 
                      onSubmit={(newPost) => setMyPosts(prev => [newPost, ...prev])} 
                      userRole={user.role} 
                      userAvatar={user.avatar}
                      userNick={user.nick}
                      userStatus={user.activeStatus}
                      allowedTypes={['post', 'poll', 'share_tournament', 'share_team']}
                      forceShareOnly={true}
                    />
                  )}

                  <div className="gp-feed" style={{ marginTop: '16px' }}>
                    {myPosts.length === 0 ? (
                      <div className="gp-feed__empty"><p>{isEs ? 'Aún no hay publicaciones en este perfil.' : 'There are no posts on this profile yet.'}</p></div>
                    ) : myPosts.map(post => (
                      <PostCard
                        key={post.id || post._id}
                        post={post}
                        onDelete={handleDeletePost}
                        onBlock={handleBlockPost}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'saved' && isOwnerProfile && (
                <motion.div key="saved" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .18 }}>
                  <div className="gp-feed" style={{ marginTop: '16px' }}>
                    {savedState === 'loading' ? (
                      <div className="gp-feed__empty"><p>{isEs ? 'Cargando…' : 'Loading…'}</p></div>
                    ) : savedState === 'pending' ? (
                      <div className="gp-feed__empty"><p>{isEs ? 'La lista de guardados aún no está disponible. Vuelve pronto.' : 'Your saved list is not available yet. Check back soon.'}</p></div>
                    ) : savedPosts.length === 0 ? (
                      <div className="gp-feed__empty"><p>{isEs ? 'Aún no has guardado publicaciones. Usa el botón Guardar en cualquier post.' : 'You have not saved any posts yet. Use the Save button on any post.'}</p></div>
                    ) : savedPosts.map(post => (
                      <PostCard
                        key={post.id || post._id}
                        post={post}
                        onSaveChange={handleSaveChange}
                        onDelete={(id) => setSavedPosts(prev => prev.filter(p => (p.id || p._id) !== id))}
                        onBlock={(id) => setSavedPosts(prev => prev.filter(p => (p.id || p._id) !== id))}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'achievements' && (
                <motion.div key="ach" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .18 }}>
                  <div className="gp-ach-progress">
                    <div className="gp-ach-progress__text"><span>{isEs ? 'Logros y Credenciales' : 'Achievements & Credentials'}</span><b>{verifiedCredentialCount} / {credentials.length}</b></div>
                    <div className="gp-ach-progress__bar"><div style={{ width: `${(verifiedCredentialCount / credentials.length) * 100}%` }} /></div>
                  </div>

                  <h4 className="gp-subtitle">{isEs ? 'Vitrina de Acreditaciones' : 'Account Credentials'}</h4>
                  <div className="gp-ach-full-grid">
                    {credentials.filter(item => ['Security', 'Accreditation', 'Seguridad', 'Acreditación'].includes(item.category)).map(item => (
                      <div className={`gp-ach-tile ${item.unlocked ? 'unlocked' : 'locked'}`} key={item.id}>
                        <div className="gp-ach-tile__icon">{ACH_ICONS[item.icon] || Icon.award}</div>
                        <div className="gp-ach-tile__info">
                          <b>{item.name}</b>
                          <span>{item.desc}</span>
                        </div>
                        <div className="gp-ach-tile__right">
                          {item.unlocked ? <div className="gp-ach-tile__done">{Icon.check}</div> : <div className="gp-ach-tile__lock">{Icon.lock}</div>}
                          <small>{item.date}</small>
                        </div>
                      </div>
                    ))}
                  </div>

                  <h4 className="gp-subtitle" style={{ marginTop: '30px' }}>{isEs ? 'Logros Competitivos Desbloqueados' : 'Unlocked Gaming Milestones'}</h4>
                  <div className="gp-ach-full-grid">
                    {credentials.filter(item => ['Competitive', 'Social', 'Economy', 'Competitivo', 'Economía'].includes(item.category)).map(item => (
                      <div className={`gp-ach-tile gaming-ach ${item.unlocked ? 'unlocked' : 'locked'}`} key={item.id}>
                        <div className="gp-ach-tile__icon">{ACH_ICONS[item.icon] || Icon.award}</div>
                        <div className="gp-ach-tile__info">
                          <b>{item.name}</b>
                          <span>{item.desc}</span>
                        </div>
                        <div className="gp-ach-tile__right">
                          {item.unlocked ? <div className="gp-ach-tile__done trophy-glow">🏆</div> : <div className="gp-ach-tile__lock">{Icon.lock}</div>}
                          <small>{item.date}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'communities' && (
                <motion.div key="comm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .18 }}>
                  <section className="gp-section">
                    <h3 className="gp-section__title"><span className="gp-section__icon">{Icon.chat}</span>{isOwnerProfile ? (isEs ? 'Mis Comunidades' : 'My Communities') : (isEs ? 'Comunidades' : 'Communities')}</h3>
                    {!isOwnerProfile ? (
                      <div className="gp-empty">{isEs ? 'Las comunidades de otros perfiles no están disponibles todavía.' : "Other profiles' communities aren't available yet."}</div>
                    ) : profileCommunities.length === 0 ? (
                      <div className="gp-empty">{isEs ? 'Aun no perteneces a ninguna comunidad.' : 'You have not joined any communities yet.'}</div>
                    ) : (
                      <div className="gp-community-grid">
                        {profileCommunities.map(community => (
                          <Link
                            key={community.slug}
                            to={`/comunidad/${community.slug}`}
                            className="gp-community-card"
                            style={{
                              '--community-color': community.color || 'var(--accent)',
                              backgroundImage: community.poster ? `linear-gradient(180deg, rgba(9,12,22,.12), rgba(9,12,22,.94)), url(${community.poster})` : 'none',
                            }}
                          >
                            <div className="gp-community-card__top">
                              <span>{community.genre}</span>
                              <b>{isEs ? 'Miembro' : 'Member'}</b>
                            </div>
                            <div className="gp-community-card__body">
                              <h4>{community.name}</h4>
                              <p>{community.description}</p>
                            </div>
                            <div className="gp-community-card__foot">
                              <span>{Icon.users} {Number(community.members || 0).toLocaleString(lang === 'en' ? 'en-US' : 'es-DO')}</span>
                              <span>{Icon.chevronRight}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </motion.div>
              )}

              {tab === 'teams' && (
                <motion.div key="teams" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .18 }}>
                  <section className="gp-section gp-teams-tab">
                    <div className="gp-tab-title-row">
                      <h3 className="gp-section__title"><span className="gp-section__icon">{Icon.users}</span>{isEs ? 'Equipos y roster' : 'Teams & roster'}</h3>
                      <button type="button" className="gp-mini-action" onClick={() => navigate('/equipos')}>
                        {Icon.chevronRight}
                        <span>{isEs ? 'Ver equipos' : 'View teams'}</span>
                      </button>
                    </div>

                    {isPrivateSection('teams') ? (
                      <div className="gp-empty gp-private-empty">{Icon.lock}<b>{privateLabel}</b><span>{privateText}</span></div>
                    ) : loadingTeam ? (
                      <div className="gp-empty">{isEs ? 'Cargando equipo...' : 'Loading team...'}</div>
                    ) : myTeamData ? (
                      <GGTeamCard
                        team={profileTeamCard(myTeamData, teamRolePreview, isEs)}
                        tiers={teamTierIds(myTeamData)}
                        layout="row"
                        defaultOpen
                        hideJoin
                        width={860}
                        viewLabel={isEs ? 'Ver equipo' : 'View team'}
                        onView={handleViewTeam}
                        actions={[
                          {
                            key: 'view',
                            label: isEs ? 'Ver equipo' : 'View team',
                            primary: true,
                            onClick: handleViewTeam,
                          },
                        ]}
                      />
                    ) : (
                      <div className="gp-empty gp-empty--team">
                        <b>{isEs ? 'No tienes equipo vinculado.' : 'No linked team.'}</b>
                        <span>{isEs ? 'Explora equipos, solicita entrada o crea una escuadra competitiva.' : 'Explore teams, request access or create a competitive roster.'}</span>
                        <button type="button" className="gp-mini-action gp-mini-action--primary" onClick={() => navigate('/equipos')}>
                          {Icon.users}
                          <span>{isEs ? 'Ir a equipos' : 'Go to teams'}</span>
                        </button>
                      </div>
                    )}
                  </section>
                </motion.div>
              )}

              {tab === 'tournaments' && (
                <motion.div key="tor" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .18 }}>
                  {isPrivateSection('tournaments') ? (
                    <div className="gp-empty gp-private-empty">{Icon.lock}<b>{privateLabel}</b><span>{privateText}</span></div>
                  ) : loadingTournaments ? (
                    <div className="gp-empty">{isEs ? 'Cargando torneos...' : 'Loading tournaments...'}</div>
                  ) : (
                    <div className="gp-tour-container">
                      <h4 className="gp-subtitle">{isEs ? 'Mis torneos registrados' : 'My registered tournaments'}</h4>
                      {registeredTournaments.length === 0 ? (
                        <div className="gp-empty">{isEs ? 'No hay inscripciones verificadas para este usuario.' : 'No verified tournament registrations for this user.'}</div>
                      ) : (
                        <div className="gp-tournaments-esports-grid">
                          {registeredTournaments.map(tournament => {
                            const gameObj = getGameArt(tournament.game)
                            const statusLower = String(tournament.status || '').toLowerCase()
                            const isLive = ['ongoing', 'live'].includes(statusLower)
                            const isClosed = ['finished', 'completed', 'closed'].includes(statusLower)
                            const tourImage = tournamentImage(tournament, gameObj)
                            
                            return (
                              <div
                                className={`gp-esports-card ${isLive ? 'live' : ''} ${isClosed ? 'closed' : ''}`}
                                key={tournament._id || tournament.id}
                                onClick={() => navigate(`/torneos/${tournament._id || tournament.id}`)}
                                style={{ '--tour-color': gameObj?.color || 'var(--accent)', '--tour-image': `url(${tourImage})` }}
                              >
                                <div className="gp-esports-card__header">
                                  <span className="gp-esports-card__game">{getGameName(tournament.game)}</span>
                                  <span className={`gp-esports-card__status-badge ${statusLower}`}>
                                    {isLive ? '● LIVE' : isClosed ? (isEs ? 'FINALIZADO' : 'FINISHED') : (tournament.status || 'Registered')}
                                  </span>
                                </div>
                                <h4 className="gp-esports-card__title">{tournament.title || tournament.name}</h4>
                                <div className="gp-esports-card__details">
                                  <div className="gp-esports-card__detail-item">
                                    {Icon.calendar}
                                    <span>{formatDate(tournament.date || tournament.startDate, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                  </div>
                                  <div className="gp-esports-card__detail-item">
                                    {Icon.users}
                                    <span>{myTeamData ? `[${myTeamData.tag}] ${myTeamData.name}` : (isEs ? 'Individual' : 'Solo')}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <h4 className="gp-subtitle">{isEs ? 'Torneos disponibles' : 'Available tournaments'}</h4>
                      {availableTournaments.length === 0 ? (
                        <div className="gp-empty">{isEs ? 'No hay torneos disponibles en este momento.' : 'No tournaments available at this time.'}</div>
                      ) : (
                        <div className="gp-tournaments-esports-grid">
                          {availableTournaments.map(tournament => {
                            const gameObj = getGameArt(tournament.game)
                            const tourImage = tournamentImage(tournament, gameObj)
                            
                            return (
                              <div
                                className="gp-esports-card available"
                                key={tournament._id || tournament.id}
                                onClick={() => navigate(`/torneos/${tournament._id || tournament.id}`)}
                                style={{ '--tour-color': gameObj?.color || 'var(--accent)', '--tour-image': `url(${tourImage})` }}
                              >
                                <div className="gp-esports-card__header">
                                  <span className="gp-esports-card__game">{getGameName(tournament.game)}</span>
                                  <span className="gp-esports-card__status-badge open">
                                    {isEs ? 'INSCRIPCIÓN ABIERTA' : 'OPEN'}
                                  </span>
                                </div>
                                <h4 className="gp-esports-card__title">{tournament.title || tournament.name}</h4>
                                <div className="gp-esports-card__details">
                                  <div className="gp-esports-card__detail-item">
                                    {Icon.calendar}
                                    <span>{formatDate(tournament.date || tournament.startDate, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                  </div>
                                  <div className="gp-esports-card__detail-item">
                                    {Icon.shield}
                                    <span>{tournament.organizer?.nick || tournament.organizerName || 'GlitchGang'}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}


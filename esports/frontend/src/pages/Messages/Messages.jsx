import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { PROFILE_BACKGROUNDS } from '../../data/backgrounds.js'
import { COMMUNITIES, getAllCommunities } from '../../data/communities.js'
import { GAME_BY_ID, normalizeGameId } from '../../data/games.js'
import { api } from '../../lib/api.js'
import { listAllCommunities } from '../../lib/communitiesApi.js'
import { createMessagesSocket } from '../../lib/messagesSocket.js'
import { getSystemTicketChatId } from '../../lib/ticketMessengerBridge.js'
import { toast } from '../../lib/toast.js'
import { Av, I } from '../../components/SocialKit/SocialKit.jsx'
import UserActionsMenu from '../../components/UserActions/UserActionsMenu.jsx'
import { teamColor } from '../../lib/teamColor.js'
import { presenceInfo } from '../../lib/presence.js'

const CHANNELS = {
  chat: { label: 'Chat', color: '#2f80ed', icon: Icon.msg },
  community: { label: 'Comunidad', color: '#64748b', icon: Icon.chat },
  friends: { label: 'Amigos', color: '#8b5cf6', icon: Icon.friends },
  team: { label: 'Equipo', color: '#2f80ed', icon: Icon.users },
  tournament: { label: 'Torneo', color: '#f59e0b', icon: Icon.trophy },
  support: { label: 'Soporte', color: '#14b8a6', icon: Icon.shield },
  discord: { label: 'Discord', color: '#5865f2', icon: Icon.discord },
  whatsapp: { label: 'WhatsApp', color: '#22c55e', icon: Icon.whatsapp },
}

const RAIL_SECTIONS = [
  { id: 'chat', label: 'Chat', icon: Icon.msg },
  { id: 'community', label: 'Comunidad', icon: Icon.chat },
  { id: 'team', label: 'Equipo', icon: Icon.users },
  { id: 'friends', label: 'Amigos', icon: Icon.friends },
  { id: 'system', label: 'Sistema', icon: Icon.gear },
]

const SECTION_COPY = {
  chat: {
    title: 'Mensaje',
    search: 'Buscar en todos los chats',
    more: 'Nuevo chat',
    empty: 'No hay chats para esta busqueda.',
  },
  community: {
    title: 'Comunidades',
    search: 'Buscar juego o comunidad',
    more: 'Explorar comunidades',
    empty: 'Busca una comunidad por juego, nombre o genero.',
  },
  team: {
    title: 'Equipo',
    search: 'Buscar equipo',
    more: 'Anadir equipo',
    empty: 'No hay equipos con ese termino.',
  },
  friends: {
    title: 'Amigos',
    search: 'Buscar amigos',
    more: 'Buscar amigos',
    empty: 'No hay amigos con ese nombre.',
  },
  system: {
    title: 'Sistema',
    search: 'Buscar alertas, bots o agentes',
    more: 'Asistencia del sistema',
    empty: 'No hay alertas o agentes con ese termino.',
  },
}

const MESSAGING_COPY = {
  es: {
    sections: SECTION_COPY,
    rail: { menu: 'Menu GlitchGang', theme: 'Tema', color: 'Color', language: 'Idioma', spanish: 'Espanol', english: 'English' },
    profile: { unread: count => `${count} ${count === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}` },
    common: {
      close: 'Cerrar',
      members: 'miembros',
      people: 'personas',
      today: 'Hoy',
      now: 'Ahora',
      community: 'Comunidad',
      game: 'Juego',
      roster: 'Roster',
      active: 'Activos',
      messages: 'Mensajes',
      team: 'Equipo',
      rules: 'Reglas',
      friend: 'Amigo',
      member: 'Miembro',
      you: 'Tu',
      back: 'Volver',
      dashboard: 'Panel',
      tournament: 'Torneo',
    },
    panels: {
      community: 'Comunidades recientes, populares y busqueda por juego.',
      team: 'Equipo conectado desde tu panel competitivo.',
      friends: 'Busca amigos de tu perfil y abre un chat directo.',
      system: 'Agrega bots, revisa alertas o habla con soporte.',
      clearSearch: 'Limpiar busqueda',
      viewChats: 'Ver conversaciones',
      noTeam: 'No hay un equipo conectado todavia.',
      noFriends: 'No hay amigos conectados todavia.',
    },
    header: { communityPreview: 'Vista previa de comunidad', info: 'Informacion' },
    emptyThread: {
      previewTitle: 'Vista previa del chat',
      previewBody: 'Sigue la comunidad para participar.',
      title: 'Todavia no hay mensajes',
      body: 'Envia el primer mensaje cuando estes listo.',
    },
    lock: 'Sigue esta comunidad para escribir, reaccionar y recibir sus mensajes.',
    follow: 'Seguir',
    following: 'Siguiendo',
    goCommunity: 'Ir a comunidad',
    compose: {
      attach: 'Adjuntar',
      share: 'Compartir en el chat',
      tournament: 'Torneo',
      tournamentHint: 'Envia el enlace de un torneo',
      poll: 'Encuesta',
      pollHint: 'Pregunta rapida al grupo',
      file: 'Archivo',
      fileHint: 'Sube una imagen o documento',
      locked: 'Sigue la comunidad para participar...',
      placeholder: 'Escribe un mensaje...',
    },
    poll: {
      oneVote: 'voto',
      votes: 'votos',
      voted: 'Ya votaste, toca para cambiar',
      voteHint: 'Toca una opcion para votar',
      create: 'Crear encuesta',
      question: 'Pregunta',
      questionPlaceholder: 'Que quieres preguntar?',
      options: 'Opciones',
      option: index => `Opcion ${index + 1}`,
      addOption: 'Anadir opcion',
      send: 'Enviar encuesta',
    },
    tournament: {
      status: { live: 'En vivo', upcoming: 'Proximo', finished: 'Finalizado' },
      share: 'Compartir torneo',
      search: 'Buscar torneo por nombre o juego...',
      empty: 'No hay torneos con ese termino.',
      sent: name => `Compartiste ${name}`,
      sentDesc: 'El enlace del torneo se envio al chat.',
      text: name => `Torneo: ${name}`,
    },
    notifications: {
      followFirst: 'Sigue la comunidad primero',
      followFirstDesc: name => `Para participar en ${name || 'esta comunidad'}, primero debes seguirla.`,
      sent: name => `Mensaje enviado a ${name}`,
      pollSent: 'Encuesta enviada',
      unfollowed: name => `Dejaste de seguir ${name}`,
      previewMode: 'El chat vuelve a modo vista previa.',
      followed: name => `Sigues ${name}`,
      chatActive: 'El chat de la comunidad ya esta activo para ti.',
    },
    info: {
      title: 'Informacion',
      verified: 'Comunidad verificada',
      friendsInCommunity: count => `Amigos en esta comunidad (${count})`,
      membersTitle: count => `Miembros (${count})`,
      teamFallback: 'Canal privado para coordinar roster, scrims, entrenamientos y decisiones competitivas.',
    },
  },
  en: {
    sections: {
      chat: { title: 'Messages', search: 'Search all chats', more: 'New chat', empty: 'No chats match this search.' },
      community: { title: 'Communities', search: 'Search game or community', more: 'Explore communities', empty: 'Search by game, name, or genre.' },
      team: { title: 'Team', search: 'Search team', more: 'Add team', empty: 'No teams match that term.' },
      friends: { title: 'Friends', search: 'Search friends', more: 'Find friends', empty: 'No friends match that name.' },
      system: { title: 'System', search: 'Search alerts, bots, or agents', more: 'System support', empty: 'No alerts or agents match that term.' },
    },
    rail: { menu: 'GlitchGang menu', theme: 'Theme', color: 'Color', language: 'Language', spanish: 'Espanol', english: 'English' },
    profile: { unread: count => `${count} unread ${count === 1 ? 'message' : 'messages'}` },
    common: {
      close: 'Close',
      members: 'members',
      people: 'people',
      today: 'Today',
      now: 'Now',
      community: 'Community',
      game: 'Game',
      roster: 'Roster',
      active: 'Active',
      messages: 'Messages',
      team: 'Team',
      rules: 'Rules',
      friend: 'Friend',
      member: 'Member',
      you: 'You',
      back: 'Back',
      dashboard: 'Dashboard',
      tournament: 'Tournament',
    },
    panels: {
      community: 'Recent and popular communities, plus game search.',
      team: 'Team connected from your competitive panel.',
      friends: 'Find friends from your profile and open a direct chat.',
      system: 'Add bots, review alerts, or talk to support.',
      clearSearch: 'Clear search',
      viewChats: 'View conversations',
      noTeam: 'No team is connected yet.',
      noFriends: 'No connected friends yet.',
    },
    header: { communityPreview: 'Community preview', info: 'Information' },
    emptyThread: {
      previewTitle: 'Chat preview',
      previewBody: 'Follow the community to participate.',
      title: 'No messages yet',
      body: 'Send the first message when you are ready.',
    },
    lock: 'Follow this community to write, react, and receive messages.',
    follow: 'Follow',
    following: 'Following',
    goCommunity: 'Open community',
    compose: {
      attach: 'Attach',
      share: 'Share in chat',
      tournament: 'Tournament',
      tournamentHint: 'Send a tournament link',
      poll: 'Poll',
      pollHint: 'Ask the group a quick question',
      file: 'File',
      fileHint: 'Upload an image or document',
      locked: 'Follow the community to participate...',
      placeholder: 'Write a message...',
    },
    poll: {
      oneVote: 'vote',
      votes: 'votes',
      voted: 'You voted. Tap to change it',
      voteHint: 'Tap an option to vote',
      create: 'Create poll',
      question: 'Question',
      questionPlaceholder: 'What do you want to ask?',
      options: 'Options',
      option: index => `Option ${index + 1}`,
      addOption: 'Add option',
      send: 'Send poll',
    },
    tournament: {
      status: { live: 'Live', upcoming: 'Upcoming', finished: 'Finished' },
      share: 'Share tournament',
      search: 'Search tournament by name or game...',
      empty: 'No tournaments match that term.',
      sent: name => `Shared ${name}`,
      sentDesc: 'The tournament link was sent to the chat.',
      text: name => `Tournament: ${name}`,
    },
    notifications: {
      followFirst: 'Follow the community first',
      followFirstDesc: name => `To participate in ${name || 'this community'}, follow it first.`,
      sent: name => `Message sent to ${name}`,
      pollSent: 'Poll sent',
      unfollowed: name => `Unfollowed ${name}`,
      previewMode: 'The chat is back in preview mode.',
      followed: name => `You follow ${name}`,
      chatActive: 'The community chat is now active for you.',
    },
    info: {
      title: 'Information',
      verified: 'Verified community',
      friendsInCommunity: count => `Friends in this community (${count})`,
      membersTitle: count => `Members (${count})`,
      teamFallback: 'Private channel for roster coordination, scrims, training, and competitive decisions.',
    },
  },
}

const SYSTEM_DIRECTORY = [
  { id: 'system-alerts', name: 'Alertas del sistema', subtitle: 'Seguridad, privacidad y cuenta', color: '#ef4444', initials: 'AL', type: 'alert', description: 'Avisos importantes de seguridad, privacidad y actividad de cuenta.' },
  { id: 'system-bot', name: 'Bot GlitchGang', subtitle: 'Automatizaciones y ayuda rapida', color: '#3b82f6', initials: 'BT', type: 'bot', description: 'Bot para resolver dudas rapidas, revisar estados y guiarte dentro de la plataforma.' },
  { id: 'system-agent', name: 'Hablar con agente', subtitle: 'Soporte humano', color: '#14b8a6', initials: 'AG', type: 'agent', description: 'Canal con un agente de soporte para casos que necesitan seguimiento humano.' },
]

const DEFAULT_COMMUNITY_RULES = [
  'Respeta a los miembros, staff y visitantes de la comunidad.',
  'Publica contenido relacionado con la comunidad y usa los canales correctos.',
  'No spam, acoso, estafas, doxxing, cheats ni enlaces peligrosos.',
  'Los torneos, scrims y eventos deben seguir las normas publicadas por sus organizadores.',
]

const DEFAULT_CHATS = []

function sanitizeStoredChat(chat) {
  if (!chat) return chat
  const demoAuthors = new Set(['Renat', 'Michael'])
  const messages = (chat.messages || []).filter(message => {
    if (chat.id === 'team-chat' && demoAuthors.has(message.from)) return false
    if (/renderings that were not included|how long does it take to finalize|definitely use/i.test(String(message.text || ''))) return false
    if (/^Canal abierto: Glitch/i.test(String(message.text || ''))) return false
    return true
  })

  if (chat.id !== 'team-chat' && chat.name !== 'Design Chat' && !String(chat.name || '').includes('Dise')) {
    return { ...chat, messages }
  }

  return {
    ...chat,
    name: 'Chat de equipo',
    subtitle: chat.subtitle === 'Glitch Elite' ? 'Glitch elite' : chat.subtitle,
    initials: chat.initials === 'DC' ? 'GE' : chat.initials,
    unread: chat.id === 'team-chat' ? 0 : chat.unread,
    members: chat.id === 'team-chat' ? [] : chat.members,
    messages,
  }
}

function sharedChatId(destination = {}) {
  if (destination.kind === 'chat') return destination.id
  if (destination.kind === 'friend') return `friend-${destination.id}`
  if (destination.kind === 'team') return 'team-chat'
  if (destination.kind === 'community') return `community-${destination.id}`
  return `share-${destination.kind || 'chat'}-${destination.id || 'invite'}`
}

function sharedChatSection(destination = {}) {
  if (destination.kind === 'friend') return 'friends'
  if (destination.kind === 'team') return 'team'
  if (destination.kind === 'community') return 'community'
  return 'system'
}

function sharedChatChannel(destination = {}) {
  if (destination.kind === 'friend') return 'friends'
  if (destination.kind === 'team') return 'team'
  if (destination.kind === 'community') return 'community'
  return 'support'
}

function buildSharedChat(destination = {}, payload = {}) {
  return {
    id: sharedChatId(destination),
    section: sharedChatSection(destination),
    channel: sharedChatChannel(destination),
    name: destination.kind === 'team' ? 'Chat de equipo' : (destination.name || 'Invitacion'),
    subtitle: payload.title || destination.subtitle || payload.game || 'Invitacion compartida',
    initials: destination.initials || initials(destination.name),
    image: destination.avatar || '',
    cover: destination.avatar || '',
    color: 'var(--accent)',
    unread: 0,
    members: destination.kind === 'friend' ? [destination.name, 'Tu'] : [destination.name].filter(Boolean),
    description: `Invitaciones y mensajes compartidos con ${destination.name || 'este destino'}.`,
    messages: [],
  }
}

function getInitialChats() {
  return DEFAULT_CHATS
    .map(sanitizeStoredChat)
    .filter(chat => chat?.id !== 'challenger')
    .filter(chat => chat?.section !== 'team' || chat?.id === 'team-chat')
}

function mapServerMessage(message = {}, currentUserId = '') {
  const mine = String(message.sender || '') === String(currentUserId || '')
  return {
    id: message.id || message._id,
    from: mine ? 'Tu' : (message.senderName || 'GlitchGang'),
    role: mine ? 'Tu' : (message.senderRole || 'Miembro'),
    time: message.createdAt ? new Date(message.createdAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : 'Ahora',
    mine,
    at: message.createdAt || '',
    kind: message.kind === 'invite' ? 'share' : (message.kind || 'text'),
    text: message.text || message.card?.title || '',
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    tournament: message.card?.tournament || undefined,
    poll: message.card?.poll || undefined,
    share: message.card ? {
      title: message.card.title,
      summary: message.card.summary,
      game: message.card.game,
      url: message.card.url,
      image: message.card.image,
      logo: message.card.logo,
    } : undefined,
  }
}

function mapServerConversation(conversation = {}, currentUserId = '') {
  const channel = conversation.type === 'private' ? 'friends'
    : conversation.type === 'community' ? 'community'
      : conversation.type === 'team' ? 'team'
        : conversation.type === 'ticket' ? 'support'
          : 'support'
  return {
    id: `server-${conversation.id}`,
    serverConversationId: conversation.id,
    section: channel === 'friends' ? 'chat' : channel,
    channel,
    name: conversation.title || 'Conversacion',
    subtitle: conversation.subtitle || conversation.lastMessagePreview || '',
    initials: initials(conversation.title || 'GG'),
    // En chats privados el backend ya manda titulo/foto/estado del OTRO
    // participante (conversation.peer), siempre al dia.
    image: resolveUploadUrl(conversation.peer?.avatar || conversation.image || ''),
    peer: conversation.peer || null,
    cover: conversation.cover || conversation.image || '',
    color: conversation.color || 'var(--accent)',
    unread: conversation.unread || 0,
    members: conversation.participants || [],
    description: conversation.lastMessagePreview || conversation.subtitle || '',
    messages: (conversation.messages || []).map(message => mapServerMessage(message, currentUserId)),
    server: true,
    context: conversation.context,
  }
}

function lastMessage(chat) {
  return (chat.messages || []).filter(message => !isLegacyPreviewMessage(message)).at(-1)
}

function getAvailableCommunities() {
  try {
    const all = getAllCommunities()
    return Array.isArray(all) && all.length ? all : COMMUNITIES
  } catch {
    return COMMUNITIES
  }
}

function getCommunityKey(community) {
  return String(community?.slug || community?.id || community?.name || '').trim()
}

function readFollowedCommunities() {
  return []
}

function resolveUploadUrl(value) {
  if (!value) return ''
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

function cssBgImage(value) {
  if (!value) return 'none'
  const text = String(value).trim()
  if (!text || text === 'none') return 'none'
  if (/^(url|linear-gradient|radial-gradient)\(/i.test(text)) return text
  return `url("${text.replace(/"/g, '\\"')}")`
}

function getUserDisplayName(user) {
  return user?.nick || user?.username || user?.name || user?.firstName || user?.email?.split('@')[0] || 'Jugador'
}

function getUserInitials(user) {
  const source = getUserDisplayName(user)
  return source.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getUserBanner(user) {
  const activeBg = user?.activeBg || 'banner-basic-1'
  const custom = activeBg === 'custom'
    ? resolveUploadUrl(user?.activeCustomBg || user?.banner || user?.cover || user?.background)
    : ''
  const selected = PROFILE_BACKGROUNDS.find(item => item.id === activeBg) || PROFILE_BACKGROUNDS[0]
  const image = custom || selected?.poster || selected?.image || '/demos/steliant-esports/banner/Basic1.jpg'
  return cssBgImage(resolveUploadUrl(image))
}

function initials(value) {
  return String(value || 'GG').split(/\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase()
}

function rosterCount(team) {
  if (!team) return 0
  if (Array.isArray(team.roster)) return team.roster.filter(Boolean).length
  if (team.rosterSlots && typeof team.rosterSlots === 'object') {
    return Object.values(team.rosterSlots).filter(Boolean).length
  }
  if (Array.isArray(team.members)) return team.members.filter(Boolean).length
  return 0
}

function getTeamMemberNames(team) {
  if (!team) return []
  const sources = []
  if (Array.isArray(team.roster)) sources.push(...team.roster)
  if (Array.isArray(team.members)) sources.push(...team.members)
  if (team.rosterSlots && typeof team.rosterSlots === 'object') {
    sources.push(...Object.values(team.rosterSlots).filter(Boolean))
  }

  const names = sources.map(member => {
    if (typeof member === 'string') return member
    return member?.nick || member?.displayName || member?.username || member?.name || member?.playerName || member?.email?.split('@')[0] || ''
  }).map(value => String(value || '').trim()).filter(Boolean)

  return [...new Set(names)]
}

function getTeamGame(team) {
  const raw = team?.game || team?.mainGame || 'valorant'
  return GAME_BY_ID[normalizeGameId(raw, 'valorant')] || GAME_BY_ID.valorant
}

function getTeamVisual(team) {
  const game = getTeamGame(team)
  const publicPage = team?.publicPage || team?.publicProfile || {}
  const banner = resolveUploadUrl(team?.banner || team?.cover || team?.background || team?.bannerUrl || publicPage.banner || publicPage.bannerUrl || publicPage.cover)
  return {
    logo: resolveUploadUrl(team?.logo || team?.logoUrl || publicPage.logo || publicPage.logoUrl),
    cover: banner || game?.images?.horizontal || game?.poster || '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    gameName: game?.name || team?.game || 'Juego',
    accent: team?.color ? teamColor(team.color) : (game?.color || '#218cff'),
  }
}

function getTournamentVisual(tournament) {
  const game = GAME_BY_ID[normalizeGameId(tournament?.game || String(tournament?.gameCode || '').toLowerCase(), 'valorant')] || GAME_BY_ID.valorant
  return {
    logo: resolveUploadUrl(tournament?.logo || tournament?.logoUrl || game?.images?.logo || ''),
    image: resolveUploadUrl(tournament?.image || tournament?.cover || tournament?.banner || game?.railImages?.torneos || game?.images?.horizontal || game?.poster || ''),
    color: tournament?.color || game?.color || '#218cff',
    gameName: game?.name || tournament?.gameCode || 'Juego',
  }
}

function getTeamRules(team) {
  const raw = team?.rules || team?.communityRules || team?.guidelines
  const rules = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/\n|;/)
      : []
  const clean = rules.map(rule => String(rule || '').trim()).filter(Boolean)
  return clean.length ? clean.slice(0, 5) : [
    'Coordina horarios, scrims y roster dentro del canal correcto.',
    'Las decisiones del equipo deben quedar confirmadas por capitan o staff.',
    'Respeta a miembros, rivales y organizadores en toda conversacion competitiva.',
  ]
}

function getChatImage(chat) {
  if (chat.image) return chat.image
  if (chat.section !== 'community') return ''
  const key = String(chat.id || '').replace(/^community-/, '')
  const community = getAvailableCommunities().find(item => item.slug === key || item.id === key || item.name === chat.name)
  return community?.poster || community?.lowFpsImage || ''
}

function getCommunityForChat(chat) {
  if (chat.community) return chat.community
  if (chat.section !== 'community') return null
  const key = String(chat.id || '').replace(/^community-/, '')
  return getAvailableCommunities().find(item => item.slug === key || item.id === key || item.name === chat.name) || null
}

function getCommunityRules(community) {
  const rawRules = community?.rules || community?.communityRules || community?.guidelines
  let rules = []

  if (Array.isArray(rawRules)) {
    rules = rawRules
  } else if (typeof rawRules === 'string') {
    rules = rawRules.split(/\n|;/)
  }

  if (!rules.length && community?.notAllowed) {
    rules = [`No permitido: ${community.notAllowed}`]
  }

  if (!rules.length && (community?.publicId || community?.creator) && community?.info?.rules) {
    rules = [community.info.rules]
  }

  return rules.map(rule => String(rule || '').trim()).filter(Boolean).slice(0, 5).length
    ? rules.map(rule => String(rule || '').trim()).filter(Boolean).slice(0, 5)
    : DEFAULT_COMMUNITY_RULES
}

const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
// El backend acepta JSON de hasta 12MB y el base64 infla ~33%, asi que el archivo real debe ser menor.
const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024

function isImageAttachment(file) {
  if (String(file?.mime || '').startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(String(file?.url || file?.name || ''))
}

function matchesSearch(item, term) {
  if (!term) return true
  return [item.name, item.subtitle, item.description, item.genre, ...(item.tags || [])]
    .some(value => String(value || '').toLowerCase().includes(term))
}

function chatBelongsToSection(chat, section) {
  if (section === 'chat') return true
  return chat.section === section
}

function isLegacyPreviewMessage(message) {
  if (!message?.system) return false
  return /^(Entraste al chat|Vista previa de)/i.test(String(message.text || ''))
}

function getShareGameVisual(gameName) {
  const game = GAME_BY_ID[normalizeGameId(String(gameName || '').toLowerCase(), 'valorant')] || GAME_BY_ID.valorant
  return {
    image: game?.images?.horizontal || game?.poster || game?.image || '',
    logo: game?.images?.logo || '',
  }
}

function displayMessageText(message) {
  const text = String(message?.text || '')
  if (message?.system && /^Ahora sigues .+ Ya puedes participar/i.test(text)) {
    return text.replace(/\. Ya puedes participar.*$/i, '.')
  }
  return text
}

function splitAdminMessage(message) {
  const text = displayMessageText(message)
  if (!message?.ticketMessage || message?.mine || String(message?.role || '').toLowerCase() !== 'admin') {
    return { main: text, manual: '' }
  }
  const parts = String(text).split('\n').map(part => part.trim()).filter(Boolean)
  return {
    main: parts[0] || text,
    manual: parts.slice(1).join('\n'),
  }
}

export default function Messages() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useLang()
  const requested = params.get('thread') || params.get('channel')
  const ticketQuery = params.get('ticket')
  const [chats, setChats] = useState(getInitialChats)
  const [activeId, setActiveId] = useState(() => {
    if (ticketQuery) return getSystemTicketChatId(ticketQuery)
    return requested === 'support-ticket' || params.get('to') === 'admin' ? 'support' : (requested || 'team-chat')
  })
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [blockedChat, setBlockedChat] = useState(false)
  // Celular: se abre en la lista salvo que el enlace pida un chat concreto (kit C6).
  const [showChats, setShowChats] = useState(() => !(requested || ticketQuery || params.get('dm')))
  const [showInfo, setShowInfo] = useState(false)
  const [activeSection, setActiveSection] = useState('chat')
  const [moreOpen, setMoreOpen] = useState(false)
  const [followedCommunityIds, setFollowedCommunityIds] = useState(readFollowedCommunities)
  // Estado inicial real: comunidades donde el usuario es miembro en el servidor.
  useEffect(() => {
    if (!user) return undefined
    let alive = true
    listAllCommunities()
      .then(list => { if (alive) setFollowedCommunityIds(list.filter(c => c.joined).map(c => c.slug)) })
      .catch(() => {})
    return () => { alive = false }
  }, [user?._id])
  const [myTeam, setMyTeam] = useState(null)
  const [friends, setFriends] = useState([])
  const [attachOpen, setAttachOpen] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [tourneyPickerOpen, setTourneyPickerOpen] = useState(false)
  const [tourneyQuery, setTourneyQuery] = useState('')
  const [pollOpen, setPollOpen] = useState(false)
  const [pollDraft, setPollDraft] = useState({ question: '', options: ['', ''] })

  const [loadState, setLoadState] = useState('loading') // loading | ok | error
  const [socketConnected, setSocketConnected] = useState(false)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const socketRef = useRef(null)
  const activeIdRef = useRef(activeId)
  const { pushNotification } = useNotifications()

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const active = chats.find(chat => chat.id === activeId) || chats[0] || { id: 'loading', channel: 'team', messages: [], members: [] }
  const activeChannel = CHANNELS[active?.channel] || CHANNELS.team
  const activeCommunity = getCommunityForChat(active)
  const activeTeam = active.id === 'team-chat' ? myTeam : null
  const activeTeamVisual = activeTeam ? getTeamVisual(activeTeam) : null
  const activeTeamRules = useMemo(() => getTeamRules(activeTeam), [activeTeam])
  const activeTeamRosterCount = rosterCount(activeTeam)
  const activeCommunityKey = getCommunityKey(activeCommunity)
  const activeCommunityFollowed = Boolean(activeCommunity?.joined || followedCommunityIds.includes(activeCommunityKey))
  const activeCommunityImage = activeCommunity?.poster || activeCommunity?.lowFpsImage || active.image || ''
  const activeInfoCover = activeTeamVisual?.cover || activeCommunityImage || active.cover || active.banner || ''
  const activeChatImage = activeTeamVisual?.logo || activeCommunityImage || active.image || ''
  const activeCommunityVerified = Boolean(activeCommunity?.verified || activeCommunityFollowed || activeCommunity?.userRole)
  const activeCommunityRules = useMemo(() => getCommunityRules(activeCommunity), [activeCommunity])
  const visibleMessages = useMemo(() => (active.messages || []).filter(message => !isLegacyPreviewMessage(message)), [active.messages])
  const unread = chats.reduce((sum, chat) => sum + (chat.unread || 0), 0)
  const copy = MESSAGING_COPY[lang] || MESSAGING_COPY.es
  const sectionCopy = copy.sections[activeSection] || copy.sections.chat
  const currentUserName = getUserDisplayName(user)
  const currentUserAvatar = resolveUploadUrl(user?.avatar)
  const currentUserPresence = user?.presence || user?.onlineStatus || (user?.isOnline ? 'En linea' : '')
  const messagingStats = [
    `${chats.length} chats`,
    `${followedCommunityIds.length} ${copy.sections.community.title.toLowerCase()}`,
    copy.profile.unread(unread),
  ]

  useEffect(() => {
    if (!user) return undefined
    const socket = createMessagesSocket()
    socketRef.current = socket

    socket.on('connect', () => setSocketConnected(true))
    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('connect_error', () => setSocketConnected(false))
    socket.on('receive_message', payload => {
      const message = mapServerMessage(payload, user?._id || user?.id)
      const chatId = `server-${payload.conversationId}`
      setChats(prev => prev.map(chat => {
        if (chat.id !== chatId) return chat
        const currentMessages = (chat.messages || []).filter(item => {
          if (!String(item.id || '').startsWith('temp-')) return true
          return !(item.mine && item.text === message.text)
        })
        const exists = currentMessages.some(item => String(item.id) === String(message.id))
        return {
          ...chat,
          messages: exists ? currentMessages : [...currentMessages, message],
          unread: activeIdRef.current === chat.id ? 0 : (Number(chat.unread) || 0) + 1,
          subtitle: message.text || chat.subtitle,
        }
      }))
    })
    socket.on('conversation_updated', conversation => {
      const serverChat = mapServerConversation(conversation, user?._id || user?.id)
      setChats(prev => {
        const exists = prev.some(chat => chat.id === serverChat.id)
        if (!exists) return [serverChat, ...prev]
        return prev.map(chat => chat.id === serverChat.id ? { ...chat, ...serverChat, messages: chat.messages || [] } : chat)
      })
    })
    socket.on('notification', notification => {
      pushNotification({
        type: notification.type || 'mensaje',
        category: 'social',
        title: notification.title || 'Nuevo mensaje',
        desc: notification.message || '',
        time: 'ahora',
        action: notification.link ? { label: 'Abrir', link: notification.link } : undefined,
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
    }
  }, [user, pushNotification])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !socketConnected) return
    chats
      .filter(chat => chat.serverConversationId)
      .forEach(chat => socket.emit('join_chat', chat.serverConversationId))
  }, [chats, socketConnected])

  const refreshServerConversations = async ({ selectId = '', selectContextTarget = '', preferFirst = false } = {}) => {
    if (!user) return []
    const data = await api('/messages/conversations')
    setLoadState('ok')
    const serverChats = (Array.isArray(data?.conversations) ? data.conversations : [])
      .map(conversation => mapServerConversation(conversation, user?._id || user?.id))
    setChats(prev => {
      const previousServerChats = new Map(
        prev.filter(chat => chat.server).map(chat => [chat.serverConversationId, chat]),
      )
      const refreshedServerChats = serverChats.map(chat => {
        const previous = previousServerChats.get(chat.serverConversationId)
        return previous ? { ...chat, messages: previous.messages || [] } : chat
      })
      const withoutServer = prev.filter(chat => !chat.server)
      return [...refreshedServerChats, ...withoutServer]
    })
    const target = selectId
      ? serverChats.find(chat => chat.id === selectId || chat.serverConversationId === selectId)
      : selectContextTarget
        ? serverChats.find(chat => String(chat.context?.targetId || chat.context?.publicCode || '') === String(selectContextTarget))
        : null
    if (target?.id) {
      setActiveId(target.id)
      setActiveSection(target.section || 'chat')
    } else if (preferFirst && serverChats[0]?.id) {
      setActiveId(serverChats[0].id)
      setActiveSection(serverChats[0].section || 'chat')
    }
    return serverChats
  }

  const filteredChats = useMemo(() => {
    const term = query.trim().toLowerCase()
    return chats
      .filter(chat => chatBelongsToSection(chat, activeSection))
      .filter(chat => !term || [chat.name, chat.subtitle, chat.description, chat.channel].some(value => String(value || '').toLowerCase().includes(term)))
  }, [chats, query, activeSection])

  // Torneos reales para compartir en el chat (antes salían los de ejemplo de
  // data/tournaments.js y la tarjeta enlazaba a torneos que no existen).
  const [realTournaments, setRealTournaments] = useState([])
  useEffect(() => {
    if (!tourneyPickerOpen) return undefined
    let alive = true
    api('/tournaments?limit=50')
      .then(({ tournaments = [] }) => {
        if (!alive) return
        const now = Date.now()
        setRealTournaments(tournaments.map(t => {
          const start = t.date ? new Date(t.date) : null
          const ended = t.status === 'finished' || t.status === 'completed'
          const live = !ended && (t.status === 'live' || t.status === 'in_progress' || (start && start.getTime() <= now))
          return {
            id: t._id || t.id,
            publicId: t.publicId || t.publicCode || '',
            name: t.title || t.name || 'Torneo',
            game: t.game,
            gameCode: String(t.game || '').toUpperCase(),
            prize: Number(t.prizePool || 0).toLocaleString(),
            date: start ? start.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            time: start ? start.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '',
            status: ended ? 'finished' : live ? 'live' : 'upcoming',
            slots: t.maxSlots || 0,
            filled: t.registeredCount ?? t.registrationsCount ?? (Array.isArray(t.registrations) ? t.registrations.length : 0),
            banner: t.banner || '',
            logo: t.logo || '',
          }
        }))
      })
      .catch(() => { if (alive) setRealTournaments([]) })
    return () => { alive = false }
  }, [tourneyPickerOpen])

  const tournamentResults = useMemo(() => {
    const term = tourneyQuery.trim().toLowerCase()
    return realTournaments.filter(t => !term || [t.name, t.gameCode, t.publicId].some(value => String(value || '').toLowerCase().includes(term)))
  }, [tourneyQuery, realTournaments])

  const communityResults = useMemo(() => {
    const term = query.trim().toLowerCase()
    return getAvailableCommunities()
      .filter(community => !term || [community.name, community.genre, community.description, ...(community.tags || [])].some(value => String(value || '').toLowerCase().includes(term)))
      .sort((a, b) => (b.members || 0) - (a.members || 0))
      .slice(0, 6)
  }, [query])

  const teamItems = useMemo(() => {
    if (!myTeam) return []
    const visual = getTeamVisual(myTeam)
    const memberNames = getTeamMemberNames(myTeam)
    const item = {
      kind: 'team',
      id: myTeam._id || myTeam.id || 'my-team',
      chatId: 'team-chat',
      name: myTeam.name || (lang === 'en' ? 'My team' : 'Mi equipo'),
      subtitle: [visual.gameName, memberNames.length ? `${memberNames.length} ${copy.common.members}` : null].filter(Boolean).join(' · ') || copy.common.team,
      initials: initials(myTeam.tag || myTeam.name),
      image: visual.logo,
      cover: visual.cover,
      color: visual.accent,
      verified: Boolean(myTeam.verified || myTeam.publicCode || myTeam._id || myTeam.id),
      description: myTeam.description || myTeam.slogan || copy.info.teamFallback,
    }
    const term = query.trim().toLowerCase()
    return matchesSearch(item, term) ? [item] : []
  }, [copy, lang, myTeam, query])

  const friendItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    return friends
      .map(friend => ({
        kind: 'friend',
        id: friend.id,
        name: friend.nick || friend.name || friend.username || 'Jugador',
        subtitle: [friend.online ? friend.presence?.label : copy.common.friend, friend.game].filter(Boolean).join(' · '),
        initials: initials(friend.nick || friend.name || friend.username),
        image: resolveUploadUrl(friend.avatar),
        cover: friend.banner ? `url(${resolveUploadUrl(friend.banner)})` : getUserBanner(friend),
        color: friend.online ? (friend.presence?.color || '#22c55e') : 'var(--accent)',
        status: friend.online ? (friend.presence?.id || 'online') : 'offline',
        description: `Chat directo con ${friend.nick || friend.name || friend.username || 'este jugador'}.`,
      }))
      .filter(item => matchesSearch(item, term))
  }, [copy, friends, lang, query])

  const panelItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (activeSection === 'community') return communityResults.map(community => ({
      kind: 'community',
      id: community.id || community.slug,
      name: community.name,
      subtitle: community.genre || copy.common.community,
      initials: String(community.name || 'GG').slice(0, 2).toUpperCase(),
      image: community.poster || community.lowFpsImage || '',
      color: community.color || '#218cff',
      verified: Boolean(community.verified || community.joined || community.userRole),
      source: community,
    }))
    if (activeSection === 'team') return teamItems
    if (activeSection === 'friends') return friendItems
    if (activeSection === 'system') return SYSTEM_DIRECTORY.filter(item => matchesSearch(item, term)).map(item => ({ ...item, kind: 'system' }))
    return []
  }, [activeSection, communityResults, copy, friendItems, query, teamItems])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    refreshServerConversations({ preferFirst: !requested && !ticketQuery && !params.get('dm') })
      .then(() => { if (!cancelled) setLoadState('ok') })
      .catch(() => { if (!cancelled) setLoadState('error') })
    return () => { cancelled = true }
  }, [user, requested, ticketQuery])

  useEffect(() => {
    if (!active?.serverConversationId) return
    let cancelled = false
    const loadActiveConversation = () => api(`/messages/conversations/${encodeURIComponent(active.serverConversationId)}`)
      .then(data => {
        if (cancelled || !data?.conversation) return
        const serverChat = mapServerConversation(data.conversation, user?._id || user?.id)
        setChats(prev => prev.map(chat => chat.id === serverChat.id ? { ...chat, ...serverChat } : chat))
        api(`/messages/conversations/${encodeURIComponent(active.serverConversationId)}/read`, { method: 'PATCH' }).catch(() => {})
      })
      .catch(() => {})
    loadActiveConversation()
    const poll = setInterval(loadActiveConversation, 7000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [active?.serverConversationId, user])

  useEffect(() => {
    if (!user) return undefined
    const poll = setInterval(() => {
      refreshServerConversations().catch(() => {})
    }, 15000)
    return () => clearInterval(poll)
  }, [user])

  useEffect(() => {
    const onExternalShare = event => {
      const nextId = event.detail?.conversationId || event.detail?.chatId || ''
      refreshServerConversations({ selectId: nextId, preferFirst: true }).catch(() => {})
    }
    window.addEventListener('gg-messenger-share', onExternalShare)
    return () => window.removeEventListener('gg-messenger-share', onExternalShare)
  }, [user])

  useEffect(() => {
    if (!ticketQuery) return
    let cancelled = false
    const chatId = getSystemTicketChatId(ticketQuery)
    api(`/system-tickets/${encodeURIComponent(ticketQuery)}`)
      .then(data => {
        if (cancelled || !data?.ticket) return
        refreshServerConversations({ selectContextTarget: data.ticket.publicCode || data.ticket.id || ticketQuery })
          .catch(() => {})
      })
      .catch(() => {})
    setActiveSection('system')
    setActiveId(chatId)
    setShowInfo(false)
    return () => { cancelled = true }
  }, [ticketQuery])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    api('/system-tickets/my')
      .then(data => {
        if (cancelled) return
        const tickets = Array.isArray(data?.tickets) ? data.tickets : []
        if (tickets.length) refreshServerConversations().catch(() => {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    const ticketKey = active?.ticket?.publicCode || active?.ticket?.serverId || active?.ticket?.id
    if (!ticketKey) return
    let cancelled = false
    api(`/system-tickets/${encodeURIComponent(ticketKey)}`)
      .then(data => {
        if (cancelled || !data?.ticket) return
        refreshServerConversations({ selectContextTarget: data.ticket.publicCode || data.ticket.id || ticketKey })
          .catch(() => {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [active?.ticket?.publicCode, active?.ticket?.serverId, active?.ticket?.id])

  useEffect(() => {
    let cancelled = false
    api('/teams/my')
      .then(team => {
        if (cancelled || !team) return
        setMyTeam(team)
        setChats(prev => prev.map(chat => {
          if (chat.id !== 'team-chat') return chat
          const visual = getTeamVisual(team)
          const memberNames = getTeamMemberNames(team)
          return {
            ...chat,
            name: `${team.name || 'Mi equipo'} - Chat`,
            subtitle: [visual.gameName, memberNames.length ? `${memberNames.length} miembros` : null].filter(Boolean).join(' - ') || chat.subtitle,
            initials: initials(team.tag || team.name),
            image: visual.logo || chat.image,
            color: visual.accent,
            description: team.description || team.slogan || chat.description,
            members: memberNames,
          }
        }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    api(`/profile/${user._id || user.id}`)
      .then(({ user: profile }) => {
        if (cancelled) return
        setFriends(
          (profile?.friends || []).map(friend => ({
            id: friend._id || friend.id || friend,
            nick: friend.nick || friend.username || friend.name || 'Jugador',
            avatar: friend.avatar || '',
            banner: friend.activeCustomBg || friend.banner || friend.cover || friend.background || '',
            activeBg: friend.activeBg,
            activeCustomBg: friend.activeCustomBg,
            // Estado elegido si esta conectado (lib/presence.js).
            presence: presenceInfo(friend, lang),
            online: presenceInfo(friend).online,
            game: friend.games?.[0] || friend.mainGame || friend.game || null,
          })).filter(friend => friend.id)
        )
      })
      .catch(() => setFriends([]))
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [activeId, active.messages.length])

  useEffect(() => {
    setBlockedChat(false)
  }, [activeId])



  const retryConversations = () => {
    setLoadState('loading')
    refreshServerConversations()
      .then(() => setLoadState('ok'))
      .catch(() => setLoadState('error'))
  }

  // Enlace directo desde /amigos ("Mensaje"): /mensajes?dm=<id>&name=<nick>
  const dmOpenedRef = useRef('')
  useEffect(() => {
    const dmId = params.get('dm')
    if (!user || !dmId || dmOpenedRef.current === dmId) return
    dmOpenedRef.current = dmId
    openDirectoryChat({ kind: 'friend', id: dmId, name: params.get('name') || 'Jugador', initials: initials(params.get('name') || 'GG') })
      .then(() => setShowChats(false))
  }, [user, params])

  // Celular: la conversacion va a pantalla completa y se ocultan los botones
  // flotantes (asistente GG, temas), como en el diseño.
  const inThread = !showChats && Boolean(active && active.id !== 'loading')
  useEffect(() => {
    document.body.classList.toggle('gg-chat-focus', inThread)
    return () => document.body.classList.remove('gg-chat-focus')
  }, [inThread])

  const openChat = id => {
    setActiveId(id)
    setShowChats(false)
    setChats(prev => prev.map(chat => chat.id === id ? { ...chat, unread: 0 } : chat))
  }

  const openSection = sectionId => {
    setActiveSection(sectionId)
    setMoreOpen(false)
    setQuery('')
    const nextChat = chats.find(chat => chatBelongsToSection(chat, sectionId))
    // Solo selecciona: en celular el usuario sigue viendo la lista del espacio.
    if (nextChat) setActiveId(nextChat.id)
  }

  const openCommunityChat = async community => {
    try {
      const data = await api('/messages/conversations', {
        method: 'POST',
        body: {
          type: 'community',
          targetId: community.slug || community.id || community.name,
          title: community.name,
          subtitle: community.genre || 'Comunidad de juego',
          image: community.logo || community.poster || community.lowFpsImage || '',
          cover: community.banner || community.poster || community.lowFpsImage || '',
          color: community.color || '#218cff',
          context: { kind: 'community', publicCode: community.publicCode || '', metadata: { source: 'messages-directory' } },
        },
      })
      if (data?.conversation) {
        const serverChat = mapServerConversation(data.conversation, user?._id || user?.id)
        setChats(prev => [serverChat, ...prev.filter(chat => chat.id !== serverChat.id)])
        setActiveSection('community')
        setActiveId(serverChat.id)
        setQuery('')
        setMoreOpen(false)
        setShowInfo(true)
        return
      }
      throw new Error('No se pudo abrir la conversacion en el servidor')
    } catch (err) {
      toast(err?.message || 'No se pudo abrir la conversacion', 'warn')
    }
  }

  const openDirectoryChat = async item => {
    if (item.kind === 'community') {
      openCommunityChat(item.source)
      return
    }

    if (item.kind === 'team' && item.chatId) {
      try {
        const data = await api('/messages/conversations', {
          method: 'POST',
          body: {
            type: 'team',
            targetId: item.id || myTeam?._id || myTeam?.publicCode || myTeam?.name,
            title: `${item.name || myTeam?.name || 'Mi equipo'} - Chat`,
            subtitle: item.subtitle || myTeam?.game || '',
            image: item.image || myTeam?.logo || '',
            cover: item.cover || myTeam?.banner || item.image || '',
            color: item.color || myTeam?.color || '',
            context: { kind: 'team', publicCode: myTeam?.publicCode || '', metadata: { source: 'messages-directory' } },
          },
        })
        if (data?.conversation) {
          const serverChat = mapServerConversation(data.conversation, user?._id || user?.id)
          setChats(prev => [serverChat, ...prev.filter(chat => chat.id !== serverChat.id)])
          setActiveSection('team')
          setActiveId(serverChat.id)
          setQuery('')
          setMoreOpen(false)
          setShowInfo(true)
          return
        }
        throw new Error('No se pudo abrir el chat del equipo en el servidor')
      } catch (err) {
        toast(err?.message || 'No se pudo abrir el chat del equipo', 'warn')
      }
      return
    }

    const id = `${item.kind}-${item.id}`
    if (item.kind === 'friend') {
      try {
        const data = await api('/messages/conversations', {
          method: 'POST',
          body: {
            type: 'private',
            targetId: item.id,
            title: item.name,
            subtitle: item.subtitle,
            image: item.image,
            cover: item.cover,
            color: item.color,
            participantIds: [item.id].filter(Boolean),
            participantLookups: [item.name].filter(Boolean),
            context: { kind: 'friend', metadata: { source: 'messages-directory' } },
          },
        })
        if (data?.conversation) {
          const serverChat = mapServerConversation(data.conversation, user?._id || user?.id)
          setChats(prev => [serverChat, ...prev.filter(chat => chat.id !== serverChat.id)])
          setActiveSection('chat')
          setActiveId(serverChat.id)
          setQuery('')
          setMoreOpen(false)
          setShowInfo(false)
          return
        }
        throw new Error('No se pudo abrir el chat en el servidor')
      } catch (err) {
        // Ajustes/Privacidad "Recibir mensajes directos": el backend puede
        // rechazar un chat privado nuevo con alguien que lo desactivó.
        toast(err?.message || 'No se pudo abrir el chat', 'warn')
        return
      }
    }
    const existing = chats.find(chat => chat.id === id || chat.id === item.id)
    if (existing) {
      setQuery('')
      setMoreOpen(false)
      setShowInfo(item.kind === 'system')
      openChat(existing.id)
      return
    }

    const channel = item.kind === 'team' ? 'team' : item.kind === 'friend' ? 'friends' : 'support'
    const section = item.kind === 'team' ? 'team' : item.kind === 'friend' ? 'friends' : 'system'
    const next = {
      id,
      section,
      channel,
      name: item.name,
      subtitle: item.subtitle,
      initials: item.initials,
      image: item.image,
      cover: item.cover,
      color: item.color,
      verified: item.verified,
      members: item.kind === 'friend' ? [item.name] : [],
      description: item.description,
      messages: [
        { id: Date.now(), from: item.kind === 'system' ? item.name : 'GlitchGang', role: item.kind === 'system' ? 'Sistema' : 'Sistema', time: 'Ahora', text: `Canal abierto: ${item.name}.`, system: true },
      ],
    }
    setChats(prev => [next, ...prev])
    setActiveSection(section)
    setActiveId(id)
    setQuery('')
    setMoreOpen(false)
    setShowInfo(item.kind === 'system')
  }

  const canWrite = !(activeCommunity && !activeCommunityFollowed) && !blockedChat
  const directUserId = active?.channel === 'friends'
    ? (active.members || []).map(String).find(id => /^[0-9a-fA-F]{24}$/.test(id) && id !== String(user?._id || user?.id || ''))
    : ''

  const sendAttachment = async file => {
    if (!file || !canWrite || uploadingAttachment) return
    if (!active.serverConversationId) {
      toast('Este chat no esta conectado al servidor; no se puede guardar el adjunto.', 'warn')
      return
    }
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      toast(T('Formato no soportado. Usa PNG, JPG, WEBP, GIF o PDF.', 'Unsupported format. Use PNG, JPG, WEBP, GIF or PDF.'), 'warn')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast(T('El archivo pesa mas de 8MB.', 'The file is larger than 8MB.'), 'warn')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploadingAttachment(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      const uploaded = await api('/messages/attachments', {
        method: 'POST',
        body: { dataUrl, filename: file.name },
      })
      const attachment = uploaded?.attachment
      if (!attachment) throw new Error('Attachment upload failed')
      const text = draft.trim() || attachment.name || file.name || 'Adjunto'
      const data = await api(`/messages/conversations/${encodeURIComponent(active.serverConversationId)}/messages`, {
        method: 'POST',
        body: { text, kind: 'attachment', attachments: [attachment] },
      })
      if (!data?.message) throw new Error('Message was not saved')
      const message = mapServerMessage(data.message, user?._id || user?.id)
      setChats(prev => prev.map(chat => {
        if (chat.id !== active.id) return chat
        const messages = chat.messages || []
        return {
          ...chat,
          messages: messages.some(item => String(item.id) === String(message.id)) ? messages : [...messages, message],
          unread: 0,
          subtitle: text,
        }
      }))
      setDraft('')
      setAttachOpen(false)
      pushNotification({ type: 'mensaje', category: 'social', title: copy.notifications.sent(active.name), desc: attachment.name || text, time: 'ahora' })
    } catch (err) {
      if (err?.status === 403) setBlockedChat(true)
      toast(err?.message || T('No se pudo subir el adjunto', 'Could not upload the attachment'), 'warn')
    } finally {
      setUploadingAttachment(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const sendMessage = async event => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    const ticketKey = active.serverConversationId
      ? (active.context?.kind === 'ticket'
        ? (active.context?.targetId || active.context?.publicCode || active.context?.metadata?.ticketId)
        : '')
      : (active.ticket?.publicCode || active.ticket?.serverId || active.ticket?.id)
    try {
      let data
      if (ticketKey) {
        data = await api(`/system-tickets/${encodeURIComponent(ticketKey)}/reply`, {
          method: 'POST',
          body: { message: text },
        })
        await refreshServerConversations({ selectContextTarget: data?.ticket?.publicCode || ticketKey })
      } else if (active.serverConversationId) {
        data = await api(`/messages/conversations/${encodeURIComponent(active.serverConversationId)}/messages`, {
          method: 'POST',
          body: { text, kind: 'text' },
        })
        if (!data?.message) throw new Error('Message was not saved')
        const message = mapServerMessage(data.message, user?._id || user?.id)
        setChats(prev => prev.map(chat => {
          if (chat.id !== active.id) return chat
          const messages = chat.messages || []
          return {
            ...chat,
            messages: messages.some(item => String(item.id) === String(message.id)) ? messages : [...messages, message],
            unread: 0,
            subtitle: text,
          }
        }))
      } else {
        toast('Este chat no esta conectado al servidor; el mensaje no se envio.', 'warn')
        return
      }
      pushNotification({ type: 'mensaje', category: 'social', title: copy.notifications.sent(active.name), desc: text, time: 'ahora' })
      setDraft('')
    } catch (err) {
      if (err?.status === 403) setBlockedChat(true)
      pushNotification({ type: 'mensaje', category: 'social', title: ticketKey ? 'No se pudo responder el ticket' : 'No se pudo enviar el mensaje', desc: 'Revisa la conexion e intentalo de nuevo.', time: 'ahora' })
    }
  }

  const saveRichMessage = async ({ kind, text, card }) => {
    if (!active.serverConversationId) throw new Error('Este chat no esta conectado al servidor')
    if (!canWrite) throw new Error(copy.notifications.followFirstDesc(activeCommunity?.name))
    const data = await api(`/messages/conversations/${encodeURIComponent(active.serverConversationId)}/messages`, {
      method: 'POST',
      body: { kind, text, card },
    })
    if (!data?.message) throw new Error('Message was not saved')
    const message = mapServerMessage(data.message, user?._id || user?.id)
    setChats(prev => prev.map(chat => {
      if (chat.id !== active.id) return chat
      const messages = chat.messages || []
      return {
        ...chat,
        messages: messages.some(item => String(item.id) === String(message.id)) ? messages : [...messages, message],
        unread: 0,
        subtitle: text,
      }
    }))
    return message
  }

  const shareTournament = async tournament => {
    const visual = getTournamentVisual(tournament)
    try {
      await saveRichMessage({
        kind: 'tournament',
        text: copy.tournament.text(tournament.name),
        card: {
          tournament: {
            id: tournament.id,
            name: tournament.name,
            gameCode: tournament.gameCode,
            prize: tournament.prize,
            date: tournament.date,
            time: tournament.time,
            status: tournament.status,
            slots: tournament.slots,
            filled: tournament.filled,
            color: visual.color,
            image: visual.image,
            logo: visual.logo,
            gameName: visual.gameName,
            publicId: tournament.publicId,
          },
        },
      })
      setTourneyPickerOpen(false)
      setAttachOpen(false)
      setTourneyQuery('')
      pushNotification({ type: 'mensaje', category: 'torneo', title: copy.tournament.sent(tournament.name), desc: copy.tournament.sentDesc, time: 'ahora' })
    } catch {
      pushNotification({ type: 'mensaje', category: 'torneo', title: 'No se pudo compartir el torneo', desc: 'El mensaje no se guardo. Revisa la conexion e intentalo de nuevo.', time: 'ahora' })
    }
  }

  const createPoll = async () => {
    const question = pollDraft.question.trim()
    const options = pollDraft.options.map(option => option.trim()).filter(Boolean)
    if (!question || options.length < 2) return
    try {
      await saveRichMessage({
        kind: 'poll',
        text: question,
        card: { poll: { question, options: options.map((text, index) => ({ id: index, text, votes: [] })) } },
      })
      setPollOpen(false)
      setAttachOpen(false)
      setPollDraft({ question: '', options: ['', ''] })
      pushNotification({ type: 'mensaje', category: 'social', title: copy.notifications.pollSent, desc: question, time: 'ahora' })
    } catch {
      pushNotification({ type: 'mensaje', category: 'social', title: 'No se pudo crear la encuesta', desc: 'El mensaje no se guardo. Revisa la conexion e intentalo de nuevo.', time: 'ahora' })
    }
  }

  const votePoll = async (messageId, optionId) => {
    if (!active.serverConversationId) {
      toast('Esta encuesta no esta conectada al servidor.', 'warn')
      return
    }
    try {
      const data = await api(`/messages/conversations/${encodeURIComponent(active.serverConversationId)}/messages/${encodeURIComponent(messageId)}/votes`, {
        method: 'PATCH',
        body: { optionId },
      })
      if (!data?.message) throw new Error('Poll vote was not saved')
      const message = mapServerMessage(data.message, user?._id || user?.id)
      setChats(prev => prev.map(chat => chat.id === active.id ? {
        ...chat,
        messages: (chat.messages || []).map(item => String(item.id) === String(message.id) ? message : item),
      } : chat))
    } catch {
      pushNotification({ type: 'mensaje', category: 'social', title: 'No se pudo guardar el voto', desc: 'Revisa la conexion e intentalo de nuevo.', time: 'ahora' })
    }
  }

  // Seguir = ser miembro real de la comunidad (POST /communities/:id/join|leave).
  // Antes solo cambiaba un estado local y anunciaba "Sigues X".
  const followActiveCommunity = async () => {
    if (!activeCommunityKey) return
    try {
      const { community: remote } = await api(`/communities/${encodeURIComponent(activeCommunityKey)}`)
      await api(`/communities/${remote._id}/${activeCommunityFollowed ? 'leave' : 'join'}`, { method: 'POST' })
    } catch (err) {
      // Ya estaba en ese estado en el servidor: se sigue y se sincroniza la vista.
      if (!/ya eres miembro|no eres miembro/i.test(err?.message || '')) {
        pushNotification({ type: 'mensaje', category: 'social', title: 'No se pudo actualizar la comunidad', desc: err?.message || 'Intentalo de nuevo.', time: 'ahora' })
        return
      }
    }
    if (activeCommunityFollowed) {
      setFollowedCommunityIds(prev => prev.filter(id => id !== activeCommunityKey))
      setChats(prev => prev.map(chat => {
        const chatCommunity = getCommunityForChat(chat)
        if (getCommunityKey(chatCommunity) !== activeCommunityKey) return chat
        return {
          ...chat,
          community: { ...chatCommunity, joined: false },
        }
      }))
      pushNotification({
        type: 'mensaje',
        category: 'social',
        title: copy.notifications.unfollowed(activeCommunity.name),
        desc: copy.notifications.previewMode,
        time: 'ahora',
      })
      return
    }

    setFollowedCommunityIds(prev => prev.includes(activeCommunityKey) ? prev : [...prev, activeCommunityKey])
    setChats(prev => prev.map(chat => {
      const chatCommunity = getCommunityForChat(chat)
      if (getCommunityKey(chatCommunity) !== activeCommunityKey) return chat
      const alreadyAnnounced = chat.messages?.some(message => message.id === `follow-${activeCommunityKey}`)
      return {
        ...chat,
        community: { ...chatCommunity, joined: true },
        messages: alreadyAnnounced ? chat.messages : [
          ...(chat.messages || []),
          {
            id: `follow-${activeCommunityKey}`,
            from: 'Comunidad GlitchGang',
            role: 'Sistema',
            time: 'Ahora',
            text: `Ahora sigues ${chatCommunity.name}.`,
            system: true,
          },
        ],
      }
    }))
    pushNotification({
      type: 'mensaje',
      category: 'social',
      title: copy.notifications.followed(activeCommunity.name),
      desc: copy.notifications.chatActive,
      time: 'ahora',
    })
  }

  // ── Render: diseño del kit "Chat y Amigos" (ui_kits/social, clases sx-*) ──
  const isEn = lang === 'en'
  const T = (es, en) => (isEn ? en : es)
  const SPACE_ITEMS = [
    { id: 'chat', name: T('Mensajes directos', 'Direct messages'), icon: 'chat' },
    { sep: true },
    { id: 'team', name: T('Equipo', 'Team'), icon: 'users' },
    // Comunidades oculto por ahora: el modulo no se esta trabajando. Descomentar para reactivarlo.
    // { id: 'community', name: T('Comunidades', 'Communities'), icon: 'globe' },
    { id: 'friends', name: T('Amigos', 'Friends'), icon: 'friends' },
    { sep: true },
    { id: 'system', name: T('Soporte y sistema', 'Support & system'), icon: 'shield' },
  ]
  const sectionUnread = sectionId => chats.some(chat => chat.unread > 0 && (sectionId === 'chat' ? chat.section === 'chat' : chat.section === sectionId))
  const isGroupChat = active.channel !== 'friends'
  const activeAvatar = activeChatImage || ''
  const activeName = activeTeam ? `${activeTeam.name || active.name} - Chat` : active.name
  const activeStatusBase = activeTeam
    ? `${activeTeamRosterCount || active.members.length} ${copy.common.members} · ${activeTeamVisual?.gameName || active.subtitle}`
    : activeCommunity && !activeCommunityFollowed
      ? copy.header.communityPreview
      : [active.members.length ? `${active.members.length} ${copy.common.members}` : '', active.subtitle].filter(Boolean).join(' · ')
  const hasThread = Boolean(active && active.id !== 'loading')
  const myId = String(user?._id || user?.id || '')
  const isMongoId = value => /^[a-f0-9]{24}$/i.test(String(value || ''))
  const memberNames = [...new Set((active.members || []).map(member => {
    const raw = typeof member === 'string' ? member : (member?.nick || member?.name || member?._id || member?.id || '')
    if (String(raw) === myId || raw === 'Tu') return currentUserName
    if (!isMongoId(raw)) return String(raw)
    if (active.channel === 'friends') return active.name
    return friends.find(friend => String(friend.id) === String(raw))?.nick || ''
  }).filter(Boolean))]
  const dmFriend = active.channel === 'friends'
    ? friends.find(friend => (active.members || []).map(String).includes(String(friend.id)) || friend.nick === active.name)
    : null
  // Estado que eligio la otra persona (Jugando, AFK, No molestar...) si esta conectada.
  const dmPresence = dmFriend?.presence || (active.peer ? presenceInfo(active.peer, lang) : null)
  const activeStatus = active.channel === 'friends'
    ? (!dmPresence ? T('Chat directo', 'Direct chat') : dmPresence.label)
    : activeStatusBase
  const imageFiles = visibleMessages.flatMap(message => (message.attachments || []).filter(isImageAttachment))

  const dayLabel = value => {
    if (!value) return T('Hoy', 'Today')
    const date = new Date(value)
    const today = new Date()
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return T('Hoy', 'Today')
    if (date.toDateString() === yesterday.toDateString()) return T('Ayer', 'Yesterday')
    return date.toLocaleDateString(isEn ? 'en-US' : 'es-DO', { day: 'numeric', month: 'short' })
  }

  // Agrupa mensajes seguidos del mismo autor (kit: 4px dentro del grupo, 16 entre grupos)
  // e inserta separadores de dia.
  const threadItems = []
  visibleMessages.forEach(message => {
    const day = dayLabel(message.at)
    const lastDay = threadItems.filter(item => item.day).at(-1)?.day
    if (day !== lastDay) threadItems.push({ day, key: `day-${day}-${message.id}` })
    const prev = threadItems.at(-1)
    const who = message.system ? 'system' : message.mine ? 'me' : `them-${message.from}`
    if (prev && !prev.day && prev.who === who && !message.system && !message.kind?.match(/tournament|share|poll/)) {
      prev.messages.push(message)
    } else {
      threadItems.push({ who, key: `grp-${message.id}`, messages: [message] })
    }
  })

  const renderMessageBody = message => {
    if (message.kind === 'tournament' && message.tournament) {
      const visual = getTournamentVisual(message.tournament)
      return (
        <div className="sx-share sx-cut">
          <div className="sx-share__art" style={{ backgroundImage: cssBgImage(message.tournament.image || visual.image) }}><span className="sx-share__tag">{T('TORNEO', 'TOURNAMENT')}</span></div>
          <div className="sx-share__body">
            <div className="t-sec">{message.tournament.name}</div>
            <div className="sx-share__meta t-sm">
              <span>{message.tournament.gameName || visual.gameName}</span>
              {message.tournament.date && <span>{message.tournament.date}{message.tournament.time ? ` · ${message.tournament.time}` : ''}</span>}
              {message.tournament.slots ? <span>{message.tournament.filled || 0}/{message.tournament.slots} {T('equipos', 'teams')}</span> : null}
              {message.tournament.prize ? <span>${message.tournament.prize}</span> : null}
            </div>
            <button type="button" className="sx-btn sx-btn--sec" style={{ width: '100%' }} onClick={() => navigate(`/torneos/${message.tournament.id}`)}>{T('Ver torneo', 'View tournament')}</button>
          </div>
        </div>
      )
    }
    if (message.kind === 'share') {
      const visual = getShareGameVisual(message.share?.game)
      const open = () => {
        if (!message.share?.url) return
        const target = new URL(message.share.url, window.location.origin)
        if (target.origin === window.location.origin) navigate(`${target.pathname}${target.search}${target.hash}`)
        else window.open(target.href, '_blank', 'noopener,noreferrer')
      }
      return (
        <div className="sx-share sx-cut">
          <div className="sx-share__art" style={{ backgroundImage: cssBgImage(message.share?.image || visual.image) }}><span className="sx-share__tag">{T('INVITACIÓN', 'INVITE')}</span></div>
          <div className="sx-share__body">
            <div className="t-sec">{String(message.share?.title || message.text || '').replace(/^Compartir\s+/i, '')}</div>
            <div className="sx-share__meta t-sm"><span>{message.share?.summary || message.share?.game || copy.common.team}</span></div>
            {message.share?.url && <button type="button" className="sx-btn sx-btn--sec" style={{ width: '100%' }} onClick={open}>{T('Abrir', 'Open')}</button>}
          </div>
        </div>
      )
    }
    if (message.kind === 'poll' && message.poll) {
      const options = message.poll.options || []
      const voterId = String(user?._id || user?.id || '')
      const total = options.reduce((sum, option) => sum + (option.votes?.length || 0), 0)
      const myVote = options.find(option => (option.votes || []).some(vote => String(vote) === voterId))
      return (
        <div className="sx-poll sx-cut">
          <div className="t-lab sx-poll__lab">{T('Encuesta', 'Poll')} · {total} {total === 1 ? T('voto', 'vote') : T('votos', 'votes')}</div>
          <div className="t-sec" data-no-translate>{message.poll.question}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {options.map(option => {
              const pct = total ? Math.round(((option.votes?.length || 0) / total) * 100) : 0
              const on = myVote?.id === option.id
              return (
                <button key={option.id} type="button" className={'sx-opt' + (on ? ' on' : '')} onClick={() => votePoll(message.id, option.id)}>
                  <s style={{ width: pct + '%' }} />
                  <i>{on && <I name="check" size={10} />}</i><b data-no-translate>{option.text}</b><em>{pct}%</em>
                </button>
              )
            })}
          </div>
          <div className="t-sm">{myVote ? T(`Votaste ${myVote.text}`, `You voted ${myVote.text}`) : T('Toca una opción para votar', 'Tap an option to vote')}</div>
        </div>
      )
    }
    if (message.kind === 'attachment') {
      return (
        <div className="sx-bub">
          <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <I name="fileText" size={16} />
            <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <b style={{ fontWeight: 600 }}>{message.text || message.attachments?.[0]?.name || copy.compose.file}</b>
              {(message.attachments || []).map(file => (
                isImageAttachment(file) ? (
                  <a key={file.id || file.url || file.name} href={resolveUploadUrl(file.url)} target="_blank" rel="noreferrer">
                    <img src={resolveUploadUrl(file.url)} alt={file.name || ''} loading="lazy" style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 6, objectFit: 'cover' }} />
                  </a>
                ) : (
                  <a key={file.id || file.url || file.name} href={resolveUploadUrl(file.url)} target="_blank" rel="noreferrer">{file.name || file.url}</a>
                )
              ))}
            </span>
          </span>
        </div>
      )
    }
    const adminText = splitAdminMessage(message)
    return (
      <>
        <div className="sx-bub" data-no-translate>{adminText.main}</div>
        {adminText.manual && (
          <div className="sx-bub">
            <span className="t-lab" style={{ display: 'block', marginBottom: 4 }}>{T('Mensaje del admin', 'Admin message')}</span>
            <span data-no-translate>{adminText.manual}</span>
          </div>
        )}
      </>
    )
  }

  const listRows = activeSection === 'chat'
    ? filteredChats.map(chat => {
        const last = lastMessage(chat)
        const teamVisual = chat.id === 'team-chat' && myTeam ? getTeamVisual(myTeam) : null
        const img = teamVisual?.logo || getChatImage(chat)
        const lastText = last ? `${last.mine ? T('Tú: ', 'You: ') : ''}${last.text || ''}` : chat.subtitle
        return (
          <button key={chat.id} type="button" className={'sx-row' + (chat.id === active.id ? ' on' : '') + (chat.unread ? ' unread' : '')} onClick={() => openChat(chat.id)}>
            <Av name={chat.name} c={chat.color && !String(chat.color).startsWith('var') ? chat.color : undefined} s={44} img={img} sq={chat.channel !== 'friends'} />
            <span className="sx-row__txt">
              <span className="sx-row__l1"><b>{chat.name}</b><time>{last?.time || ''}</time></span>
              <span className="sx-row__l2"><span>{lastText}</span>{chat.unread > 0 && <em className="sx-badge" style={{ fontStyle: 'normal' }}>{chat.unread}</em>}</span>
            </span>
          </button>
        )
      })
    : panelItems.map(item => (
        <button key={`${item.kind}-${item.id}`} type="button" className="sx-row" onClick={() => openDirectoryChat(item)}>
          <Av name={item.name} c={item.color && !String(item.color).startsWith('var') ? item.color : undefined} s={44} img={item.image} sq={item.kind !== 'friend'} on={item.kind === 'friend' ? item.status === 'online' : undefined} />
          <span className="sx-row__txt">
            <span className="sx-row__l1"><b>{item.name}</b>{item.verified && <I name="check" size={14} />}</span>
            <span className="sx-row__l2"><span>{item.subtitle}</span></span>
          </span>
        </button>
      ))

  const newChatItems = [SYSTEM_DIRECTORY[2], SYSTEM_DIRECTORY[1], ...friendItems.slice(0, 6)].filter(Boolean)

  return (
    <main className="sx gg-msgr" data-lang={lang}>
      <div className="sx-chatwrap">
        <div className={'sx-chat' + (showInfo && hasThread ? ' info-open' : '')} data-view={showChats || !hasThread ? 'list' : 'thread'}>
          <nav className="sx-spaces" aria-label={T('Espacios', 'Spaces')}>
            {SPACE_ITEMS.map((space, index) => space.sep ? <hr key={`sep-${index}`} /> : (
              <div key={space.id} className={'sx-space__wrap' + (activeSection === space.id ? ' on' : '')}>
                <button type="button" className={'sx-space sx-cut' + (activeSection === space.id ? ' on' : '')} aria-label={space.name} onClick={() => openSection(space.id)}>
                  <I name={space.icon} size={20} />
                </button>
                {sectionUnread(space.id) && <i />}<span>{space.name}</span>
              </div>
            ))}
            <hr className="gg-msgr__push" />
            <div className="sx-space__wrap">
              <button type="button" className="sx-space sx-cut" aria-label={T('Ver app', 'View app')} onClick={() => navigate('/dashboard')}><I name="eye" size={20} /></button>
              <span>{T('Ver app', 'View app')}</span>
            </div>
          </nav>

          <aside className="sx-list">
            <div className="sx-list__head">
              <h2 className="t-sec">{SPACE_ITEMS.find(space => space.id === activeSection)?.name || sectionCopy.title}</h2>
              {activeSection === 'chat' && (
                <button type="button" className={'sx-ico' + (moreOpen ? ' on' : '')} aria-label={sectionCopy.more} onClick={() => setMoreOpen(value => !value)}><I name={moreOpen ? 'x' : 'plus'} size={20} /></button>
              )}
            </div>
            <label className="sx-search sx-cut"><I name="search" size={16} /><input placeholder={sectionCopy.search} value={query} onChange={event => setQuery(event.target.value)} /></label>

            {loadState === 'error' && (
              <div className="sx-banner sx-cut" role="alert"><I name="alert" size={18} />
                <div><b>{T('Sin conexión con el chat', 'No connection to chat')}</b><span className="t-sm">{T('No pudimos conectar. Revisa tu internet e inténtalo otra vez.', 'We could not connect. Check your internet and try again.')}</span></div>
                <button type="button" className="sx-btn sx-btn--sec" style={{ height: 32, padding: '0 12px' }} onClick={retryConversations}>{T('Reintentar', 'Retry')}</button>
              </div>
            )}

            {activeSection === 'chat' && moreOpen ? (
              <div className="sx-rows">
                <div className="t-lab" style={{ padding: '8px 8px 4px' }}>{T('Iniciar conversación', 'Start a conversation')}</div>
                {newChatItems.map(item => (
                  <button key={item.id} type="button" className="sx-row" onClick={() => openDirectoryChat({ ...item, kind: item.type ? 'system' : 'friend' })}>
                    <Av name={item.name} c={item.color && !String(item.color).startsWith('var') ? item.color : undefined} s={44} img={item.image} sq={Boolean(item.type)} on={item.type ? undefined : item.status === 'online'} />
                    <span className="sx-row__txt">
                      <span className="sx-row__l1"><b>{item.name}</b></span>
                      <span className="sx-row__l2"><span>{item.subtitle}</span></span>
                    </span>
                  </button>
                ))}
                {!friendItems.length && <p className="t-sm" style={{ padding: '8px' }}>{T('Agrega amigos para escribirles directo.', 'Add friends to message them directly.')}</p>}
              </div>
            ) : loadState === 'loading' && activeSection === 'chat' ? (
              <div className="sx-rows" aria-busy="true">
                <div className="t-lab" style={{ padding: '8px 8px 4px' }}>{T('Cargando conversaciones…', 'Loading conversations…')}</div>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="sx-skrow"><span className="sx-sk" style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none' }} />
                    <div><span className="sx-sk" style={{ height: 12, width: `${60 - i * 5}%` }} /><span className="sx-sk" style={{ height: 10, width: `${85 - i * 7}%` }} /></div></div>
                ))}
              </div>
            ) : activeSection === 'chat' && !chats.length ? (
              <div className="sx-rows" style={{ display: 'grid' }}>
                <div className="sx-state">
                  <span className="sx-state__ic sx-cut"><I name="chat" size={24} /></span>
                  <div className="t-sec">{T('Todavía no tienes conversaciones', "You don't have conversations yet")}</div>
                  <p className="t-body">{T('Escríbele a un amigo o entra a la comunidad de tu juego para empezar.', 'Message a friend or join your game community to get started.')}</p>
                  <button type="button" className="sx-btn sx-btn--pri" onClick={() => navigate('/amigos')}>{T('Buscar amigos', 'Find friends')}</button>
                </div>
              </div>
            ) : (
              <div className="sx-rows" style={loadState === 'error' ? { opacity: .55 } : null}>
                {listRows}
                {listRows.length === 0 && (
                  <div className="sx-state">
                    <div className="t-sec">{T('Sin resultados', 'No results')}</div>
                    <p className="t-body">{query.trim() ? T(`Nada coincide con “${query.trim()}”.`, `Nothing matches “${query.trim()}”.`) : sectionCopy.empty}</p>
                  </div>
                )}
              </div>
            )}
          </aside>

          {hasThread ? (
            <section className="sx-thread">
              <header className="sx-thread__head">
                <button type="button" className="sx-ico sx-back" aria-label={T('Volver', 'Back')} onClick={() => setShowChats(true)}>
                  <span style={{ transform: 'rotate(180deg)', display: 'grid' }}><I name="chevronRight" size={20} /></span>
                </button>
                <Av name={active.name} s={40} img={activeAvatar} sq={active.channel !== 'friends'} c={active.color && !String(active.color).startsWith('var') ? active.color : undefined} />
                <div className="sx-thread__who"><b>{activeName}</b><span>{activeStatus}</span></div>
                {directUserId && <UserActionsMenu user={{ _id: directUserId, nick: active.name, avatar: activeAvatar }} context={{ type: 'message', id: active.serverConversationId || active.id }} />}
                <button type="button" className={'sx-ico' + (showInfo ? ' on' : '')} aria-label={copy.header.info} onClick={() => setShowInfo(value => !value)}><I name="user" size={18} /></button>
              </header>

              <div className="sx-msgs">
                {visibleMessages.length === 0 && (
                  <div className="sx-state">
                    <span className="sx-state__ic sx-cut"><I name="msg" size={24} /></span>
                    <div className="t-sec">{activeCommunity && !activeCommunityFollowed ? copy.emptyThread.previewTitle : copy.emptyThread.title}</div>
                    <p className="t-body">{activeCommunity && !activeCommunityFollowed ? copy.emptyThread.previewBody : copy.emptyThread.body}</p>
                  </div>
                )}
                {threadItems.map(item => item.day ? <div key={item.key} className="sx-day t-lab">{item.day}</div> : item.who === 'system' ? (
                  <div key={item.key} className="sx-day t-lab" style={{ textTransform: 'none', letterSpacing: 0 }}>{displayMessageText(item.messages[0])}</div>
                ) : (
                  <div key={item.key} className={'sx-grp' + (item.who === 'me' ? ' me' : '')}>
                    {item.who !== 'me' && isGroupChat && (
                      <span className="t-sm" data-no-translate>{item.messages[0].from}{item.messages[0].role && item.messages[0].role !== 'Miembro' ? ` · ${item.messages[0].role}` : ''}</span>
                    )}
                    {item.messages.map(message => <div key={message.id} style={{ display: 'contents' }}>{renderMessageBody(message)}</div>)}
                    <div className="sx-meta">{item.messages.at(-1).time}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {blockedChat ? (
                <div className="sx-compose sx-cut" role="status" style={{ alignItems: 'center', padding: '0 14px', color: 'var(--mu)' }}>
                  {T('No puedes enviar mensajes a este usuario.', 'You cannot message this user.')}
                </div>
              ) : (
                <form className="sx-compose" onSubmit={sendMessage}>
                  <div className="sx-more gg-msgr__attach">
                    <button type="button" className={'sx-ico' + (attachOpen ? ' on' : '')} aria-label={copy.compose.attach} disabled={!canWrite} onClick={() => setAttachOpen(value => !value)}><I name="plus" size={20} /></button>
                    {attachOpen && canWrite && (
                      <div className="sx-menu sx-cut">
                        <button type="button" onClick={() => { setTourneyPickerOpen(true); setAttachOpen(false) }}><I name="trophy" size={16} />{copy.compose.tournament}</button>
                        <button type="button" onClick={() => { setPollOpen(true); setAttachOpen(false) }}><I name="chartBar" size={16} />{copy.compose.poll}</button>
                        <button type="button" disabled={uploadingAttachment} onClick={() => fileInputRef.current?.click()}><I name={uploadingAttachment ? 'clock' : 'upload'} size={16} />{uploadingAttachment ? T('Subiendo…', 'Uploading…') : copy.compose.file}</button>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,.pdf" hidden onChange={event => sendAttachment(event.target.files?.[0])} />
                  </div>
                  <label className="sx-compose__in sx-cut">
                    <input value={draft} onChange={event => setDraft(event.target.value)} disabled={!canWrite} placeholder={!canWrite ? copy.compose.locked : T(`Escribe a ${active.name}`, `Message ${active.name}`)} />
                  </label>
                  {canWrite
                    ? <button type="submit" className="sx-send sx-cut" aria-label={T('Enviar', 'Send')} disabled={!draft.trim()}><I name="send" size={18} /></button>
                    : <button type="button" className="sx-btn sx-btn--pri" onClick={followActiveCommunity}>{copy.follow}</button>}
                </form>
              )}
            </section>
          ) : (
            <section className="sx-thread gg-msgr__empty">
              <div className="sx-empty-thread">
                <div className="sx-state">
                  <div className="t-sec">{T('Elige una conversación', 'Pick a conversation')}</div>
                  <p className="t-body">{T('Tus chats con amigos, equipos y comunidades se abren aquí.', 'Your chats with friends, teams and communities open here.')}</p>
                </div>
              </div>
            </section>
          )}

          {hasThread && <div className="sx-scrim" onClick={() => setShowInfo(false)} />}
          {hasThread && (
            <aside className="sx-info">
              <div className="sx-info__head"><span className="t-lab">{copy.info.title}</span><button type="button" className="sx-ico" aria-label={copy.common.close} onClick={() => setShowInfo(false)}><I name="x" size={18} /></button></div>
              <div className="sx-info__who" style={{ '--ring': 'var(--s1)' }}>
                <Av name={activeTeam ? activeTeam.name : active.name} s={64} img={activeAvatar} sq={active.channel !== 'friends'} c={active.color && !String(active.color).startsWith('var') ? active.color : undefined} />
                <div className="t-sec">{activeTeam ? activeTeam.name : active.name}{activeCommunityVerified && <> <I name="check" size={14} /></>}</div>
                <div className="t-sm">
                  {activeTeam
                    ? `${activeTeamRosterCount || active.members.length} ${copy.common.members} · ${activeTeamVisual?.gameName || copy.common.game}`
                    : activeCommunity ? (activeCommunity.genre || copy.common.community) : `${active.members.length} ${copy.common.members}`}
                </div>
                {activeCommunity ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="sx-btn sx-btn--sec" disabled aria-disabled="true" style={{ opacity: 0.5, cursor: 'not-allowed' }}>{copy.goCommunity}</button>
                    <button type="button" className={activeCommunityFollowed ? 'sx-btn sx-btn--sec' : 'sx-btn sx-btn--pri'} onClick={followActiveCommunity}>{activeCommunityFollowed ? copy.following : copy.follow}</button>
                  </div>
                ) : activeTeam ? (
                  <button type="button" className="sx-btn sx-btn--sec" style={{ marginTop: 8 }} onClick={() => navigate('/mi-equipo')}>{T('Ver equipo', 'View team')}</button>
                ) : active.channel === 'friends' ? (
                  <button type="button" className="sx-btn sx-btn--sec" style={{ marginTop: 8 }} onClick={() => navigate(`/perfil?user=${encodeURIComponent(active.name)}`)}>{T('Ver perfil', 'View profile')}</button>
                ) : null}
              </div>

              {(activeTeam || activeCommunity?.description) && (
                <div className="sx-info__sec">
                  <span className="t-lab">{T('Acerca de', 'About')}</span>
                  <p className="t-body" style={{ margin: 0, color: 'var(--mu)' }}>{activeTeam ? (activeTeam.description || activeTeam.slogan || copy.info.teamFallback) : activeCommunity.description}</p>
                </div>
              )}

              {(activeTeam || activeCommunity) && (
                <div className="sx-info__sec">
                  <span className="t-lab">{copy.common.rules}</span>
                  <ul className="t-body" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'var(--mu)' }}>
                    {(activeTeam ? activeTeamRules : activeCommunityRules).map(rule => <li key={rule}>{rule}</li>)}
                  </ul>
                </div>
              )}

              {(activeTeam || activeCommunity?.tags?.length > 0) && (
                <div className="sx-info__sec">
                  <span className="t-lab">{T('Etiquetas', 'Tags')}</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(activeTeam
                      ? [activeTeamVisual?.gameName || activeTeam.game, activeTeam.region || 'Global', activeTeam.level || activeTeam.tier]
                      : activeCommunity.tags.slice(0, 6)
                    ).filter(Boolean).map(tag => <span key={tag} className="sx-tag">{tag}</span>)}
                  </span>
                </div>
              )}

              {memberNames.length > 0 && (
                <div className="sx-info__sec">
                  <span className="t-lab">{copy.info.membersTitle(memberNames.length)}</span>
                  {memberNames.slice(0, 12).map(member => (
                    <div key={member} className="sx-mini">
                      <Av name={member} s={32} />
                      <div><div className="t-body">{member}</div><div className="t-sm">{member === currentUserName ? copy.common.you : copy.common.member}</div></div>
                    </div>
                  ))}
                </div>
              )}

              {imageFiles.length > 0 && (
                <div className="sx-info__sec">
                  <span className="t-lab">{T('Archivos', 'Files')} · {imageFiles.length}</span>
                  <div className="sx-files">
                    {imageFiles.slice(0, 9).map(file => (
                      <a key={file.id || file.url} href={resolveUploadUrl(file.url)} target="_blank" rel="noreferrer" className="sx-cut" style={{ '--cut': '6px', display: 'block', aspectRatio: '1 / 1', overflow: 'hidden' }} aria-label={file.name || T('Archivo', 'File')}>
                        <img src={resolveUploadUrl(file.url)} alt="" loading="lazy" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      {tourneyPickerOpen && (
        <div className="gg-msgr__modal" role="dialog" aria-label={copy.tournament.share} onClick={() => setTourneyPickerOpen(false)}>
          <div className="sx-card sx-cut gg-msgr__modal-in" onClick={event => event.stopPropagation()}>
            <div className="sx-sec-h" style={{ justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
              <h2 className="t-sec">{copy.tournament.share}</h2>
              <button type="button" className="sx-ico" aria-label={copy.common.close} onClick={() => setTourneyPickerOpen(false)}><I name="x" size={18} /></button>
            </div>
            <label className="sx-search sx-cut" style={{ margin: 0 }}><I name="search" size={16} /><input value={tourneyQuery} onChange={event => setTourneyQuery(event.target.value)} placeholder={copy.tournament.search} autoFocus /></label>
            <div className="sx-rows" style={{ padding: 0, maxHeight: '50vh' }}>
              {tournamentResults.map(tournament => {
                const visual = getTournamentVisual(tournament)
                return (
                  <button key={tournament.id} type="button" className="sx-row" onClick={() => shareTournament(tournament)}>
                    <Av name={tournament.gameCode || tournament.name} s={44} img={visual.logo} sq c={visual.color} />
                    <span className="sx-row__txt">
                      <span className="sx-row__l1"><b>{tournament.name}</b><time>${tournament.prize}</time></span>
                      <span className="sx-row__l2"><span>{copy.tournament.status[tournament.status] || copy.common.tournament} · {tournament.date}{tournament.time ? ` · ${tournament.time}` : ''}</span></span>
                    </span>
                  </button>
                )
              })}
              {!tournamentResults.length && <p className="t-sm" style={{ padding: 8 }}>{copy.tournament.empty}</p>}
            </div>
          </div>
        </div>
      )}

      {pollOpen && (
        <div className="gg-msgr__modal" role="dialog" aria-label={copy.poll.create} onClick={() => setPollOpen(false)}>
          <div className="sx-card sx-cut gg-msgr__modal-in" onClick={event => event.stopPropagation()}>
            <div className="sx-sec-h" style={{ justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
              <h2 className="t-sec">{copy.poll.create}</h2>
              <button type="button" className="sx-ico" aria-label={copy.common.close} onClick={() => setPollOpen(false)}><I name="x" size={18} /></button>
            </div>
            <span className="t-lab">{copy.poll.question}</span>
            <label className="sx-search sx-cut" style={{ margin: 0 }}><input value={pollDraft.question} onChange={event => setPollDraft(d => ({ ...d, question: event.target.value }))} placeholder={copy.poll.questionPlaceholder} autoFocus /></label>
            <span className="t-lab">{copy.poll.options}</span>
            {pollDraft.options.map((option, index) => (
              <div key={index} style={{ display: 'flex', gap: 8 }}>
                <label className="sx-search sx-cut" style={{ margin: 0, flex: 1 }}><input value={option} onChange={event => setPollDraft(d => ({ ...d, options: d.options.map((value, i) => i === index ? event.target.value : value) }))} placeholder={copy.poll.option(index)} /></label>
                {pollDraft.options.length > 2 && <button type="button" className="sx-ico" aria-label={T('Quitar opción', 'Remove option')} onClick={() => setPollDraft(d => ({ ...d, options: d.options.filter((_, i) => i !== index) }))}><I name="x" size={16} /></button>}
              </div>
            ))}
            {pollDraft.options.length < 5 && (
              <button type="button" className="sx-btn sx-btn--sec" onClick={() => setPollDraft(d => ({ ...d, options: [...d.options, ''] }))}><I name="plus" size={16} />{copy.poll.addOption}</button>
            )}
            <button type="button" className="sx-btn sx-btn--pri" disabled={!pollDraft.question.trim() || pollDraft.options.map(option => option.trim()).filter(Boolean).length < 2} onClick={createPoll}><I name="send" size={16} />{copy.poll.send}</button>
          </div>
        </div>
      )}
    </main>
  )
}


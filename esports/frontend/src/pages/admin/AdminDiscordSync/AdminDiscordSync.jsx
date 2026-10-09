import { useEffect, useMemo, useState } from 'react'
import Button from '../../../components/Button/Button.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { uploadFile } from '../../../lib/uploadsApi.js'
import { PUBLICATION_PRESETS, presetsForForum } from './discordPresets.js'
import './AdminDiscordSync.css'

const STATUS_LABEL = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Listo',
  failed: 'Fallido',
}

const CONTROL_TABS = [
  { id: 'overview', label: 'Servidor', icon: Icon.discord },
  { id: 'channels', label: 'Canales', icon: Icon.layers },
  { id: 'automations', label: 'Automatizaciones', icon: Icon.gear },
  { id: 'publish', label: 'Publicaciones', icon: Icon.send },
  { id: 'versions', label: 'Versiones', icon: Icon.bolt },
  { id: 'forums', label: 'Foros', icon: Icon.messageSquare },
  { id: 'events', label: 'Historial bot', icon: Icon.list },
]

const PUBLICATION_TYPE_LABEL = {
  news: 'Noticia',
  announcement: 'Anuncio',
  banner: 'Banner / promo',
  brand: 'Marca',
  sponsor: 'Patrocinador',
  version: 'Version',
  rules: 'Reglas',
  registration: 'Inscripciones',
}

const PUBLICATION_STATUS_LABEL = {
  ready: 'En cola',
  published: 'Publicado',
  failed: 'Fallido',
  archived: 'Archivada',
}

const SOURCE_LABEL = {
  manual: 'Creada aqui',
  news: 'Admin Noticias',
}

// Solo texto y anuncios aceptan publicaciones del bot.
const PUBLISHABLE_CHANNEL_TYPES = new Set([0, 5, 15])
// Que se puede editar segun el tipo de canal.
const TOPIC_TYPES = new Set([0, 5, 15])
const SLOWMODE_TYPES = new Set([0, 15])

const EMPTY_FORM = { type: 'announcement', title: '', body: '', url: '', imageUrl: '', ctaLabel: '', ctaUrl: '', targetChannelId: '', appliedTags: [] }

// Para que sirve cada foro, por nombre. Los foros en si salen del servidor
// real (canales tipo 15), no de una lista fija.
const FORUM_HINTS = {
  sugerencias: 'Ideas de la comunidad: votos y estado de cada idea.',
  soporte: 'Casos de ayuda: el staff responde dentro de cada tema.',
  inscripciones: 'Un tema por torneo para dudas de inscripcion y cupos.',
  bugs: 'Errores de la plataforma, uno por tema.',
  versiones: 'Feedback de cada version publicada.',
}
const forumHint = name => FORUM_HINTS[String(name || '').replace(/^foro-/, '')] || 'Foro del servidor.'

const NEW_CHANNEL_TYPES = [
  ['text', 'Texto'],
  ['voice', 'Voz'],
  ['forum', 'Foro'],
  ['category', 'Categoria'],
]

// Variables que el bot reemplaza en bienvenida/despedida.
const MEMBER_VARIABLES = [
  ['{usuario}', 'Mencion'],
  ['{nombre}', 'Nombre'],
  ['{nick}', 'Nick GG'],
  ['{servidor}', 'Servidor'],
  ['{miembros}', 'Total miembros'],
]

const EMPTY_MEMBER_MSG = { enabled: false, channelId: '', channelName: '', title: '', message: '', imageUrl: '', color: '' }

const MEMBER_MSG_META = {
  welcome: {
    label: 'Bienvenida',
    when: 'Cuando alguien entra al servidor.',
    title: 'Bienvenido, {nombre}',
    message: 'Vincula tu cuenta de GlitchGang con /vincular para desbloquear tu rol y jugar torneos.',
    color: '#20c997',
  },
  farewell: {
    label: 'Despedida',
    when: 'Cuando alguien sale del servidor.',
    title: '{nombre} salio del servidor',
    message: 'Esperamos verte pronto de nuevo.',
    color: '#111827',
  },
}

// Mensajes predeterminados para elegir (y luego editar). {#canal} se cambia
// por la mencion real del canal (<#id>) al elegirlo, para que en Discord
// sea un enlace que se puede tocar.
const MEMBER_PRESETS = {
  welcome: [
    {
      id: 'welcome-casa',
      name: 'Bienvenida completa',
      color: '#7c5cff',
      title: '🎮 ¡Bienvenido a GlitchGang, {nombre}!',
      message: [
        'Hola {usuario}, ¡qué alegría tenerte aquí! 🙌',
        'Ya eres parte de **{servidor}**, la comunidad donde competimos, aprendemos y nos divertimos juntos. Eres el miembro número **{miembros}**.',
        '',
        '**📌 Tus primeros pasos**',
        '1️⃣ Lee las reglas en {#bienvenida-y-reglas}: son cortas y nos cuidan a todos.',
        '2️⃣ Vincula tu cuenta de GlitchGang con `/vincular` para recibir tu rol y jugar torneos.',
        '3️⃣ Preséntate en {#general} y cuéntanos a qué juegas.',
        '4️⃣ Mira los torneos en {#torneos-activos} e inscríbete en {#inscripciones}.',
        '',
        '**🤝 Lo que esperamos de ti**',
        'Respeto siempre, juego limpio y buena vibra. Aquí nadie se queda atrás.',
        '',
        '¿Dudas? Revisa {#faq} o abre un tema en {#soporte}: el staff está para ayudarte.',
        '',
        '¡Siéntete como en casa y que empiecen las partidas! 🏆',
      ].join('\n'),
    },
    {
      id: 'welcome-lobby',
      name: 'Bienvenida gamer',
      color: '#00e5ff',
      title: '⚡ ¡{nombre} acaba de entrar al lobby!',
      message: [
        '¡Bienvenido, {usuario}! 🔥',
        'Acabas de unirte a **{servidor}** y ya somos **{miembros}** jugadores con ganas de competir.',
        '',
        '**🕹️ Tu checklist antes de entrar a la partida**',
        '✅ Lee las reglas en {#bienvenida-y-reglas}',
        '✅ Usa `/vincular` para conectar tu cuenta y desbloquear tu rol',
        '✅ Saluda a la comunidad en {#general}',
        '✅ Entérate de todo en {#noticias-glitchgang}',
        '',
        '**🎯 ¿Qué vas a encontrar aquí?**',
        'Torneos cada semana, equipos buscando jugadores, noticias de la plataforma y una comunidad que te va a hacer mejorar partida a partida.',
        '',
        'Juega limpio, respeta a todos y, sobre todo, diviértete.',
        '¡Nos vemos en el bracket, {nombre}! 🏆',
      ].join('\n'),
    },
  ],
  farewell: [
    {
      id: 'farewell-gracias',
      name: 'Despedida con cariño',
      color: '#7c5cff',
      title: '👋 Hasta pronto, {nombre}',
      message: [
        '**{nombre}** ha salido de **{servidor}**.',
        '',
        'Gracias por el tiempo que compartiste con nosotros, por cada partida y cada mensaje. 💜',
        'Las puertas de GlitchGang siempre van a estar abiertas: si algún día quieres volver, aquí seguiremos compitiendo.',
        '',
        '¡Mucha suerte en tus próximas partidas!',
      ].join('\n'),
    },
    {
      id: 'farewell-gg',
      name: 'Despedida gamer',
      color: '#111827',
      title: '🎮 {nombre} ha dejado el lobby',
      message: [
        'Se nos fue un jugador... 😢',
        '**{nombre}** ya no está en **{servidor}**. Ahora somos **{miembros}** en la comunidad.',
        '',
        'GG por todo lo que jugaste con nosotros. 🕹️',
        'Si algún día quieres la revancha, ya sabes dónde encontrarnos.',
        '',
        '¡Buena suerte y hasta la próxima!',
      ].join('\n'),
    },
  ],
}

// {#nombre-canal} -> <#id> si el canal existe; si no, queda como texto #nombre.
function resolveChannelTokens(text, channels) {
  return String(text || '').replace(/\{#([\w-]+)\}/g, (_, name) => {
    const channel = channels.find(c => c.name === name)
    return channel ? `<#${channel.id}>` : `#${name}`
  })
}

const SAMPLE_VALUES = { usuario: '@Stephanie', nombre: 'Stephanie', nick: 'tephygg', servidor: 'GlitchGang', miembros: '128' }
const renderSample = (text, channels = []) => String(text || '')
  .replace(/\{(usuario|nombre|nick|servidor|miembros)\}/gi, (_, key) => SAMPLE_VALUES[key.toLowerCase()])
  .replace(/<#(\d+)>/g, (_, id) => `#${channels.find(c => c.id === id)?.name || 'canal'}`)

function discordMessageUrl(guildId, pub) {
  const channelId = pub.discordChannelId || pub.targetChannelId
  if (!guildId || !channelId || !pub.discordMessageId) return ''
  return `https://discord.com/channels/${guildId}/${channelId}/${pub.discordMessageId}`
}

const CHANNEL_TYPE_LABEL = {
  0: 'Texto',
  2: 'Voz',
  4: 'Categoria',
  5: 'Anuncios',
  13: 'Voz (stage)',
  15: 'Foro',
}

const CHANNEL_TYPE_ICON = {
  0: Icon.chat,
  2: Icon.users,
  4: Icon.layers,
  5: Icon.send,
  13: Icon.users,
  15: Icon.messageSquare,
}

function fmt(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function StatusPill({ value }) {
  const key = String(value || '').toLowerCase().replace(/\s+/g, '-')
  return <span className={`adsync__pill is-${key}`}>{value}</span>
}

// Fila compacta de un canal dentro de una carpeta.
function ChannelRow({ channel, active, badge, locked, onClick }) {
  return (
    <button type="button" className={`adsync__tree-row ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="adsync__tree-icon">{CHANNEL_TYPE_ICON[channel.type] || Icon.layers}</span>
      <span className="adsync__tree-name">{channel.type === 2 || channel.type === 13 ? channel.name : `#${channel.name}`}</span>
      {badge && <em className="adsync__tree-badge">{badge}</em>}
      {locked && <span className="adsync__tree-lock" title="Solo lectura">{Icon.lock}</span>}
    </button>
  )
}

// Cabecera plegable de una carpeta (servidor, categoria, torneo, equipo).
function Folder({ open, onToggle, icon, label, count, sub, level = 0, active, onSelect, children }) {
  return (
    <div className={`adsync__folder level-${level}`}>
      <div className={`adsync__folder-head ${active ? 'active' : ''}`}>
        <button type="button" className="adsync__folder-toggle" onClick={onToggle} aria-expanded={open}>
          <span className={`adsync__chevron ${open ? 'is-open' : ''}`}>{Icon.chevronRight}</span>
          <span className="adsync__tree-icon">{icon}</span>
          <span className="adsync__tree-name">{label}</span>
          {sub && <small>{sub}</small>}
        </button>
        {onSelect && <button type="button" className="adsync__folder-more" onClick={onSelect} title="Ver detalles">{Icon.moreVertical}</button>}
        <b className="adsync__folder-count">{count}</b>
      </div>
      {open && <div className="adsync__folder-body">{children}</div>}
    </div>
  )
}

const ORGANIZER_ACTIONS = {
  warn: { label: 'Advertir', title: name => `Advertencia sobre tu torneo "${name}"` },
  notify: { label: 'Notificar', title: name => `Aviso sobre tu torneo "${name}"` },
  report: { label: 'Reportar', title: name => `Reporte sobre tu torneo "${name}"` },
}

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)

export default function AdminDiscordSync() {
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('all')
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const [serverStatus, setServerStatus] = useState(null)
  const [serverState, setServerState] = useState('idle') // idle | loading | ok | error
  const [serverError, setServerError] = useState('')

  const [channels, setChannels] = useState([])
  const [serverChannels, setServerChannels] = useState([])
  const [tournamentChannels, setTournamentChannels] = useState([])
  const [tournamentCategories, setTournamentCategories] = useState({})
  const [channelsState, setChannelsState] = useState('idle')
  const [channelsError, setChannelsError] = useState('')
  const [selectedChannelId, setSelectedChannelId] = useState('')

  const [channelMap, setChannelMap] = useState({})
  const [functionLabels, setFunctionLabels] = useState({})
  const [typeFunctions, setTypeFunctions] = useState({})
  const [configError, setConfigError] = useState('')
  const [savingFn, setSavingFn] = useState('')

  const [publications, setPublications] = useState([])
  const [pubState, setPubState] = useState('idle')
  const [pubError, setPubError] = useState('')
  const [pubNotice, setPubNotice] = useState('')
  const [pubBusy, setPubBusy] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [forumPostMode, setForumPostMode] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [templates, setTemplates] = useState([])
  const [templateNotice, setTemplateNotice] = useState('')
  const [editingPublished, setEditingPublished] = useState(false)

  const [channelEdit, setChannelEdit] = useState(null)
  const [newChannel, setNewChannel] = useState(null) // null = formulario cerrado
  const [channelBusy, setChannelBusy] = useState('')
  const [channelNotice, setChannelNotice] = useState('')
  const [channelActionError, setChannelActionError] = useState('')

  const [automations, setAutomations] = useState(null)
  const [autoDraft, setAutoDraft] = useState({ welcome: EMPTY_MEMBER_MSG, farewell: EMPTY_MEMBER_MSG })
  const [autoState, setAutoState] = useState('idle')
  const [autoBusy, setAutoBusy] = useState('')
  const [autoNotice, setAutoNotice] = useState('')
  const [autoError, setAutoError] = useState('')

  const [openFolders, setOpenFolders] = useState({ server: true, tournaments: true })
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [orgAction, setOrgAction] = useState(null) // { kind, message }
  const [orgBusy, setOrgBusy] = useState(false)

  const [forumData, setForumData] = useState({}) // forumId -> { state, threads, tags, error }
  const [openForumId, setOpenForumId] = useState('')
  const [forumError, setForumError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    api(`/admin/discord/events?status=${encodeURIComponent(status)}&limit=100`)
      .then(data => setEvents(data.events || []))
      .catch(err => setError(err.message || 'No se pudieron cargar los eventos de Discord.'))
      .finally(() => setLoading(false))
  }

  const loadServerStatus = () => {
    setServerState('loading')
    setServerError('')
    api('/admin/discord/server')
      .then(data => { setServerStatus(data); setServerState(data.bot ? 'ok' : 'error'); if (!data.bot) setServerError(data.error || 'El bot no respondio.') })
      .catch(err => { setServerError(err.message || 'El backend todavia no expone el estado del servidor.'); setServerState('error') })
  }

  const loadChannels = () => {
    setChannelsState('loading')
    setChannelsError('')
    api('/admin/discord/channels')
      .then(data => {
        const list = data.channels || []
        const serverList = data.serverChannels || list.filter(channel => channel.managedScope !== 'tournament')
        const tournamentList = data.tournamentChannels || []
        setChannels(list)
        setServerChannels(serverList)
        setTournamentChannels(tournamentList)
        setTournamentCategories(data.tournamentCategories || {})
        setChannelsState('ok')
        // Si el canal elegido ya no existe en Discord, se suelta la seleccion.
        setSelectedChannelId(prev => (prev && list.some(channel => channel.id === prev) ? prev : ''))
      })
      .catch(err => { setChannelsError(err.message || 'El backend todavia no expone la lista de canales.'); setChannelsState('error') })
  }

  const loadConfig = () => {
    setConfigError('')
    api('/admin/discord/config')
      .then(data => {
        setChannelMap(data.config?.channels || {})
        setFunctionLabels(data.functions || {})
        setTypeFunctions(data.types || {})
      })
      .catch(err => setConfigError(err.message || 'No se pudo cargar la configuracion de canales.'))
  }

  const loadPublications = () => {
    setPubState('loading')
    setPubError('')
    api('/admin/discord/publications')
      .then(data => { setPublications(data.publications || []); setPubState('ok') })
      .catch(err => { setPubError(err.message || 'No se pudieron cargar las publicaciones.'); setPubState('error') })
  }

  // Asigna (o quita, si channel es null) el canal de una funcion.
  const assignFunction = async (fn, channel) => {
    setSavingFn(fn)
    setConfigError('')
    try {
      const data = await api('/admin/discord/config', {
        method: 'PATCH',
        body: { channels: { [fn]: { channelId: channel?.id || '', channelName: channel?.name || '' } } },
      })
      setChannelMap(data.config?.channels || {})
    } catch (err) {
      setConfigError(err.message || 'No se pudo guardar el canal.')
    } finally {
      setSavingFn('')
    }
  }

  const loadTemplates = () => {
    api('/admin/discord/templates')
      .then(data => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
  }

  const loadAutomations = () => {
    setAutoState('loading')
    setAutoError('')
    api('/admin/discord/automations')
      .then(data => {
        const saved = data.automations || {}
        setAutomations(saved)
        setAutoDraft({
          welcome: { ...EMPTY_MEMBER_MSG, ...(saved.welcome || {}) },
          farewell: { ...EMPTY_MEMBER_MSG, ...(saved.farewell || {}) },
        })
        setAutoState('ok')
      })
      .catch(err => { setAutoError(err.message || 'No se pudieron cargar las automatizaciones.'); setAutoState('error') })
  }

  const refreshAll = () => {
    load()
    loadServerStatus()
    loadChannels()
    loadConfig()
    loadPublications()
    loadAutomations()
  }

  // ── Canales: crear / editar / borrar ──

  const submitNewChannel = async (event) => {
    event.preventDefault()
    setChannelBusy('create')
    setChannelActionError('')
    setChannelNotice('')
    try {
      const data = await api('/admin/discord/channels', { method: 'POST', body: newChannel })
      setNewChannel(null)
      setChannelNotice(`#${data.channel?.name} creado en Discord.`)
      setSelectedChannelId(data.channel?.id || '')
      loadChannels()
    } catch (err) {
      setChannelActionError(err.message || 'No se pudo crear el canal.')
    } finally {
      setChannelBusy('')
    }
  }

  const saveChannel = async (event) => {
    event.preventDefault()
    if (!selectedChannel || !channelEdit) return
    const body = {}
    if (channelEdit.name.trim() !== selectedChannel.name) body.name = channelEdit.name.trim()
    if (TOPIC_TYPES.has(selectedChannel.type) && channelEdit.topic !== (selectedChannel.topic || '')) body.topic = channelEdit.topic
    if (SLOWMODE_TYPES.has(selectedChannel.type) && Number(channelEdit.rateLimitPerUser) !== (selectedChannel.rateLimitPerUser || 0)) {
      body.rateLimitPerUser = Number(channelEdit.rateLimitPerUser) || 0
    }
    if (selectedChannel.type !== 4 && channelEdit.parentId !== (selectedChannel.parentId || '')) body.parentId = channelEdit.parentId
    if (!Object.keys(body).length) { setChannelNotice('No hay cambios que guardar.'); return }
    setChannelBusy('save')
    setChannelActionError('')
    setChannelNotice('')
    try {
      await api(`/admin/discord/channels/${selectedChannel.id}`, { method: 'PATCH', body })
      setChannelNotice('Cambios guardados en Discord.')
      loadChannels()
    } catch (err) {
      setChannelActionError(err.message || 'No se pudo guardar el canal.')
    } finally {
      setChannelBusy('')
    }
  }

  const removeChannel = async () => {
    if (!selectedChannel) return
    const what = selectedChannel.type === 4 ? `la categoria "${selectedChannel.name}" (sus canales quedan sueltos, no se borran)` : `#${selectedChannel.name} y todos sus mensajes`
    if (!window.confirm(`¿Borrar ${what}? No se puede deshacer.`)) return
    setChannelBusy('delete')
    setChannelActionError('')
    setChannelNotice('')
    try {
      await api(`/admin/discord/channels/${selectedChannel.id}`, { method: 'DELETE' })
      setChannelNotice(`#${selectedChannel.name} borrado de Discord.`)
      setSelectedChannelId('')
      loadChannels()
    } catch (err) {
      setChannelActionError(err.message || 'No se pudo borrar el canal.')
    } finally {
      setChannelBusy('')
    }
  }

  const toggleFolder = key => setOpenFolders(f => ({ ...f, [key]: !f[key] }))

  const selectChannel = (id) => {
    setSelectedChannelId(id)
    setSelectedTournamentId('')
    setOrgAction(null)
    setChannelNotice('')
    setChannelActionError('')
  }

  const selectTournament = (id) => {
    setSelectedTournamentId(id)
    setSelectedChannelId('')
    setOrgAction(null)
    setChannelNotice('')
    setChannelActionError('')
  }

  // Torneos de terceros: el admin no los edita, solo avisa al organizador
  // (crea un ticket de moderacion + notificacion, /admin/users/:id/notice).
  const sendOrganizerNotice = async (event, tournament) => {
    event.preventDefault()
    if (!tournament?.organizerId || !orgAction?.message.trim()) return
    setOrgBusy(true)
    setChannelActionError('')
    setChannelNotice('')
    try {
      await api(`/admin/users/${tournament.organizerId}/notice`, {
        method: 'POST',
        body: { title: ORGANIZER_ACTIONS[orgAction.kind].title(tournament.title), message: orgAction.message.trim() },
      })
      setChannelNotice(`${ORGANIZER_ACTIONS[orgAction.kind].label}: enviado a ${tournament.organizerNick || 'el organizador'}.`)
      setOrgAction(null)
    } catch (err) {
      setChannelActionError(err.message || 'No se pudo enviar el aviso.')
    } finally {
      setOrgBusy(false)
    }
  }

  // ── Automatizaciones ──

  const setMemberField = (kind, key, value) => setAutoDraft(d => ({ ...d, [kind]: { ...d[kind], [key]: value } }))

  const applyMemberPreset = (kind, preset) => setAutoDraft(d => ({
    ...d,
    [kind]: {
      ...d[kind],
      title: preset.title,
      message: resolveChannelTokens(preset.message, serverChannels),
      color: preset.color,
    },
  }))

  const insertVariable = (kind, variable) => setAutoDraft(d => {
    const current = d[kind].message
    const glue = current && !/\s$/.test(current) ? ' ' : ''
    return { ...d, [kind]: { ...d[kind], message: `${current}${glue}${variable}` } }
  })

  const saveMemberMessage = async (kind) => {
    setAutoBusy(kind)
    setAutoError('')
    setAutoNotice('')
    try {
      const data = await api('/admin/discord/automations', { method: 'PATCH', body: { [kind]: autoDraft[kind] } })
      setAutomations(data.automations)
      setAutoNotice(`${MEMBER_MSG_META[kind].label} guardada.`)
    } catch (err) {
      setAutoError(err.message || 'No se pudo guardar.')
    } finally {
      setAutoBusy('')
    }
  }

  const testMemberMessage = async (kind) => {
    setAutoBusy(`${kind}-test`)
    setAutoError('')
    setAutoNotice('')
    try {
      const data = await api(`/admin/discord/automations/${kind}/test`, { method: 'POST', body: {} })
      setAutoNotice(`Prueba enviada a #${data.channelName || 'Discord'}. Revisa como quedo.`)
    } catch (err) {
      setAutoError(err.message || 'No se pudo enviar la prueba.')
    } finally {
      setAutoBusy('')
    }
  }

  const toggleAutomation = async (key, value) => {
    setAutoBusy(key)
    setAutoError('')
    setAutoNotice('')
    try {
      const data = await api('/admin/discord/automations', { method: 'PATCH', body: { [key]: value } })
      setAutomations(data.automations)
    } catch (err) {
      setAutoError(err.message || 'No se pudo guardar.')
    } finally {
      setAutoBusy('')
    }
  }

  const onMemberImagePicked = kind => async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setAutoError('Solo imagenes (PNG, JPG, GIF, WEBP).'); return }
    if (file.size > 8 * 1024 * 1024) { setAutoError('La imagen supera 8MB.'); return }
    setAutoBusy(`${kind}-upload`)
    setAutoError('')
    try {
      const data = await uploadFile(file)
      setMemberField(kind, 'imageUrl', data.url)
    } catch (err) {
      setAutoError(err.message || 'No se pudo subir la imagen.')
    } finally {
      setAutoBusy('')
    }
  }

  // ── Foros ──

  const loadForumThreads = (forumId) => {
    setForumData(d => ({ ...d, [forumId]: { threads: [], tags: [], ...(d[forumId] || {}), state: 'loading', error: '' } }))
    api(`/admin/discord/forums/${forumId}/threads`)
      .then(data => setForumData(d => ({ ...d, [forumId]: { state: 'ok', threads: data.threads || [], tags: data.tags || [], error: '' } })))
      .catch(err => setForumData(d => ({ ...d, [forumId]: { state: 'error', threads: [], tags: [], error: err.message || 'No se pudieron cargar los temas.' } })))
  }

  const toggleForum = (forumId) => {
    setOpenForumId(prev => (prev === forumId ? '' : forumId))
    if (!forumData[forumId]) loadForumThreads(forumId)
  }

  const deleteThread = async (forumId, thread) => {
    if (!window.confirm(`¿Borrar el tema "${thread.name}" con todas sus respuestas? No se puede deshacer.`)) return
    setForumError('')
    try {
      await api(`/admin/discord/threads/${thread.id}`, { method: 'DELETE' })
      loadForumThreads(forumId)
      loadPublications()
    } catch (err) {
      setForumError(err.message || 'No se pudo borrar el tema.')
    }
  }

  // ── Publicaciones ──

  const openNewPublication = () => {
    setActiveTab('publish')
    setForumPostMode(false)
    setEditingPublished(false)
    setForm(EMPTY_FORM)
    setEditingId('')
    setShowForm(true)
  }

  const openNewVersionPublication = () => {
    setActiveTab('publish')
    setForumPostMode(false)
    setEditingPublished(false)
    setForm({ ...EMPTY_FORM, type: 'version' })
    setEditingId('')
    setShowForm(true)
  }

  const openForumPublication = (forum) => {
    setActiveTab('publish')
    setForumPostMode(true)
    setEditingPublished(false)
    setForm({ ...EMPTY_FORM, targetChannelId: forum.id })
    setEditingId('')
    setShowForm(true)
    setPubError('')
    setPubNotice('')
    if (!forumData[forum.id]) loadForumThreads(forum.id)
  }

  const pickTargetChannel = (channelId) => {
    setForm(f => ({ ...f, targetChannelId: channelId, appliedTags: [] }))
    setPubError('')
    const channel = serverChannels.find(c => c.id === channelId)
    if (channel?.type === 15 && !forumData[channelId]) loadForumThreads(channelId)
  }

  const toggleTag = (tagId) => setForm(f => ({
    ...f,
    appliedTags: f.appliedTags.includes(tagId) ? f.appliedTags.filter(id => id !== tagId) : [...f.appliedTags, tagId].slice(0, 5),
  }))

  const retractPublication = async (pub) => {
    if (!window.confirm(`¿Borrar "${pub.title}" de Discord? La publicacion vuelve a la cola por si quieres corregirla y publicarla otra vez.`)) return
    setPubBusy(pub._id)
    setPubError('')
    setPubNotice('')
    try {
      await api(`/admin/discord/publications/${pub._id}/retract`, { method: 'POST', body: {} })
      setPubNotice(`${pub.publicId} retirado de Discord. Quedo en la cola.`)
      loadPublications()
    } catch (err) {
      setPubError(err.message || 'No se pudo retirar de Discord.')
    } finally {
      setPubBusy('')
    }
  }

  const editPublication = (pub) => {
    setActiveTab('publish')
    setForumPostMode(false)
    setEditingPublished(pub.status === 'published')
    setForm({
      type: pub.type,
      title: pub.title || '',
      body: pub.body || '',
      url: pub.url || '',
      imageUrl: pub.imageUrl || '',
      ctaLabel: pub.ctaLabel || '',
      ctaUrl: pub.ctaUrl || '',
      targetChannelId: pub.targetChannelId || '',
      appliedTags: pub.appliedTags || [],
    })
    setEditingId(pub._id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Mensaje predeterminado: rellena titulo/texto/boton; la imagen y el canal
  // elegidos se respetan.
  const applyPublicationPreset = (preset) => setForm(f => ({
    ...f,
    title: resolveChannelTokens(preset.title, serverChannels),
    body: resolveChannelTokens(preset.body, serverChannels),
    ctaLabel: preset.ctaLabel ?? f.ctaLabel,
    ctaUrl: preset.ctaUrl ?? f.ctaUrl,
  }))

  const applyTemplate = (id) => {
    const tpl = templates.find(t => t._id === id)
    if (!tpl) return
    setForm(f => ({
      ...f,
      type: tpl.type || f.type,
      title: tpl.title || '',
      body: tpl.body || '',
      imageUrl: tpl.imageUrl || f.imageUrl,
      ctaLabel: tpl.ctaLabel || '',
      ctaUrl: tpl.ctaUrl || '',
    }))
  }

  const saveAsTemplate = async () => {
    const name = window.prompt('Nombre de la plantilla', form.title.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 60))
    if (!name) return
    try {
      await api('/admin/discord/templates', { method: 'POST', body: { ...form, name } })
      setTemplateNotice(`Plantilla "${name}" guardada.`)
      loadTemplates()
    } catch (err) {
      setPubError(err.message || 'No se pudo guardar la plantilla.')
    }
  }

  const deleteTemplate = async (tpl) => {
    if (!window.confirm(`¿Borrar la plantilla "${tpl.name}"?`)) return
    try {
      await api(`/admin/discord/templates/${tpl._id}`, { method: 'DELETE' })
      loadTemplates()
    } catch (err) {
      setPubError(err.message || 'No se pudo borrar la plantilla.')
    }
  }

  const onImagePicked = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setPubError('Solo imagenes (PNG, JPG, GIF, WEBP).'); return }
    if (file.size > 8 * 1024 * 1024) { setPubError('La imagen supera 8MB.'); return }
    setUploading(true)
    setPubError('')
    try {
      const data = await uploadFile(file)
      setForm(f => ({ ...f, imageUrl: data.url }))
    } catch (err) {
      setPubError(err.message || 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const submitPublication = async (event) => {
    event.preventDefault()
    if (forumPostMode && !serverChannels.some(channel => channel.id === form.targetChannelId && channel.type === 15)) {
      setPubError('Selecciona un canal de tipo Foro para crear el tema.')
      return
    }
    setPubBusy('create')
    setPubError('')
    try {
      const target = serverChannels.find(c => c.id === form.targetChannelId)
      const body = { ...form, channelName: target?.name || '' }
      if (editingId) {
        await api(`/admin/discord/publications/${editingId}`, { method: 'PATCH', body })
      } else {
        await api('/admin/discord/publications', { method: 'POST', body })
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
      setForumPostMode(false)
      setPubNotice(editingPublished ? 'Mensaje actualizado en Discord.' : editingId ? 'Publicacion actualizada.' : 'Publicacion creada y puesta en cola.')
      setEditingId('')
      setEditingPublished(false)
      loadPublications()
    } catch (err) {
      setPubError(err.message || 'No se pudo crear la publicacion.')
    } finally {
      setPubBusy('')
    }
  }

  const publishNow = async (pub) => {
    setPubBusy(pub._id)
    setPubError('')
    setPubNotice('')
    try {
      const data = await api(`/admin/discord/publications/${pub._id}/publish`, { method: 'POST', body: {} })
      const result = data.publication
      if (result?.status === 'published') setPubNotice(`${result.publicId} publicado en #${result.channelName || 'Discord'}.`)
      else setPubError(result?.error || 'No se pudo publicar en Discord.')
      loadPublications()
    } catch (err) {
      setPubError(err.message || 'No se pudo publicar en Discord.')
    } finally {
      setPubBusy('')
    }
  }

  const archive = async (pub) => {
    setPubBusy(pub._id)
    try {
      await api(`/admin/discord/publications/${pub._id}/archive`, { method: 'POST', body: {} })
      loadPublications()
    } catch (err) {
      setPubError(err.message || 'No se pudo archivar.')
    } finally {
      setPubBusy('')
    }
  }

  const functionChannelLabel = (type) => {
    const fn = typeFunctions[type]
    const mapped = channelMap[fn]
    return mapped?.channelId ? `#${mapped.channelName}` : `Sin canal de ${functionLabels[fn] || fn || '?'}`
  }

  const targetLabel = (pub) => (pub.targetChannelId
    ? `#${pub.channelName || pub.targetChannelId}`
    : functionChannelLabel(pub.type))

  useEffect(() => { load() }, [status])
  useEffect(() => { loadConfig(); loadPublications(); loadTemplates(); loadServerStatus(); loadAutomations() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'automations' && channelsState === 'idle') loadChannels() }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'publish' && channelsState === 'idle') loadChannels() }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'forums' && channelsState === 'idle') loadChannels() }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'overview' && serverState === 'idle') loadServerStatus() }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps
  // Canales siempre se relee al entrar: lo que se borra en Discord no debe
  // seguir apareciendo por tener la pestaña abierta desde antes.
  useEffect(() => { if (activeTab === 'channels') loadChannels() }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedChannel = channels.find(c => c.id === selectedChannelId) || null
  // El formulario de edicion arranca con los datos reales del canal elegido.
  useEffect(() => {
    setChannelEdit(selectedChannel ? {
      name: selectedChannel.name || '',
      topic: selectedChannel.topic || '',
      rateLimitPerUser: selectedChannel.rateLimitPerUser || 0,
      parentId: selectedChannel.parentId || '',
    } : null)
  }, [selectedChannelId, channels]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectedTournamentInfo = selectedChannel?.tournamentInfo || tournamentCategories[selectedChannel?.id] || tournamentCategories[selectedChannel?.parentId] || null
  const selectedIsTournamentChannel = Boolean(selectedTournamentInfo || selectedChannel?.managedScope === 'tournament')
  const publishableChannels = serverChannels.filter(c => PUBLISHABLE_CHANNEL_TYPES.has(c.type))
  const textChannels = serverChannels.filter(c => c.type === 0 || c.type === 5)
  const categories = serverChannels.filter(c => c.type === 4)
  const forums = serverChannels.filter(c => c.type === 15)
  const guildId = serverStatus?.guild?.id || ''
  const formTarget = serverChannels.find(c => c.id === form.targetChannelId)
  const formForumTags = formTarget?.type === 15 ? forumData[formTarget.id]?.tags || [] : []
  const composerPresets = formTarget?.type === 15 ? presetsForForum(formTarget.name) : PUBLICATION_PRESETS[form.type] || []
  // Arbol de carpetas: Servidor -> categorias de Discord -> canales;
  // Torneos -> un torneo -> sus canales + salas de equipo.
  const serverTree = useMemo(() => {
    const items = serverChannels.filter(c => c.type !== 4)
    return {
      categories: categories.slice().sort(byPosition).map(cat => ({
        cat,
        channels: items.filter(c => c.parentId === cat.id).sort(byPosition),
      })),
      loose: items.filter(c => !c.parentId || !categories.some(cat => cat.id === c.parentId)).sort(byPosition),
    }
  }, [serverChannels]) // eslint-disable-line react-hooks/exhaustive-deps

  const tournamentTree = useMemo(() => {
    const groups = new Map()
    for (const channel of tournamentChannels) {
      const info = channel.tournamentInfo || tournamentCategories[channel.id] || tournamentCategories[channel.parentId]
      if (!info || channel.type === 4) continue
      if (!groups.has(info.tournamentId)) groups.set(info.tournamentId, { info, channels: [], teams: new Map() })
      const group = groups.get(info.tournamentId)
      if (info.kind === 'team') {
        const name = info.teamName || 'Equipo'
        if (!group.teams.has(name)) group.teams.set(name, [])
        group.teams.get(name).push(channel)
      } else {
        group.channels.push(channel)
      }
    }
    return [...groups.values()].map(g => ({
      ...g,
      channels: g.channels.sort(byPosition),
      teams: [...g.teams.entries()].map(([name, channels]) => ({ name, channels: channels.sort(byPosition) })),
      total: g.channels.length + [...g.teams.values()].reduce((n, list) => n + list.length, 0),
    }))
  }, [tournamentChannels, tournamentCategories])

  // canalId -> funciones que cumple (para la etiqueta de la fila).
  const functionsByChannel = {}
  for (const [fn, mapped] of Object.entries(channelMap)) {
    if (mapped?.channelId) (functionsByChannel[mapped.channelId] ||= []).push(functionLabels[fn] || fn)
  }

  const activeTournamentId = selectedTournamentId || (selectedIsTournamentChannel ? selectedTournamentInfo?.tournamentId : '')
  const selectedTournament = tournamentTree.find(t => t.info.tournamentId === activeTournamentId)?.info || null
  const selectedCategoryChildren = selectedChannel?.type === 4 ? serverTree.categories.find(c => c.cat.id === selectedChannel.id)?.channels.length || 0 : 0

  const memberDirty = kind => JSON.stringify({ ...EMPTY_MEMBER_MSG, ...(automations?.[kind] || {}) }) !== JSON.stringify(autoDraft[kind])
  const queuedCount = publications.filter(p => p.status === 'ready' || p.status === 'failed').length
  const missingFunctions = Object.keys(functionLabels).filter(fn => !channelMap[fn]?.channelId)
  const link = serverState === 'loading' || serverState === 'idle'
    ? { crm: 'wait', bot: 'wait' }
    : { crm: serverStatus?.crm ? 'ok' : 'bad', bot: serverStatus?.bot ? 'ok' : 'bad' }
  const previewImage = form.imageUrl

  const stats = useMemo(() => ({
    total: events.length,
    pending: events.filter(e => e.status === 'pending').length,
    failed: events.filter(e => e.status === 'failed').length,
    done: events.filter(e => e.status === 'done').length,
  }), [events])

  const retry = async (eventId) => {
    setBusy(eventId)
    try {
      await api(`/admin/discord/events/${eventId}/retry`, { method: 'POST', body: {} })
      load()
    } catch (err) {
      setError(err.message || 'No se pudo reintentar el evento.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="gg-admin-page adsync">
      <div className="gg-admin-page__header adsync__hero">
        <div>
          <span className="adsync__eyebrow">{Icon.discord} GlitchGang Control Center</span>
          <h2>Discord Sync</h2>
          <p>Controla el servidor general de Discord desde la web: lo que publicas aqui viaja web → CRM → bot.</p>
        </div>
        <div className="adsync__hero-actions">
          <Button size="sm" variant="ghost" onClick={refreshAll}>{Icon.refresh} Actualizar todo</Button>
          <Button size="sm" onClick={openNewPublication}>{Icon.plus} Nueva publicacion</Button>
        </div>
      </div>

      <div className="adsync__links" role="status">
        <span className="is-ok"><i />Web</span>
        <span className={`is-${link.crm}`}><i />CRM</span>
        <span className={`is-${link.bot}`}><i />Bot</span>
        <p>
          {link.bot === 'wait' && 'Comprobando conexion...'}
          {link.bot === 'ok' && 'Todo conectado: lo que publiques llega a Discord.'}
          {link.bot === 'bad' && link.crm === 'bad' && 'El CRM no responde: enciendelo (npm run dev en discord-bot) y revisa CRM_PORTAL_URL/BOT_API_KEY en backend/.env.'}
          {link.bot === 'bad' && link.crm === 'ok' && 'El CRM responde pero el bot no: enciende el bot (npm run dev en discord-bot).'}
        </p>
      </div>

      <div className="adsync__kpis">
        <div><b>{channelsState === 'ok' ? serverChannels.length : '—'}</b><span>Canales servidor</span></div>
        <div><b>{channelsState === 'ok' ? tournamentChannels.length : '—'}</b><span>Canales torneos</span></div>
        <div><b>{queuedCount}</b><span>En cola</span></div>
        <div className="is-bad"><b>{stats.failed}</b><span>Eventos fallidos</span></div>
      </div>

      <div className="adsync__tabs">
        {CONTROL_TABS.map(tab => (
          <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="adsync__grid">
          <article className="adsync__panel adsync__panel--wide">
            <div className="adsync__section-head">
              <div>
                <h3>Estado del servidor</h3>
                <p>Datos en vivo del bot conectado a discord.glitchgang.net.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={loadServerStatus} disabled={serverState === 'loading'}>{Icon.refresh} Actualizar</Button>
            </div>

            {serverState === 'loading' && <p className="adsync__hint">Consultando el bot...</p>}
            {serverState === 'error' && <div className="adsync__error">{Icon.alert} {serverError}</div>}
            {serverState === 'ok' && serverStatus && (
              <div className="adsync__server-grid">
                <div><dt>Estado</dt><b className={serverStatus.online ? 'is-ok' : 'is-bad'}>{serverStatus.online ? 'En linea' : 'Desconectado'}</b></div>
                <div><dt>Servidor</dt><b>{serverStatus.guild?.name || '—'}</b></div>
                <div><dt>Miembros</dt><b>{serverStatus.guild?.memberCount ?? '—'}</b></div>
                <div><dt>En linea</dt><b>{serverStatus.guild?.onlineCount ?? '—'}</b></div>
                <div><dt>Latencia</dt><b>{serverStatus.latencyMs != null ? `${serverStatus.latencyMs} ms` : '—'}</b></div>
                <div><dt>Boost</dt><b>Nivel {serverStatus.guild?.boostLevel ?? 0} ({serverStatus.guild?.boostCount ?? 0})</b></div>
                <div><dt>Canales</dt><b>{serverStatus.guild?.channels?.total ?? '—'}</b></div>
                <div><dt>Roles</dt><b>{serverStatus.guild?.roles ?? '—'}</b></div>
              </div>
            )}
          </article>

          <aside className="adsync__panel">
            <h3>Automatizaciones</h3>
            <ul className="adsync__checklist">
              <li className={automations?.welcome?.enabled ? '' : 'is-off'}>
                {automations?.welcome?.enabled ? Icon.check : Icon.clock} Bienvenida {automations?.welcome?.enabled ? `→ #${automations.welcome.channelName || 'canal'}` : '(apagada)'}
              </li>
              <li className={automations?.farewell?.enabled ? '' : 'is-off'}>
                {automations?.farewell?.enabled ? Icon.check : Icon.clock} Despedida {automations?.farewell?.enabled ? `→ #${automations.farewell.channelName || automations?.welcome?.channelName || 'canal'}` : '(apagada)'}
              </li>
              <li>
                {Icon.check} Noticia publicada en la web → {automations?.newsAutoPublish ? 'sale sola a Discord' : 'cola (tu le das Publicar)'}
              </li>
              <li>{Icon.check} Anuncio, banner, marca, version o tema de foro → cola → su canal</li>
            </ul>
            <Button size="sm" variant="ghost" onClick={() => setActiveTab('automations')}>{Icon.gear} Configurar</Button>
          </aside>
        </section>
      )}

      {activeTab === 'channels' && (
        <section className="adsync__split">
          <div className="adsync__panel adsync__tree-panel">
            <div className="adsync__section-head">
              <h3>Canales</h3>
              <div className="adsync__actions">
                <Button size="sm" variant="ghost" onClick={loadChannels} disabled={channelsState === 'loading'} title="Recargar desde Discord">{Icon.refresh}</Button>
                {newChannel
                  ? <Button size="sm" variant="ghost" onClick={() => setNewChannel(null)}>Cancelar</Button>
                  : <Button size="sm" onClick={() => { setNewChannel({ name: '', type: 'text', parentId: '', topic: '' }); setChannelActionError(''); setChannelNotice('') }}>{Icon.plus} Nuevo</Button>}
              </div>
            </div>
            {newChannel && (
              <form className="adsync__form adsync__form--compact" onSubmit={submitNewChannel}>
                <label className="is-wide">
                  <span>Nombre</span>
                  <input required autoFocus maxLength={100} value={newChannel.name} placeholder="anuncios-torneos" onChange={e => setNewChannel(c => ({ ...c, name: e.target.value }))} />
                </label>
                <label>
                  <span>Tipo</span>
                  <select value={newChannel.type} onChange={e => setNewChannel(c => ({ ...c, type: e.target.value, parentId: e.target.value === 'category' ? '' : c.parentId }))}>
                    {NEW_CHANNEL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {newChannel.type !== 'category' && (
                  <label>
                    <span>Carpeta</span>
                    <select value={newChannel.parentId} onChange={e => setNewChannel(c => ({ ...c, parentId: e.target.value }))}>
                      <option value="">Sin carpeta</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </label>
                )}
                <div className="adsync__actions is-wide">
                  <Button size="sm" type="submit" disabled={channelBusy === 'create'}>{Icon.check} {channelBusy === 'create' ? 'Creando...' : 'Crear'}</Button>
                </div>
              </form>
            )}
            {channelsState === 'loading' && channels.length === 0 && <p className="adsync__hint">Cargando...</p>}
            {channelsState === 'error' && <div className="adsync__error">{Icon.alert} {channelsError}</div>}
            {(channelsState === 'ok' || channels.length > 0) && (
              <div className="adsync__tree">
                <Folder
                  open={openFolders.server}
                  onToggle={() => toggleFolder('server')}
                  icon={Icon.discord}
                  label="Servidor"
                  count={serverChannels.filter(c => c.type !== 4).length}
                >
                  {serverTree.categories.map(({ cat, channels: items }) => (
                    <Folder
                      key={cat.id}
                      level={1}
                      open={openFolders[cat.id]}
                      onToggle={() => toggleFolder(cat.id)}
                      icon={Icon.layers}
                      label={cat.name}
                      count={items.length}
                      active={selectedChannelId === cat.id}
                      onSelect={() => selectChannel(cat.id)}
                    >
                      {items.map(channel => (
                        <ChannelRow
                          key={channel.id}
                          channel={channel}
                          active={selectedChannelId === channel.id}
                          badge={functionsByChannel[channel.id]?.join(', ')}
                          onClick={() => selectChannel(channel.id)}
                        />
                      ))}
                      {items.length === 0 && <p className="adsync__tree-empty">Vacia</p>}
                    </Folder>
                  ))}
                  {serverTree.loose.map(channel => (
                    <ChannelRow
                      key={channel.id}
                      channel={channel}
                      active={selectedChannelId === channel.id}
                      badge={functionsByChannel[channel.id]?.join(', ')}
                      onClick={() => selectChannel(channel.id)}
                    />
                  ))}
                </Folder>

                <Folder
                  open={openFolders.tournaments}
                  onToggle={() => toggleFolder('tournaments')}
                  icon={Icon.trophy}
                  label="Torneos"
                  sub="solo lectura"
                  count={tournamentTree.length}
                >
                  {tournamentTree.length === 0 && <p className="adsync__tree-empty">Ningun torneo tiene canales en Discord ahora.</p>}
                  {tournamentTree.map(group => {
                    const key = `t-${group.info.tournamentId}`
                    return (
                      <Folder
                        key={key}
                        level={1}
                        open={openFolders[key]}
                        onToggle={() => toggleFolder(key)}
                        icon={Icon.trophy}
                        label={group.info.title || 'Torneo'}
                        sub={group.info.organizerNick ? `@${group.info.organizerNick}` : ''}
                        count={group.total}
                        active={selectedTournamentId === group.info.tournamentId}
                        onSelect={() => selectTournament(group.info.tournamentId)}
                      >
                        {group.channels.map(channel => (
                          <ChannelRow key={channel.id} channel={channel} locked active={selectedChannelId === channel.id} onClick={() => selectChannel(channel.id)} />
                        ))}
                        {group.teams.map(team => (
                          <Folder
                            key={team.name}
                            level={2}
                            open={openFolders[`${key}-${team.name}`]}
                            onToggle={() => toggleFolder(`${key}-${team.name}`)}
                            icon={Icon.users}
                            label={team.name}
                            count={team.channels.length}
                          >
                            {team.channels.map(channel => (
                              <ChannelRow key={channel.id} channel={channel} locked active={selectedChannelId === channel.id} onClick={() => selectChannel(channel.id)} />
                            ))}
                          </Folder>
                        ))}
                      </Folder>
                    )
                  })}
                </Folder>
              </div>
            )}
          </div>

          <div className="adsync__panel adsync__detail">
            {channelNotice && <div className="adsync__notice">{Icon.check} {channelNotice}</div>}
            {channelActionError && <div className="adsync__error">{Icon.alert} {channelActionError}</div>}

            {selectedTournament ? (
              <>
                <div className="adsync__detail-head">
                  <span className="adsync__tree-icon">{Icon.trophy}</span>
                  <div>
                    <h3>{selectedChannel ? `#${selectedChannel.name}` : selectedTournament.title}</h3>
                    <p>
                      {selectedChannel ? `${selectedTournament.title} · ` : ''}
                      {selectedTournamentInfo?.kind === 'team' && selectedChannel ? `${selectedTournamentInfo.teamName} · ` : ''}
                      Organiza {selectedTournament.organizerNick ? `@${selectedTournament.organizerNick}` : 'un tercero'}
                    </p>
                  </div>
                  <span className="adsync__lock-pill">{Icon.lock} Solo lectura</span>
                </div>
                <p className="adsync__hint">Es un torneo de un tercero: no se edita desde aqui. Puedes escribirle al organizador.</p>
                {selectedTournament.organizerId ? (
                  <>
                    <div className="adsync__actions">
                      {Object.entries(ORGANIZER_ACTIONS).map(([kind, action]) => (
                        <Button
                          key={kind}
                          size="sm"
                          variant={orgAction?.kind === kind ? undefined : 'ghost'}
                          onClick={() => setOrgAction(a => (a?.kind === kind ? null : { kind, message: a?.message || '' }))}
                        >
                          {kind === 'warn' ? Icon.alert : kind === 'notify' ? Icon.bell : Icon.shield} {action.label}
                        </Button>
                      ))}
                    </div>
                    {orgAction && (
                      <form className="adsync__form adsync__form--compact" onSubmit={e => sendOrganizerNotice(e, selectedTournament)}>
                        <label className="is-wide">
                          <span>{ORGANIZER_ACTIONS[orgAction.kind].title(selectedTournament.title)}</span>
                          <textarea
                            required
                            autoFocus
                            rows={3}
                            maxLength={400}
                            value={orgAction.message}
                            placeholder="Escribe el mensaje para el organizador"
                            onChange={e => setOrgAction(a => ({ ...a, message: e.target.value }))}
                          />
                        </label>
                        <div className="adsync__actions is-wide">
                          <Button size="sm" type="submit" disabled={orgBusy}>{Icon.send} {orgBusy ? 'Enviando...' : 'Enviar'}</Button>
                        </div>
                      </form>
                    )}
                  </>
                ) : (
                  <p className="adsync__hint">Este torneo no tiene organizador registrado.</p>
                )}
              </>
            ) : selectedChannel ? (
              <>
                <div className="adsync__detail-head">
                  <span className="adsync__tree-icon">{CHANNEL_TYPE_ICON[selectedChannel.type] || Icon.layers}</span>
                  <div>
                    <h3>{selectedChannel.type === 4 ? selectedChannel.name : `#${selectedChannel.name}`}</h3>
                    <p>
                      {CHANNEL_TYPE_LABEL[selectedChannel.type] || 'Canal'}
                      {selectedChannel.type === 4 ? ` · ${selectedCategoryChildren} canales` : selectedChannel.parentName ? ` · ${selectedChannel.parentName}` : ''}
                    </p>
                  </div>
                </div>
                {channelEdit && (
                  <form className="adsync__form adsync__form--compact" onSubmit={saveChannel}>
                    <label className={selectedChannel.type === 4 ? 'is-wide' : ''}>
                      <span>Nombre</span>
                      <input required maxLength={100} value={channelEdit.name} onChange={e => setChannelEdit(c => ({ ...c, name: e.target.value }))} />
                    </label>
                    {selectedChannel.type !== 4 && (
                      <label>
                        <span>Carpeta</span>
                        <select value={channelEdit.parentId} onChange={e => setChannelEdit(c => ({ ...c, parentId: e.target.value }))}>
                          <option value="">Sin carpeta</option>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                      </label>
                    )}
                    {TOPIC_TYPES.has(selectedChannel.type) && (
                      <label className={SLOWMODE_TYPES.has(selectedChannel.type) ? '' : 'is-wide'}>
                        <span>Tema</span>
                        <input maxLength={1024} value={channelEdit.topic} placeholder="Sin tema" onChange={e => setChannelEdit(c => ({ ...c, topic: e.target.value }))} />
                      </label>
                    )}
                    {SLOWMODE_TYPES.has(selectedChannel.type) && (
                      <label>
                        <span>Modo lento</span>
                        <select value={channelEdit.rateLimitPerUser} onChange={e => setChannelEdit(c => ({ ...c, rateLimitPerUser: Number(e.target.value) }))}>
                          {[[0, 'Apagado'], [5, '5 s'], [30, '30 s'], [60, '1 min'], [300, '5 min'], [900, '15 min'], [3600, '1 h']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          {![0, 5, 30, 60, 300, 900, 3600].includes(Number(channelEdit.rateLimitPerUser)) && <option value={channelEdit.rateLimitPerUser}>{channelEdit.rateLimitPerUser} s</option>}
                        </select>
                      </label>
                    )}
                    <div className="adsync__actions is-wide">
                      <Button size="sm" type="submit" disabled={Boolean(channelBusy)}>{Icon.check} {channelBusy === 'save' ? 'Guardando...' : 'Guardar'}</Button>
                      <button type="button" className="adsync__danger" onClick={removeChannel} disabled={Boolean(channelBusy)}>
                        {Icon.trash} {channelBusy === 'delete' ? 'Borrando...' : 'Borrar'}
                      </button>
                    </div>
                  </form>
                )}
                {PUBLISHABLE_CHANNEL_TYPES.has(selectedChannel.type) && (
                  <div className="adsync__fn-chips">
                    <span>Usar para</span>
                    {configError && <div className="adsync__error">{Icon.alert} {configError}</div>}
                    <div className="adsync__vars">
                      {Object.entries(functionLabels).map(([fn, label]) => {
                        const current = channelMap[fn]
                        const isHere = current?.channelId === selectedChannel.id
                        return (
                          <button
                            key={fn}
                            type="button"
                            className={isHere ? 'active' : ''}
                            disabled={savingFn === fn}
                            title={isHere ? 'Quitar' : current?.channelId ? `Ahora en #${current.channelName}` : 'Sin canal'}
                            onClick={() => assignFunction(fn, isHere ? null : selectedChannel)}
                          >
                            {isHere && Icon.check} {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="adsync__hint">Elige un canal o una carpeta.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'automations' && (
        <section className="adsync__panel">
          <div className="adsync__section-head">
            <div>
              <h3>Automatizaciones del servidor</h3>
              <p>Lo que el bot hace solo, sin que tengas que entrar a Discord.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={loadAutomations} disabled={autoState === 'loading'}>{Icon.refresh}</Button>
          </div>

          {autoNotice && <div className="adsync__notice">{Icon.check} {autoNotice}</div>}
          {autoError && <div className="adsync__error">{Icon.alert} {autoError}</div>}
          {autoState === 'loading' && !automations && <p className="adsync__hint">Cargando...</p>}

          {automations && (
            <>
              <div className="adsync__toggles">
                <label className="adsync__toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(automations.newsAutoPublish)}
                    disabled={autoBusy === 'newsAutoPublish'}
                    onChange={e => toggleAutomation('newsAutoPublish', e.target.checked)}
                  />
                  <span>
                    <b>Noticias automaticas</b>
                    <small>Cuando publicas una noticia en Admin Noticias sale sola al canal de Noticias. Apagado: queda en la cola hasta que le das Publicar.</small>
                  </span>
                </label>
                <label className="adsync__toggle">
                  <input
                    type="checkbox"
                    checked={automations.welcomeDm !== false}
                    disabled={autoBusy === 'welcomeDm'}
                    onChange={e => toggleAutomation('welcomeDm', e.target.checked)}
                  />
                  <span>
                    <b>Mensaje privado para vincular cuenta</b>
                    <small>Al que entra sin cuenta de GlitchGang vinculada, el bot le manda por privado el enlace para vincularla.</small>
                  </span>
                </label>
              </div>

              <div className="adsync__member-msgs">
                {['welcome', 'farewell'].map(kind => {
                  const meta = MEMBER_MSG_META[kind]
                  const draft = autoDraft[kind]
                  const dirty = memberDirty(kind)
                  const channelPlaceholder = kind === 'farewell' && autoDraft.welcome.channelId
                    ? `El mismo de la bienvenida (#${autoDraft.welcome.channelName})`
                    : 'Elige un canal'
                  return (
                    <article key={kind} className={`adsync__member-card ${draft.enabled ? 'is-on' : ''}`}>
                      <div className="adsync__member-head">
                        <div>
                          <h4>{meta.label}</h4>
                          <p>{meta.when}</p>
                        </div>
                        <label className="adsync__switch" title={draft.enabled ? 'Encendida' : 'Apagada'}>
                          <input type="checkbox" checked={draft.enabled} onChange={e => setMemberField(kind, 'enabled', e.target.checked)} />
                          <span>{draft.enabled ? 'Encendida' : 'Apagada'}</span>
                        </label>
                      </div>

                      <div className="adsync__form adsync__form--flat">
                        <label className="is-wide">
                          <span>Canal</span>
                          <select
                            value={draft.channelId}
                            onChange={e => {
                              const channel = textChannels.find(c => c.id === e.target.value)
                              setAutoDraft(d => ({ ...d, [kind]: { ...d[kind], channelId: channel?.id || '', channelName: channel?.name || '' } }))
                            }}
                          >
                            <option value="">{channelPlaceholder}</option>
                            {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}{c.parentName ? ` · ${c.parentName}` : ''}</option>)}
                          </select>
                        </label>
                        <div className="adsync__presets is-wide">
                          <span>Mensaje predeterminado</span>
                          <div>
                            {MEMBER_PRESETS[kind].map(preset => {
                              const chosen = draft.title === preset.title
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  className={chosen ? 'active' : ''}
                                  style={{ '--preset-color': preset.color }}
                                  onClick={() => applyMemberPreset(kind, preset)}
                                >
                                  <b>{chosen && Icon.check} {preset.name}</b>
                                  <small>{renderSample(preset.title)}</small>
                                </button>
                              )
                            })}
                          </div>
                          <small>Elige uno y luego cambia lo que quieras abajo.</small>
                        </div>
                        <label className="is-wide">
                          <span>Titulo</span>
                          <input maxLength={256} value={draft.title} placeholder={meta.title} onChange={e => setMemberField(kind, 'title', e.target.value)} />
                        </label>
                        <label className="is-wide">
                          <span>Mensaje</span>
                          <textarea rows={9} maxLength={2000} value={draft.message} placeholder={meta.message} onChange={e => setMemberField(kind, 'message', e.target.value)} />
                          <small>Vacio = se usa el texto de ejemplo. **negrita** y *cursiva* funcionan.</small>
                        </label>
                        <div className="adsync__vars is-wide">
                          {MEMBER_VARIABLES.map(([variable, label]) => (
                            <button key={variable} type="button" onClick={() => insertVariable(kind, variable)} title={`Insertar ${variable}`}>
                              <code>{variable}</code> {label}
                            </button>
                          ))}
                        </div>
                        <div className="adsync__image is-wide">
                          <span>Imagen (opcional)</span>
                          {draft.imageUrl ? (
                            <div className="adsync__image-current">
                              <img src={draft.imageUrl} alt="" />
                              <Button size="sm" variant="ghost" type="button" onClick={() => setMemberField(kind, 'imageUrl', '')}>Quitar</Button>
                            </div>
                          ) : (
                            <label className="adsync__image-drop">
                              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onMemberImagePicked(kind)} disabled={autoBusy === `${kind}-upload`} />
                              {autoBusy === `${kind}-upload` ? 'Subiendo...' : <>{Icon.upload} Subir imagen o GIF (max 8MB)</>}
                            </label>
                          )}
                        </div>
                        <label>
                          <span>Color</span>
                          <input type="color" value={draft.color || meta.color} onChange={e => setMemberField(kind, 'color', e.target.value)} />
                        </label>
                      </div>

                      <div className="adsync__dc-msg adsync__dc-msg--compact">
                        <div className="adsync__dc-avatar">GG</div>
                        <div className="adsync__dc-body">
                          <div className="adsync__dc-author"><b>GlitchGang</b><em>BOT</em></div>
                          <div className="adsync__dc-embed" style={{ borderLeftColor: draft.color || meta.color }}>
                            <b className="adsync__dc-title">{renderSample(draft.title || meta.title, serverChannels)}</b>
                            <p>{renderSample(draft.message || meta.message, serverChannels)}</p>
                            {draft.imageUrl && <img src={draft.imageUrl} alt="" />}
                          </div>
                        </div>
                      </div>

                      <div className="adsync__actions">
                        <Button size="sm" onClick={() => saveMemberMessage(kind)} disabled={!dirty || autoBusy === kind}>
                          {Icon.check} {autoBusy === kind ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => testMemberMessage(kind)} disabled={dirty || autoBusy === `${kind}-test`} title={dirty ? 'Guarda primero' : 'Manda un ejemplo al canal'}>
                          {Icon.send} {autoBusy === `${kind}-test` ? 'Enviando...' : 'Enviar prueba'}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
              <p className="adsync__hint">
                Las imagenes subidas se ven en Discord solo cuando la web esta publicada (en local Discord no puede descargarlas; la prueba si las adjunta).
              </p>
            </>
          )}
        </section>
      )}

      {activeTab === 'publish' && (
        <section className="adsync__panel">
          <div className="adsync__section-head">
            <div>
              <h3>Cola de publicaciones</h3>
              <p>Lo creado en la web entra aqui. Al publicar viaja web → CRM → bot → Discord.</p>
            </div>
            <div className="adsync__actions">
              <Button size="sm" variant="ghost" onClick={loadPublications} disabled={pubState === 'loading'}>{Icon.refresh}</Button>
              {showForm
                ? <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(''); setForumPostMode(false); setEditingPublished(false) }}>Cancelar</Button>
                : <Button size="sm" onClick={openNewPublication}>{Icon.plus} Nueva</Button>}
            </div>
          </div>

          {missingFunctions.length > 0 && (
            <p className="adsync__hint">
              Sin canal asignado: {missingFunctions.map(fn => functionLabels[fn]).join(', ')}. Asignalos en la pestaña Canales.
            </p>
          )}
          {pubNotice && <div className="adsync__notice">{Icon.check} {pubNotice}</div>}
          {pubError && <div className="adsync__error">{Icon.alert} {pubError}</div>}

          {templateNotice && <div className="adsync__notice">{Icon.check} {templateNotice}</div>}

          {showForm && (
            <div className="adsync__composer">
            <form className="adsync__form" onSubmit={submitPublication}>
              <div className="adsync__templates is-wide">
                <span>{editingPublished ? 'Editando un mensaje que ya esta en Discord: al guardar se cambia alla tambien' : editingId ? 'Editando publicacion en cola' : 'Empezar desde una plantilla'}</span>
                <div>
                  {templates.map(tpl => (
                    <span key={tpl._id} className="adsync__tpl">
                      <button type="button" onClick={() => applyTemplate(tpl._id)}>{tpl.name}</button>
                      <button type="button" className="adsync__tpl-del" title="Borrar plantilla" onClick={() => deleteTemplate(tpl)}>×</button>
                    </span>
                  ))}
                  {templates.length === 0 && <em>Sin plantillas todavia.</em>}
                </div>
              </div>
              <label>
                <span>Tipo</span>
                <select value={form.type} disabled={editingPublished} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(PUBLICATION_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>{forumPostMode ? 'Foro' : 'Canal'}</span>
                <select value={form.targetChannelId} disabled={editingPublished} onChange={e => pickTargetChannel(e.target.value)}>
                  <option value="">{forumPostMode ? 'Selecciona un foro' : `Canal de su funcion (${functionChannelLabel(form.type)})`}</option>
                  {publishableChannels
                    .filter(channel => !forumPostMode || channel.type === 15)
                    .map(c => <option key={c.id} value={c.id}>#{c.name}{c.type === 15 ? ' (foro)' : ''}</option>)}
                </select>
              </label>
              {formForumTags.length > 0 && !editingPublished && (
                <div className="adsync__vars is-wide">
                  <span className="adsync__vars-label">Etiquetas del tema</span>
                  {formForumTags.map(tag => (
                    <button key={tag.id} type="button" className={form.appliedTags.includes(tag.id) ? 'active' : ''} onClick={() => toggleTag(tag.id)}>
                      {tag.emoji ? `${tag.emoji} ` : ''}{tag.name}
                    </button>
                  ))}
                </div>
              )}
              {!editingPublished && composerPresets.length > 0 && (
                <div className="adsync__presets is-wide">
                  <span>Mensaje predeterminado{formTarget?.type === 15 ? ` para #${formTarget.name}` : ` · ${PUBLICATION_TYPE_LABEL[form.type]}`}</span>
                  <div>
                    {composerPresets.map(preset => {
                      const chosen = form.title === resolveChannelTokens(preset.title, serverChannels)
                      return (
                        <button key={preset.id} type="button" className={chosen ? 'active' : ''} onClick={() => applyPublicationPreset(preset)}>
                          <b>{chosen && Icon.check} {preset.name}</b>
                          <small>{preset.title}</small>
                        </button>
                      )
                    })}
                  </div>
                  <small>Elige uno, completa lo que esta [entre corchetes] y publica.</small>
                </div>
              )}
              <label className="is-wide">
                <span>Titulo *</span>
                <input required maxLength={256} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </label>
              <label className="is-wide">
                <span>Texto</span>
                <textarea rows={10} maxLength={4000} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
                <small>**negrita**, *cursiva* y saltos de linea funcionan en Discord. {form.body.length}/4000</small>
              </label>
              <div className="adsync__image is-wide">
                <span>Imagen</span>
                {form.imageUrl ? (
                  <div className="adsync__image-current">
                    <img src={form.imageUrl} alt="" />
                    <Button size="sm" variant="ghost" type="button" onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}>Quitar</Button>
                  </div>
                ) : (
                  <label className="adsync__image-drop">
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onImagePicked} disabled={uploading} />
                    {uploading ? 'Subiendo...' : <>{Icon.plus} Subir imagen (max 8MB)</>}
                  </label>
                )}
              </div>
              <label>
                <span>Texto del boton</span>
                <input maxLength={80} value={form.ctaLabel} placeholder="Ver mas" onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))} />
              </label>
              <label>
                <span>Enlace del boton</span>
                <input value={form.ctaUrl} placeholder="/torneos o https://..." onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))} />
              </label>
              <label className="is-wide">
                <span>Enlace del titulo (opcional)</span>
                <input value={form.url} placeholder="/noticias/... o https://..." onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </label>
              <div className="adsync__actions is-wide">
                <Button size="sm" type="submit" disabled={pubBusy === 'create' || uploading}>{Icon.check} {editingPublished ? 'Guardar y actualizar en Discord' : editingId ? 'Guardar cambios' : forumPostMode ? 'Poner tema en cola' : 'Poner en cola'}</Button>
                <Button size="sm" variant="ghost" type="button" onClick={saveAsTemplate} disabled={!form.title && !form.body}>Guardar como plantilla</Button>
              </div>
            </form>

            <aside className="adsync__preview" aria-label="Vista previa en Discord">
              <span className="adsync__preview-label">Vista previa en Discord</span>
              <div className="adsync__dc-msg">
                <div className="adsync__dc-avatar">GG</div>
                <div className="adsync__dc-body">
                  <div className="adsync__dc-author"><b>GlitchGang</b><em>BOT</em></div>
                  <div className="adsync__dc-embed">
                    <b className="adsync__dc-title">{form.title ? renderSample(form.title, serverChannels) : 'Titulo de la publicacion'}</b>
                    {form.body && <p>{renderSample(form.body, serverChannels)}</p>}
                    {previewImage && <img src={previewImage} alt="" />}
                    <small>GlitchGang · PUB-…</small>
                  </div>
                  {form.ctaLabel && form.ctaUrl && <span className="adsync__dc-btn">{form.ctaLabel} ↗</span>}
                </div>
              </div>
            </aside>
            </div>
          )}

          {pubState === 'loading' && <p className="adsync__hint">Cargando publicaciones...</p>}
          {pubState === 'ok' && publications.length === 0 && !showForm && (
            <p className="adsync__hint">No hay nada en cola. Publica una noticia en Admin Noticias o crea una publicacion aqui.</p>
          )}
          <div className="adsync__cards">
            {publications.map(pub => (
              <article key={pub._id} className="adsync__publish-card">
                <div>
                  <code>{pub.publicId}</code>
                  <h4>{pub.title}</h4>
                  <p>{PUBLICATION_TYPE_LABEL[pub.type] || pub.type} · {SOURCE_LABEL[pub.sourceType] || pub.sourceType}{pub.sourceCode ? ` (${pub.sourceCode})` : ''}</p>
                  {pub.status === 'failed' && pub.error && <p className="adsync__card-error">{pub.error}</p>}
                  {pub.status === 'published' && <p>Publicado {fmt(pub.publishedAt)}</p>}
                </div>
                <div className="adsync__publish-side">
                  <span>{pub.status === 'published' ? `#${pub.channelName}` : targetLabel(pub)}</span>
                  <StatusPill value={PUBLICATION_STATUS_LABEL[pub.status] || pub.status} />
                </div>
                {pub.status !== 'published' ? (
                  <div className="adsync__actions">
                    <Button size="sm" onClick={() => publishNow(pub)} disabled={pubBusy === pub._id}>
                      {Icon.send} {pub.status === 'failed' ? 'Reintentar' : 'Publicar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => editPublication(pub)} disabled={pubBusy === pub._id}>{Icon.edit} Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(pub)} disabled={pubBusy === pub._id}>Archivar</Button>
                  </div>
                ) : (
                  <div className="adsync__actions">
                    <Button size="sm" variant="ghost" onClick={() => editPublication(pub)} disabled={pubBusy === pub._id}>{Icon.edit} Editar en Discord</Button>
                    {discordMessageUrl(guildId, pub) && (
                      <a className="adsync__link-btn" href={discordMessageUrl(guildId, pub)} target="_blank" rel="noreferrer">{Icon.eye} Ver</a>
                    )}
                    <button type="button" className="adsync__danger" onClick={() => retractPublication(pub)} disabled={pubBusy === pub._id}>
                      {Icon.trash} Retirar de Discord
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'versions' && (
        <section className="adsync__panel">
          <div className="adsync__section-head">
            <div>
              <h3>Versiones beta y lanzamiento</h3>
              <p>Frontend para administrar changelog, mejoras y publicaciones de version.</p>
            </div>
            <Button size="sm" onClick={openNewVersionPublication}>{Icon.plus} Nueva version</Button>
          </div>
          <div className="adsync__versions">
            {publications.filter(item => item.type === 'version' && item.status !== 'archived').map(item => (
              <article key={item._id}>
                <div>
                  <b>{item.publicId}</b>
                  <h4>{item.title}</h4>
                  <p>{item.body || 'Sin notas adicionales.'}</p>
                  {item.status === 'published' && <small>Publicado {fmt(item.publishedAt)}</small>}
                </div>
                <StatusPill value={PUBLICATION_STATUS_LABEL[item.status] || item.status} />
              </article>
            ))}
            {publications.every(item => item.type !== 'version' || item.status === 'archived') && (
              <p className="adsync__hint">Todavia no hay publicaciones de version.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'forums' && (
        <section className="adsync__panel">
          <div className="adsync__section-head">
            <div>
              <h3>Foros e interacciones</h3>
              <p>Los foros convierten mensajes de comunidad en casos rastreables.</p>
            </div>
          </div>
          {forumError && <div className="adsync__error">{Icon.alert} {forumError}</div>}
          {channelsState === 'loading' && <p className="adsync__hint">Buscando los foros del servidor...</p>}
          {channelsState === 'error' && <div className="adsync__error">{Icon.alert} {channelsError}</div>}
          {channelsState === 'ok' && forums.length === 0 && (
            <p className="adsync__hint">El servidor no tiene foros. Crea uno en la pestaña Canales (tipo Foro).</p>
          )}
          <div className="adsync__forum-list">
            {forums.map(forum => {
              const data = forumData[forum.id]
              const open = openForumId === forum.id
              return (
                <article key={forum.id} className={`adsync__forum ${open ? 'is-open' : ''}`}>
                  <div className="adsync__forum-head">
                    <span className="adsync__forum-icon">{Icon.messageSquare}</span>
                    <div>
                      <h4>#{forum.name}</h4>
                      <p>{forum.topic || forumHint(forum.name)}{forum.parentName ? ` · ${forum.parentName}` : ''}</p>
                    </div>
                    <div className="adsync__actions">
                      <Button size="sm" onClick={() => openForumPublication(forum)}>{Icon.plus} Nuevo tema</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleForum(forum.id)}>
                        {open ? 'Ocultar temas' : `Ver temas${data?.state === 'ok' ? ` (${data.threads.length})` : ''}`}
                      </Button>
                    </div>
                  </div>
                  {open && (
                    <div className="adsync__threads">
                      {data?.state === 'loading' && <p className="adsync__hint">Cargando temas...</p>}
                      {data?.state === 'error' && <div className="adsync__error">{Icon.alert} {data.error}</div>}
                      {data?.state === 'ok' && data.threads.length === 0 && <p className="adsync__hint">Este foro no tiene temas todavia.</p>}
                      {data?.threads?.map(thread => (
                        <div key={thread.id} className="adsync__thread">
                          <div>
                            <b>{thread.name}</b>
                            <small>
                              {fmt(thread.createdAt)}
                              {thread.messageCount != null && ` · ${thread.messageCount} respuestas`}
                              {thread.archived && ' · Archivado'}
                              {thread.locked && ' · Cerrado'}
                              {thread.appliedTags?.length > 0 && ` · ${thread.appliedTags.map(id => data.tags.find(t => t.id === id)?.name).filter(Boolean).join(', ')}`}
                            </small>
                          </div>
                          <div className="adsync__actions">
                            {guildId && (
                              <a className="adsync__link-btn" href={`https://discord.com/channels/${guildId}/${thread.id}`} target="_blank" rel="noreferrer">{Icon.eye} Abrir</a>
                            )}
                            <button type="button" className="adsync__danger" onClick={() => deleteThread(forum.id, thread)}>{Icon.trash} Borrar</button>
                          </div>
                        </div>
                      ))}
                      {data?.state === 'ok' && (
                        <Button size="sm" variant="ghost" onClick={() => loadForumThreads(forum.id)}>{Icon.refresh} Recargar</Button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {activeTab === 'events' && (
        <>
          <div className="gg-admin-controls">
            <div className="gg-admin-filter-tabs">
              {['all', 'pending', 'processing', 'failed', 'done'].map(value => (
                <button key={value} className={`gg-admin-filter-tab ${status === value ? 'active' : ''}`} onClick={() => setStatus(value)}>
                  {value === 'all' ? 'Todos' : STATUS_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="adsync__error">{Icon.alert} {error}</div>}

          <div className="gg-admin-card" style={{ padding: 0 }}>
            <div className="gg-datatable-wrap">
              <table className="gg-datatable adsync__table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Entidad</th>
                    <th>Estado</th>
                    <th>Intentos</th>
                    <th>Creado</th>
                    <th>Error</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="gg-datatable__empty">Cargando...</td></tr>
                  ) : events.length === 0 ? (
                    <tr><td colSpan={7} className="gg-datatable__empty">No hay eventos con este filtro.</td></tr>
                  ) : events.map(event => (
                    <tr key={event._id}>
                      <td><code>{event.type}</code></td>
                      <td>
                        <b>{event.entityType}</b>
                        <small>{event.entityId}</small>
                      </td>
                      <td><span className={`adsync__status is-${event.status}`}>{STATUS_LABEL[event.status] || event.status}</span></td>
                      <td>{event.attempts || 0}</td>
                      <td>{fmt(event.createdAt)}</td>
                      <td className="adsync__error-cell">{event.lastError || '-'}</td>
                      <td>
                        {event.status === 'failed' && (
                          <Button size="sm" variant="ghost" disabled={busy === event._id} onClick={() => retry(event._id)}>
                            {Icon.refresh} Reintentar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


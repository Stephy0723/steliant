import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import GGTeamCard, { teamTierIds } from '../../../components/GGTeamCard/GGTeamCard.jsx'
import LeaveTeamModal from '../../../components/LeaveTeamModal/LeaveTeamModal.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useLang } from '../../../i18n/LangContext.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { API_ORIGIN } from '../../../lib/serverApi.js'
import { uploadFile } from '../../../lib/uploadsApi.js'
import { GameAccountReminder, GameIdVerify, playsMobileLegends, useMyGameAccount } from '../../../components/GameAccountConnect/GameAccountConnect.jsx'
import { isMobileLegends } from '../../../../../shared/matchStats.mjs'
import './PlayerTeams.css'
import TeamInvitationsInbox from './TeamInvitationsInbox.jsx'
import { teamColor } from '../../../lib/teamColor.js'
import { presenceInfo } from '../../../lib/presence.js'

const TR = {
  es: {
    title: 'Mis Equipos',
    sub: 'Tus equipos reales, tu rol y el enlace directo a la pagina publica',
    all: 'Todos',
    active: 'Activos',
    former: 'Anteriores',
    activeOne: 'Activo',
    formerOne: 'Anterior',
    leftOn: 'Saliste el',
    disbandedOn: 'Se disolvió el',
    founder: 'Fundador',
    ranking: 'Ranking',
    winrate: 'Win rate',
    wins: 'Victorias',
    losses: 'Derrotas',
    points: 'Puntos',
    you: '(tu)',
    since: 'Desde',
    until: 'hasta',
    empty: 'Todavia no perteneces a un equipo.',
    emptySub: 'Explora equipos abiertos o crea tu roster competitivo desde el panel de equipo.',
    browse: 'Buscar equipos',
    createTeam: 'Crear equipo',
    publicPage: 'Ver pagina publica',
    leaveTeam: 'Salir del equipo',
    panel: 'Gestionar mi equipo',
    editMemberProfile: 'Editar mi perfil',
    profileTitle: 'Mi perfil en el equipo',
    profileSub: 'Estos datos los ve tu equipo y se usan para inscripciones y check-in.',
    slotBadge: 'Puesto asignado',
    unassigned: 'Sin puesto todavia',
    sectionSlot: 'Puesto en el roster',
    sectionIdentity: 'Identidad',
    sectionCompetitive: 'Perfil competitivo',
    sectionBio: 'Biografia',
    sectionContact: 'Contacto y redes',
    slot: 'Puesto',
    nick: 'Nickname',
    role: 'Rol competitivo',
    gameId: 'Game ID',
    email: 'Correo',
    avatar: 'Foto profesional',
    uploadAvatar: 'Subir foto profesional',
    changeAvatar: 'Cambiar imagen',
    uploadingAvatar: 'Subiendo imagen...',
    bio: 'Biografia',
    bioPlaceholder: 'Contale al resto del equipo (y a los organizadores) quien eres, tu estilo de juego, logros o lo que aportas al roster.',
    characters: 'Personajes favoritos',
    rank: 'Rango / nivel',
    availability: 'Disponibilidad',
    socials: 'Redes sociales',
    discordLinked: 'Discord vinculado',
    connectDiscord: 'Conectar Discord',
    save: 'Guardar perfil',
    cancel: 'Cancelar',
    saved: 'Tu perfil de equipo fue guardado.',
    loading: 'Cargando equipos...',
    error: 'No se pudo cargar tu equipo.',
  },
  en: {
    title: 'My Teams',
    sub: 'Your real teams, your role and the direct link to the public page',
    all: 'All',
    active: 'Active',
    former: 'Former',
    activeOne: 'Active',
    formerOne: 'Former',
    leftOn: 'Left on',
    disbandedOn: 'Disbanded on',
    founder: 'Founder',
    ranking: 'Ranking',
    winrate: 'Win rate',
    wins: 'Wins',
    losses: 'Losses',
    points: 'Points',
    you: '(you)',
    since: 'Since',
    until: 'until',
    empty: 'You are not in a team yet.',
    emptySub: 'Explore open teams or create your competitive roster from the team panel.',
    browse: 'Find teams',
    createTeam: 'Create team',
    publicPage: 'View public page',
    leaveTeam: 'Leave team',
    panel: 'Manage my team',
    editMemberProfile: 'Edit my profile',
    profileTitle: 'My team profile',
    profileSub: 'Your team sees this info, and it is used for registrations and check-in.',
    slotBadge: 'Assigned slot',
    unassigned: 'No slot yet',
    sectionSlot: 'Roster slot',
    sectionIdentity: 'Identity',
    sectionCompetitive: 'Competitive profile',
    sectionBio: 'Bio',
    sectionContact: 'Contact & social',
    slot: 'Slot',
    nick: 'Nickname',
    role: 'Competitive role',
    gameId: 'Game ID',
    email: 'Email',
    avatar: 'Photo / avatar',
    uploadAvatar: 'Upload image',
    changeAvatar: 'Change image',
    uploadingAvatar: 'Uploading image...',
    bio: 'Bio',
    bioPlaceholder: 'Tell your team (and organizers) who you are, your playstyle, achievements, or what you bring to the roster.',
    characters: 'Favorite characters',
    rank: 'Rank / level',
    availability: 'Availability',
    socials: 'Social media',
    discordLinked: 'Discord linked',
    connectDiscord: 'Connect Discord',
    save: 'Save profile',
    cancel: 'Cancel',
    saved: 'Your team profile was saved.',
    loading: 'Loading teams...',
    error: 'Could not load your team.',
  },
}

const SOCIAL_FIELDS = [
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['twitch', 'Twitch'],
  ['youtube', 'YouTube'],
  ['twitter', 'X / Twitter'],
  ['website', 'Sitio web'],
]

function initials(value, fallback = 'GG') {
  return String(value || fallback).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || fallback
}

function imageUrl(value) {
  if (!value) return ''
  if (value.startsWith('/uploads/')) return value
  try {
    const url = new URL(value)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) return value
  return `/${value}`
}

function rememberActiveTeam(team) {
  const id = team?._id || team?.id
  if (!id) return
  try {
    localStorage.setItem('gg-active-team-id', String(id))
  } catch {}
}

function formatDate(value, lang) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US', { month: 'short', year: 'numeric' })
}

function rosterFromTeam(team, user) {
  const roster = Array.isArray(team?.roster) ? team.roster : []
  const members = roster.length ? roster : (Array.isArray(team?.members) ? team.members : [])
  const userId = String(user?._id || user?.id || '')
  const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')

  return members.map(member => {
    const id = String(member?._id || member?.id || member?.playerCode || member || '')
    return {
      id,
      nick: member?.nick || member?.name || 'Jugador',
      role: member?.role || (id && id === leaderId ? 'Lider' : 'Miembro'),
      avatar: imageUrl(member?.avatar || ''),
      // Estado elegido si esta conectado (lib/presence.js).
      presence: presenceInfo(member),
      online: presenceInfo(member).online,
      me: Boolean(id && id === userId),
    }
  })
}

function rosterSlotRoleLabel(slot = '') {
  if (slot.startsWith('titular')) return 'Titular'
  if (slot.startsWith('sub')) return 'Suplente'
  if (slot.startsWith('coach')) return 'Coach'
  if (slot.startsWith('manager')) return 'Manager'
  return slot || 'Jugador'
}

// Jugador antes que staff -- el orden alfabetico ponia "coach"/"manager"
// primero (c/m < t), asi que el primer slot "vacante" que se le
// preseleccionaba a un jugador nuevo terminaba siendo un puesto de staff.
function rosterSlotSortRank(slot = '') {
  const key = String(slot).toLowerCase()
  if (key.startsWith('titular')) return 0
  if (key.startsWith('sub')) return 1
  return 2
}

function rosterSlotRows(slots = {}) {
  const defaults = ['titular-1', 'titular-2', 'titular-3', 'titular-4', 'titular-5', 'sub-1', 'sub-2', 'coach', 'manager']
  return Array.from(new Set([...defaults, ...Object.keys(slots || {})]))
    .sort((a, b) => {
      const rankDiff = rosterSlotSortRank(a) - rosterSlotSortRank(b)
      return rankDiff !== 0 ? rankDiff : a.localeCompare(b, undefined, { numeric: true })
    })
    .map(slot => ({ slot, player: slots?.[slot] || null }))
}

function findMyRosterSlot(team, user) {
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const identifiers = [
    user?._id,
    user?.id,
    user?.playerCode,
    user?.nick,
    user?.email,
    user?.discord?.id,
    user?.discord?.username,
    user?.social?.discord,
    user?.gamerProfile?.gameId,
  ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean)

  for (const [slot, player] of Object.entries(slots)) {
    const values = [
      player?.userId,
      player?.id,
      player?.playerCode,
      player?.nick,
      player?.email,
      player?.discordId,
      player?.discordName,
      player?.gameId,
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean)
    if (values.some(value => identifiers.includes(value))) return { slot, player }
  }
  return null
}

function mapTeam(team, user, lang) {
  const wins = Number(team?.wins || 0)
  const losses = Number(team?.losses || 0)
  const total = wins + losses
  const userId = String(user?._id || user?.id || '')
  const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')

  return {
    id: team?._id || team?.id || team?.publicCode,
    _id: team?._id || '',
    publicCode: team?.publicCode || team?._id || team?.id || '',
    name: team?.name || 'Equipo',
    tag: team?.tag || initials(team?.name),
    logo: imageUrl(team?.logo || ''),
    country: team?.country || '',
    gender: team?.gender || '',
    color: team?.color ? teamColor(team.color) : 'var(--pp-color)',
    game: team?.game || 'Juego competitivo',
    myRole: leaderId && userId && leaderId === userId ? 'Lider' : 'Miembro',
    founder: Boolean(leaderId && userId && leaderId === userId),
    leaderId,
    status: 'active',
    rank: team?.rank || '-',
    winrate: total ? Math.round((wins / total) * 100) : 0,
    wins,
    losses,
    rankPts: Number(team?.rankPts || 0),
    roster: rosterFromTeam(team, user),
    rosterSlots: team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {},
    raw: team,
    joined: formatDate(team?.createdAt, lang),
  }
}

// Equipos de los que el jugador salio (self-leave o el equipo se disolvio) --
// GET /teams/mine/history, ver BACKEND-PENDIENTE.md #jugador-equipos-anteriores.
// No tiene roster/winrate real (el equipo puede ya ni existir): es un
// snapshot minimo, no se puede editar ni gestionar como uno activo.
function mapFormerTeam(entry, lang) {
  return {
    id: entry.id || `former-${entry.name}-${entry.leftAt}`,
    _id: entry.id || '',
    publicCode: entry.id || '',
    name: entry.name,
    tag: entry.tag || initials(entry.name),
    logo: imageUrl(entry.logo || ''),
    color: entry.color || 'var(--pp-color)',
    game: entry.game || 'Juego competitivo',
    myRole: entry.role === 'leader' ? 'Lider' : 'Miembro',
    founder: entry.role === 'leader',
    leaderId: '',
    status: 'former',
    historyKey: entry.leftAt || '',
    rank: '-',
    winrate: 0,
    wins: 0,
    losses: 0,
    rankPts: 0,
    roster: [],
    rosterSlots: {},
    raw: null,
    reason: entry.reason,
    joined: formatDate(entry.leftAt, lang),
  }
}

function playerTeamCard(team, L) {
  if (team.status === 'former') {
    return {
      name: team.name,
      crest: team.logo,
      country: team?.country || '',
      gender: team?.gender || '',
      initials: initials(team.tag || team.name),
      code: team.tag,
      shortCode: team.tag,
      game: team.game,
      region: team.myRole,
      founded: team.joined,
      bio: `${team.reason === 'disbanded' ? L.disbandedOn : L.leftOn} ${team.joined}`,
      tags: [
        { label: L.formerOne, on: false },
        team.founder ? L.founder : team.myRole,
      ].filter(Boolean),
      members: [],
      capacity: 0,
      roster: [],
    }
  }
  return {
    name: team.name,
    crest: team.logo,
    country: team?.country || '',
    gender: team?.gender || '',
    initials: initials(team.tag || team.name),
    code: team.publicCode || team.tag,
    shortCode: team.tag,
    game: team.game,
    region: team.myRole,
    founded: team.joined,
    bio: `${team.winrate}% ${L.winrate} / ${team.wins}W - ${team.losses}L`,
    tags: [
      { label: team.status === 'active' ? L.activeOne : L.formerOne, on: team.status === 'active' },
      team.founder ? L.founder : team.myRole,
      `${team.rankPts.toLocaleString()} ${L.points}`,
    ].filter(Boolean),
    members: team.roster.length
      ? team.roster.slice(0, 5).map(member => member.avatar || '/demos/steliant-esports/avatar-default.svg')
      : ['/demos/steliant-esports/avatar-default.svg'],
    capacity: Math.max(team.roster.length, 5),
    roster: team.roster.map(member => ({
      nick: `${member.nick}${member.me ? ` ${L.you}` : ''}`,
      role: member.role,
      avatar: member.avatar || '',
    })),
  }
}

export default function PlayerTeams() {
  const { lang } = useLang()
  const { user } = useAuth()
  const { account: mlbbAccount } = useMyGameAccount()
  const mlbbAccountId = mlbbAccount ? `${mlbbAccount.roleId} (${mlbbAccount.zoneId})` : ''
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const avatarInputRef = useRef(null)
  const L = TR[lang] || TR.es
  const [filter, setFilter] = useState('active')
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingTeam, setEditingTeam] = useState(null)
  const [leavingTeam, setLeavingTeam] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [profileForm, setProfileForm] = useState({
    slot: 'titular-1',
    nick: '',
    role: '',
    gameId: '',
    email: '',
    avatar: '',
    bio: '',
    mainCharacters: '',
    rank: '',
    availability: '',
    socials: {},
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const connectedDiscord = Boolean(user?.discord?.id)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    Promise.all([
      api('/teams/mine'),
      api('/teams/mine/history').catch(() => ({ teams: [] })), // no bloquea el equipo activo si esto falla
    ])
      .then(([mineData, historyData]) => {
        if (!alive) return
        const active = Array.isArray(mineData?.teams) ? mineData.teams.map(team => mapTeam(team, user, lang)) : []
        const former = Array.isArray(historyData?.teams) ? historyData.teams.map(entry => mapFormerTeam(entry, lang)) : []
        setTeams([...active, ...former])
      })
      .catch(err => {
        if (!alive) return
        setError(err?.message || L.error)
        setTeams([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [L.error, lang, user, reloadKey])

  const active = teams.filter(team => team.status === 'active')
  const former = teams.filter(team => team.status === 'former')
  const list = filter === 'active' ? active : filter === 'former' ? former : teams
  const filters = useMemo(() => ([
    { key: 'all', label: `${L.all} (${teams.length})` },
    { key: 'active', label: `${L.active} (${active.length})` },
    { key: 'former', label: `${L.former} (${former.length})` },
  ]), [L, active.length, former.length, teams.length])

  function openMemberProfile(team) {
    const mine = findMyRosterSlot(team, user)
    const player = mine?.player || {}
    const vacant = rosterSlotRows(team.rosterSlots).find(row => !row.player)?.slot || 'titular-1'
    setEditingTeam(team)
    setProfileForm({
      slot: mine?.slot || vacant,
      nick: player.nick || user?.nick || '',
      role: player.role || '',
      // Equipo de MLBB con la cuenta verificada: el ID es siempre el verificado.
      gameId: (isMobileLegends(team.game) && mlbbAccountId) || player.gameId || user?.gamerProfile?.gameId || user?.playerCode || '',
      email: player.email || user?.email || '',
      avatar: player.avatar || user?.avatar || '',
      bio: player.bio || '',
      mainCharacters: Array.isArray(player.mainCharacters) ? player.mainCharacters.join(', ') : (player.mainCharacters || ''),
      rank: player.rank || user?.gamerProfile?.rank || '',
      availability: player.availability || '',
      socials: player.socials || player.social || {
        whatsapp: user?.social?.whatsapp || '',
        instagram: user?.social?.instagram || '',
        tiktok: user?.social?.tiktok || '',
        twitch: user?.social?.twitch || '',
        youtube: user?.social?.youtube || '',
        twitter: user?.social?.twitter || user?.social?.x || '',
        website: user?.social?.website || '',
      },
    })
  }

  // La invitacion abre el perfil del equipo recien aceptado.
  useEffect(() => {
    const requestedTeam = searchParams.get('perfilEquipo')
    if (!requestedTeam || loading) return
    const joinedTeam = teams.find(team => team.status === 'active' &&
      [team._id, team.id, team.publicCode].some(id => String(id || '') === requestedTeam))
    if (!joinedTeam) return
    openMemberProfile(joinedTeam)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('perfilEquipo')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams, loading, teams])

  async function saveMemberProfile(event) {
    event.preventDefault()
    if (!editingTeam || savingProfile) return
    setSavingProfile(true)
    try {
      const updated = await api(`/teams/${encodeURIComponent(editingTeam._id || editingTeam.id)}/roster/mine`, {
        method: 'PATCH',
        body: {
          ...profileForm,
          socials: {
            ...(profileForm.socials || {}),
            ...(connectedDiscord ? { discord: user?.discord?.username || user?.discord?.id || '' } : {}),
          },
          mainCharacters: String(profileForm.mainCharacters || '').split(',').map(item => item.trim()).filter(Boolean),
        },
      })
      setTeams(current => current.map(team => (
        String(team._id || team.id) === String(editingTeam._id || editingTeam.id)
          ? mapTeam(updated, user, lang)
          : team
      )))
      setEditingTeam(null)
      toast(L.saved)
    } catch (err) {
      toast(err?.message || L.error, 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleAvatarFile(file) {
    if (!file || uploadingAvatar) return
    if (!String(file.type || '').startsWith('image/')) {
      toast('Selecciona una imagen valida.', 'error')
      return
    }
    setUploadingAvatar(true)
    try {
      const uploaded = await uploadFile(file)
      if (!uploaded?.url) throw new Error('No se pudo subir la imagen.')
      setProfileForm(prev => ({ ...prev, avatar: uploaded.url }))
      toast('Imagen cargada.')
    } catch (err) {
      toast(err?.message || 'No se pudo subir la imagen.', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  function connectDiscord() {
    window.location.href = `${API_ORIGIN}/auth/discord?return=${encodeURIComponent('/jugador/equipos')}`
  }

  return (
    <div className="pp-page">
      <div className="pp-page__header">
        <div>
          <h1>{L.title}</h1>
          <p>{L.sub}</p>
        </div>
      </div>

      <TeamInvitationsInbox onJoined={() => setReloadKey(key => key + 1)} />

      <GameAccountReminder show={playsMobileLegends(user, isMobileLegends, active.map(t => t.game))} />
      <div className="pp-teams-filters">
        {filters.map(item => (
          <button key={item.key} className={`pp-chip ${filter === item.key ? 'active' : ''}`} onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading && <div className="pp-teams-state"><GGLoader label={L.loading} size="sm" /></div>}
      {!loading && error && <div className="pp-teams-state pp-teams-state--error">{Icon.alert}<p>{error}</p></div>}
      {!loading && !error && teams.length === 0 && (
        <div className="pp-teams-empty">
          <span>{Icon.team}</span>
          <div>
            <h2>{L.empty}</h2>
            <p>{L.emptySub}</p>
          </div>
          <div className="pp-teams-empty__actions">
            <button type="button" onClick={() => navigate('/equipos')}>{Icon.search} {L.browse}</button>
            <button type="button" onClick={() => navigate('/equipos')}>{Icon.plus} {L.createTeam}</button>
          </div>
        </div>
      )}
      {!loading && !error && teams.length > 0 && list.length === 0 && (
        <div className="pp-teams-state"><p>{filter === 'active' ? L.empty : `${L.former}: 0`}</p></div>
      )}
      <div className="pp-teams-grid">
        {list.map((team, index) => (
          <motion.div
            key={team.status === 'former' ? `former-${team.id}-${team.historyKey}` : `active-${team.id}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <GGTeamCard
              team={playerTeamCard(team, L)}
              tiers={team.status === 'former' ? ['anterior'] : teamTierIds(team.raw)}
              index={index}
              layout="horizontal"
              defaultOpen
              hideJoin
              // Un equipo "Anterior" no tiene pagina publica valida ni panel
              // que gestionar -- el equipo puede ya ni existir (disuelto).
              // Ver mapFormerTeam/BACKEND-PENDIENTE.md #jugador-equipos-anteriores.
              {...(team.status === 'former' ? {} : {
                viewLabel: L.publicPage,
                onView: () => navigate(`/equipos/${encodeURIComponent(team.publicCode || team.id)}`),
                actions: [
                  {
                    key: 'public',
                    label: L.publicPage,
                    onClick: () => navigate(`/equipos/${encodeURIComponent(team.publicCode || team.id)}`),
                  },
                  {
                    key: team.founder ? 'panel' : 'profile',
                    label: team.founder ? L.panel : L.editMemberProfile,
                    primary: true,
                    onClick: () => {
                      if (team.founder) {
                        rememberActiveTeam(team)
                        navigate('/mi-equipo')
                        return
                      }
                      openMemberProfile(team)
                    },
                  },
                  // El lider no sale: delega o disuelve desde Mi equipo.
                  ...(team.founder ? [] : [{
                    key: 'leave',
                    label: L.leaveTeam,
                    icon: Icon.logout,
                    danger: true,
                    onClick: () => setLeavingTeam(team),
                  }]),
                ],
              })}
            />
          </motion.div>
        ))}
      </div>
      <LeaveTeamModal
        open={Boolean(leavingTeam)}
        team={leavingTeam}
        onClose={() => setLeavingTeam(null)}
        onLeft={() => { setLeavingTeam(null); setEditingTeam(null); setFilter('active'); setReloadKey(k => k + 1) }}
      />
      {editingTeam && (() => {
        const mySlot = findMyRosterSlot(editingTeam, user)
        return (
          <div className="pp-profile-modal" role="dialog" aria-modal="true">
            <button className="pp-profile-modal__backdrop" type="button" onClick={() => setEditingTeam(null)} aria-label={L.cancel} />
            <motion.form
              className="pp-profile-form"
              onSubmit={saveMemberProfile}
              initial={{ opacity: 0, y: 18, scale: .98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: .22, ease: 'easeOut' }}
            >
              <div className="pp-profile-form__head">
                <div className="pp-profile-form__head-team">
                  <div className="pp-profile-form__badge" style={{ background: editingTeam.color }}>
                    {editingTeam.tag || initials(editingTeam.name)}
                  </div>
                  <div>
                    <span>{editingTeam.name}</span>
                    <h2>{L.profileTitle}</h2>
                    <p className="pp-profile-form__sub">{L.profileSub}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setEditingTeam(null)} aria-label={L.cancel}>{Icon.x}</button>
              </div>

              <section className="pp-profile-section">
                <h3>{Icon.target} {L.sectionSlot}</h3>
                {mySlot ? (
                  <div className="pp-profile-slot-badge pp-profile-slot-badge--assigned">
                    <span>{L.slotBadge}</span>
                    <b>{rosterSlotRoleLabel(mySlot.slot)}</b>
                  </div>
                ) : (
                  <label className="pp-profile-field">
                    <span>{L.slot}</span>
                    <select value={profileForm.slot} onChange={event => setProfileForm(prev => ({ ...prev, slot: event.target.value }))}>
                      {rosterSlotRows(editingTeam.rosterSlots).filter(row => !row.player).map(row => (
                        <option key={row.slot} value={row.slot}>{rosterSlotRoleLabel(row.slot)}</option>
                      ))}
                    </select>
                  </label>
                )}
              </section>

              <section className="pp-profile-section">
                <h3>{Icon.user} {L.sectionIdentity}</h3>
                <div className="pp-profile-form__grid">
                  <div className="pp-profile-avatar pp-profile-field--wide">
                    <div className="pp-profile-avatar__preview">
                      {profileForm.avatar ? <img src={imageUrl(profileForm.avatar)} alt={profileForm.nick || editingTeam.name} /> : <span>{initials(profileForm.nick || user?.nick || 'GG')}</span>}
                    </div>
                    <div className="pp-profile-avatar__actions">
                      <span style={{ color: '#ef4444' }}>{L.avatar}</span>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        hidden
                        onChange={event => {
                          handleAvatarFile(event.target.files?.[0])
                          event.target.value = ''
                        }}
                      />
                      <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                        {Icon.upload} {uploadingAvatar ? L.uploadingAvatar : profileForm.avatar ? L.changeAvatar : L.uploadAvatar}
                      </button>
                    </div>
                  </div>
                  {[
                    ['nick', L.nick],
                    ['gameId', L.gameId],
                    ['email', L.email, 'email'],
                  ].map(([key, label, type]) => {
                    // MLBB verificada: el Game ID no se escribe a mano.
                    const lockedId = key === 'gameId' && isMobileLegends(editingTeam.game) && Boolean(mlbbAccountId)
                    return (
                      <label className="pp-profile-field" key={key}>
                        <span>{label}{lockedId ? ' · verificado' : ''}</span>
                        <input type={type || 'text'} readOnly={lockedId} value={profileForm[key] || ''} onChange={event => setProfileForm(prev => ({ ...prev, [key]: event.target.value }))} />
                      </label>
                    )
                  })}
                  {isMobileLegends(editingTeam.game) && (
                    <div className="pp-profile-field pp-profile-field--wide">
                      <GameIdVerify
                        value={profileForm.gameId}
                        onUse={account => setProfileForm(prev => ({ ...prev, gameId: `${account.roleId} (${account.zoneId})`, nick: account.nickname || prev.nick }))}
                      />
                    </div>
                  )}
                </div>
              </section>

              <section className="pp-profile-section">
                <h3>{Icon.trophy} {L.sectionCompetitive}</h3>
                <div className="pp-profile-form__grid">
                  {[
                    ['role', L.role],
                    ['rank', L.rank],
                    ['mainCharacters', L.characters],
                    ['availability', L.availability],
                  ].map(([key, label, type]) => (
                    <label className="pp-profile-field" key={key}>
                      <span>{label}</span>
                      <input type={type || 'text'} value={profileForm[key] || ''} onChange={event => setProfileForm(prev => ({ ...prev, [key]: event.target.value }))} />
                    </label>
                  ))}
                </div>
              </section>

              <section className="pp-profile-section">
                <h3>{Icon.edit} {L.sectionBio}</h3>
                <label className="pp-profile-field pp-profile-field--wide">
                  <textarea rows={4} placeholder={L.bioPlaceholder} value={profileForm.bio || ''} onChange={event => setProfileForm(prev => ({ ...prev, bio: event.target.value }))} />
                </label>
              </section>

              <section className="pp-profile-section">
                <h3>{Icon.globe} {L.sectionContact}</h3>
                <div className="pp-profile-discord">
                  <span>{Icon.discord}</span>
                  <div>
                    <b>Discord</b>
                    <small>{connectedDiscord ? `${L.discordLinked}: ${user.discord.username || user.discord.id}` : L.connectDiscord}</small>
                  </div>
                  {!connectedDiscord && (
                    <button type="button" onClick={connectDiscord}>
                      {Icon.discord} {L.connectDiscord}
                    </button>
                  )}
                </div>
                <div className="pp-profile-form__grid">
                  {SOCIAL_FIELDS.map(([key, label]) => (
                    <label className="pp-profile-field" key={key}>
                      <span>{label}</span>
                      <input
                        type="text"
                        value={profileForm.socials?.[key] || ''}
                        onChange={event => setProfileForm(prev => ({ ...prev, socials: { ...(prev.socials || {}), [key]: event.target.value } }))}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <div className="pp-profile-form__actions">
                <button type="button" onClick={() => setEditingTeam(null)}>{L.cancel}</button>
                <button type="submit" disabled={savingProfile}>{Icon.check} {L.save}</button>
              </div>
            </motion.form>
          </div>
        )
      })()}
      </div>
  )
}


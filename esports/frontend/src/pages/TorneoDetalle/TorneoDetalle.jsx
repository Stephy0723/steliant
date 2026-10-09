import { useState, useEffect, useMemo } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import OrganizerReviewCard from '../../components/OrganizerReviewCard/OrganizerReviewCard.jsx'
import { GAMES } from '../../data/games.js'
import { organizerSocialLinks } from '../../data/socialPlatforms.js'
import { canCreateTournaments } from '../../lib/permissions.js'
import { downloadTournamentPdf, printTournamentDoc } from '../../lib/tournamentDoc.js'
import { normalizeTournament } from '../../lib/tournamentAdapter.js'
import { getBracket, subscribeBrackets, buildPublicRounds, pullBracket } from '../../lib/bracketStore.js'
import { getPaymentByTournament } from '../../lib/paymentsStore.js'
import { getSponsorByTournament, SPONSORS } from '../../data/sponsors.js'
import Tabs from '../../components/Tabs/Tabs.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Bracket from '../../components/Bracket/Bracket.jsx'
import ChampionPoster from '../../components/ChampionPoster/ChampionPoster.jsx'
import { buildChampionPoster } from '../../lib/championPoster.js'
import { Icon } from '../../components/icons/Icons.jsx'
import GGLoader from '../../components/GGLoader/GGLoader.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { api } from '../../lib/api.js'
import { sfx } from '../../lib/sfx.js'
import { registrationOpenByDate } from '../../lib/registrationWindow.js'
import './TorneoDetalle.css'
import TournamentAnnouncements from '../../components/TournamentAnnouncements/TournamentAnnouncements.jsx'

const GAME_ART = GAMES.reduce((m, g) => { m[g.id] = g; m[g.name] = g; return m }, {})
const getArt = (name) => GAME_ART[name] || { name: 'Valorant', image: '/demos/steliant-esports/ImaHorizontal/Valo.jpg', images: { logo: null }, color: '#00E676' }
const STELIANT_ESPORTS_DISCORD_URL = 'https://discord.gg/bZTsanNB3G'

function formatTournamentTime(value, fallback = '19:00') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value, fallback = 'Por definir') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

function teamPageKey(team) {
  return team?.publicCode || team?.teamPublicCode || team?.internalCode || team?.teamInternalCode || team?._id || team?.id || team?.teamId || ''
}

function normalizeGameKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function mapTournamentParticipants(tournament) {
  const registrations = Array.isArray(tournament?.registrations) ? tournament.registrations : []
  if (registrations.length) {
    return registrations.map((registration, index) => {
      const team = registration.team && typeof registration.team === 'object' ? registration.team : {}
      const meta = registration.teamMeta || {}
      const key = teamPageKey({ ...team, teamId: registration.team })
      return {
        id: String(registration._id || registration.id || key || index),
        teamId: team?._id || registration.team || '',
        publicCode: team?.publicCode || registration.teamPublicCode || '',
        name: team?.name || meta.name || 'Equipo',
        tag: team?.tag || meta.tag || 'TEAM',
        color: team?.color || '',
        logo: imageUrl(team?.logo || meta.logo || ''),
        seed: index + 1,
        record: registration.record || '0-0',
        eliminated: registration.status === 'disqualified' || registration.status === 'withdrawn',
        status: registration.status || 'registered',
        pageKey: key,
      }
    })
  }

  return (Array.isArray(tournament?.participants) ? tournament.participants : []).map((participant, index) => ({
    ...participant,
    id: String(participant.id || participant._id || index),
    seed: participant.seed || index + 1,
    pageKey: teamPageKey(participant),
    logo: imageUrl(participant.logo || ''),
  }))
}

export default function TorneoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { t, lang } = useLang()
  const isEs = lang === 'es'

  const [tour, setTour] = useState(null)
  const [detail, setDetail] = useState(null)
  const [docTournament, setDocTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  const requestedTab = searchParams.get('tab')
  const PUBLIC_TABS = ['resumen', 'bracket', 'equipos', 'reglas', 'staff', 'contacto', 'sponsors']
  const [tab, setTab] = useState(PUBLIC_TABS.includes(requestedTab) ? requestedTab : 'resumen')
  const [pubBracket, setPubBracket] = useState({ rounds: [], published: false })

  useEffect(() => {
    // Load from backend Mongoose database API
    setLoading(true)
    api(`/tournaments/${id}`)
      .then(res => {
        const t = res.tournament || res
        if (t) {
          const participants = mapTournamentParticipants(t)
          const mapped = {
            id: t._id,
            status: { open: 'upcoming', ongoing: 'live', finished: 'finished', draft: 'upcoming', registration_closed: 'upcoming' }[t.status] || 'upcoming',
            game: t.game,
            gameCode: t.gameCode || t.game?.toUpperCase(),
            name: t.title,
            prize: t.prizePool ? `$${t.prizePool.toLocaleString()}` : '—',
            date: t.date ? new Date(t.date).toLocaleDateString(isEs ? 'es-DO' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
            slots: t.maxSlots || 16,
            filled: participants.length || t.currentSlots || 0,
            color: t.primaryColor || getArt(t.game).color,
            logo: imageUrl(t.logo || ''),
            banner: imageUrl(t.banner || ''),
            organizerId: t.organizer?._id || t.organizer?.id || '',
            organizerBrandName: t.organizerBrandName || '',
            creatorAvatar: imageUrl(t.organizer?.avatar || t.organizer?.logo || ''),
            creatorName: t.organizerBrandName || t.organizer?.nick || 'GlitchGang Staff',
            creatorRole: t.organizerBrandName ? (isEs ? 'Marca organizadora' : 'Organizer brand') : (isEs ? 'Organizador oficial' : 'Official organizer'),
            winner: t.winner || '',
            publicId: t.publicId || '',
            internalId: t.tournamentCode || '',
            time: formatTournamentTime(t.date),
            format: t.format || 'single_elimination',
            platform: t.platform || 'PC',
            region: t.region || '',
            timezone: t.timezone || '',
            cost: t.entryFee > 0 ? `$${t.entryFee}` : 'Gratis',
            entryFee: t.entryFee || 0,
            minAge: t.minAge || 0,
            allowedCountries: Array.isArray(t.allowedCountries) ? t.allowedCountries : [],
            sourceStatus: t.status || '',
            registrationStart: t.registrationWindow?.start || t.registrationStart || '',
            registrationEnd: t.registrationWindow?.end || t.registrationEnd || '',
            startsAt: t.date || '',
            lateRegistration: Boolean(t.lateRegistration),
            category: t.modality || '5v5',
            creator: t.organizerBrandName || t.organizer?.nick || 'GlitchGang_Admin'
          }
          setTour(mapped)
          try { setDocTournament(normalizeTournament(t)) } catch { setDocTournament(null) }
          setDetail({
            desc: t.description || 'Información no disponible.',
            rules: (t.rules || '').split('\n').filter(Boolean),
            organizer: t.organizerBrandName || t.organizer?.nick || 'GlitchGang Staff',
            notes: t.notes || '',
            server: t.server || '',
            series: t.series || '',
            seasonName: t.seasonName || '',
            seasonNumber: t.seasonNumber || 1,
            competition: t.competition || null,
            patch: t.patch || '',
            mapPool: t.mapPool || '',
            prizeType: t.prizeType || '',
            prizes: Array.isArray(t.prizes) ? t.prizes : [],
            contactEmail: t.contactEmail || '',
            contactPhone: t.contactPhone || '',
            contactDiscord: t.contactDiscord || '',
            discordEnabled: Boolean(t.discordEnabled),
            streamUrl: t.streamUrl || '',
            streamLang: t.streamLang || '',
            staff: t.staff || {},
            staffMembers: t.staffMembers || [],
            rulesDocument: t.rulesDocument || '',
            sponsors: Array.isArray(t.sponsors) ? t.sponsors : [],
            // { titles, editions } del campeon dentro de su serie (seriesId).
            seriesChampion: t.seriesChampion || null,
            // Comunicados de cambios confirmados (Tournament.announcements).
            announcements: Array.isArray(t.announcements) ? t.announcements : [],
            organizerWebsite: t.organizer?.website || '',
            organizerSocial: t.organizer?.social || {},
            participants,
            // t.bracket es el blob real del backend ({results, published, status, ...}),
            // no un array de rounds -- el render real de bracket usa pubBracket
            // (buildPublicRounds, más abajo), que sí lo transforma correctamente.
            bracket: { rounds: [] }
          })
        } else {
          setTour(null)
          setDetail(null)
        }
      })
      .catch(err => {
        console.error('Error fetching tournament details:', err)
        setTour(null)
        setDetail(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, isEs])

  useEffect(() => {
    if (!tour) return
    const refresh = () => setPubBracket(buildPublicRounds(tour, getBracket(id)))
    refresh()
    pullBracket(id) // trae lo publicado desde el backend (si está conectado)
    return subscribeBrackets(refresh)
  }, [id, tour])

  useEffect(() => {
    if (PUBLIC_TABS.includes(requestedTab)) setTab(requestedTab)
  }, [requestedTab])

  const [enrolled, setEnrolled] = useState(false)
  const [waitlist, setWaitlist] = useState(false)
  const [inscOpen, setInscOpen] = useState(false)
  const [myTeams, setMyTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [registering, setRegistering] = useState(false)
  const entryFee = tour?.entryFee || 0
  const isPaidTournament = entryFee > 0
  const tournamentKey = tour?.publicId || tour?.internalId || tour?.id || id

  useEffect(() => {
    if (!tour) return
    setInscOpen(['open', 'ongoing'].includes(tour.sourceStatus) && registrationOpenByDate(tour) && tour.status !== 'finished')
  }, [tour])

  useEffect(() => {
    if (!user) {
      setMyTeams([])
      setSelectedTeamId('')
      return
    }
    let alive = true
    api('/teams/mine')
      .then(res => {
        if (!alive) return
        const teams = Array.isArray(res?.teams) ? res.teams : []
        setMyTeams(teams)
      })
      .catch(() => {
        if (alive) setMyTeams([])
      })
    return () => { alive = false }
  }, [user])

  const eligibleTeams = useMemo(() => {
    const tournamentGame = normalizeGameKey(tour?.game)
    const exact = myTeams.filter(team => normalizeGameKey(team?.game) === tournamentGame)
    return exact.length ? exact : myTeams
  }, [myTeams, tour?.game])

  // Torneo finalizado + un equipo mio que de verdad jugo -> puede calificar
  // al organizador (ver BACKEND-PENDIENTE.md #brand-organizador-reputacion).
  // El backend vuelve a validar todo esto, esto solo decide si se muestra
  // el widget.
  const myReviewableTeam = useMemo(() => {
    if (tour?.status !== 'finished' || !tour?.organizerId) return null
    const myTeamIds = new Set(myTeams.map(team => String(team._id || team.id)))
    const participation = (detail?.participants || []).find(pt => myTeamIds.has(String(pt.teamId)))
    if (!participation) return null
    return { id: participation.teamId, name: participation.name, tag: participation.tag }
  }, [tour?.status, tour?.organizerId, myTeams, detail?.participants])

  const championPoster = useMemo(() => buildChampionPoster({
    bracket: pubBracket,
    stored: getBracket(id),
    competition: detail?.competition,
    participants: detail?.participants,
    seriesChampion: detail?.seriesChampion,
    sponsors: (detail?.sponsors || []).map(s => ({ name: s.name || '', logo: imageUrl(s.logo || s.image || '') })),
  }), [pubBracket, id, detail])

  // Enlace directo al poster (#campeon), p. ej. desde la notificacion de podio.
  useEffect(() => {
    if (!championPoster || window.location.hash !== '#campeon') return
    setTab('resumen')
    requestAnimationFrame(() => document.getElementById('campeon')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [championPoster])

  // Si uno de mis equipos es el campeon, suena la fanfarria la primera vez que
  // lo ve. Sin interaccion previa el navegador bloquea el audio: entonces no se
  // marca como visto y sonara en la siguiente visita.
  useEffect(() => {
    const champ = championPoster?.champion
    if (!champ?.name || !myTeams.length) return
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
    const key = value => String(value || '').trim().toLowerCase()
    const myTeamIds = new Set(myTeams.map(team => String(team._id || team.id)))
    const won = (detail?.participants || []).some(pt => myTeamIds.has(String(pt.teamId)) && [pt.name, pt.tag].some(n => n && key(n) === key(champ.name)))
    if (!won) return
    const seenKey = `gg-victory-sfx:${id}`
    try {
      if (localStorage.getItem(seenKey)) return
      localStorage.setItem(seenKey, '1')
    } catch { /* sin almacenamiento: puede volver a sonar */ }
    sfx('victory')
  }, [championPoster, myTeams, detail?.participants, id])

  // `enrolled` decide si se muestra "Inscribirse" o "Inscrito": antes solo
  // miraba el registro local de pagos (paymentsStore), asi que un torneo
  // gratis siempre mostraba "Inscribirse" aunque el equipo ya estuviera
  // inscrito. Ahora se calcula comparando mis equipos contra las
  // inscripciones reales que ya vinieron del backend (detail.participants).
  useEffect(() => {
    const alreadyPaid = Boolean(getPaymentByTournament(id))
    const myTeamIds = new Set(myTeams.map(team => String(team._id || team.id)))
    const isRegistered = (detail?.participants || []).some(pt => myTeamIds.has(String(pt.teamId)))
    setEnrolled(alreadyPaid || isRegistered)
  }, [id, detail, myTeams])

  useEffect(() => {
    if (!eligibleTeams.length) {
      setSelectedTeamId('')
      return
    }
    setSelectedTeamId(current => eligibleTeams.some(team => String(team._id || team.id) === String(current))
      ? current
      : String(eligibleTeams[0]._id || eligibleTeams[0].id))
  }, [eligibleTeams])

  const handleEnroll = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    navigate(`/torneos/${tournamentKey}/inscripcion`, { state: { tournament: tour, teamId: selectedTeamId } })
  }

  const renderTeamPicker = () => !enrolled && eligibleTeams.length > 1 && (
    <label className="gg-td__team-picker">
      <span>{isEs ? 'Equipo para inscribir' : 'Team to register'}</span>
      <select value={selectedTeamId} onChange={event => setSelectedTeamId(event.target.value)}>
        {eligibleTeams.map(team => (
          <option key={team._id || team.id} value={team._id || team.id}>
            {team.name} [{team.tag || 'GG'}]
          </option>
        ))}
      </select>
    </label>
  )

  const renderEnrollButton = () => {
    if (tour.status === 'finished') {
      return <Button variant="ghost" onClick={() => setTab('bracket')}>{isEs ? 'Ver resultados' : 'View results'}</Button>
    }
    if (isFull && !enrolled) {
      return (
        <Button variant="ghost" onClick={() => setWaitlist(true)}>
          {waitlist ? <>{Icon.check} {isEs ? 'En lista de espera' : 'On waitlist'}</> : (isEs ? 'Lista de espera' : 'Waitlist')}
        </Button>
      )
    }
    if (enrolled) {
      return (
        <Button variant="primary" onClick={() => isPaidTournament && navigate('/mis-pagos')}>
          {Icon.check} {isEs ? 'Inscrito' : 'Enrolled'}
        </Button>
      )
    }
    // El plazo de inscripcion ya calculado en inscOpen no se estaba usando
    // aca: el boton quedaba activo incluso con las inscripciones cerradas
    // por fecha. El backend igual lo rechaza, pero la UI debe reflejarlo.
    if (!inscOpen) {
      return <Button variant="ghost" disabled>{isEs ? 'Inscripciones cerradas' : 'Registration closed'}</Button>
    }
    return (
      <Button variant="primary" disabled={registering} onClick={handleEnroll}>
        {registering
          ? (isEs ? 'Inscribiendo...' : 'Registering...')
          : isPaidTournament
            ? `${isEs ? 'Inscribirse' : 'Enroll'} · $${entryFee}`
            : (isEs ? 'Inscribirse' : 'Enroll')}
      </Button>
    )
  }

  const STATUS_BADGE = {
    live:     <Badge variant="live">{isEs ? '● EN VIVO' : '● LIVE'}</Badge>,
    upcoming: <Badge variant="warn">{isEs ? 'PRÓXIMO' : 'UPCOMING'}</Badge>,
    finished: <Badge variant="muted">{isEs ? 'FINALIZADO' : 'FINISHED'}</Badge>,
  }

  if (loading) {
    return (
      <div className="gg-page gg-td-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-dim)' }}>
        <GGLoader label={isEs ? 'Sincronizando torneo' : 'Syncing tournament'} size="lg" />
      </div>
    )
  }

  if (!tour) {
    return (
      <div className="gg-page gg-td-notfound">
        <p>{isEs ? 'Torneo no encontrado.' : 'Tournament not found.'}</p>
        <Button variant="ghost" onClick={() => navigate('/torneos')}>{isEs ? '← Volver' : '← Back'}</Button>
      </div>
    )
  }

  // ── Permisos: solo admin o el organizador dueño del torneo ven datos internos ──
  const isAdmin = user?.role === 'admin'
  const isOwnerOrganizer = !!user && canCreateTournaments(user) && (
    [tour.creator, detail?.organizer].some(c => c && user?.nick && String(c).toLowerCase().includes(String(user.nick).toLowerCase()))
  )
  const canManage = isAdmin || isOwnerOrganizer  // ve ID extenso + panel de administración

  const isFull = tour.filled >= tour.slots
  const pct = Math.round((tour.filled / tour.slots) * 100)
  const art = getArt(tour.game)
  const formatLabel = (tour.format || 'single_elimination').replace(/_/g, ' ')
  const registrationLabel = inscOpen ? (isEs ? 'Inscripciones abiertas' : 'Registration open') : (isEs ? 'Inscripciones cerradas' : 'Registration closed')

  const TABS = [
    { id: 'resumen', label: isEs ? 'Resumen' : 'Summary' },
    { id: 'bracket', label: 'Bracket' },
    { id: 'equipos', label: `${isEs ? 'Equipos' : 'Teams'} (${detail?.participants?.length || tour.filled})` },
    { id: 'reglas',  label: isEs ? 'Reglas' : 'Rules' },
    { id: 'staff', label: 'Staff' },
    { id: 'contacto', label: isEs ? 'Contacto' : 'Contact' },
    { id: 'sponsors', label: isEs ? 'Sponsors' : 'Sponsors' },
  ]
  const creatorName = tour.creatorName || detail?.organizer || tour.creator || 'GlitchGang Staff'
  const creatorInitials = creatorName
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'GG'
  const activeCasters = (detail?.staff?.casters || []).filter(caster => !caster.removedAt)
  const referees = detail?.staff?.arbitros || []
  const contactItems = [
    { icon: Icon.mail, label: isEs ? 'Correo de soporte' : 'Support email', value: detail?.contactEmail, href: detail?.contactEmail ? 'mailto:demo@steliant.example' : '' },
    { icon: Icon.whatsapp, label: 'WhatsApp', value: detail?.contactPhone, href: detail?.contactPhone ? `https://wa.me/${String(detail.contactPhone).replace(/\D/g, '')}` : '' },
    { icon: Icon.discord, label: 'Discord', value: detail?.contactDiscord, href: detail?.contactDiscord },
    { icon: Icon.play, label: isEs ? 'Stream' : 'Stream', value: detail?.streamUrl, href: detail?.streamUrl },
  ].filter(item => item.value)
  const socialItems = [
    ...(detail?.organizerWebsite ? [{ icon: Icon.globe, label: 'Web', value: detail.organizerWebsite, href: /^https?:\/\//.test(detail.organizerWebsite) ? detail.organizerWebsite : `https://${detail.organizerWebsite}` }] : []),
    ...organizerSocialLinks(detail?.organizerSocial).map(p => ({ icon: Icon[p.icon] || Icon.globe, label: p.label, value: p.label, href: p.url })),
  ]

  return (
    <div className="gg-page gg-td">
      {/* ── Banner ── */}
      <motion.div
        className="gg-td__banner gg-td__banner--art"
        style={{ '--tc': tour.color || art.color }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .45 }}
      >
        <div className="gg-td__banner-img" style={{ backgroundImage: `url(${art.image})` }} />
        <div className="gg-td__banner-scrim" />
        {art.images?.logo && <img className="gg-td__banner-logo" src={art.images.logo} alt={tour.game} />}
        <button className="gg-td__back" onClick={() => navigate('/torneos')}>
          <span className="gg-td__back-ic">{Icon.chevronRight}</span>
          {isEs ? 'Volver a Torneos' : 'Back to Tournaments'}
        </button>
        <div className="gg-td__banner-inner">
          <div className="gg-td__banner-left">
            <div className="gg-td__banner-tags">
              {STATUS_BADGE[tour.status]}
              <span className="gg-td__game">{art.name || tour.game}</span>
            </div>
            <div className="gg-td__title-row">
              {/* Logo del torneo: el mismo que sale en la tarjeta del listado */}
              {tour.logo && (
                <div className="gg-td__tour-logo">
                  <img src={tour.logo} alt="" />
                </div>
              )}
              <h1>{tour.name}</h1>
            </div>
            {detail && (
              <div className="gg-td__creator">
                <div className="gg-td__creator-avatar">
                  {tour.creatorAvatar ? (
                    <img src={tour.creatorAvatar} alt={creatorName} />
                  ) : (
                    <span>{creatorInitials}</span>
                  )}
                </div>
                <div className="gg-td__creator-copy">
                  <span>{isEs ? 'Creado por' : 'Created by'}</span>
                  <b>{creatorName}</b>
                  <small>{tour.creatorRole || detail.seasonName || (isEs ? 'Organizador oficial' : 'Official organizer')}</small>
                </div>
              </div>
            )}
            <p className="gg-td__lead">{detail?.desc || (isEs ? 'Competencia oficial con informacion del torneo.' : 'Official competition with tournament information.')}</p>

            {detail?.discordEnabled && (
              <p className="gg-td__discord-req">
                {Icon.discord} {isEs
                  ? 'Este torneo se juega en el Discord de GlitchGang. Necesitas una cuenta de GlitchGang y estar en el servidor para el check-in y las partidas.'
                  : 'This tournament runs on the GlitchGang Discord. You need a GlitchGang account and to be in the server for check-in and matches.'}
                <a href={STELIANT_ESPORTS_DISCORD_URL} target="_blank" rel="noopener noreferrer">
                  {isEs ? 'Entrar al Discord' : 'Join Discord'}
                </a>
              </p>
            )}

            {/* Bloque de IDs: público + extenso */}
            <div className="gg-td__ids">
              <div className="gg-td__id">
                <span>{isEs ? 'ID público' : 'Public ID'}</span>
                <b>{tour.publicId}</b>
              </div>
              {canManage && (
                <div className="gg-td__id gg-td__id--ext" title={isEs ? 'Visible solo para admins y el organizador' : 'Visible only to admins and the organizer'}>
                  <span>{isEs ? 'ID extenso' : 'Extended ID'}</span>
                  <b>{tour.internalId}</b>
                </div>
              )}
            </div>
            <div className="gg-td__hero-actions" id="inscripcion">
              {renderTeamPicker()}
              {tour.status === 'finished' ? (
                <Button variant="ghost" onClick={() => setTab('bracket')}>{isEs ? 'Ver resultados' : 'View results'}</Button>
              ) : isFull && !enrolled ? (
                <Button variant="ghost" onClick={() => setWaitlist(true)}>
                  {waitlist ? <>{Icon.check} {isEs ? 'En lista de espera' : 'On waitlist'}</> : (isEs ? 'Lista de espera' : 'Waitlist')}
                </Button>
              ) : enrolled ? (
                <Button variant="primary" onClick={() => isPaidTournament && navigate('/mis-pagos')}>
                  {Icon.check} {isEs ? 'Inscrito' : 'Enrolled'}
                </Button>
              ) : !inscOpen ? (
                // Mismo candado que el boton de la barra: este de la cabecera
                // seguia activo con el torneo empezado o el cierre vencido.
                <Button variant="ghost" disabled>{isEs ? 'Inscripciones cerradas' : 'Registration closed'}</Button>
              ) : isPaidTournament ? (
                <Button variant="primary" disabled={registering} onClick={handleEnroll}>
                  {isEs ? 'Inscribirse' : 'Enroll'} · ${entryFee}
                </Button>
              ) : (
                <Button variant="primary" disabled={registering} onClick={handleEnroll}>
                  {isEs ? 'Inscribirse' : 'Enroll'}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setTab('reglas')}>{isEs ? 'Ver reglas' : 'Rules'}</Button>
            </div>
          </div>
          <div className="gg-td__banner-action">
            <div className="gg-td__visual-stack">
              <article className="gg-td__preview gg-td__preview--main">
                <div className="gg-td__preview-img" style={{ backgroundImage: `url(${tour.banner || art.image})` }} />
                <div className="gg-td__preview-body">
                  <b>{tour.name}</b>
                  <span>{art.name || tour.game} · {tour.category}</span>
                  <small className="gg-td__preview-creator">{isEs ? 'Organizador' : 'Organizer'}: {creatorName}</small>
                  <strong>{tour.prize}</strong>
                </div>
              </article>
              <article className="gg-td__preview gg-td__preview--back">
                <div className="gg-td__preview-img" style={{ backgroundImage: `url(${tour.banner || art.image})` }} />
                <div className="gg-td__preview-body">
                  <b>{detail?.seasonName || 'GlitchGang'}</b>
                  <span>{registrationLabel}</span>
                  <strong>{tour.filled}/{tour.slots}</strong>
                </div>
              </article>
              <div className="gg-td__seal">
                <span>{tour.gameCode || 'GG'}</span>
              </div>
            </div>
            {renderTeamPicker()}
            {renderEnrollButton()}
            {myReviewableTeam && (
              <OrganizerReviewCard organizerId={tour.organizerId} tournamentId={tour.id} team={myReviewableTeam} />
            )}
          </div>
        </div>

        {/* Info strip */}
        <div className="gg-td__strip">
          <div className="gg-td__strip-item">
            <span>{Icon.trophy} {isEs ? 'Premio' : 'Prize'}</span><b>{tour.prize}</b>
          </div>
          <div className="gg-td__strip-item">
            <span>{Icon.creditCard} {isEs ? 'Inscripción' : 'Entry'}</span>
            <b style={isPaidTournament ? { color: 'var(--accent)' } : undefined}>{isPaidTournament ? `$${entryFee}` : (isEs ? 'Gratis' : 'Free')}</b>
          </div>
          <div className="gg-td__strip-item">
            <span>{Icon.calendar} {isEs ? 'Fecha' : 'Date'}</span><b>{tour.date}</b>
          </div>
          <div className="gg-td__strip-item">
            <span>{Icon.clock} {isEs ? 'Hora' : 'Time'}</span><b>{tour.time}</b>
          </div>
          <div className="gg-td__strip-item">
            <span>{Icon.users} {isEs ? 'Equipos' : 'Teams'}</span>
            <b>{tour.filled}/{tour.slots}</b>
          </div>
          <div className="gg-td__strip-item gg-td__strip-bar">
            <span>{isEs ? 'Cupos' : 'Slots'}</span>
            <div className="gg-td__bar"><div style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {/* ── Content ── */}
      <motion.div key={tab} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:.25 }}>

        {tab === 'resumen' && (
          <div className="gg-td__resumen">
            {championPoster && (
              <ChampionPoster
                poster={championPoster}
                onViewBracket={() => setTab('bracket')}
                tournament={{
                  title: tour.name,
                  seasonName: detail?.seasonName,
                  seasonNumber: detail?.seasonNumber,
                  game: art.name || tour.game,
                  organizer: creatorName,
                  organizerLogo: tour.creatorAvatar,
                  color: tour.color,
                }}
              />
            )}
            <div className="gg-td__desc">
              <h3>{isEs ? 'Sobre el torneo' : 'About the tournament'}</h3>
              <p>{detail?.desc || (isEs ? 'Información no disponible.' : 'Information not available.')}</p>
              {detail?.notes && <p className="gg-td__note">{detail.notes}</p>}
            </div>
            <TournamentAnnouncements announcements={detail?.announcements} isEs={isEs} />
            <div className="gg-td__stats">
              {[
                { label: isEs ? 'Premio total' : 'Total prize', value: tour.prize },
                { label: isEs ? 'Equipos inscritos' : 'Enrolled teams', value: `${tour.filled}/${tour.slots}` },
                { label: isEs ? 'Formato' : 'Format', value: formatLabel },
                { label: isEs ? 'Juego' : 'Game', value: art.name || tour.game },
                { label: isEs ? 'Servidor' : 'Server', value: detail?.server || 'LATAM' },
                { label: isEs ? 'Mapa / pool' : 'Map pool', value: detail?.mapPool || 'Por definir' },
              ].map(s => (
                <div key={s.label} className="gg-td__stat">
                  <span>{s.label}</span><b>{s.value}</b>
                </div>
              ))}
            </div>
            {detail?.prizes?.length > 0 && (
              <div className="gg-td__prizes">
                <div className="gg-td__section-head">
                  <h3>{isEs ? 'Premios' : 'Prizes'}</h3>
                  <small>{detail.prizeType || tour.prize}</small>
                </div>
                <div className="gg-td__prize-grid">
                  {[...detail.prizes].sort((a, b) => (a.kind === 'award' ? 1 : 0) - (b.kind === 'award' ? 1 : 0)).map((prize, index) => (
                    <div className={`gg-td__prize-card${prize.kind === 'award' ? ' gg-td__prize-card--award' : ''}`} key={`${prize.place}-${index}`}>
                      <span>{prize.kind === 'award' && Icon.star} {prize.place}</span>
                      {Number(prize.amount) > 0 && <b>${Number(prize.amount).toLocaleString()}</b>}
                      {prize.items && <small>{prize.items}</small>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'staff' && (
          <div className="gg-td__tab-panel">
            <motion.section className="gg-td__info-panel gg-td__info-panel--wide" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>
              <div className="gg-td__section-head">
                <h3>{Icon.shield} {isEs ? 'Staff del torneo' : 'Tournament staff'}</h3>
                <small>{detail?.staffMembers?.length ? detail.staffMembers.length : activeCasters.length + referees.length + Number(Boolean(detail?.staff?.admin || detail?.staff?.director))} {isEs ? 'miembros' : 'members'}</small>
              </div>
              <div className="gg-td__staff-grid">
                {detail?.staffMembers?.some(m => m.status !== 'declined') ? detail.staffMembers.filter(m => m.status !== 'declined').map((member, index) => (
                  <StaffCard key={member._id || member.user || index} label={member.role} name={member.nick || member.name} avatar={imageUrl(member.avatar || '')} icon={Icon.user} pending={member.status === 'pending'} />
                )) : <>
                <StaffCard label="Admin" name={detail?.staff?.admin || detail?.staff?.director || creatorName} icon={Icon.shield} />
                {activeCasters.length ? activeCasters.map(caster => (
                  <StaffCard key={caster.user || caster.nick} label="Caster" name={caster.nick || 'Caster'} avatar={imageUrl(caster.avatar || '')} icon={Icon.play} />
                )) : <StaffCard label="Caster" name={isEs ? 'Por anunciar' : 'To be announced'} icon={Icon.play} muted />}
                {referees.length ? referees.map((referee, index) => (
                  <StaffCard key={`${referee}-${index}`} label={isEs ? 'Arbitro' : 'Referee'} name={referee} icon={Icon.award} />
                )) : <StaffCard label={isEs ? 'Arbitro' : 'Referee'} name={isEs ? 'Por anunciar' : 'To be announced'} icon={Icon.award} muted />}
                </>}
              </div>
            </motion.section>
          </div>
        )}

        {tab === 'contacto' && (
          <div className="gg-td__tab-panel">
            <motion.section className="gg-td__info-panel gg-td__info-panel--wide" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>
              <div className="gg-td__section-head">
                <h3>{Icon.mail} {isEs ? 'Contacto y stream' : 'Contact and stream'}</h3>
                <small>{detail?.streamLang || 'ES'}</small>
              </div>
              <div className="gg-td__link-list gg-td__link-list--grid">
                {contactItems.length ? contactItems.map(item => (
                  <a key={item.label} className="gg-td__contact-link" href={String(item.href || '').startsWith('http') || String(item.href || '').startsWith('mailto:') ? item.href : undefined} target={String(item.href || '').startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                    <span>{item.icon}</span>
                    <div><b>{item.label}</b><small>{item.value}</small></div>
                  </a>
                )) : <p className="dim">{isEs ? 'Contacto no publicado.' : 'No contact published.'}</p>}
              </div>
              <div className="gg-td__social-row gg-td__social-row--contact">
                {socialItems.length ? socialItems.map(item => (
                  <a key={item.label} className="gg-td__social-link" href={String(item.href || '').startsWith('http') ? item.href : undefined} target="_blank" rel="noreferrer" title={item.label}>{item.icon}</a>
                )) : <span className="dim">{isEs ? 'Redes no publicadas.' : 'No socials published.'}</span>}
              </div>
            </motion.section>
          </div>
        )}

        {tab === 'sponsors' && (
          <div className="gg-td__tab-panel">
            <motion.section className="gg-td__info-panel gg-td__info-panel--wide" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>
              <div className="gg-td__section-head">
                <h3>{Icon.globe} {isEs ? 'Sponsors del torneo' : 'Tournament sponsors'}</h3>
                <small>{detail?.sponsors?.length || 0} sponsors</small>
              </div>
              {detail?.sponsors?.length > 0 ? (
                <div className="gg-td__sponsor-list">
                  {detail.sponsors.map((sponsor, index) => (
                    <a
                      className="gg-td__sponsor"
                      key={`${sponsor.name || sponsor}-${index}`}
                      href={/^https?:\/\//.test(sponsor.url || sponsor.link || sponsor.website || '') ? (sponsor.url || sponsor.link || sponsor.website) : undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="gg-td__sponsor-logo">
                        {sponsor.logo || sponsor.image ? <img src={imageUrl(sponsor.logo || sponsor.image)} alt="" /> : Icon.globe}
                      </span>
                      <div>
                        <b>{sponsor.name || sponsor.companyName || sponsor}</b>
                        <small>{sponsor.tier || sponsor.type || (isEs ? 'Patrocinador' : 'Sponsor')}</small>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="gg-td__empty-panel">
                  <span>{Icon.globe}</span>
                  <b>{isEs ? 'Sin sponsors publicados' : 'No published sponsors'}</b>
                  <small>{isEs ? 'Cuando el organizador agregue patrocinadores, apareceran aqui.' : 'When the organizer adds sponsors, they will appear here.'}</small>
                </div>
              )}
            </motion.section>
          </div>
        )}

        {tab === 'bracket' && (
          <div className="gg-td__bracket">
            {pubBracket.published ? (
              <>
                {pubBracket.champion && (
                  <div className="gg-td__champ">
                    {Icon.crown} {isEs ? 'Campeón' : 'Champion'}: <b>{pubBracket.champion}</b>
                    {championPoster && (
                      <button type="button" className="gg-td__champ-poster" onClick={() => setTab('resumen')}>
                        {Icon.trophy} {isEs ? 'Ver póster' : 'View poster'}
                      </button>
                    )}
                  </div>
                )}
                {pubBracket.rounds.length > 0 ? (
                  <Bracket rounds={pubBracket.rounds} themeColor={tour.color} />
                ) : (
                  <p className="dim">{isEs ? 'Bracket publicado. Los resultados aparecerán aquí conforme avance el torneo.' : 'Bracket published. Results will appear as the tournament progresses.'}</p>
                )}
              </>
            ) : detail?.bracket?.rounds?.length ? (
              <Bracket rounds={detail.bracket.rounds} themeColor={tour.color} />
            ) : (
              <p className="dim">{isEs ? 'El bracket aún no ha sido publicado por el organizador.' : 'The bracket has not been published by the organizer yet.'}</p>
            )}
          </div>
        )}

        {tab === 'equipos' && (
          <div className="gg-td__equipos">
            <table className="gg-td__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{isEs ? 'Equipo' : 'Team'}</th>
                  <th>Tag</th>
                  <th>Record</th>
                  <th>{isEs ? 'Estado' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {(detail?.participants || []).length ? (detail?.participants || []).map((pt) => (
                  <tr key={pt.id} className={pt.eliminated ? 'eliminated' : ''}>
                    <td className="seed">{pt.seed}</td>
                    <td className="name">
                      <div className="gg-td__team-logo" style={pt.color ? { '--team-row-color': pt.color } : undefined}>
                        {pt.logo ? <img src={pt.logo} alt="" /> : (pt.name?.[0] || 'T')}
                      </div>
                      <div className="gg-td__team-copy">
                        <b>{pt.name}</b>
                        {pt.publicCode && <small>{pt.publicCode}</small>}
                      </div>
                    </td>
                    <td><span className="gg-td__tag">{pt.tag}</span></td>
                    <td>{pt.record}</td>
                    <td>
                      <div className="gg-td__team-actions">
                        {pt.eliminated
                          ? <Badge variant="muted">{isEs ? 'Eliminado' : 'Eliminated'}</Badge>
                          : <Badge variant="live">{isEs ? 'Activo' : 'Active'}</Badge>
                        }
                        {pt.pageKey && (
                          <button type="button" onClick={() => navigate(`/equipos/${encodeURIComponent(pt.pageKey)}`)}>
                            {Icon.eye} {isEs ? 'Ver equipo' : 'View team'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="gg-td__table-empty">
                      {isEs ? 'Aun no hay equipos inscritos publicados.' : 'No enrolled teams published yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reglas' && (() => {
          const docData = docTournament || { ...tour, rulesText: (detail?.rules || []).join('\n') }
          const rulesList = detail?.rules?.length ? detail.rules : []
          return (
          <div className="gg-td__reglas">
            <div className="gg-td__reglas-head">
              <h3>{isEs ? 'Reglas del torneo' : 'Tournament rules'}</h3>
              <div className="gg-td__reglas-actions">
                {detail?.rulesDocument && /^(https?:\/\/|\/uploads\/)/.test(detail.rulesDocument) && <a href={detail.rulesDocument} target="_blank" rel="noreferrer" className="gg-btn gg-btn--ghost gg-btn--sm">{Icon.fileText} {isEs ? 'Reglamento adjunto' : 'Attached rules'}</a>}
                <Button variant="ghost" size="sm" onClick={() => printTournamentDoc(docData)}>
                  {Icon.printer} {isEs ? 'Imprimir' : 'Print'}
                </Button>
                <Button variant="primary" size="sm" onClick={() => downloadTournamentPdf(docData)}>
                  {Icon.download} {isEs ? 'Descargar PDF' : 'Download PDF'}
                </Button>
              </div>
            </div>
            {rulesList.length ? (
              <ol>
                {rulesList.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            ) : (
              <p className="dim">{isEs ? 'No hay reglas publicadas aún.' : 'No rules published yet.'}</p>
            )}
          </div>
          )
        })()}
      </motion.div>

      {/* ── 3 Cubos de datos horizontales ── */}
      {tab === 'resumen' && <motion.div
        className="gg-td__data-cubes"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .3, delay: .1 }}
      >
        {/* Cubo 1: Calendario y operación */}
        <div className="gg-td__cube">
          <div className="gg-td__cube-head">
            <span>{Icon.calendar}</span>
            <b>{isEs ? 'Calendario y operación' : 'Schedule & operation'}</b>
            <small>{tour.timezone || 'America/Santo_Domingo'}</small>
          </div>
          <dl className="gg-td__cube-dl">
            <div><dt>{isEs ? 'Fecha de inicio' : 'Start date'}</dt><dd>{tour.date}</dd></div>
            <div><dt>{isEs ? 'Hora' : 'Time'}</dt><dd>{tour.time}</dd></div>
            <div><dt>{isEs ? 'Zona horaria' : 'Timezone'}</dt><dd>{tour.timezone || 'America/Santo_Domingo'}</dd></div>
            <div><dt>{isEs ? 'Modalidad' : 'Modality'}</dt><dd>{tour.category}</dd></div>
            <div><dt>{isEs ? 'Región' : 'Region'}</dt><dd>{tour.region || 'LATAM Norte'}</dd></div>
            <div><dt>{isEs ? 'Servidor' : 'Server'}</dt><dd>{detail?.server || 'LAN / LAS según convocatoria'}</dd></div>
            <div><dt>{isEs ? 'Serie / temporada' : 'Series / season'}</dt><dd>{detail?.seasonName ? `${detail.seasonName} · Temporada ${detail.seasonNumber}` : 'Temporada 1'}</dd></div>
            <div><dt>{isEs ? 'Serie por encuentro' : 'Best of'}</dt><dd>{detail?.competition?.defaultSeries || detail?.series || 'BO1'}</dd></div>
            <div><dt>{isEs ? 'Patch / versión' : 'Patch / version'}</dt><dd>{detail?.patch || (isEs ? 'Versión competitiva vigente' : 'Current competitive version')}</dd></div>
          </dl>
        </div>

        {/* Cubo 2: Competición */}
        <div className="gg-td__cube">
          <div className="gg-td__cube-head">
            <span>{Icon.award}</span>
            <b>{isEs ? 'Competición' : 'Competition'}</b>
            <small>{art.name || tour.game}</small>
          </div>
          <dl className="gg-td__cube-dl">
            <div><dt>{isEs ? 'Juego' : 'Game'}</dt><dd>{art.name || tour.game}</dd></div>
            <div><dt>{isEs ? 'Formato' : 'Format'}</dt><dd>{formatLabel}</dd></div>
            <div><dt>{isEs ? 'Plataforma' : 'Platform'}</dt><dd>{tour.platform || 'PC'}</dd></div>
            <div><dt>{isEs ? 'Mapa / pool' : 'Map pool'}</dt><dd>{detail?.mapPool || (isEs ? 'Por definir' : 'TBD')}</dd></div>
            <div><dt>{isEs ? 'Estado' : 'Status'}</dt><dd className={inscOpen ? 'is-ok' : 'is-warn'}>{registrationLabel}</dd></div>
          </dl>
        </div>

        {/* Cubo 3: Inscripción */}
        <div className="gg-td__cube">
          <div className="gg-td__cube-head">
            <span>{Icon.users}</span>
            <b>{isEs ? 'Inscripción' : 'Registration'}</b>
            <small>{tour.filled}/{tour.slots}</small>
          </div>
          <dl className="gg-td__cube-dl">
            <div><dt>{isEs ? 'Apertura' : 'Opens'}</dt><dd>{tour.registrationStart ? new Date(tour.registrationStart).toLocaleString(isEs ? 'es-DO' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
            <div><dt>{isEs ? 'Cierre' : 'Closes'}</dt><dd>{tour.registrationEnd ? new Date(tour.registrationEnd).toLocaleString(isEs ? 'es-DO' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
            <div><dt>{isEs ? 'Capacidad' : 'Capacity'}</dt><dd>{tour.slots} {isEs ? 'equipos' : 'teams'}</dd></div>
            <div><dt>{isEs ? 'Cuota de entrada' : 'Entry fee'}</dt><dd>{isPaidTournament ? `$${entryFee}` : (isEs ? 'Gratis' : 'Free')}</dd></div>
            <div><dt>{isEs ? 'Edad mínima' : 'Minimum age'}</dt><dd>{tour.minAge ? `${tour.minAge}+` : '18+'}</dd></div>
            <div><dt>{isEs ? 'Países permitidos' : 'Allowed countries'}</dt><dd>{tour.allowedCountries?.length ? tour.allowedCountries.join(', ') : 'Global'}</dd></div>
          </dl>
        </div>
      </motion.div>}

      {/* ── Footer del Organizador ── */}
      <motion.footer
        className="gg-td__footer"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .3, delay: .12 }}
      >
        <div className="gg-td__footer-brand-strip">
          <div className="gg-td__footer-gg-logo">
            {tour.creatorAvatar
              ? <img src={tour.creatorAvatar} alt={creatorName} />
              : <span>{creatorInitials}</span>
            }
          </div>
          <div className="gg-td__footer-gg-copy">
            <b>{creatorName}</b>
            <small>{tour.creatorRole || (isEs ? 'Organizador de torneos' : 'Tournament organizer')}</small>
          </div>
        </div>

        {(socialItems.length > 0 || contactItems.length > 0) && (
          <div className="gg-td__footer-social">
            {socialItems.map(item => (
              <a key={item.label} href={String(item.href || '').startsWith('http') ? item.href : undefined} target="_blank" rel="noreferrer" title={item.label}>{item.icon}</a>
            ))}
            {contactItems.filter(c => c.href).map(item => (
              <a key={item.label} href={safeHref(item.href)} target="_blank" rel="noreferrer" title={`${item.label}: ${item.value}`}>{item.icon}</a>
            ))}
          </div>
        )}

        <div className="gg-td__footer-bottom">
          <small>© {creatorName} {new Date().getFullYear()} · {isEs ? 'Torneo organizado en' : 'Tournament hosted on'} GlitchGang · {tour.publicId || tour.id}</small>
        </div>
      </motion.footer>
    </div>
  )
}

function InfoRow({ label, value, tone }) {
  return (
    <div className={`gg-td__info-row ${tone ? `gg-td__info-row--${tone}` : ''}`}>
      <span>{label}</span>
      <b>{value || 'Por definir'}</b>
    </div>
  )
}

function StaffCard({ label, name, avatar, icon, muted = false, pending = false }) {
  return (
    <div className={`gg-td__staff-card ${muted ? 'is-muted' : ''} ${pending ? 'is-pending' : ''}`}>
      <div className="gg-td__staff-avatar">
        {avatar ? <img src={avatar} alt="" /> : icon}
      </div>
      <div>
        <span>{label}{pending ? ' · pendiente de confirmar' : ''}</span>
        <b>{name}</b>
      </div>
    </div>
  )
}


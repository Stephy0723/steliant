import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../../components/Button/Button.jsx'
import SponsorBanner from '../../components/SponsorBanner/SponsorBanner.jsx'
import PromoModal from '../../components/PromoModal/PromoModal.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import TournamentIdentityCorner from '../../components/TournamentIdentityCorner/TournamentIdentityCorner.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import { api } from '../../lib/api.js'
import { GAMES, normalizeGameId } from '../../data/games.js'
import { ROLES } from '../../data/communities.js'
import { canCreateTournaments } from '../../lib/permissions.js'
import { getSiteAds, trackSiteAdView, trackSiteAdClick } from '../../lib/siteAdsApi.js'
import { useAdsVisibility } from '../../context/AdsVisibilityContext.jsx'
import { registrationDateState } from '../../lib/registrationWindow.js'
import './Tournaments.css'

// ── Arte de juegos (imagen horizontal + logo + color de marca) ──
const GAME_ART = GAMES.reduce((map, g) => {
  map[g.id] = g
  map[g.slug] = g
  map[g.name] = g
  map[String(g.name).toLowerCase()] = g
  return map
}, {})
const GAME_ALIASES = {
  cs2: 'counter-strike-2',
  'counter strike 2': 'counter-strike-2',
  counterstrike2: 'counter-strike-2',
  valorant: 'valorant',
  val: 'valorant',
  lol: 'league-of-legends-wild-rift',
  'league of legends': 'league-of-legends-wild-rift',
  leagueoflegends: 'league-of-legends-wild-rift',
  mlbb: 'mobile-legends-bang-bang',
  'mobile legends': 'mobile-legends-bang-bang',
  mobilelegends: 'mobile-legends-bang-bang',
  freefire: 'free-fire',
  'free fire': 'free-fire',
  tft: 'teamfight-tactics',
}
const FALLBACK_ART = { name: 'Valorant', image: '/demos/steliant-esports/ImaHorizontal/Valo.jpg', images: { horizontal: '/demos/steliant-esports/ImaHorizontal/Valo.jpg', logo: null }, color: '#00E676' }
const getArt = (name) => {
  const raw = String(name || '').trim()
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const compactKey = key.replace(/\s+/g, '')
  const normalized = GAME_ALIASES[key] || GAME_ALIASES[compactKey] || normalizeGameId(raw, '')
  const art = GAME_ART[raw] || GAME_ART[raw.toLowerCase()] || GAME_ART[normalized] || FALLBACK_ART
  return {
    ...art,
    image: art.image || art.images?.horizontal || FALLBACK_ART.image,
    images: { ...(art.images || {}), horizontal: art.images?.horizontal || art.image || FALLBACK_ART.image },
  }
}
// Un mismo juego puede venir guardado con ids distintos ("mlbb", "Mobile Legends"...):
// los chips de filtro se agrupan por el nombre real para no salir repetidos.
const gameFilterKey = (game) => getArt(game).name || String(game || '').trim()
const normalizeTournamentGame = (name) => {
  const raw = String(name || '').trim()
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const compactKey = key.replace(/\s+/g, '')
  return GAME_ALIASES[key] || GAME_ALIASES[compactKey] || normalizeGameId(raw, raw)
}

// ── Organizadores / creadores destacados (perfiles públicos) ──
const toNum = (s) => Number(String(s).replace(/[^0-9.]/g, '')) || 0
const fmtPrize = (s) => `$${toNum(s).toLocaleString()}`
const pad2 = (n) => String(n).padStart(2, '0')
const dateKeyFromParts = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`
const toDateKey = (date) => date instanceof Date && !Number.isNaN(date.getTime())
  ? dateKeyFromParts(date.getFullYear(), date.getMonth(), date.getDate())
  : ''
const parseDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const formatDate = (value, isEs) => {
  const parsed = parseDate(value)
  if (!parsed) return isEs ? 'Por definir' : 'TBD'
  return parsed.toLocaleDateString(isEs ? 'es-DO' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}
const formatTime = (value, fallback = '') => {
  if (fallback) return fallback
  const parsed = parseDate(value)
  if (!parsed) return ''
  const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0
  return hasTime ? parsed.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : ''
}

export default function Tournaments() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { mode: themeMode } = useTheme()
  const navigate = useNavigate()
  const p = t.pages
  const isEs = lang === 'es'

  // ── Torneos desde API ──
  const [tournaments, setTournaments] = useState([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadTournaments = () => {
    setLoadingTournaments(true)
    setLoadError('')
    api('/tournaments?limit=50')
      .then(({ tournaments: data = [] }) => setTournaments(data.map(item => {
        const startDate = parseDate(item.date)
        const slots = Number(item.maxSlots || item.slots || 0)
        const filled = Number(item.currentSlots ?? item.registrations?.length ?? 0)
        const game = normalizeTournamentGame(item.game)
        return {
          id: item._id,
          publicId: item.publicId || '',
          internalId: item.tournamentCode || item.internalCode || item.internalId || '',
          organizer: item.organizer,
          organizerId: item.organizer?._id || item.organizer,
          name: item.title,
          game,
          gameLabel: item.game,
          prize: item.prizePool || 0,
          currency: item.currency || 'USD',
          entryFee: Number(item.entryFee || 0),
          date: formatDate(item.date, isEs),
          rawDate: item.date,
          dateObj: startDate,
          dateKey: toDateKey(startDate),
          time: formatTime(item.date, item.time),
          sourceStatus: item.status,
          status: { open: 'upcoming', registration_closed: 'upcoming', ongoing: 'live', finished: 'finished', cancelled: 'finished', draft: 'upcoming' }[item.status] || 'upcoming',
          registrationStart: item.registrationWindow?.start || item.registrationStart,
          registrationEnd: item.registrationWindow?.end || item.registrationEnd,
          lateRegistration: Boolean(item.lateRegistration),
          filled,
          slots,
          format: item.format || 'single_elimination',
          platform: item.platform || 'PC',
          creator: item.organizer?.nick || item.organizer?.name || 'GlitchGang',
          color: item.primaryColor || getArt(game).color,
          logo: item.logo || '',
          banner: item.banner || '',
        }
      })))
      .catch((err) => {
        setTournaments([])
        setLoadError(err?.message || (isEs ? 'No se pudieron cargar los torneos.' : 'Could not load tournaments.'))
      })
      .finally(() => setLoadingTournaments(false))
  }

  useEffect(() => {
    loadTournaments()
  }, [isEs])

  // Permiso de crear torneo
  const [canCreate, setCanCreate] = useState(() => canCreateTournaments(user))
  const [showLock, setShowLock] = useState(false)
  useEffect(() => { setCanCreate(canCreateTournaments(user)) }, [user])

  const handleCreateClick = () => {
    if (canCreate) navigate('/torneos/crear')
    else setShowLock(true)
  }
  const goToRoleForm = (role) => {
    setShowLock(false)
    navigate(role ? `/solicitar-rol?role=${role}` : '/solicitar-rol')
  }

  // ── Filtros ──
  const [tab, setTab] = useState('all')
  const [gameFilter, setGameFilter] = useState('all')

  // ── Carrusel ──
  const [activeSlide, setActiveSlide] = useState(0)

  // ── Calendario (Junio 2026) ──
  const today = new Date()
  const todayKey = toDateKey(today)
  const [calendarYear, setCalendarYear] = useState(today.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)
  const [showFullCalendarModal, setShowFullCalendarModal] = useState(false)

  // ── Agendador ──
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDayInput, setScheduleDayInput] = useState(today.getDate())
  const [scheduleForm, setScheduleForm] = useState({ idCode: '', title: '', game: 'Valorant', time: '19:00', color: '#00E676' })
  const [scheduleFeedback, setScheduleFeedback] = useState({ message: '', type: '' })
  const [manualEvents, setManualEvents] = useState([])

  // ── Slides del héroe — leídos desde el store de anuncios ──
  const { visibility } = useAdsVisibility()
  const [allAds, setAllAds] = useState([])
  useEffect(() => {
    if (!visibility.banner && !visibility.tournament) return
    getSiteAds().then(setAllAds).catch(() => {})
  }, [visibility.banner, visibility.tournament])

  // Banner Hero: todos los anuncios del slot 'banner' activos, ordenados (solo si la sección está encendida)
  const heroAds = visibility.banner
    ? allAds.filter(a => a.slot === 'banner' && a.active).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    : []

  const SLIDES = [
    // Anuncios gestionados desde admin (Banner Hero)
    ...heroAds.map(a => ({
      id: a.id,
      adManaged: true,
      imageUrl: a.imageUrl,
      slotColor: a.color1 || '#00E676',
      slotTextColor: a.textColor || '#fff',
      kicker: a.uid || '',
      badge: a.badge || '',
      title: a.title,
      desc: a.description,
      prize: a.prize,
      meta: a.scheduledDate
        ? ((a.live ? 'En vivo' : (isEs ? 'Próximo' : 'Upcoming')) + ' · ' + new Date(a.scheduledDate + 'T12:00:00').toLocaleDateString(isEs ? 'es-DO' : 'en-US', { day:'2-digit', month:'short' }))
        : (a.meta || ''),
      cta: a.btnText || (isEs ? 'Ver más' : 'Learn more'),
      link: a.btnUrl || '#',
      live: a.live,
    })),
    // Slide fijo del sistema: crear torneo
    {
      id: 'sys-create', create: true, kicker: 'ORG :: DEPLOY',
      badge: isEs ? 'ORGANIZADOR PRO' : 'PRO ORGANIZER',
      title: isEs ? 'CREA TU PROPIO TORNEO' : 'CREATE YOUR OWN TOURNAMENT',
      desc: isEs ? 'Gestiona inscripciones, define premios y construye tu comunidad competitiva.' : 'Manage registrations, define prizes and build your competitive community.',
      cta: isEs ? 'CREAR TORNEO +' : 'CREATE TOURNAMENT +', link: '/torneos/crear',
    },
  ]

  // SponsorBanner: slot 'tournament' del store (solo si la sección está encendida y hay un anuncio real activo)
  const stripAd = visibility.tournament ? allAds.find(a => a.slot === 'tournament' && a.active) : null
  const activeSponsor = stripAd
    ? {
        name: stripAd.title,
        logoInitials: stripAd.title.slice(0, 2).toUpperCase(),
        color: stripAd.color1 || '#00E676',
        accentColor: stripAd.color2 || '#0e1118',
        tagline: stripAd.description || '',
        btnUrl: stripAd.btnUrl || '/marcas',
        campaign: { badge: stripAd.btnText || (isEs ? 'Ver oferta' : 'View offer') },
      }
    : null

  useEffect(() => {
    const slide = SLIDES[0]
    if (slide?.adManaged) trackSiteAdView(slide.id)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setActiveSlide(c => {
      const next = (c + 1) % SLIDES.length
      const nextSlide = SLIDES[next]
      if (nextSlide?.adManaged) trackSiteAdView(nextSlide.id)
      return next
    }), 6500)
    return () => clearInterval(timer)
  }, [SLIDES.length])

  // ── Calendario: utilidades ──
  const MONTHS = isEs
    ? ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const WEEKDAYS = isEs ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const getFirstDayOffset = (month, year) => { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1 }
  const getDaysCount = (month, year) => new Date(year, month + 1, 0).getDate()
  const offset = getFirstDayOffset(calendarMonth, calendarYear)
  const daysInMonth = getDaysCount(calendarMonth, calendarYear)
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const spacerDays = Array.from({ length: offset })
  const monthKeyPrefix = `${calendarYear}-${pad2(calendarMonth + 1)}-`
  const selectedDateKey = selectedDay !== null ? dateKeyFromParts(calendarYear, calendarMonth, selectedDay) : ''
  const calendarEvents = [
    ...tournaments
      .filter(item => item.dateKey?.startsWith(monthKeyPrefix))
      .map(item => {
        const art = getArt(item.game)
        return {
          id: item.id,
          source: 'tournament',
          dateKey: item.dateKey,
          day: item.dateObj?.getDate(),
          name: item.name,
          game: art.name || item.gameLabel || item.game,
          time: item.time || (isEs ? 'Por definir' : 'TBD'),
          color: art.color,
        }
      }),
    ...manualEvents.filter(item => item.dateKey?.startsWith(monthKeyPrefix)),
  ]
  const eventsByDay = calendarEvents.reduce((acc, event) => {
    if (!event.day) return acc
    acc[event.day] = [...(acc[event.day] || []), event]
    return acc
  }, {})

  const handlePrevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) } else setCalendarMonth(m => m - 1)
    setSelectedDay(null)
  }
  const handleNextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) } else setCalendarMonth(m => m + 1)
    setSelectedDay(null)
  }

  // ── Filtrado de torneos ──
  const getFiltered = () => {
    let result = tournaments
    if (tab !== 'all') result = result.filter(x => x.status === tab)
    if (gameFilter !== 'all') result = result.filter(x => gameFilterKey(x.game) === gameFilterKey(gameFilter))
    if (selectedDateKey) result = result.filter(x => x.dateKey === selectedDateKey)
    return result
  }
  const filtered = getFiltered()

  const STATUS_TABS = [
    { id: 'all', label: p.allTourneys, icon: Icon.layoutGrid },
    { id: 'live', label: p.live, icon: Icon.play },
    { id: 'upcoming', label: p.upcoming, icon: Icon.clock },
    { id: 'finished', label: p.finished, icon: Icon.check },
  ]
  // Juegos presentes en los torneos (para el filtro por juego)
  const GAME_TABS = [...new Map(tournaments.map(x => [gameFilterKey(x.game), x.game])).values()]

  // ── Stats rápidas ──
  const stats = {
    total: tournaments.length,
    live: tournaments.filter(x => x.status === 'live').length,
    upcoming: tournaments.filter(x => x.status === 'upcoming').length,
    prize: tournaments.reduce((a, x) => a + toNum(x.prize), 0),
  }
  const getCardState = (tour) => {
    const dateState = registrationDateState({ ...tour, startsAt: tour.rawDate })
    const full = tour.slots > 0 && tour.filled >= tour.slots
    if (tour.status === 'finished') return { label: isEs ? 'FINALIZADO' : 'FINISHED', cta: isEs ? 'Ver resultados' : 'Results', targetTab: 'bracket', disabled: false, tone: 'finished' }
    if (tour.status === 'live') return { label: isEs ? 'EN VIVO' : 'LIVE', cta: isEs ? 'Ver bracket' : 'View bracket', targetTab: 'bracket', disabled: false, tone: 'live' }
    if (full) return { label: isEs ? 'COMPLETO' : 'FULL', cta: isEs ? 'Lista llena' : 'Full', disabled: true, tone: 'full' }
    if (dateState === 'not_open') return { label: isEs ? 'PRÓXIMO' : 'UPCOMING', cta: isEs ? 'Ver reglas' : 'Rules', targetTab: 'reglas', disabled: false, tone: 'upcoming' }
    if (dateState === 'closed' || dateState === 'started') return { label: isEs ? 'INSCRIPCIÓN CERRADA' : 'REGISTRATION CLOSED', cta: isEs ? 'Ver equipos' : 'Teams', targetTab: 'equipos', disabled: false, tone: 'closed' }
    if (tour.sourceStatus === 'draft') return { label: isEs ? 'BORRADOR' : 'DRAFT', cta: isEs ? 'Ver ficha' : 'View card', targetTab: 'resumen', disabled: false, tone: 'draft' }
    return { label: isEs ? 'ABIERTO' : 'OPEN', cta: tour.entryFee > 0 ? (isEs ? 'Pagar inscripción' : 'Pay entry') : (isEs ? 'Inscribirme' : 'Register'), targetTab: 'resumen', join: true, disabled: false, tone: 'open' }
  }

  // ── Agendador handlers ──
  const handleImportById = () => {
    const code = scheduleForm.idCode.trim()
    if (!code) { setScheduleFeedback({ message: isEs ? 'Ingresa un ID de torneo' : 'Enter a tournament ID', type: 'error' }); return }
    const found = tournaments.find(x => x.publicId === code || x.internalId === code || String(x.id) === code || x.name.toLowerCase().includes(code.toLowerCase()))
    if (found) {
      const art = getArt(found.game)
      if (found.dateObj) {
        setCalendarYear(found.dateObj.getFullYear())
        setCalendarMonth(found.dateObj.getMonth())
        setScheduleDayInput(found.dateObj.getDate())
      }
      setScheduleForm(prev => ({ ...prev, title: found.name, game: found.gameLabel || found.game, time: found.time || '19:00', color: art.color || '#00E676' }))
      setScheduleFeedback({ message: isEs ? 'Torneo importado con éxito.' : 'Tournament imported successfully.', type: 'success' })
    } else {
      setScheduleFeedback({ message: isEs ? 'ID no encontrado. Rellena los datos manualmente.' : 'ID not found. Fill in manually.', type: 'warn' })
    }
  }
  const handleSaveSchedule = (e) => {
    e.preventDefault()
    if (!scheduleForm.title.trim()) { setScheduleFeedback({ message: isEs ? 'El título es obligatorio' : 'Title is required', type: 'error' }); return }
    const newEvent = {
      id: `manual-${Date.now()}`,
      source: 'manual',
      dateKey: dateKeyFromParts(calendarYear, calendarMonth, Number(scheduleDayInput)),
      day: Number(scheduleDayInput),
      name: scheduleForm.title,
      game: scheduleForm.game,
      time: scheduleForm.time,
      color: scheduleForm.color,
    }
    setManualEvents(prev => [...prev, newEvent])
    setShowScheduleModal(false)
    setSelectedDay(Number(scheduleDayInput))
    setScheduleForm({ idCode: '', title: '', game: 'Valorant', time: '19:00', color: '#00E676' })
    setScheduleFeedback({ message: '', type: '' })
  }
  const totalTourneysInMonth = calendarEvents.length

  const slide = SLIDES[activeSlide] || SLIDES[0]
  const slideColor = slide.adManaged ? slide.slotColor : slide.create ? 'var(--accent)' : '#00E676'
  const nextTournament = [...tournaments].filter(tour => tour.status !== 'finished').sort((a, b) => (a.dateObj?.getTime?.() || 0) - (b.dateObj?.getTime?.() || 0))[0]
  const nextArt = nextTournament ? getArt(nextTournament.game) : FALLBACK_ART

  return (
    <div className="gg-page gt-page" data-theme-mode={themeMode}>
      <PromoModal />

      {/* ════════ HERO CAROUSEL ════════ */}
      <section className="gt-hero" style={{ '--gc': slideColor }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            className={`gt-hero__slide ${slide.create ? 'gt-hero__slide--create' : ''}`}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Fondo */}
            <div className="gt-hero__bg" style={{ backgroundImage: `url(${slide.imageUrl || nextTournament?.banner || nextArt.image || FALLBACK_ART.image})` }} />
            <div className="gt-hero__scrim" />
            <div className="gt-hero__grid-fx" />

            {/* Contenido */}
            <motion.div
              className="gt-hero__content"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              <div className="gt-hero__top">
                {slide.live ? (
                  <span className="gt-pill gt-pill--live"><span className="gt-dot" /> {isEs ? 'EN VIVO' : 'LIVE'}</span>
                ) : (
                  <span className="gt-pill gt-pill--ready"><span className="gt-dot" /> READY</span>
                )}
                <span className="gt-hero__kicker">{slide.kicker}</span>
              </div>

              <div className="gt-hero__badge">{Icon.crown}<span>{slide.badge}</span></div>

              <h1 className="gt-hero__title">{slide.title}</h1>
              <p className="gt-hero__desc">{slide.desc}</p>

              {!slide.create && (slide.prize || slide.meta) && (
                <div className="gt-hero__chips">
                  {slide.prize && <span className="gt-hero__chip gt-hero__chip--prize">{Icon.trophy} {slide.prize.startsWith('$') ? slide.prize : fmtPrize(slide.prize)}</span>}
                  {slide.meta && <span className="gt-hero__chip">{Icon.calendar} {slide.meta}</span>}
                </div>
              )}

              <div className="gt-hero__actions">
                <Button
                  variant="primary"
                  className="gt-hero__cta"
                  style={{ background: slideColor, color: slide.adManaged ? (slide.slotTextColor || '#fff') : '#04140c', fontWeight: 800 }}
                  onClick={() => {
                    if (slide.create) { handleCreateClick(); return }
                    if (slide.adManaged) trackSiteAdClick(slide.id)
                    if (slide.link?.startsWith('http')) { window.open(slide.link, '_blank'); return }
                    navigate(slide.link)
                  }}
                >
                  {slide.cta}
                </Button>
                {!slide.create && !slide.adManaged && (
                  <Button variant="ghost" className="gt-hero__cta-ghost" onClick={() => navigate(slide.link)}>
                    {Icon.eye} {p.moreInfo}
                  </Button>
                )}
              </div>
            </motion.div>

            {slide.create && <div className="gt-hero__crown-fx">{Icon.crown}</div>}
          </motion.div>
        </AnimatePresence>

        {/* Navegación del carrusel */}
        <div className="gt-hero__nav">
          <span className="gt-hero__counter">{String(activeSlide + 1).padStart(2, '0')}<i>/</i>{String(SLIDES.length).padStart(2, '0')}</span>
          <div className="gt-hero__dots">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                className={`gt-hero__dot ${i === activeSlide ? 'active' : ''}`}
                onClick={() => { setActiveSlide(i); if (SLIDES[i]?.adManaged) trackSiteAdView(SLIDES[i].id) }}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ════════ STATS STRIP ════════ */}
      <motion.div className="gt-stats" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <div className="gt-stat"><span className="gt-stat__ic">{Icon.trophy}</span><div><b>{stats.total}</b><small>{isEs ? 'Torneos' : 'Tournaments'}</small></div></div>
        <div className="gt-stat"><span className="gt-stat__ic gt-stat__ic--red">{Icon.play}</span><div><b>{stats.live}</b><small>{isEs ? 'En vivo' : 'Live'}</small></div></div>
        <div className="gt-stat"><span className="gt-stat__ic gt-stat__ic--amber">{Icon.clock}</span><div><b>{stats.upcoming}</b><small>{isEs ? 'Próximos' : 'Upcoming'}</small></div></div>
        <div className="gt-stat"><span className="gt-stat__ic gt-stat__ic--green">{Icon.gem}</span><div><b>${stats.prize.toLocaleString()}</b><small>{isEs ? 'En premios' : 'In prizes'}</small></div></div>
      </motion.div>

      {/* ════════ LAYOUT ════════ */}
      <div className="gt-layout">
        {/* ─── Columna principal ─── */}
        <div className="gt-main">
          <motion.div className="gt-head" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <div className="gt-head__titles">
              <h2>{t.side.torneos}</h2>
              <p>{isEs ? 'Compite, clasifica y gana.' : 'Compete, qualify, win.'}</p>
            </div>
            {canCreate ? (
              <Button variant="primary" size="sm" onClick={() => navigate('/torneos/crear')}>
                {Icon.bolt} {p.createTourney}
              </Button>
            ) : (
              <button className="gt-create-lock" onClick={() => setShowLock(true)}>
                <span className="gt-create-lock__ic">{Icon.lock}</span>
                {p.createTourney}
              </button>
            )}
          </motion.div>

          <SponsorBanner sponsor={activeSponsor} />

          {/* Filtros por estado */}
          <motion.div className="gt-filters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            {STATUS_TABS.map(s => (
              <button
                key={s.id}
                className={`gt-tab ${tab === s.id ? 'active' : ''}`}
                onClick={() => { setTab(s.id); setSelectedDay(null) }}
              >
                <span className="gt-tab__ic">{s.icon}</span>{s.label}
              </button>
            ))}
          </motion.div>

          {/* Filtros por juego */}
          <div className="gt-games">
            <button className={`gt-game ${gameFilter === 'all' ? 'active' : ''}`} onClick={() => setGameFilter('all')}>
              {isEs ? 'Todos los juegos' : 'All games'}
            </button>
            {GAME_TABS.map(g => {
              const art = getArt(g)
              return (
                <motion.button
                  key={g}
                  className={`gt-game ${gameFilter === g ? 'active' : ''}`}
                  style={gameFilter === g ? { borderColor: art.color, color: art.color } : undefined}
                  onClick={() => setGameFilter(g)}
                >
                  <span className="gt-game__dot" style={{ background: art.color }} />
                  {art.name || g}
                </motion.button>
              )
            })}

            {selectedDay !== null && (
              <motion.div className="gt-dayfilter" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                {Icon.calendar}<span>{isEs ? `Día ${selectedDay}` : `Day ${selectedDay}`}</span>
                <button onClick={() => setSelectedDay(null)}>{Icon.x}</button>
              </motion.div>
            )}
          </div>

          {/* Grid de torneos */}
          <div className="gt-grid">
            {loadingTournaments ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div className="gt-card gt-card--loading" key={`loading-${i}`}>
                  <div className="gt-card__head" />
                  <div className="gt-card__body">
                    <span />
                    <b />
                    <p />
                    <p />
                  </div>
                </div>
              ))
            ) : loadError ? (
              <div className="gt-empty gt-empty--error">
                <div className="gt-empty__ic">{Icon.x}</div>
                <p>{loadError}</p>
                <Button variant="primary" size="sm" onClick={loadTournaments}>
                  {isEs ? 'Reintentar' : 'Retry'}
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="gt-empty">
                <div className="gt-empty__ic">{Icon.trophy}</div>
                <p>{isEs ? 'No se encontraron torneos.' : 'No tournaments found.'}</p>
                <Button variant="ghost" size="sm" onClick={() => { setTab('all'); setGameFilter('all'); setSelectedDay(null) }}>
                  {isEs ? 'Limpiar filtros' : 'Clear filters'}
                </Button>
              </div>
            ) : (
              filtered.map((tour, i) => {
                const art = getArt(tour.game)
                const pct = tour.slots > 0 ? Math.min(100, Math.round((tour.filled / tour.slots) * 100)) : 0
                const full = tour.slots > 0 && tour.filled >= tour.slots
                const cardState = getCardState(tour)
                const primaryTarget = `/torneos/${tour.id}${cardState.join ? '#inscripcion' : ''}`
                const registrationEnded = tour.registrationEnd && parseDate(tour.registrationEnd)?.getTime() < Date.now()
                const statusTone = cardState.tone || (tour.sourceStatus === 'registration_closed' || registrationEnded ? 'closed' : tour.status)
                return (
                  <motion.article
                    key={tour.id}
                    className="gt-card gt-card--role-id"
                    style={{ '--gc': tour.color || art.color }}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -10, rotateX: 1.5, rotateY: -1.5 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => navigate(`/torneos/${tour.id}`)}
                  >
                    <span className="gt-card__glow" />
                    <TournamentIdentityCorner tournament={tour} shortOnly />
                    {/* Cabecera con imagen */}
                    <div className="gt-card__head" style={{ backgroundImage: `url(${art.image})` }}>
                      <div className="gt-card__energy" />
                      <div className="gt-card__scan" />
                      <div className="gt-card__scrim" />
                      <div className="gt-card__head-top">
                        <span className="gt-card__game">
                          {tour.logo || art.images?.logo
                            ? <img src={tour.logo || art.images.logo} alt={art.name || tour.gameLabel || tour.game} />
                            : <span className="gt-card__game-txt">{art.name || tour.gameLabel || tour.game}</span>}
                        </span>
                        <span className={`gt-card__status gt-card__status--${statusTone}`}>
                          {statusTone === 'live' && <span className="gt-dot" />}
                          {cardState.label}
                        </span>
                      </div>
                      <div className="gt-card__prize">
                        <span className="gt-card__prize-ic">{Icon.trophy}</span>
                        <span className="gt-card__prize-val">{fmtPrize(tour.prize)}</span>
                      </div>
                    </div>

                    {/* Cuerpo */}
                    <div className="gt-card__body">
                      <h3 className="gt-card__title">{tour.name}</h3>
                      <div className="gt-card__pulse-row">
                        <span><i />{cardState.label}</span>
                        <span>{tour.publicId || tour.internalId || 'GG-TORNEO'}</span>
                      </div>

                      <div className="gt-card__meta">
                        <span>{Icon.calendar} {tour.date}</span>
                        <span>{Icon.clock} {tour.time || (isEs ? 'Por definir' : 'TBD')}</span>
                        <span>{Icon.shield} {(tour.format || 'single_elim').replace(/_/g, ' ')}</span>
                        <span>{Icon.gamepad} {tour.platform || 'PC'}</span>
                      </div>

                      {/* Progreso */}
                      <div className="gt-card__progress">
                        <div className="gt-card__progress-top">
                          <span>{tour.filled}/{tour.slots || (isEs ? 'sin limite' : 'no limit')} {p.registeredTeams}</span>
                          <span className={full ? 'full' : ''}>{full ? (isEs ? 'COMPLETO' : 'FULL') : `${pct}%`}</span>
                        </div>
                        <div className="gt-bar"><div className="gt-bar__fill" style={{ width: `${pct}%`, background: full ? '#22c55e' : (tour.color || art.color) }} /></div>
                      </div>

                      <div className="gt-card__chips">
                        <span>{tour.entryFee > 0 ? `${tour.currency} ${tour.entryFee}` : (isEs ? 'Gratis' : 'Free')}</span>
                        <span>{tour.registrationEnd ? `${isEs ? 'Cierra' : 'Closes'} ${formatDate(tour.registrationEnd, isEs)}` : (isEs ? 'Sin cierre' : 'No deadline')}</span>
                      </div>

                      {/* Creador */}
                      <div className="gt-card__creator">
                        <span className="gt-card__creator-check">{Icon.check}</span>
                        {tour.creator || 'GlitchGang_Admin'}
                      </div>

                      <div className="gt-card__actions gt-card__actions--single" onClick={e => e.stopPropagation()}>
                        <Button variant="primary" size="sm" style={{ background: tour.color || art.color, color: '#04140c' }} onClick={() => navigate(primaryTarget)}>
                          {cardState.join ? cardState.cta : (isEs ? 'Ver torneo' : 'View tournament')}
                        </Button>
                      </div>
                    </div>
                  </motion.article>
                )
              })
            )}
          </div>

        </div>

        {/* ─── Sidebar: Calendario ─── */}
        <aside className="gt-side">
          <div className="gt-cal">
            <div className="gt-cal__head">
              <div className="gt-cal__head-label">{Icon.calendar}<span>{p.calendar.toUpperCase()}</span></div>
              <button className="gt-cal__add" title={isEs ? 'Agendar evento' : 'Schedule event'}
                onClick={() => { setScheduleDayInput(selectedDay || today.getDate()); setShowScheduleModal(true) }}>
                {Icon.plus}
              </button>
            </div>

            <div className="gt-cal__nav">
              <button onClick={handlePrevMonth}>{Icon.chevronRight}</button>
              <div className="gt-cal__month">{MONTHS[calendarMonth]} <span>{calendarYear}</span></div>
              <button onClick={handleNextMonth}>{Icon.chevronRight}</button>
            </div>

            <div className="gt-cal__count">
              <b>{totalTourneysInMonth}</b>
              {isEs ? 'torneos / eventos' : 'tournaments / events'}
            </div>

            <div className="gt-cal__weekdays">
              {WEEKDAYS.map((d, i) => <span key={i} className={i >= 5 ? 'we' : ''}>{d}</span>)}
            </div>

            <div className="gt-cal__days">
              {spacerDays.map((_, i) => <div key={`sp-${i}`} className="gt-cal__spacer" />)}
              {calendarDays.map(day => {
                const isToday = dateKeyFromParts(calendarYear, calendarMonth, day) === todayKey
                const has = !!eventsByDay[day]?.length
                const sel = selectedDay === day
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(sel ? null : day)}
                    className={`gt-cal__day ${isToday ? 'today' : ''} ${has ? 'has' : ''} ${sel ? 'sel' : ''}`}
                  >
                    {day}
                    {has && <span className="gt-cal__day-dot" />}
                  </button>
                )
              })}
            </div>

            <button className="gt-cal__full" onClick={() => navigate('/calendario')}>
              {Icon.calendar}<span>{p.fullCalendar}</span><i>→</i>
            </button>
          </div>

          <AnimatePresence>
            {selectedDay !== null && (
              <motion.div className="gt-day" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                <div className="gt-day__head">
                  <h4>{isEs ? `Eventos · ${selectedDay} ${MONTHS[calendarMonth]}` : `Events · ${MONTHS[calendarMonth]} ${selectedDay}`}</h4>
                  <button onClick={() => { setScheduleDayInput(selectedDay); setShowScheduleModal(true) }}>{Icon.plus}</button>
                </div>
                <div className="gt-day__list">
                  {(!eventsByDay[selectedDay] || eventsByDay[selectedDay].length === 0) ? (
                    <p className="gt-day__empty">{isEs ? 'Sin torneos agendados.' : 'No tournaments scheduled.'}</p>
                  ) : (
                    eventsByDay[selectedDay].map(ev => (
                      <button key={ev.id} type="button" className="gt-day__item" style={{ '--ec': ev.color }} onClick={() => ev.source === 'tournament' && navigate(`/torneos/${ev.id}`)}>
                        <span className="gt-day__bullet" />
                        <div>
                          <b>{ev.name}</b>
                          <small>{ev.game} · {ev.time}</small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>

      {/* ════════ MODAL: AGENDADOR ════════ */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div className="gt-modal__overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowScheduleModal(false)}>
            <motion.div className="gt-modal" initial={{ scale: 0.95, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 15 }} onClick={e => e.stopPropagation()}>
              <div className="gt-modal__head">
                <div>
                  <span className="gt-modal__pre">{isEs ? 'CALENDARIO DE EVENTOS' : 'EVENTS CALENDAR'}</span>
                  <h3>{isEs ? `Agendar para el ${scheduleDayInput} de ${MONTHS[calendarMonth]}` : `Schedule for ${MONTHS[calendarMonth]} ${scheduleDayInput}`}</h3>
                </div>
                <button className="gt-modal__close" onClick={() => setShowScheduleModal(false)}>{Icon.x}</button>
              </div>

              {scheduleFeedback.message && (
                <div className={`gt-modal__feedback gt-modal__feedback--${scheduleFeedback.type}`}>{scheduleFeedback.message}</div>
              )}

              <form onSubmit={handleSaveSchedule} className="gt-modal__form">
                <div className="gt-import">
                  <label>{isEs ? 'Importar torneo por ID (autocompletar)' : 'Import tournament by ID (auto-fill)'}</label>
                  <div className="gt-import__row">
                    <input type="text" placeholder="ej: TOR-MLBB-001-01 o 8" value={scheduleForm.idCode}
                      onChange={e => setScheduleForm(prev => ({ ...prev, idCode: e.target.value }))} />
                    <button type="button" className="gg-btn gg-btn--primary gg-btn--sm" onClick={handleImportById}>{isEs ? 'Importar' : 'Import'}</button>
                  </div>
                </div>

                <div className="gt-modal__divider" />

                <div className="gt-modal__fields">
                  <label className="wide">
                    <span>{isEs ? 'Título del torneo' : 'Tournament title'} *</span>
                    <input type="text" placeholder="ej: MLBB Caribbean Clash 2026" value={scheduleForm.title}
                      onChange={e => { setScheduleForm(prev => ({ ...prev, title: e.target.value })); if (scheduleFeedback.message) setScheduleFeedback({ message: '', type: '' }) }} />
                  </label>
                  <label>
                    <span>{isEs ? 'Juego' : 'Game'} *</span>
                    <select value={scheduleForm.game} onChange={e => setScheduleForm(prev => ({ ...prev, game: e.target.value }))}>
                      {GAMES.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>{isEs ? 'Hora' : 'Time'} *</span>
                    <input type="time" value={scheduleForm.time} onChange={e => setScheduleForm(prev => ({ ...prev, time: e.target.value }))} />
                  </label>
                  <label className="wide">
                    <span>{isEs ? 'Color de acento' : 'Accent color'}</span>
                    <div className="gt-color-row">
                      <input type="color" value={scheduleForm.color} onChange={e => setScheduleForm(prev => ({ ...prev, color: e.target.value }))} className="gt-color" />
                      <input type="text" value={scheduleForm.color} onChange={e => setScheduleForm(prev => ({ ...prev, color: e.target.value }))} placeholder="#00E676" />
                    </div>
                  </label>
                </div>

                <div className="gt-modal__actions">
                  <button type="button" className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => setShowScheduleModal(false)}>{isEs ? 'Cancelar' : 'Cancel'}</button>
                  <button type="submit" className="gg-btn gg-btn--primary gg-btn--sm">{isEs ? 'Agendar torneo' : 'Schedule tournament'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ MODAL: CALENDARIO COMPLETO ════════ */}
      <AnimatePresence>
        {showFullCalendarModal && (
          <motion.div className="gt-modal__overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFullCalendarModal(false)}>
            <motion.div className="gt-fullcal" initial={{ scale: 0.96, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>
              <div className="gt-fullcal__head">
                <div>
                  <span className="gt-modal__pre">{isEs ? 'VISTA EXPANDIDA' : 'EXPANDED VIEW'}</span>
                  <h3>{isEs ? 'Calendario completo de torneos' : 'Full tournament calendar'}</h3>
                </div>
                <div className="gt-cal__nav gt-cal__nav--lg">
                  <button onClick={handlePrevMonth}>{Icon.chevronRight}</button>
                  <div className="gt-cal__month">{MONTHS[calendarMonth]} <span>{calendarYear}</span></div>
                  <button onClick={handleNextMonth}>{Icon.chevronRight}</button>
                </div>
                <button className="gt-modal__close" onClick={() => setShowFullCalendarModal(false)}>{Icon.x}</button>
              </div>

              <div className="gt-fullcal__weekdays">
                {WEEKDAYS.map((d, i) => <span key={i} className={i >= 5 ? 'we' : ''}>{d}</span>)}
              </div>

              <div className="gt-fullcal__days">
                {spacerDays.map((_, i) => <div key={`fs-${i}`} className="gt-fullcal__cell spacer" />)}
                {calendarDays.map(day => {
                  const isToday = dateKeyFromParts(calendarYear, calendarMonth, day) === todayKey
                  const dayEvents = eventsByDay[day] || []
                  return (
                    <div key={day} className={`gt-fullcal__cell ${isToday ? 'today' : ''}`}
                      onClick={() => { setScheduleDayInput(day); setShowScheduleModal(true) }}
                      title={isEs ? 'Clic para agendar' : 'Click to schedule'}>
                      <span className="gt-fullcal__num">{day}</span>
                      <div className="gt-fullcal__events" onClick={e => e.stopPropagation()}>
                        {dayEvents.map(ev => (
                          <div key={ev.id} className="gt-fullcal__cap" style={{ '--ec': ev.color }}
                            onClick={() => { if (ev.source === 'tournament') { setShowFullCalendarModal(false); navigate(`/torneos/${ev.id}`) } }}>
                            <span className="t">{ev.time}</span><span className="n">{ev.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="gt-fullcal__foot">
                <p>{isEs ? '* Clic en una celda para agendar. Clic en una etiqueta para ver el torneo.' : '* Click a cell to schedule. Click a tag to view the tournament.'}</p>
                <Button variant="ghost" size="sm" onClick={() => setShowFullCalendarModal(false)}>{isEs ? 'Cerrar' : 'Close'}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ MODAL: CREACIÓN BLOQUEADA ════════ */}
      <AnimatePresence>
        {showLock && (
          <motion.div className="gt-modal__overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLock(false)}>
            <motion.div className="gt-lock" initial={{ scale: .96, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: .96, opacity: 0, y: 15 }} onClick={e => e.stopPropagation()}>
              <button className="gt-modal__close" onClick={() => setShowLock(false)}>{Icon.x}</button>
              <div className="gt-lock__hero">{Icon.lock}</div>
              <h3>{isEs ? 'Creación de torneos bloqueada' : 'Tournament creation locked'}</h3>
              <p>{isEs
                ? 'Crear torneos está reservado para Organizadores y Creadores. Solicita el rol con el formulario oficial; se desbloquea tras la aprobación.'
                : 'Tournament creation is reserved for organizers and creators. Request the role with the official form; it unlocks after approval.'}</p>
              <div className="gt-lock__roles">
                {[{ role: 'tournament-organizer', form: 'organizer' }, { role: 'event-organizer', form: 'organizer' }, { role: 'creator', form: 'creator' }].map(({ role, form }) => (
                  <button key={role} className="gt-lock__role" onClick={() => goToRoleForm(form)}>
                    <span className="gt-lock__dot" style={{ background: ROLES[role]?.color }} />
                    <span>{ROLES[role]?.label}</span><i>→</i>
                  </button>
                ))}
              </div>
              <div className="gt-modal__actions">
                <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => setShowLock(false)}>{isEs ? 'Cancelar' : 'Cancel'}</button>
                <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => goToRoleForm()}>{isEs ? 'Ir al formulario' : 'Go to form'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


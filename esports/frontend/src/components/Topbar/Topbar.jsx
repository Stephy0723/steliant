import { hideInBeta, hideInBetaSections, isBetaHidden } from '../../config/betaHidden.js'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import Logo from '../Logo/Logo.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import NotificationsDropdown from '../NotificationsDropdown/NotificationsDropdown.jsx'
import SoundToggle from '../SoundToggle/SoundToggle.jsx'
import { GlitchGangText } from '../GlitchText/GlitchText.jsx'
import { usePoints } from '../../context/PointsContext.jsx'
import { COMMUNITIES } from '../../data/communities.js'
import { displayStatus } from '../../lib/cosmeticUnlocks.js'
import { api } from '../../lib/api.js'
import { GAME_BY_ID, normalizeGameId } from '../../data/games.js'
import './Topbar.css'

const ChevronDown = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M6 9l6 6 6-6"/>
  </svg>
)

function resolveUploadUrl(value) {
  if (!value) return value
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

const SEARCH_ITEMS = [
  { label:{ es:'Dashboard', en:'Dashboard' }, path:'/dashboard', icon:'dashboard' },
  { label:{ es:'Torneos', en:'Tournaments' }, path:'/torneos', icon:'trophy' },
  { label:{ es:'Equipos', en:'Teams' }, path:'/equipos', icon:'team' },
  { label:{ es:'STELIANT ESPORTS TV', en:'STELIANT ESPORTS TV' }, path:'/tv', icon:'tv' },
  { label:{ es:'Comunidad', en:'Community' }, path:'/comunidad', icon:'chat' },
  { label:{ es:'Amigos', en:'Friends' }, path:'/amigos', icon:'friends' },
  { label:{ es:'Mensajes', en:'Messages' }, path:'/mensajes', icon:'msg' },
  { label:{ es:'Noticias', en:'News' }, path:'/noticias', icon:'news' },
  { label:{ es:'Mi Perfil', en:'My Profile' }, path:'/perfil', icon:'user' },
  { label:{ es:'Universidad', en:'University' }, path:'/universidad', icon:'award' },
  { label:{ es:'Marcas', en:'Brands' }, path:'/marcas', icon:'star' },
  { label:{ es:'Ajustes', en:'Settings' }, path:'/ajustes', icon:'gear' },
  { label:{ es:'Notificaciones', en:'Notifications' }, path:'/notificaciones', icon:'bell' },
  { label:{ es:'Progreso y logros', en:'Progress & achievements' }, path:'/recompensas', icon:'bolt' },
]

const SEARCH_DEBOUNCE_MS = 250

const TOURNAMENT_STATUS = {
  open:                { es: 'Inscripciones abiertas', en: 'Registration open' },
  registration_closed: { es: 'Inscripciones cerradas', en: 'Registration closed' },
  ongoing:             { es: 'En curso', en: 'Live' },
  finished:            { es: 'Finalizado', en: 'Finished' },
  cancelled:           { es: 'Cancelado', en: 'Cancelled' },
}

const gameLabel = (value) => (value && GAME_BY_ID[normalizeGameId(value, '')]?.name) || value || ''

// Resultados reales (GET /search) + secciones del menu. Antes el modal solo
// filtraba una lista fija de 14 secciones: no encontraba ni un jugador, ni un
// equipo, ni un torneo.
function useGlobalSearch(q) {
  const [state, setState] = useState({ loading: false, error: false, data: null })
  const seqRef = useRef(0)
  useEffect(() => {
    const term = q.trim()
    const seq = ++seqRef.current
    if (term.replace(/^#/, '').length < 2) { setState({ loading: false, error: false, data: null }); return undefined }
    setState(prev => ({ ...prev, loading: true, error: false }))
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/search?q=${encodeURIComponent(term)}`)
        // Respuesta vieja (el usuario siguio escribiendo): se descarta.
        if (seq === seqRef.current) setState({ loading: false, error: false, data })
      } catch {
        if (seq === seqRef.current) setState({ loading: false, error: true, data: null })
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [q])
  return state
}

function ResultThumb({ src, fallback, round }) {
  const [broken, setBroken] = useState(false)
  const url = resolveUploadUrl(src)
  if (!url || broken) {
    return <span className={`gg-search-thumb gg-search-thumb--mono${round ? ' is-round' : ''}`}>{String(fallback || '?').slice(0, 2).toUpperCase()}</span>
  }
  return <img className={`gg-search-thumb${round ? ' is-round' : ''}`} src={url} alt="" onError={() => setBroken(true)} />
}

function SearchModal({ onClose, navigate, lang }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const L = (es, en) => (lang === 'es' ? es : en)
  useEffect(() => { inputRef.current?.focus() }, [])

  const { loading, error, data } = useGlobalSearch(q)
  const term = q.trim().toLowerCase()

  const groups = useMemo(() => {
    const menu = hideInBeta(SEARCH_ITEMS)
      .filter(i => !term || i.label[lang].toLowerCase().includes(term))
      .slice(0, term ? 4 : SEARCH_ITEMS.length)
      .map(i => ({ key: `nav:${i.path}`, path: i.path, icon: Icon[i.icon], title: i.label[lang], sub: i.path }))
    const out = []
    if (data) {
      if (data.users?.length) out.push({ id: 'users', label: L('Jugadores', 'Players'), items: data.users.map(u => ({
        key: `u:${u.id}`, path: `/perfil?user=${encodeURIComponent(u.nick)}`,
        thumb: <ResultThumb src={u.avatar} fallback={u.nick} round />,
        title: u.nick, sub: [u.playerCode, gameLabel(u.game)].filter(Boolean).join(' · '),
      })) })
      if (data.teams?.length) out.push({ id: 'teams', label: L('Equipos', 'Teams'), items: data.teams.map(t => ({
        key: `t:${t.id}`, path: `/equipos/${encodeURIComponent(t.id)}`,
        thumb: <ResultThumb src={t.logo} fallback={t.tag || t.name} />,
        title: t.name, sub: [t.tag && `[${t.tag}]`, gameLabel(t.game), t.members ? L(`${t.members} miembros`, `${t.members} members`) : ''].filter(Boolean).join(' · '),
      })) })
      if (data.tournaments?.length) out.push({ id: 'tournaments', label: L('Torneos', 'Tournaments'), items: data.tournaments.map(t => ({
        key: `tr:${t.id}`, path: `/torneos/${encodeURIComponent(t.id)}`,
        thumb: <ResultThumb src={t.logo} fallback={t.title} />,
        title: t.title,
        sub: [gameLabel(t.game), TOURNAMENT_STATUS[t.status]?.[lang], t.date && new Date(t.date).toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · '),
      })) })
      if (data.universities?.length) out.push({ id: 'universities', label: L('Universidades', 'Universities'), items: data.universities.map(u => ({
        key: `uni:${u.id}`, path: `/universidad/${encodeURIComponent(u.id)}`,
        thumb: <ResultThumb src={u.logo} fallback={u.tag || u.name} />,
        title: u.name, sub: [u.tag, u.city].filter(Boolean).join(' · '),
      })) })
    }
    if (menu.length) out.push({ id: 'nav', label: L('Secciones', 'Sections'), items: menu })
    return out
  }, [data, term, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])
  useEffect(() => { setActive(0) }, [flat])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const go = (path) => { navigate(path); onClose() }
  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown' && flat.length) { e.preventDefault(); setActive(i => (i + 1) % flat.length) }
    else if (e.key === 'ArrowUp' && flat.length) { e.preventDefault(); setActive(i => (i - 1 + flat.length) % flat.length) }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active].path) }
  }

  const searching = term.replace(/^#/, '').length >= 2
  let idx = -1
  return (
    <motion.div className="gg-search-backdrop" onClick={onClose}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:.15 }}>
      <motion.div className="gg-search-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={L('Buscar', 'Search')}
        initial={{ opacity:0, y:-16, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }}
        exit={{ opacity:0, y:-12, scale:.97 }} transition={{ duration:.18 }}>
        <div className="gg-search-modal__input-row">
          <span className="gg-search-modal__icon">{loading ? <span className="gg-search-spinner" aria-hidden="true" /> : Icon.search}</span>
          <input ref={inputRef} className="gg-search-modal__input"
            placeholder={L('Buscar jugadores, equipos, torneos...', 'Search players, teams, tournaments...')} value={q}
            maxLength={60}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox" aria-expanded={flat.length > 0} aria-controls="gg-search-list"
            aria-activedescendant={flat[active] ? `gg-search-opt-${active}` : undefined} />
          <kbd className="gg-search-esc" onClick={onClose}>Esc</kbd>
        </div>
        <div className="gg-search-modal__results" id="gg-search-list" role="listbox" ref={listRef}>
          {error && <div className="gg-search-note">{L('No se pudo buscar. Revisa tu conexión e intenta de nuevo.', 'Search failed. Check your connection and try again.')}</div>}
          {searching && !loading && !error && data && groups.every(g => g.id === 'nav') && (
            <div className="gg-search-empty">{L('Sin resultados para', 'No results for')} "{q.trim()}"</div>
          )}
          {!searching && term.length === 1 && <div className="gg-search-note">{L('Escribe al menos 2 letras para buscar jugadores, equipos y torneos.', 'Type at least 2 letters to search players, teams and tournaments.')}</div>}
          {groups.map(group => (
            <div key={group.id} className="gg-search-group" role="group" aria-label={group.label}>
              <div className="gg-search-group__label">{group.label}</div>
              {group.items.map(item => {
                idx += 1
                const i = idx
                return (
                  <button key={item.key} type="button" id={`gg-search-opt-${i}`} data-idx={i} role="option" aria-selected={i === active}
                    className={`gg-search-result${i === active ? ' is-active' : ''}`}
                    onMouseMove={() => { if (i !== active) setActive(i) }}
                    onClick={() => go(item.path)}>
                    {item.thumb || <span className="gg-search-result__icon">{item.icon}</span>}
                    <span className="gg-search-result__text">
                      <span className="gg-search-result__label"><GlitchGangText>{item.title}</GlitchGangText></span>
                      {item.sub && <span className="gg-search-result__path">{item.sub}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

function UserDropdown({ user, logout, navigate, onClose, t, isAdmin }) {
  const ref = useRef(null)
  const avatarSrc = resolveUploadUrl(user?.avatar) || '/demos/steliant-esports/avatar-default.svg'
  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <motion.div ref={ref} className="gg-user-dropdown"
      initial={{ opacity:0, y:6, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:4, scale:.97 }} transition={{ duration:.15 }}>
      <div className="gg-user-dropdown__header">
        <img src={avatarSrc} alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/demos/steliant-esports/avatar-default.svg' }} />
        <div>
          <div className="gg-user-dropdown__nick">{user.nick}</div>
          <div className="gg-user-dropdown__email">{user.email}</div>
        </div>
      </div>
      <div className="gg-user-dropdown__sep" />
      <button className="gg-user-dropdown__item" onClick={() => { navigate('/perfil'); onClose() }}>
        {Icon.user}<span>{t.side?.perfil || 'Mi Perfil'}</span>
      </button>
      <button className="gg-user-dropdown__item" onClick={() => { navigate('/ajustes'); onClose() }}>
        {Icon.gear}<span>{t.side?.ajustes || 'Ajustes'}</span>
      </button>
      {isAdmin && (
        <button className="gg-user-dropdown__item" onClick={() => { navigate('/admin'); onClose() }}>
          {Icon.shield}<span>{t.side?.adminPanel || 'Panel admin'}</span>
        </button>
      )}
      <div className="gg-user-dropdown__sep" />
      <button className="gg-user-dropdown__item" onClick={() => { logout(); onClose(); navigate('/login') }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6"/>
        </svg>
        <span>{t.lang === 'es' ? 'Cambiar cuenta' : 'Switch account'}</span>
      </button>
    </motion.div>
  )
}

const ROUTE_TITLES = {
  '/dashboard':      { es: 'Dashboard',        en: 'Dashboard' },
  '/juegos':         { es: 'Juegos',            en: 'Games' },
  '/torneos':        { es: 'Torneos',           en: 'Tournaments' },
  '/equipos':        { es: 'Equipos',           en: 'Teams' },
  '/tv':             { es: 'STELIANT ESPORTS TV',    en: 'STELIANT ESPORTS TV' },
  '/comunidad':      { es: 'Comunidad',         en: 'Community' },
  '/amigos':         { es: 'Amigos',            en: 'Friends' },
  '/mensajes':       { es: 'Mensajes',          en: 'Messages' },
  '/noticias':       { es: 'Noticias',          en: 'News' },
  '/perfil':         { es: 'Mi Perfil',         en: 'My Profile' },
  '/notificaciones': { es: 'Notificaciones',    en: 'Notifications' },
  '/ajustes':        { es: 'Ajustes',           en: 'Settings' },
  '/marcas':         { es: 'Marcas',            en: 'Brands' },
  '/universidad':    { es: 'Universidad',       en: 'University' },
  '/recompensas':    { es: 'Progreso y logros', en: 'Progress & achievements' },
}

export default function Topbar() {
  const { lang, setLang, t } = useLang()
  const { user, logout } = useAuth()
  const { unread } = useNotifications()
  const { balance, level } = usePoints()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Check user roles
  const isAdmin = user?.role === 'admin'

  const [showNotif, setShowNotif]       = useState(false)
  const [showSearch, setShowSearch]     = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [now, setNow] = useState(new Date())
  const locale = lang === 'es' ? 'es-DO' : 'en-US'
  const langLabels = {
    es: { switchEs: 'Cambiar idioma a español', switchEn: 'Cambiar idioma a inglés' },
    en: { switchEs: 'Switch language to Spanish', switchEn: 'Switch language to English' },
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const clockStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const dateStr = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(now).toUpperCase()

  const base = '/' + pathname.split('/')[1]
  const titleMap = ROUTE_TITLES[base]
  const title = titleMap ? titleMap[lang] : pathname.split('/')[1] || 'Dashboard'
  const currentStatus = displayStatus(user)
  const statusLabel = user?.statusText || currentStatus.label || (lang === 'es' ? 'Online' : 'Online')
  const avatarSrc = resolveUploadUrl(user?.avatar) || '/demos/steliant-esports/avatar-default.svg'
  // Los ids de Mongo (24 hex) no le dicen nada al usuario y en celular
  // ocupaban toda la barra: se omiten del breadcrumb.
  const crumbs = pathname.split('/').filter(Boolean).filter(s => !/^[a-f0-9]{24}$/i.test(s)).map((s, index) => {
    const route = index === 0 ? `/${s}` : null
    const mapped = route && ROUTE_TITLES[route]?.[lang]
    return (mapped || decodeURIComponent(s)).toUpperCase()
  })

  // Ctrl+K shortcut
  useEffect(() => {
    const h = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Close everything on route change
  useEffect(() => { setShowNotif(false); setShowUserMenu(false) }, [pathname])

  return (
    <>
      <header className="gg-topbar">
        {/* Logo + page title */}
        <button className="gg-topbar__brand" onClick={() => navigate('/dashboard')}>
          <Logo size={22} withText />
          <span className="gg-topbar__sep" />
          <span className="gg-topbar__page"><GlitchGangText>{title}</GlitchGangText></span>
        </button>

        {/* Search bar */}
        <button className="gg-topsearch" onClick={() => setShowSearch(true)}>
          {Icon.search}
          <span>{lang === 'es' ? 'Buscar en STELIANT ESPORTS...' : 'Search STELIANT ESPORTS...'}</span>
          <kbd>Ctrl K</kbd>
        </button>

        {/* Right */}
        <div className="gg-topright">
          {user ? (
            <>
              <div className="gg-toplang" data-no-translate>
                <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')} aria-label={langLabels[lang].switchEs} title="Español">ES</button>
                <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-label={langLabels[lang].switchEn} title="English">EN</button>
              </div>
              {!isBetaHidden('/recompensas') && (
              <button className="gg-points-chip" style={{ '--rank-color':level.color, '--rank-glow':level.glow }} title={lang === 'es' ? 'Progreso y logros' : 'Progress & achievements'} onClick={() => navigate('/recompensas')}>
                {Icon.bolt}<b>{balance.toLocaleString()}</b><span>PTS</span>
              </button>
              )}
              {!isBetaHidden('/noticias') && (
                <button className="gg-iconbtn" title={lang === 'es' ? 'Noticias' : 'News'} onClick={() => navigate('/noticias')}>
                  {Icon.news}
                </button>
              )}
              {!isBetaHidden('section:topbar-sound') && <SoundToggle />}
              {!isBetaHidden('/ranking') && (
                <button className="gg-iconbtn" title={t.side?.ranking || 'Ranking'} onClick={() => navigate('/ranking')}>
                  {Icon.trophy}
                </button>
              )}

              {/* Admin Button */}
              {isAdmin && (
                <button className="gg-btn-admin" title={t.side?.adminPanel || (lang === 'es' ? 'Panel admin' : 'Admin panel')} onClick={() => navigate('/admin')}>
                  {Icon.shield}
                  <span>{lang === 'es' ? 'Admin' : 'Admin'}</span>
                </button>
              )}

              <div className="gg-notif-wrap">
                <button className="gg-iconbtn" title={lang === 'es' ? 'Notificaciones' : 'Notifications'}
                  aria-label={lang === 'es' ? 'Notificaciones' : 'Notifications'}
                  data-testid="notifications-btn"
                  onClick={() => { setShowNotif(v=>!v); setShowUserMenu(false) }}>
                  {Icon.bell}
                  {unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
                </button>
                <AnimatePresence>
                  {showNotif && <NotificationsDropdown onClose={() => setShowNotif(false)} />}
                </AnimatePresence>
              </div>
              {/* User chip + dropdown */}
              <div className="gg-topuser-wrap">
                <button
                  className={`gg-topuser status-motion--${currentStatus.motion}`}
                  style={{ '--status-color': currentStatus.color, '--status-rgb': currentStatus.tint }}
                  onClick={() => { setShowUserMenu(v=>!v); setShowNotif(false) }}
                >
                  <img src={avatarSrc} alt={user.nick} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/demos/steliant-esports/avatar-default.svg' }} />
                  <div className="gg-topuser__info">
                    <span className="gg-topuser__nick">{user.nick}</span>
                    <span className="gg-topuser__status">
                      <span className="gg-topuser__dot" />
                      {statusLabel}
                    </span>
                  </div>
                  <ChevronDown />
                </button>
                <AnimatePresence>
                  {showUserMenu && (
                    <UserDropdown user={user} logout={logout} navigate={navigate}
                      onClose={() => setShowUserMenu(false)} t={{ ...t, lang }} isAdmin={isAdmin} />
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => navigate('/login')}>
                {t.nav?.login || 'Iniciar sesión'}
              </button>
              <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => navigate('/register')}>
                {t.nav?.join || 'Registrarse'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Breadcrumb + clock subbar */}
      <div className="gg-subbar">
        <div className="gg-subbar__crumbs">
          <span className="gg-subbar__dot" />
          {crumbs.length === 0
            ? <span className="gg-subbar__seg">DASHBOARD</span>
            : crumbs.map((seg, i) => (
                <span key={i} className="gg-subbar__crumb-group">
                  {i > 0 && <span className="gg-subbar__slash">/</span>}
                  <span className="gg-subbar__seg">{seg}</span>
                </span>
              ))
          }
        </div>
        <div className="gg-subbar__clock">
          {clockStr}
          <span className="gg-subbar__clock-sep">|</span>
          {dateStr}
        </div>
      </div>

      <AnimatePresence>
        {showSearch && <SearchModal onClose={() => setShowSearch(false)} navigate={navigate} lang={lang} />}
      </AnimatePresence>
    </>
  )
}


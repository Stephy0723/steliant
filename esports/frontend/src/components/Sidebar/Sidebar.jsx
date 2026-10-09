import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import ThemeSwitcher from '../ThemeSwitcher/ThemeSwitcher.jsx'
import { GlitchGangText } from '../GlitchText/GlitchText.jsx'
import Logo from '../Logo/Logo.jsx'
import { api } from '../../lib/api.js'
import { hideInBeta, isSidebarHidden } from '../../config/betaHidden.js'
import './Sidebar.css'

function resolveUploadUrl(value) {
  if (!value) return value
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

export default function Sidebar() {
  const { lang, setLang, t } = useLang()
  const isEs = lang === 'es'
  const { user } = useAuth()
  const { notifications, unread } = useNotifications()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900)
  const [showThemer, setShowThemer] = useState(false)
  const [openGroups, setOpenGroups] = useState({ espacios: true, roles: true, menu: false, cuenta: false })
  const [managedTeamCount, setManagedTeamCount] = useState(0)
  const sideRef = useRef(null)
  const avatarSrc = resolveUploadUrl(user?.avatar) || '/demos/steliant-esports/avatar-default.svg'

  const toggleGroup = (key) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  const messageBadge = notifications.filter(item => !item.archived && item.type === 'mensaje' && !item.read).length
  const roleKeys = new Set([
    user?.role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    // roleProfiles siempre trae las 6 claves (organizer/creator/.../sponsor)
    // con un objeto vacio por defecto, aun sin aprobar — solo cuenta si el
    // rol fue realmente aprobado (approvedAt con fecha).
    ...Object.entries(user?.roleProfiles || {})
      .filter(([, profile]) => profile?.approvedAt)
      .map(([key]) => key),
  ].filter(Boolean))
  const hasRole = (...roles) => roles.some(role => roleKeys.has(role))
  const hasManagedTeamAccess = managedTeamCount > 0 || Boolean(user?.captainTeam || user?.ownedTeam)
  const hasCommunityAccess = Boolean(
    user?.community ||
    user?.communityId ||
    (Array.isArray(user?.communities) && user.communities.length > 0)
  )

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 900) setCollapsed(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!user) {
      setManagedTeamCount(0)
      return
    }
    let alive = true
    api('/teams/mine')
      .then(data => {
        if (!alive) return
        const userId = String(user?._id || user?.id || '')
        const teams = Array.isArray(data?.teams) ? data.teams : []
        setManagedTeamCount(teams.filter(team => {
          const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')
          return userId && leaderId && userId === leaderId
        }).length)
      })
      .catch(() => { if (alive) setManagedTeamCount(0) })
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    if (window.innerWidth < 900) {
      setCollapsed(true)
      setShowThemer(false)
    }
  }, [pathname])

  // Auto-collapse on outside click
  useEffect(() => {
    if (collapsed) return
    const handler = (e) => {
      if (sideRef.current && !sideRef.current.contains(e.target)) {
        setCollapsed(true)
        setShowThemer(false)
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 150)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [collapsed])

  // Lo que mas se usa, arriba y siempre visible.
  const PRIMARY_ITEMS = [
    { to: '/dashboard',     icon: Icon.dashboard, label: t.side.dashboard },
    { to: '/torneos',       icon: Icon.trophy,    label: t.side.torneos },
    { to: '/equipos',       icon: Icon.team,      label: t.side.equipos },
    { to: '/mensajes',      icon: Icon.msg,       label: t.side.mensajes, badge: messageBadge > 0 ? `${messageBadge}` : undefined },
    { to: '/amigos',        icon: Icon.friends,   label: t.side.amigos },
  ]

  const GROUPS_ALL = [
    {
      // "Lo mio": panel de jugador y equipo propio. "Mi equipo" solo aparece si de
      // verdad soy lider/creadora de un equipo -- ser admin del sitio no cuenta
      // (para eso esta /admin/equipos, no este panel).
      key: 'espacios', label: t.side.mySpaces || (isEs ? 'Mis espacios' : 'My spaces'),
      items: [
        { to: '/jugador', icon: Icon.chartBar, label: t.side.playerPanel || t.side.myPerformance },
        ...(hasManagedTeamAccess ? [{ to: '/mi-equipo', icon: Icon.team, label: t.side.myTeam || 'Mi equipo' }] : []),
        ...(hasCommunityAccess || hasRole('admin') ? [{ to: '/mi-comunidad', icon: Icon.chat, label: t.side.myCommunity }] : []),
      ],
    },
    {
      key: 'roles', label: t.side.rolePanels || t.side.myPanels,
      items: [
        ...(hasRole('organizer', 'admin') ? [{ to: '/organizador', icon: Icon.trophy, label: t.side.organizer }] : []),
        ...(hasRole('brand', 'sponsor', 'admin') ? [{ to: '/marca', icon: Icon.layoutGrid, label: t.side.brandCenter }] : []),
        ...(hasRole('coach', 'admin') ? [{ to: '/coach', icon: Icon.users, label: t.side.coachPanel }] : []),
        ...(hasRole('caster', 'admin') ? [{ to: '/caster', icon: Icon.play, label: t.side.caster }] : []),
        ...(hasRole('analyst', 'admin') ? [{ to: '/analista', icon: Icon.trend, label: t.side.analyst }] : []),
        ...(hasRole('moderator', 'admin') ? [{ to: '/moderador', icon: Icon.shield, label: t.side.moderator || (isEs ? 'Moderador' : 'Moderator') }] : []),
        ...(hasRole('creator', 'admin') ? [{ to: '/creador/perfil', icon: Icon.camera, label: t.side.creatorStudio }] : []),
        ...(hasRole('admin') ? [{ to: '/admin', icon: Icon.shield, label: t.side.adminPanel }] : []),
      ],
    },
    {
      key: 'menu', label: t.side.explore,
      items: [
        { to: '/universidad', icon: Icon.award, label: t.side.university },
        { to: '/sorteos', icon: Icon.gem, label: isEs ? 'Sorteos' : 'Raffles' },
      ],
    },
    {
      key: 'cuenta', label: t.side.cuenta,
      items: [
        { to: '/perfil',         icon: Icon.user,   label: t.side.perfil },
        { to: '/editar-perfil',  icon: Icon.edit,   label: t.side.editProfile },
        { to: '/notificaciones', icon: Icon.bell,   label: t.side.notificaciones, badge: unread > 0 ? `${unread > 99 ? '99+' : unread}` : undefined },
        { to: '/ajustes',        icon: Icon.gear,   label: t.side.ajustes },
      ],
    },
  ]

  // Accesos ocultos en la beta (config/betaHidden.js): los de toda la app y los
  // quitados solo del sidebar (noticias, marcas, comunidad, ranking).
  const GROUPS = GROUPS_ALL
    .map(group => ({ ...group, items: hideInBeta(group.items, 'to').filter(item => !isSidebarHidden(item.to)) }))
    .filter(group => group.items.length > 0)

  const NavItem = ({ to, icon, label, badge, adminTag }) => (
    <NavLink
      to={to}
      className={({ isActive }) => `gg-navitem${isActive ? ' active' : ''}${adminTag ? ' gg-navitem--admin' : ''}`}
      title={collapsed ? label : undefined}
      onClick={() => window.innerWidth < 900 && setCollapsed(true)}
    >
      <span className="ni-icon">{icon}</span>
      <span className="ni-label">{label}</span>
      {adminTag && <span className="ni-admin-tag">ADMIN</span>}
      {badge && <span className="ni-badge">{badge}</span>}
    </NavLink>
  )

  return (
    <>
      <button
        className={`gg-side-mobile-trigger ${collapsed ? 'visible' : ''}`}
        onClick={() => setCollapsed(false)}
        aria-label={t.side.openMenu}
        title={t.side.openMenu}
      >
        {Icon.collapse}
      </button>

      {!collapsed && (
        <button
          className="gg-side-backdrop"
          onClick={() => { setCollapsed(true); setShowThemer(false) }}
          aria-label={t.side.closeMenu}
        />
      )}

      <aside
      ref={sideRef}
      className={`gg-side ${collapsed ? 'collapsed' : ''}`}
      onClick={(e) => {
        if (collapsed) {
          e.stopPropagation()
          setCollapsed(false)
        }
      }}
    >

      {/* ── Header ── */}
      <div className="gg-side__head">
        <div className="side-logo" onClick={() => setCollapsed(v => !v)}>
          <Logo size={32} />
        </div>
        <div className="side-brand">
          <span className="side-brand__word">GLITCH<b><GlitchGangText>GANG</GlitchGangText></b></span>
        </div>
        <button
          className="side-toggle"
          onClick={() => { setCollapsed(v => !v); setShowThemer(false) }}
          title={collapsed ? t.side.expand : t.side.collapse}
        >
          {Icon.collapse}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="gg-side__nav">
        <div className="gg-navprimary">
          {PRIMARY_ITEMS.map((item) => <NavItem key={item.to} {...item} />)}
        </div>

        {/* Publicar button */}
        <button
          className="gg-pub-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('gg:publish'))}
          title={t.side.publish}
        >
          <span className="ni-icon">{Icon.send}</span>
          <span className="ni-label">{t.side.publish}</span>
        </button>

        <div className="gg-navgroups">
          {GROUPS.map(({ key, label, items }) => {
            if (!items.length) return null
            const isOpen = openGroups[key]
            return (
              <div key={key} className={`gg-navgroup ${isOpen ? 'open' : ''}`}>
                <button
                  className="gg-navgroup__label"
                  onClick={() => !collapsed && toggleGroup(key)}
                  title={collapsed ? label : undefined}
                >
                  <span className="ngl-text">{label}</span>
                  <span className={`ngl-chevron ${isOpen ? 'up' : ''}`}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </span>
                </button>
                <div className="gg-navgroup__items">
                  <div className="gg-navgroup__inner">
                    {items.map((item) => <NavItem key={item.to} {...item} />)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Theme switcher popup ── */}
      {showThemer && !collapsed && (
        <div className="gg-themer-pop">
          <ThemeSwitcher inline />
        </div>
      )}

      {/* ── Bottom controls ── */}
      <div className="gg-side__ctrl">
        <div className="gg-ctrl-lang" title={t.side.idioma}>
          <span className="ni-icon">{Icon.globe}</span>
          <span className="ni-label gg-langpill gg-langpill--sidebar" data-no-translate>
            <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>ES</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </span>
        </div>
        <button
          className="gg-ctrl-btn"
          onClick={() => setShowThemer(v => !v)}
          title={t.side.temas}
        >
          <span className="ni-icon">{Icon.palette}</span>
          <span className="ni-label">{t.side.temas}</span>
        </button>
      </div>

      {/* ── User ── */}
      <div className="gg-side__user" onClick={() => navigate('/perfil')} title={user?.nick}>
        <img src={avatarSrc} alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/demos/steliant-esports/avatar-default.svg' }} />
        <div className="gg-user__meta">
          <b>{user?.nick || 'Brooklyn'}</b>
          <small>{user?.plan || t.side.protrial}</small>
        </div>
      </div>

      </aside>
    </>
  )
}


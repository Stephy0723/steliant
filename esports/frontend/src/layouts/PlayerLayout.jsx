import { hideInBeta, hideInBetaSections, isBetaHidden } from '../config/betaHidden.js'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../i18n/LangContext.jsx'
import { Icon } from '../components/icons/Icons.jsx'
import Logo from '../components/Logo/Logo.jsx'
import './PlayerLayout.css'

const TR = {
  es: {
    hq: 'Player HQ', center: 'Centro de Rendimiento', role: 'Player Pro', player: 'Jugador',
    secPerf: 'Rendimiento', secAccount: 'Cuenta',
    summary: 'Resumen', perf: 'Mi Rendimiento', teams: 'Mis Equipos', matches: 'Partidas', history: 'Historial',
    profile: 'Mi Perfil', edit: 'Editar', playerProfile: 'Perfil profesional', findTeam: 'Buscar equipo',
    proPlan: 'Plan Pro', viewApp: 'Ver app', logout: 'Cerrar sesión',
    expand: 'Expandir', collapse: 'Colapsar',
  },
  en: {
    hq: 'Player HQ', center: 'Performance Hub', role: 'Player Pro', player: 'Player',
    secPerf: 'Performance', secAccount: 'Account',
    summary: 'Overview', perf: 'My Performance', teams: 'My Teams', matches: 'Matches', history: 'History',
    profile: 'My Profile', edit: 'Edit', playerProfile: 'Pro profile', findTeam: 'Find a team',
    proPlan: 'Pro Plan', viewApp: 'View app', logout: 'Log out',
    expand: 'Expand', collapse: 'Collapse',
  },
}

export default function PlayerLayout() {
  const { user } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const L = TR[lang] || TR.es
  const NAV_SECTIONS = [
    {
      section: L.secPerf,
      items: [
        { path: '/jugador',             label: L.summary, icon: Icon.dashboard, end: true },
        { path: '/jugador/rendimiento', label: L.perf,    icon: Icon.chartBar },
        { path: '/jugador/equipos',     label: L.teams,   icon: Icon.team },
        { path: '/jugador/buscar-equipo', label: L.findTeam, icon: Icon.search },
        { path: '/jugador/partidas',    label: L.matches, icon: Icon.target },
        { path: '/jugador/historial',   label: L.history, icon: Icon.clock },
      ],
    },
    {
      section: L.secAccount,
      items: [
        { path: '/jugador/perfil', label: L.playerProfile, icon: Icon.gamepad },
        { path: '/perfil',        label: L.profile, icon: Icon.user },
        { path: '/editar-perfil', label: L.edit,    icon: Icon.edit },
      ],
    },
  ]

  const nick = user?.nick || 'Jugador'
  const avatar = user?.avatar || '/demos/steliant-esports/avatar-default.svg'

  return (
    <div className={`gg-player ${collapsed ? 'collapsed' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="gg-player-side">
        {/* Logo / header */}
        <div className="gg-player-side__logo">
          <div className="gg-player-side__logo-group">
            <div className="gg-player-side__logo-icon"><Logo size={28} /></div>
            <div className="gg-player-side__logo-text">
              <span>GlitchGang</span>
              <small>{L.hq}</small>
            </div>
          </div>
          <button
            className="gg-player-side__collapse"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? L.expand : L.collapse}
          >
            {Icon.collapse}
          </button>
        </div>

        {/* Navigation */}
        <nav className="gg-player-side__nav">
          {hideInBetaSections(NAV_SECTIONS).map(section => (
            <div key={section.section}>
              <div className="gg-player-side__nav-section">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end ?? false}
                  className={({ isActive }) => `gg-player-nav${isActive ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="gg-player-nav__icon">{item.icon}</span>
                  <span className="gg-player-nav__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="gg-player-side__bottom">
          {!isBetaHidden('/planes') && (
            <button
              className="gg-player-nav"
              onClick={() => navigate('/planes')}
              title={collapsed ? L.proPlan : undefined}
            >
              <span className="gg-player-nav__icon">{Icon.crown}</span>
              <span className="gg-player-nav__label">{L.proPlan}</span>
            </button>
          )}
          <button
            className="gg-player-nav"
            onClick={() => navigate('/dashboard')}
            title={collapsed ? L.viewApp : undefined}
          >
            <span className="gg-player-nav__icon">{Icon.eye}</span>
            <span className="gg-player-nav__label">{L.viewApp}</span>
          </button>
        </div>

        {/* User card */}
        <div className="gg-player-side__user" onClick={() => navigate('/perfil')}>
          <img src={avatar} alt={nick} />
          <div className="gg-player-side__user-info">
            <b>{nick}</b>
            <small>{L.player}</small>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="gg-player-main">
        {/* Topbar */}
        <header className="gg-player-topbar">
          <span className="gg-player-topbar__title">{L.center}</span>
          <div className="gg-player-topbar__right">
            <div className="gg-player-topbar__user">
              <img src={avatar} alt={nick} className="gg-player-topbar__avatar" />
              <span>{nick}</span>
              <span className="gg-player-topbar__role">{L.role}</span>
            </div>
          </div>
        </header>

        {/* Navegacion en celular: el sidebar se oculta y las secciones pasan a
            una fila deslizable (mismo patron que PanelShell). */}
        <nav className="gg-player-mobile-nav" aria-label={L.center}>
          {hideInBetaSections(NAV_SECTIONS).flatMap(section => section.items).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end ?? false}
              className={({ isActive }) => `gg-player-mobile-nav__item${isActive ? ' active' : ''}`}
            >
              <span>{item.icon}</span>
              <b>{item.label}</b>
            </NavLink>
          ))}
          <NavLink to="/dashboard" className="gg-player-mobile-nav__item">
            <span>{Icon.eye}</span>
            <b>{L.viewApp}</b>
          </NavLink>
        </nav>

        {/* Page content */}
        <div className="gg-player-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}


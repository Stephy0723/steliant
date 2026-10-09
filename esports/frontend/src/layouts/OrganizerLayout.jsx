import { hideInBeta, hideInBetaSections, isBetaHidden } from '../config/betaHidden.js'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation, matchPath } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Icon } from '../components/icons/Icons.jsx'
import Logo from '../components/Logo/Logo.jsx'
import { getGameArt, STATUS_LABEL } from '../data/organizerTournaments.js'
import { MANAGE_TABS } from '../data/organizerManageTabs.js'
import { tournamentsApi } from '../lib/serverApi.js'
import { normalizeTournament } from '../lib/tournamentAdapter.js'
import { resolveMemberAccess, ACCESS_NONE } from '../lib/staffPermissions.js'
import { roleDashboardPath } from '../lib/roleDashboards.js'
import './OrganizerLayout.css'

const NAV_SECTIONS = [
  {
    section: 'Panel',
    items: [
      { path: '/organizador', label: 'Mis Torneos', icon: Icon.trophy, end: true },
      { path: '/organizador/resultados', label: 'Resultados por revisar', icon: Icon.shield },
      { path: '/organizador/integraciones', label: 'Discord y bots', icon: Icon.discord || Icon.bolt },
      { path: '/organizador/perfil', label: 'Perfil profesional', icon: Icon.edit },
    ]
  },
  {
    section: 'Cuenta',
    items: [
      { path: '/organizador/configuracion', label: 'Mi Perfil', icon: Icon.user },
    ]
  },
]

// Agrupa las pestañas por su "group" preservando el orden.
const TAB_GROUPS = MANAGE_TABS.reduce((acc, tab) => {
  const g = acc.find(x => x.name === tab.group)
  if (g) g.items.push(tab)
  else acc.push({ name: tab.group, items: [tab] })
  return acc
}, [])

export default function OrganizerLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  // ¿Estamos dentro de un torneo puntual? -> sidebar contextual (tambien
  // aplica a /organizador/torneo/:id sin /gestionar, para que un staff que
  // aterrice ahi no vea el sidebar generico de cuenta del organizador, que
  // no le corresponde).
  const manageMatch =
    matchPath('/organizador/torneo/:id/gestionar/:tab', location.pathname) ||
    matchPath('/organizador/torneo/:id/gestionar', location.pathname) ||
    matchPath('/organizador/torneo/:id', location.pathname)
  const manageId = manageMatch?.params.id || null
  const isManaging = Boolean(manageMatch)

  // El torneo se trae del backend real (antes se buscaba en una lista
  // estática de demo — cualquier torneo real que no estuviera ahí hacía que
  // el sidebar cayera al menú genérico sin avisar).
  const [tournament, setTournament] = useState(null)

  useEffect(() => {
    if (!manageId) {
      setTournament(null)
      return
    }
    let cancelled = false
    tournamentsApi.get(manageId)
      .then((data) => { if (!cancelled) setTournament(normalizeTournament(data)) })
      .catch(() => { if (!cancelled) setTournament(null) })
    return () => { cancelled = true }
  }, [manageId])

  const art = tournament ? getGameArt(tournament.game) : null

  // Mismo cálculo que en OrganizerTournamentManage: el dueño/admin ve todo;
  // cualquier otro staff solo ve las pestañas que su acceso resuelto permite
  // (ver staffPermissions.js) — así el menú no ofrece algo que el contenido
  // igual le va a esconder.
  const myId = String(user?._id || user?.id || '')
  const isAdmin = user?.role === 'admin' || (user?.roles || []).includes('admin')
  const isOwner = Boolean(tournament && myId && tournament.organizerId === myId)
  const myStaffRecord = tournament?.staffMembers?.find(m => String(m.user) === myId) || null
  // Para el "volver" y la etiqueta de rol: el dueño/admin vuelve a su panel
  // de organizador; cualquier otro staff vuelve a su propio dashboard (no
  // tiene acceso a /organizador en si) y ve su rol real, no "Organizador".
  const backPath = (isAdmin || isOwner) ? '/organizador' : roleDashboardPath(user?.role)
  const backLabel = (isAdmin || isOwner) ? 'Mis Torneos' : 'Mi panel'
  // Fuera de un torneo puntual (isManaging=false) solo entra aqui
  // organizador/admin (TournamentOrgRoute), asi que ahi siempre es
  // "Organizador" aunque tournament/myStaffRecord todavia esten en null.
  const roleLabel = (!isManaging || isAdmin || isOwner) ? 'Organizador' : (myStaffRecord?.role || 'Staff')
  const tabGroups = (isAdmin || isOwner || !tournament)
    ? TAB_GROUPS
    : TAB_GROUPS
      .map(group => {
        const access = myStaffRecord ? resolveMemberAccess(myStaffRecord, manageId) : {}
        return { ...group, items: group.items.filter(tab => access[tab.key] && access[tab.key] !== ACCESS_NONE) }
      })
      .filter(group => group.items.length > 0)

  return (
    <div className={`gg-organizer ${collapsed ? 'collapsed' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="gg-organizer-side">

        {/* Logo / Header */}
        <div className="gg-organizer-side__logo">
          <div className="gg-organizer-side__logo-group">
            <div className="gg-organizer-side__logo-icon"><Logo size={28} /></div>
            <div className="gg-organizer-side__logo-text">
              <span>GlitchGang</span>
              <small>Eventos</small>
            </div>
          </div>
          <button
            className="gg-organizer-side__collapse"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {Icon.collapse}
          </button>
        </div>

        {/* Navigation */}
        <nav className="gg-organizer-side__nav">
          {isManaging ? (
            <>
              {/* Volver */}
              <button className="gg-organizer-back" onClick={() => navigate(backPath)}>
                <span className="gg-organizer-back__icon">{Icon.chevronRight}</span>
                <span className="gg-organizer-nav__label">{backLabel}</span>
              </button>

              {/* Cabecera del torneo en el sidebar */}
              {tournament ? (
                <div className="gg-organizer-tctx">
                  <div
                    className="gg-organizer-tctx__cover"
                    style={(tournament.banner || art?.image)
                      ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.78)), url(${tournament.banner || art.image})` }
                      : { background: `linear-gradient(135deg, ${tournament.primaryColor}, ${tournament.primaryColor}55)` }}
                  >
                    {(tournament.logo || art?.logo)
                      ? <img className="gg-organizer-tctx__logo" src={tournament.logo || art.logo} alt={tournament.game} />
                      : <span className="gg-organizer-tctx__game">{tournament.game}</span>}
                    <span className={`gg-organizer-tctx__status gg-organizer-tctx__status--${tournament.rawStatus === 'draft' ? 'draft' : tournament.status}`}>
                      {tournament.rawStatus === 'draft' ? STATUS_LABEL.draft : STATUS_LABEL[tournament.status]}
                    </span>
                  </div>
                  <div className="gg-organizer-tctx__info">
                    <b className="gg-organizer-tctx__name">{tournament.title}</b>
                    <span className="gg-organizer-tctx__id">{tournament.publicId}</span>
                  </div>
                </div>
              ) : (
                <div className="gg-organizer-tctx">
                  <div className="gg-organizer-tctx__info">
                    <b className="gg-organizer-tctx__name">Cargando torneo...</b>
                  </div>
                </div>
              )}

              {/* Pestañas agrupadas */}
              {tabGroups.map(group => (
                <div key={group.name}>
                  <div className="gg-organizer-side__nav-section">{group.name}</div>
                  {group.items.map(tab => (
                    <NavLink
                      key={tab.key}
                      to={`/organizador/torneo/${manageId}/gestionar/${tab.key}`}
                      className={({ isActive }) => `gg-organizer-nav${isActive ? ' active' : ''}`}
                      title={collapsed ? tab.label : undefined}
                    >
                      <span className="gg-organizer-nav__icon">{Icon[tab.icon]}</span>
                      <span className="gg-organizer-nav__label">{tab.label}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </>
          ) : (
            hideInBetaSections(NAV_SECTIONS).map((section) => (
              <div key={section.section}>
                <div className="gg-organizer-side__nav-section">{section.section}</div>
                {section.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end ?? false}
                    className={({ isActive }) => `gg-organizer-nav${isActive ? ' active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="gg-organizer-nav__icon">{item.icon}</span>
                    <span className="gg-organizer-nav__label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))
          )}
        </nav>

        {/* Bottom controls */}
        <div className="gg-organizer-side__bottom">
          <button
            className="gg-organizer-nav"
            onClick={() => navigate('/dashboard')}
            title={collapsed ? 'Ver app' : undefined}
          >
            <span className="gg-organizer-nav__icon">{Icon.eye}</span>
            <span className="gg-organizer-nav__label">Ver app</span>
          </button>
        </div>

        {/* User card */}
        <div className="gg-organizer-side__user" onClick={() => navigate('/perfil')}>
          <img src={user?.avatar || '/demos/steliant-esports/avatar-default.svg'} alt={user?.nick} />
          <div className="gg-organizer-side__user-info">
            <b>{user?.nick || 'Organizador'}</b>
            <small>{roleLabel}</small>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="gg-organizer-main">
        {/* Topbar */}
        <header className="gg-organizer-topbar">
          {isManaging ? (
            <div className="gg-organizer-topbar__ctx">
              <span className="gg-organizer-topbar__crumb">{backLabel}</span>
              <span className="gg-organizer-topbar__slash">/</span>
              <span className="gg-organizer-topbar__title">{tournament?.title || 'Cargando...'}</span>
              {tournament ? <span className="gg-organizer-topbar__pill">{tournament.publicId}</span> : null}
            </div>
          ) : (
            <span className="gg-organizer-topbar__title">Centro de Eventos</span>
          )}
          <div className="gg-organizer-topbar__right">
            <div className="gg-organizer-topbar__user">
              <img
                src={user?.avatar || '/demos/steliant-esports/avatar-default.svg'}
                alt={user?.nick}
                className="gg-organizer-topbar__avatar"
              />
              <span>{user?.nick || 'Organizador'}</span>
              <span className="gg-organizer-topbar__role">{roleLabel}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="gg-organizer-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}


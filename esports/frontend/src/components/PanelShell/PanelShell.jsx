import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { hideInBeta, hideInBetaSections, isBetaHidden } from '../../config/betaHidden.js'
import { Icon } from '../icons/Icons.jsx'
import Logo from '../Logo/Logo.jsx'
import './PanelShell.css'

/**
 * Carcasa reutilizable para paneles con sidebar (Creador, Marca, …).
 * Replica el lenguaje visual del Player HQ pero parametrizado.
 *
 * props:
 *  - brand:    { name, hq }            texto del logo
 *  - accent:   color CSS (opcional)    acento del panel
 *  - title:    string                  título del topbar
 *  - roleLabel:string                  etiqueta de rol en topbar
 *  - sections: [{ section, items:[{ path, label, icon, end }] }]
 *  - user:     { nick, avatar, sub }   tarjeta de usuario
 *  - profilePath: string               a dónde lleva la tarjeta de usuario
 */
export default function PanelShell({
  brand, accent, title, roleLabel, sections: allSections, user, profilePath = '/perfil', sidebarContext = null, topbarExtra = null, outletContext = null,
}) {
  const navigate = useNavigate()
  // Accesos ocultos en la beta (config/betaHidden.js)
  const sections = hideInBetaSections(allSections)
  const [collapsed, setCollapsed] = useState(false)

  const accentRgb = hexToRgb(accent)
  const style = accent ? {
    '--accent': accent,
    '--accent-rgb': accentRgb,
    '--panel-accent': accent,
    '--panel-accent-rgb': accentRgb,
  } : undefined

  return (
    <div className={`gg-pnl ${collapsed ? 'collapsed' : ''}`} style={style}>
      {/* ── Sidebar ── */}
      <aside className="gg-pnl-side">
        <div className="gg-pnl-side__logo">
          <div className="gg-pnl-side__logo-group">
            <div className="gg-pnl-side__logo-icon"><Logo size={28} /></div>
            <div className="gg-pnl-side__logo-text">
              <span>{brand.name}</span>
              <small>{brand.hq}</small>
            </div>
          </div>
          <button
            className="gg-pnl-side__collapse"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {Icon.collapse}
          </button>
        </div>

        {sidebarContext && (
          <div className="gg-pnl-side__context" style={sidebarContext.accent ? { '--ctx-accent': sidebarContext.accent } : undefined}>
            {(sidebarContext.banner || sidebarContext.logo) && (
              <div
                className="gg-pnl-side__context-media"
                style={sidebarContext.banner ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.55)), url(${sidebarContext.banner})` } : undefined}
              >
                {sidebarContext.logo && <img src={sidebarContext.logo} alt="" />}
              </div>
            )}
            <div className="gg-pnl-side__context-title">
              <b>{sidebarContext.title}</b>
              <small>{sidebarContext.subtitle}</small>
            </div>
            <div className="gg-pnl-side__context-list">
              {(sidebarContext.items || []).map(item => (
                <div key={item.label} className="gg-pnl-side__context-row">
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <nav className="gg-pnl-side__nav">
          {sections.map(section => (
            <div key={section.section}>
              <div className="gg-pnl-side__nav-section">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end ?? false}
                  className={({ isActive }) => `gg-pnl-nav${isActive ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="gg-pnl-nav__icon">{item.icon}</span>
                  <span className="gg-pnl-nav__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="gg-pnl-side__bottom">
          <button className="gg-pnl-nav" onClick={() => navigate('/dashboard')} title={collapsed ? 'Ver app' : undefined}>
            <span className="gg-pnl-nav__icon">{Icon.eye}</span>
            <span className="gg-pnl-nav__label">Ver app</span>
          </button>
        </div>

        <div className="gg-pnl-side__user" onClick={() => navigate(profilePath)}>
          {user.avatar
            ? <img src={user.avatar} alt={user.nick} />
            : <span className="gg-pnl-side__user-mono">{user.nick?.[0] || '?'}</span>}
          <div className="gg-pnl-side__user-info">
            <b>{user.nick}</b>
            <small>{user.sub}</small>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="gg-pnl-main">
        <header className="gg-pnl-topbar">
          <span className="gg-pnl-topbar__title">{title}</span>
          <div className="gg-pnl-topbar__right">
            {topbarExtra}
            <div className="gg-pnl-topbar__user">
              {user.avatar && <img src={user.avatar} alt={user.nick} className="gg-pnl-topbar__avatar" />}
              <span>{user.nick}</span>
              <span className="gg-pnl-topbar__role">{roleLabel}</span>
            </div>
          </div>
        </header>

        <nav className="gg-pnl-mobile-nav" aria-label="Navegacion del panel">
          {sections.flatMap(section => section.items).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end ?? false}
              className={({ isActive }) => `gg-pnl-mobile-nav__item${isActive ? ' active' : ''}`}
            >
              <span>{item.icon}</span>
              <b>{item.label}</b>
            </NavLink>
          ))}
          {/* En celular el sidebar (y su boton "Ver app") no se muestra. */}
          <NavLink to="/dashboard" className="gg-pnl-mobile-nav__item">
            <span>{Icon.eye}</span>
            <b>Ver app</b>
          </NavLink>
        </nav>

        <div className="gg-pnl-content">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  )
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : '0,230,118'
}


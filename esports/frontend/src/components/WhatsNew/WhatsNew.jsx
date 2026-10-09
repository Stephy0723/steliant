import { isBetaHidden } from '../../config/betaHidden.js'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { getPublicBrands } from '../../lib/brandApi.js'
import './WhatsNew.css'

const NEVER_KEY = 'gg-whatsnew-never'
const SEEN_KEY = 'gg-whatsnew-seen-session'

// Se muestra una sola vez por sesión (al iniciar sesión / abrir la app),
// y nunca más si el usuario marcó "No volver a mostrar".
export function shouldShowWhatsNew() {
  try {
    if (localStorage.getItem(NEVER_KEY) === '1') return false
    if (sessionStorage.getItem(SEEN_KEY) === '1') return false
    return true
  } catch { return false }
}

const TR = {
  es: {
    pre: 'RESUMEN DEL SISTEMA', title: 'Novedades en GlitchGang', sub: 'Todo lo nuevo desde tu última visita',
    tabs: { platform: 'Plataforma', tournaments: 'Torneos', news: 'Noticias', creators: 'Creadores', brands: 'Marcas' },
    empty: 'Nada nuevo por aquí.', dontShow: 'No volver a mostrar', cta: 'Explorar', got: 'Entendido',
    live: 'EN VIVO', newTag: 'NUEVO', viewAll: 'Ver todo', loading: 'Cargando...',
  },
  en: {
    pre: 'SYSTEM DIGEST', title: "What's new on GlitchGang", sub: 'Everything new since your last visit',
    tabs: { platform: 'Platform', tournaments: 'Tournaments', news: 'News', creators: 'Creators', brands: 'Brands' },
    empty: 'Nothing new here.', dontShow: "Don't show again", cta: 'Explore', got: 'Got it',
    live: 'LIVE', newTag: 'NEW', viewAll: 'View all', loading: 'Loading...',
  },
}

const STATUS_MAP = { open: 'upcoming', registration_closed: 'upcoming', ongoing: 'live', finished: 'finished', cancelled: 'finished', draft: 'upcoming' }

function normalizeTournament(t) {
  return {
    id: t._id,
    name: t.title,
    game: t.game,
    prize: t.prizePool || 0,
    date: t.date ? new Date(t.date).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' }) : '',
    status: STATUS_MAP[t.status] || 'upcoming',
    color: t.primaryColor || '#00E676',
  }
}

function normalizeNews(n) {
  return { id: n._id, slug: n.slug, title: n.title }
}

function normalizeCreator(u) {
  return { id: u.id, nick: u.nick, avatar: u.avatar, game: u.games?.[0] || '' }
}

function normalizeBrand(b) {
  return { id: b._id, name: b.name, color: b.color || '#F0A500', logoInitials: b.logoInitials || b.name?.[0] || '?' }
}

export default function WhatsNew() {
  const { lang } = useLang()
  const isEs = lang !== 'en'
  const L = isEs ? TR.es : TR.en
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState(() => Boolean(user) && shouldShowWhatsNew())
  const [tab, setTab] = useState('tournaments')
  const [never, setNever] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ platform: [], tournaments: [], news: [], creators: [], brands: [] })

  // Marca como visto en esta sesión: no vuelve a aparecer hasta el próximo login.
  useEffect(() => {
    if (open) { try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* noop */ } }
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    Promise.allSettled([
      api('/tournaments?limit=50'),
      api('/news?limit=4'),
      api('/users/creators'),
      getPublicBrands(),
      api('/site/announcements'),
      api('/site/changelog?limit=4'),
    ]).then(([tournamentsRes, newsRes, creatorsRes, brandsRes, annRes, logRes]) => {
      if (!alive) return
      const tournaments = tournamentsRes.status === 'fulfilled'
        ? (tournamentsRes.value?.tournaments || [])
          .filter(t => t.status === 'open' || t.status === 'ongoing')
          .map(normalizeTournament)
          .slice(0, 4)
        : []
      const news = newsRes.status === 'fulfilled' ? (newsRes.value?.news || []).map(normalizeNews) : []
      const creators = creatorsRes.status === 'fulfilled' ? (creatorsRes.value?.creators || []).map(normalizeCreator).slice(0, 4) : []
      const brands = brandsRes.status === 'fulfilled' ? (Array.isArray(brandsRes.value) ? brandsRes.value : []).map(normalizeBrand).slice(0, 5) : []
      // Anuncios activos (de hoy en adelante) + ultimas entradas del changelog,
      // ambos publicados desde /admin/noticias.
      const platform = [
        ...(annRes.status === 'fulfilled' ? (annRes.value?.announcements || []) : []).map(a => ({ ...a, kind: 'announcement' })),
        ...(logRes.status === 'fulfilled' ? (logRes.value?.changelog || []) : []).map(c => ({ ...c, kind: 'changelog' })),
      ]
      setData({ platform, tournaments, news, creators, brands })
      if (platform.length) setTab('platform')
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open])

  const TABS = useMemo(() => ([
    ...(data.platform.length ? [{ key: 'platform', icon: 'bell', count: data.platform.length }] : []),
    { key: 'tournaments', icon: 'trophy', count: data.tournaments.length },
    { key: 'news', icon: 'news', count: data.news.length },
    ...(isBetaHidden('/creadores') ? [] : [{ key: 'creators', icon: 'camera', count: data.creators.length }]),
    { key: 'brands', icon: 'star', count: data.brands.length },
  ]), [data])

  const close = () => {
    if (never) { try { localStorage.setItem(NEVER_KEY, '1') } catch { /* noop */ } }
    setOpen(false)
  }

  const go = (path) => { close(); navigate(path) }

  const ANN_COLOR = { evento: '#00E676', recordatorio: '#f59e0b', aviso: '#7c3aed' }
  const LOG_COLOR = { feature: '#22c55e', fix: '#7c3aed', maintenance: '#f59e0b' }

  const renderItems = () => {
    if (tab === 'platform') {
      return data.platform.map(p => p.kind === 'announcement' ? (
        <button key={`a-${p.id}`} className="wn-row" style={{ '--rc': ANN_COLOR[p.type] || '#7c3aed' }} onClick={() => p.link ? (/^https?:/i.test(p.link) ? window.open(p.link, '_blank', 'noopener') : go(p.link)) : null}>
          <span className="wn-row__dot" />
          <div className="wn-row__body">
            <b>{p.title}</b>
            <small>{p.message || ''}{p.date ? ` · ${new Date(`${p.date}T12:00:00`).toLocaleDateString(isEs ? 'es-DO' : 'en-US', { day: '2-digit', month: 'short' })}` : ''}</small>
          </div>
          <span className="wn-tag">{L.newTag}</span>
        </button>
      ) : (
        <div key={`c-${p.id}`} className="wn-row" style={{ '--rc': LOG_COLOR[p.type] || '#22c55e' }}>
          <span className="wn-row__dot" />
          <div className="wn-row__body">
            <b>{p.version ? `${p.version} · ` : ''}{p.title}</b>
            <small>{(p.items || []).slice(0, 3).join(' · ') || p.date}</small>
          </div>
        </div>
      ))
    }
    if (tab === 'tournaments') {
      return data.tournaments.map(t => (
        <button key={t.id} className="wn-row" style={{ '--rc': t.color }} onClick={() => go(`/torneos/${t.id}`)}>
          <span className="wn-row__dot" />
          <div className="wn-row__body">
            <b>{t.name}</b>
            <small>{t.game} · {t.prize ? `$${t.prize}` : ''} · {t.date}</small>
          </div>
          {t.status === 'live' ? <span className="wn-tag wn-tag--live">{L.live}</span> : <span className="wn-tag">{L.newTag}</span>}
        </button>
      ))
    }
    if (tab === 'news') {
      return data.news.map(n => (
        <button key={n.id} className="wn-row" style={{ '--rc': '#1E9DE3' }} onClick={() => go(`/noticias/${n.slug}`)}>
          <span className="wn-row__dot" />
          <div className="wn-row__body"><b>{n.title}</b><small>{isEs ? 'Noticia' : 'News'}</small></div>
          <span className="wn-row__arrow">{Icon.chevronRight}</span>
        </button>
      ))
    }
    if (tab === 'creators') {
      return data.creators.map(c => (
        <button key={c.id} className="wn-row" style={{ '--rc': '#9146FF' }} onClick={() => go('/creadores')}>
          {c.avatar
            ? <img className="wn-row__avatar" src={c.avatar} alt={c.nick} />
            : <span className="wn-row__avatar wn-row__avatar--fallback">{(c.nick || '??').slice(0, 2).toUpperCase()}</span>}
          <div className="wn-row__body">
            <b>{c.nick}</b>
            <small>{c.game || (isEs ? 'Creador de contenido' : 'Content creator')}</small>
          </div>
          <span className="wn-tag">{L.newTag}</span>
        </button>
      ))
    }
    if (tab === 'brands') {
      return data.brands.map(b => (
        <button key={b.id} className="wn-row" style={{ '--rc': b.color }} onClick={() => go('/marcas')}>
          <span className="wn-row__logo" style={{ background: b.color }}>{b.logoInitials}</span>
          <div className="wn-row__body"><b>{b.name}</b><small>{isEs ? 'Patrocinador' : 'Sponsor'}</small></div>
          <span className="wn-tag">{L.newTag}</span>
        </button>
      ))
    }
    return null
  }

  const items = renderItems()
  const ctaPath = { platform: '/noticias', tournaments: '/torneos', news: '/noticias', creators: '/creadores', brands: '/marcas' }[tab]

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="wn-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            className="wn-card" onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: .94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .96, y: 12 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          >
            {/* esquinas HUD */}
            <span className="wn-corner wn-corner--tl" /><span className="wn-corner wn-corner--tr" />
            <span className="wn-corner wn-corner--bl" /><span className="wn-corner wn-corner--br" />
            <span className="wn-scan" />

            <header className="wn-head">
              <div>
                <span className="wn-pre">{Icon.bolt} {L.pre}</span>
                <h2 className="wn-title">{L.title}</h2>
                <p className="wn-sub">{L.sub}</p>
              </div>
              <button className="wn-close" onClick={close} aria-label="Cerrar">{Icon.x}</button>
            </header>

            <nav className="wn-tabs">
              {TABS.map(t => (
                <button key={t.key} className={`wn-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                  <span className="wn-tab__icon">{Icon[t.icon]}</span>
                  <span className="wn-tab__label">{L.tabs[t.key]}</span>
                  {t.count > 0 && <span className="wn-tab__count">{t.count}</span>}
                </button>
              ))}
            </nav>

            <div className="wn-body">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab} className="wn-list"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: .18 }}
                >
                  {loading ? (
                    <div className="wn-empty">{Icon.bolt}<p>{L.loading}</p></div>
                  ) : (items && items.length ? items : <div className="wn-empty">{Icon.bolt}<p>{L.empty}</p></div>)}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="wn-foot">
              <label className="wn-never">
                <input type="checkbox" checked={never} onChange={e => setNever(e.target.checked)} />
                <span>{L.dontShow}</span>
              </label>
              <div className="wn-foot__btns">
                <button className="wn-btn wn-btn--ghost" onClick={() => go(ctaPath)}>{L.cta} {Icon.chevronRight}</button>
                <button className="wn-btn wn-btn--primary" onClick={close}>{L.got}</button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


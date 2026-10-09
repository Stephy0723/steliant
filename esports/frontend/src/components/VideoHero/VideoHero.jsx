import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import FilterTag from '../FilterTag/FilterTag.jsx'
import { getUiPrefs, subscribeUi } from '../../lib/uiPrefs.js'
import './VideoHero.css'

export default function VideoHero({
  name,
  genre,
  description,
  tags = [],
  video,
  poster,
  lowFpsImage,
  railImages = {},
  railData = {},
  color,
  members = 0,
  activePlayers = 0,
  joined,
  onJoin,
  onLeave,
  leaving = false,
  onShare,
  onTagClick,
  activeTag,
  onQuickNav,
  counts = {},
  onBack,
}) {
  const videoRef = useRef(null)
  const [perfMode, setPerfMode] = useState(() => getUiPrefs().perfMode)

  useEffect(() => subscribeUi(prefs => setPerfMode(prefs.perfMode)), [])

  const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

  const quick = [
    { key: 'torneos', icon: 'trophy', label: 'Torneos', n: counts.torneos, data: railData?.torneos },
    { key: 'creadores', icon: 'camera', label: 'Creadores', n: counts.creadores, data: railData?.creadores },
    { key: 'noticias', icon: 'news', label: 'Noticias', n: counts.noticias, data: railData?.noticias },
    { key: 'mas-info', icon: 'shield', label: 'Información', n: null, data: railData?.rules },
  ]

  const availableQuick = quick.filter(item => {
    if (item.key === 'mas-info') return Boolean(item.data?.title)
    return Number(item.n || 0) > 0
  })

  const preferredQuickAction =
    availableQuick.find(item => item.key !== 'mas-info') ||
    availableQuick[0] ||
    quick.find(item => item.key === 'mas-info')

  const quickActionLabelMap = {
    torneos: 'Ver torneos',
    creadores: 'Ver creadores',
    noticias: 'Ver noticias',
    'mas-info': 'Ver información',
  }

  const staticBg = (perfMode ? lowFpsImage : null) || poster
  const railBg = (q) => (perfMode ? staticBg : railImages[q.key]) || staticBg || undefined

  return (
    <div className="vhero" style={{ '--vhero-color': color }}>
      {!perfMode && video ? (
        <video ref={videoRef} className="vhero__video" src={video} poster={poster} autoPlay muted loop playsInline />
      ) : staticBg ? (
        <div className="vhero__poster-bg" style={{ backgroundImage: `url(${staticBg})` }} />
      ) : (
        <div className="vhero__bg-anim" />
      )}

      {onBack && (
        <button className="vhero__back" onClick={onBack} aria-label="Volver">
          {Icon.chevronRight}
        </button>
      )}

      <div className="vhero__cine-left" />
      <div className="vhero__cine-bottom" />
      <div className="vhero__cine-vignette" />

      <div className="vhero__content">
        <motion.div className="vhero__meta" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}>
          <span className="vhero__pill vhero__pill--genre">{genre}</span>
          <span className="vhero__pill">{Icon.users} {fmt(members)} miembros</span>
          {activePlayers > 0 && <span className="vhero__pill vhero__pill--live"><i /> {fmt(activePlayers)} en línea</span>}
        </motion.div>

        <motion.h1 className="vhero__title" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .16 }}>
          {name}
        </motion.h1>

        <motion.p className="vhero__desc" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .22 }}>
          {description}
        </motion.p>

        <motion.div className="vhero__tags" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .28 }}>
          {tags.slice(0, 6).map(tag => (
            <FilterTag key={tag} label={tag} active={activeTag === tag} onClick={() => onTagClick?.(tag)} dark />
          ))}
        </motion.div>

        <motion.div className="vhero__cta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .34 }}>
          {joined ? (
            <button className="vhero__btn vhero__btn--quiet" onClick={onLeave}><span>{Icon.x}</span> Dejar comunidad</button>
          ) : (
            <button className="vhero__btn vhero__btn--primary" onClick={onJoin}><span>{Icon.plus}</span> Unirse</button>
          )}
          <button className="vhero__btn vhero__btn--share" onClick={onShare}>
            <span>{Icon.share}</span> Compartir
          </button>
          {preferredQuickAction && (
            <button className="vhero__btn vhero__btn--ghost" onClick={() => onQuickNav?.(preferredQuickAction.key)}>
              <span>{Icon[preferredQuickAction.icon]}</span> {quickActionLabelMap[preferredQuickAction.key] || 'Explorar'}
            </button>
          )}
        </motion.div>
      </div>

      {availableQuick.length > 0 && (
        <motion.div className="vhero__rail" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .42 }}>
          {availableQuick.map(q => (
            <button key={q.key} className="vhero__rail-card" onClick={() => onQuickNav?.(q.key)} style={{ backgroundImage: railBg(q) ? `url(${railBg(q)})` : undefined }}>
              <span className="vhero__rail-scrim" />
              <span className="vhero__rail-ic">{Icon[q.icon]}</span>
              <span className="vhero__rail-l">{q.label}{q.n != null && <b>{q.n}</b>}</span>
              {q.data?.title && <span className="vhero__rail-sub">{q.data.title}</span>}
              {q.data?.prize && <span className="vhero__rail-prize">{q.data.prize}</span>}
              {q.data?.followers && <span className="vhero__rail-followers">{q.data.followers}</span>}
              {q.data?.live && <span className="vhero__rail-live">EN VIVO</span>}
              {q.data?.date && <span className="vhero__rail-date">{q.data.date}</span>}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}


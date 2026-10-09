import { isBetaHidden } from '../../config/betaHidden.js'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import SponsoredCard from '../../components/SponsoredCard/SponsoredCard.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePoints } from '../../context/PointsContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { api } from '../../lib/api.js'
import { getSiteAds, trackSiteAdView, trackSiteAdClick } from '../../lib/siteAdsApi.js'
import { useAdsVisibility } from '../../context/AdsVisibilityContext.jsx'
import { getEquippedBannerGift, isBannerGiftUnlocked, unlockBannerGift } from '../../data/bannerGift.js'
import { PROFILE_BACKGROUNDS } from '../../data/backgrounds.js'
import './Dashboard.css'

// ── Panel del jugador: strip de patrocinador (slot 'dashboard' de pubStore) ────
function DashboardAd() {
  const [storeAds, setStoreAds] = useState([])
  const [idx,      setIdx]      = useState(0)
  const [hidden,   setHidden]   = useState(() => sessionStorage.getItem('gg-dash-ad') === '1')
  const { visibility } = useAdsVisibility()

  useEffect(() => {
    if (hidden || !visibility.dashboard) return
    let cancelled = false

    getSiteAds().then(ads => {
      if (cancelled) return
      const active = ads.filter(a => a.slot === 'dashboard' && a.active)
      if (active.length) {
        setStoreAds(active)
        trackSiteAdView(active[0].id)
        return
      }
      // Fallback: anuncios de marcas pagadas (Creative/Campaign vía /ads)
      api('/ads?type=banner')
        .then(data => {
          if (cancelled || !Array.isArray(data) || !data.length) return
          setStoreAds(data.map(d => ({
            id: d.adId, title: d.brandId?.name || 'Patrocinador oficial',
            description: d.campaignId?.name || 'Colaborador oficial de GlitchGang',
            color1: d.brandId?.color || '#F0A500', badge: '',
            btnText: 'Ver oferta', btnUrl: d.linkUrl || '#',
            _apiDoc: d,
          })))
          api(`/ads/${data[0].adId}/impression`, { method: 'POST' }).catch(() => {})
        })
        .catch(() => {})
    }).catch(() => {})

    return () => { cancelled = true }
  }, [hidden, visibility.dashboard])

  useEffect(() => {
    if (storeAds.length <= 1) return
    const t = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % storeAds.length
        const ad = storeAds[next]
        if (ad._apiDoc) api(`/ads/${ad.id}/impression`, { method: 'POST' }).catch(() => {})
        else trackSiteAdView(ad.id)
        return next
      })
    }, 8000)
    return () => clearInterval(t)
  }, [storeAds])

  if (!storeAds.length || hidden) return null

  const ad    = storeAds[idx]
  const color = ad.color1 || '#F0A500'

  const handleClick = () => {
    if (ad._apiDoc) api(`/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {})
    else trackSiteAdClick(ad.id)
    if (ad.btnUrl && ad.btnUrl !== '#') window.open(ad.btnUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="gg-dash-sponsored">
      <SponsoredCard
        brand={ad.title}
        title={ad.badge ? `${ad.title} - ${ad.badge}` : ad.title}
        body={ad.description}
        cta={ad.btnText || 'Ver oferta'}
        code={ad.uid || ad.id || 'AD-SLOT-01'}
        accent={color}
        width={520}
        onCta={handleClick}
        onClose={() => { sessionStorage.setItem('gg-dash-ad', '1'); setHidden(true) }}
      />
      {storeAds.length > 1 && (
        <div className="gg-dash-sponsored__dots">
          {storeAds.map((_, i) => (
            <button key={i} className={`gg-dash-sponsored__dot${i === idx ? ' active' : ''}`}
              onClick={() => setIdx(i)} aria-label={`Anuncio ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  )
}


const DASH_COPY = {
  es: {
    viewTournaments: 'Ver torneos',
    myTeam: 'Mi equipo',
    ggPoints: 'Puntos GG',
    level: 'Nivel',
    toward: 'Hacia',
    matches: 'Partidas',
    registered: 'registradas',
    winRate: 'Win Rate',
    allMatches: 'todas',
    rankPoints: 'Rank Points',
    currentLevel: 'nivel actual',
    gamesTracked: 'juegos medidos',
    tournaments: 'Torneos',
    podiums: 'podios',
    hoursPlayed: 'Horas jugadas',
    trackedGames: 'juegos medidos',
    realActivity: 'Actividad real',
    realActivityDesc: 'Partidas registradas desde el nuevo sistema de dashboard.',
    viewHistory: 'Ver historial',
    noMatchesTitle: 'No hay partidas reales registradas todavia',
    noMatchesDesc: 'Cuando se creen partidas con la API, este dashboard cambia automaticamente.',
    progressTitle: 'Progreso del perfil',
    progressDesc: 'Nivel y actividad verificada',
    friends: 'amigos conectados',
    viewProgress: 'Ver progreso y logros',
  },
  en: {
    suggestions: ['How do I rank up faster?', 'Which tournaments fit me now?', 'Give me an aim improvement tip', 'How do I find a team?'],
    viewTournaments: 'View tournaments',
    myTeam: 'My team',
    ggPoints: 'GG Points',
    level: 'Level',
    toward: 'Toward',
    matches: 'Matches',
    registered: 'registered',
    winRate: 'Win Rate',
    allMatches: 'all matches',
    rankPoints: 'Rank Points',
    currentLevel: 'current level',
    gamesTracked: 'tracked games',
    tournaments: 'Tournaments',
    podiums: 'podiums',
    hoursPlayed: 'Hours played',
    trackedGames: 'tracked games',
    realActivity: 'Real activity',
    realActivityDesc: 'Matches registered from the new dashboard system.',
    viewHistory: 'View history',
    noMatchesTitle: 'No real matches registered yet',
    noMatchesDesc: 'When matches are created through the API, this dashboard updates automatically.',
    progressTitle: 'Profile progress',
    progressDesc: 'Verified level and activity',
    friends: 'connected friends',
    viewProgress: 'View progress and achievements',
  },
}

export default function Dashboard() {
  const { user } = useAuth()
  const { profilePoints, level, nextLevel, stats } = usePoints()
  const { t, lang } = useLang()
  const C = DASH_COPY[lang] || DASH_COPY.es
  const p = t.pages
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(false)
  const [giftBanner, setGiftBanner] = useState(() => (isBannerGiftUnlocked() ? getEquippedBannerGift() : null))
  const [playerMatches, setPlayerMatches] = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [playerTournaments, setPlayerTournaments] = useState([])
  const [dashboardLoaded, setDashboardLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api('/players/me/matches?limit=5').catch(() => ({ matches: [] })),
      api('/players/me/stats/games').catch(() => ({ stats: [] })),
      api('/players/me/tournaments?limit=20').catch(() => ({ results: [] })),
    ]).then(([matchesRes, statsRes, tournamentsRes]) => {
      if (cancelled) return
      setPlayerMatches(matchesRes.matches || [])
      setPlayerStats(statsRes.stats || [])
      setPlayerTournaments(tournamentsRes.results || [])
      setDashboardLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (localStorage.getItem('gg-welcome-pending') === '1') {
      unlockBannerGift()
      setGiftBanner(getEquippedBannerGift())
      setShowWelcome(true)
    }
  }, [])

  const closeWelcome = () => {
    localStorage.removeItem('gg-welcome-pending')
    setShowWelcome(false)
  }

  const levelProgress = nextLevel
    ? Math.min(100, Math.round(((profilePoints - level.min) / (nextLevel.min - level.min)) * 100))
    : 100

  const heroActiveBg = user?.activeBg || 'banner-basic-1'
  const heroBg = heroActiveBg === 'custom'
    ? { image: user?.activeCustomBg }
    : (PROFILE_BACKGROUNDS.find(b => b.id === heroActiveBg) || PROFILE_BACKGROUNDS[0])
  const heroImg = (heroBg?.image && !heroBg?.isVideo ? heroBg.image : heroBg?.poster) || giftBanner?.poster || giftBanner?.src || null
  const heroMediaStyle = heroImg
    ? { backgroundImage: `url(${heroImg})` }
    : (heroBg?.gradient ? { background: heroBg.gradient } : undefined)
  const totalMatches = playerStats.reduce((sum, item) => sum + Number(item.matches || 0), 0)
  const totalWins = playerStats.reduce((sum, item) => sum + Number(item.wins || 0), 0)
  const totalLosses = playerStats.reduce((sum, item) => sum + Number(item.losses || 0), 0)
  const totalHours = Math.round(playerStats.reduce((sum, item) => sum + Number(item.hours || 0), 0))
  const avgWinrate = totalMatches ? Math.round((totalWins / totalMatches) * 100) : null
  const avgKda = playerStats.length
    ? (playerStats.reduce((sum, item) => sum + Number(item.kda || 0), 0) / playerStats.length).toFixed(2)
    : null
  const realMetrics = useMemo(() => ([
    { key: 'matches', label: C.matches, value: totalMatches || (dashboardLoaded ? 0 : '...'), unit: '', trend: playerMatches.length || 0, up: true, period: C.registered, icon: Icon.gamepad, color: '#06b6d4' },
    { key: 'wr', label: C.winRate, value: avgWinrate ?? (dashboardLoaded ? 0 : '...'), unit: avgWinrate == null && !dashboardLoaded ? '' : '%', trend: `${totalWins}W/${totalLosses}L`, up: true, period: C.allMatches, icon: Icon.trophy, color: '#22c55e' },
    { key: 'rp', label: C.rankPoints, value: profilePoints.toLocaleString(), unit: '', trend: level.name, up: true, period: C.currentLevel, icon: Icon.bolt, color: '#a855f7' },
    { key: 'kda', label: 'KDA', value: avgKda ?? (dashboardLoaded ? '0.00' : '...'), unit: '', trend: playerStats.length || 0, up: true, period: C.gamesTracked, icon: Icon.target, color: '#3b82f6' },
    { key: 'tourn', label: C.tournaments, value: playerTournaments.length || (dashboardLoaded ? 0 : '...'), unit: '', trend: playerTournaments.filter(item => Number(item.placement) <= 3).length, up: true, period: C.podiums, icon: Icon.trophy, color: '#f59e0b' },
    { key: 'hours', label: C.hoursPlayed, value: totalHours || (dashboardLoaded ? 0 : '...'), unit: dashboardLoaded ? 'h' : '', trend: playerStats.length, up: true, period: C.trackedGames, icon: Icon.clock, color: '#ec4899' },
  ]), [C, avgKda, avgWinrate, dashboardLoaded, level.name, playerMatches.length, playerStats.length, playerTournaments, profilePoints, totalHours, totalLosses, totalMatches, totalWins])

  return (
    <div className="gg-page gg-dash">
      {showWelcome && (
        <motion.div className="gg-first-welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section
            className="gg-first-welcome__card"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28 }}
          >
            <button className="gg-first-welcome__close" onClick={closeWelcome} aria-label={t.firstWelcome.close}>
              {Icon.x}
            </button>
            <div className="gg-first-welcome__badge">{Icon.bolt} {t.firstWelcome.badge}</div>
            <h1>{t.firstWelcome.title} <span>GlitchGang</span>, {user?.nick || t.firstWelcome.fallbackUser}.</h1>
            <p>{t.firstWelcome.description}</p>
            <div className="gg-first-welcome__steps">
              {t.firstWelcome.steps.map((text, index) => <div key={text}><b>{index + 1}</b><span>{text}</span></div>)}
            </div>
            {giftBanner && (
              <div className="gg-first-welcome__gift">
                <img src={giftBanner.poster || giftBanner.src} alt={t.firstWelcome.giftAlt} />
                <div>
                  <strong>{t.firstWelcome.giftTitle}</strong>
                  <span>{t.firstWelcome.giftText}</span>
                </div>
              </div>
            )}
            <div className="gg-first-welcome__actions">
              <button className="gg-btn gg-btn--primary gg-btn--md" onClick={() => { closeWelcome(); navigate('/editar-perfil') }}>
                {t.firstWelcome.completeProfile}
              </button>
              <button className="gg-btn gg-btn--ghost gg-btn--md" onClick={() => { closeWelcome(); navigate('/torneos') }}>
                {t.firstWelcome.viewTournaments}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}

      <motion.div
        className="gg-hero"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ '--rank-color': level.color, '--rank-glow': level.glow }}
      >
        <div className="gg-hero__media" style={heroMediaStyle} />
        <div className="gg-hero__overlay" />
        <div className="gg-hero__content">
          <div className="gg-hero__left">
            <span className="gg-hero__badge">{Icon.bolt} {level.name}</span>
            <h1>
              {p.welcome || 'Bienvenido'}, <span className="gl">{user?.nick || 'Brooklyn'}</span>
            </h1>
            <p>{p.weekSummary || 'Tu centro de mando competitivo. Metricas, analisis y todo tu progreso, en un solo lugar.'}</p>
            <div className="gg-hero__actions">
              <button className="gg-hero__btn gg-hero__btn--primary" onClick={() => navigate('/torneos')}>
                {Icon.trophy}<span>{C.viewTournaments}</span>
              </button>
              <button className="gg-hero__btn gg-hero__btn--glass" onClick={() => navigate('/equipos')}>
                {Icon.users}<span>{C.myTeam}</span>
              </button>
            </div>
          </div>
          <div className="gg-hero__stats">
            <div className="gg-hero__stat">
              <span className="gg-hero__stat-label">{C.ggPoints}</span>
              <b className="gg-hero__stat-val">{profilePoints.toLocaleString()}</b>
            </div>
            <div className="gg-hero__stat">
              <span className="gg-hero__stat-label">{C.level}</span>
              <b className="gg-hero__stat-val">{level.name}</b>
            </div>
            <div className="gg-hero__progress">
              <div className="gg-hero__progress-top">
                <span>{C.toward} {nextLevel?.name || 'MAX'}</span>
                <span>{levelProgress}%</span>
              </div>
              <div className="gg-hero__progress-bar"><span style={{ width: `${levelProgress}%` }} /></div>
            </div>
          </div>
        </div>
      </motion.div>

      <DashboardAd />

      <div className="gg-metrics">
        {realMetrics.map((m, i) => (
          <motion.div className="gg-metric" key={m.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="gg-metric__head">
              <span className="gg-metric__icon" style={{ background: `${m.color}1a`, color: m.color }}>{m.icon}</span>
              <span className="gg-metric__label">{m.label}</span>
            </div>
            <div className="gg-metric__value">{m.value}{m.unit && <small>{m.unit}</small>}</div>
            <div className="gg-metric__cmp">
              <span className="gg-metric__period">{m.period}</span>
              <span className={`gg-metric__delta ${m.up ? 'up' : 'down'}`}>{m.up ? '↑' : '↓'} {m.trend}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div className="gg-live-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div className="gg-live-panel__head">
          <div>
            <h3>{C.realActivity}</h3>
            <p>{C.realActivityDesc}</p>
          </div>
{!isBetaHidden('/jugador/historial') && (
          <button type="button" onClick={() => navigate('/jugador/historial')}>
            {C.viewHistory} {Icon.chevronRight}
          </button>
)}
        </div>
        <div className="gg-live-panel__body">
          {playerMatches.length === 0 ? (
            <div className="gg-live-empty">
              <span>{Icon.gamepad}</span>
              <div>
                <b>{C.noMatchesTitle}</b>
                <p>{C.noMatchesDesc}</p>
              </div>
            </div>
          ) : playerMatches.map(match => (
            <div key={match.id} className="gg-live-match">
              <span className={`gg-live-match__result gg-live-match__result--${match.result}`}>{match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}</span>
              <div>
                <b>{match.game} vs {match.vs}</b>
                <small>{match.mode} · {match.map} · {match.kda}</small>
              </div>
              <strong className={Number(match.rp || 0) >= 0 ? 'up' : 'down'}>{Number(match.rp || 0) >= 0 ? '+' : ''}{match.rp || 0}</strong>
            </div>
          ))}
        </div>
      </motion.div>

      {!isBetaHidden('/recompensas') && (
      <div className="gg-dash-grid">
        <motion.div
          className={`gg-panel gg-panel--points gg-points-rank-${Math.min(level.intensity, 7)}`}
          style={{ '--rank-color': level.color, '--rank-accent': level.accent, '--rank-glow': level.glow }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="gg-points-snapshot__head">
            <div>
              <h3>{C.progressTitle}</h3>
              <div className="ph">{C.progressDesc}</div>
            </div>
            <div className="gg-points-snapshot__balance">{profilePoints.toLocaleString()} <span>PTS</span></div>
          </div>
          <div className="gg-points-snapshot__level">
            <div>
              <b>{level.name}</b>
              <span>{levelProgress}% {C.toward.toLowerCase()} {nextLevel.name}</span>
            </div>
            <strong>{stats.friends}</strong>
            <small>{C.friends}</small>
          </div>
          <div className="gg-points-snapshot__bar">
            <span style={{ width: `${levelProgress}%` }} />
          </div>
{!isBetaHidden('/recompensas') && (
          <button className="gg-view-all" onClick={() => navigate('/recompensas')}>
            {C.viewProgress} {Icon.chevronRight}
          </button>
)}
        </motion.div>
      </div>
      )}

    </div>
  )
}


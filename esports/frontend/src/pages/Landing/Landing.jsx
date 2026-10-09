import { isBetaHidden } from '../../config/betaHidden.js'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

import Navbar from '../../components/Navbar/Navbar.jsx'
import Footer from '../../sections/Footer/Footer.jsx'
import ThemeSwitcher from '../../components/ThemeSwitcher/ThemeSwitcher.jsx'
import Button from '../../components/Button/Button.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import GlitchText, { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import GameDeck from '../../components/GameDeck/GameDeck.jsx'
import HeroSlider from '../../components/HeroSlider/HeroSlider.jsx'
import { useLang } from '../../i18n/LangContext.jsx'

import { GAME_BY_ID, GAMES, HERO_SLIDES, normalizeGameId } from '../../data/games.js'
import { FEATURED_NEWS, NEWS } from '../../data/news.js'
import { api } from '../../lib/api.js'

import './Landing.css'

const VP = { once: true, amount: 0.1 }
const stagger = (d = 0.08) => ({ hidden: {}, show: { transition: { staggerChildren: d, delayChildren: 0.05 } } })
const fadeUp = { hidden: { y: 36, opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } } }
const slideL = { hidden: { x: -52, opacity: 0 }, show: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 130, damping: 22 } } }
const slideR = { hidden: { x: 52, opacity: 0 }, show: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 130, damping: 22 } } }
const scaleUp = { hidden: { opacity: 0, scale: 0.88, y: 30 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 150, damping: 20 } } }

function tournamentArt(tournament) {
  const game = GAME_BY_ID[normalizeGameId(tournament.game)]
  return game?.images?.horizontal || game?.poster || game?.image || '/demos/steliant-esports/ImaHorizontal/Valo.jpg'
}


const TOURNAMENT_STATUS_MAP = {
  open: 'upcoming', registration_closed: 'upcoming', draft: 'upcoming',
  ongoing: 'live', finished: 'finished', cancelled: 'finished',
}

function normalizeLandingTournament(item, isEs) {
  const slots = Number(item.maxSlots || item.slots || 0)
  const filled = Number(item.currentSlots ?? item.registrations?.length ?? 0)
  const prizePool = Number(item.prizePool || 0)
  return {
    id: item._id,
    game: item.game,
    gameCode: item.gameCode || '',
    name: item.title,
    prize: prizePool ? prizePool.toLocaleString() : (isEs ? 'Por definir' : 'TBD'),
    date: item.date ? new Date(item.date).toLocaleDateString(isEs ? 'es-DO' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : (isEs ? 'Por definir' : 'TBD'),
    slots,
    filled,
    color: item.primaryColor || gameArtColor(item.game),
    platform: item.platform || 'PC',
    format: item.format || 'single_elimination',
    status: TOURNAMENT_STATUS_MAP[item.status] || 'upcoming',
  }
}
function gameArtColor(gameName) {
  return GAME_BY_ID[normalizeGameId(gameName)]?.color || '#00E676'
}
function gameArt(gameName) {
  const game = GAME_BY_ID[normalizeGameId(gameName)]
  return game?.images?.horizontal || game?.poster || game?.image || null
}

// Comunidades de ejemplo: solo se usan si /communities no responde o aun no
// hay comunidades reales que mostrar (base nueva sin data) -- mismo patron
// que LANDING_LIVE_TOURNAMENT/LANDING_UPCOMING_TOURNAMENTS de arriba. Usa el
// catalogo real de juegos (nombre/imagen/color reales); fallbackActive queda
// en '-' en vez de inventar un numero de actividad.
const FALLBACK_COMMUNITY_ROWS = GAMES.slice(0, 4).map(game => ({
  id: game.id,
  slug: null,
  name: game.name,
  image: game.images?.horizontal || game.poster || game.image,
  color: game.color,
  fallback: true,
  fallbackActive: '—',
}))

const LANDING_NEWS_COPY = {
  1: {
    excerpt: 'La nueva temporada abre con más torneos, mejor trazabilidad para organizadores y un frente editorial dedicado a historias, resultados y análisis del ecosistema competitivo.',
  },
  2: {
    title: 'IESF acelera clasificatorias y amplía su presencia regional con un calendario más sólido',
  },
  3: {
    title: 'LCK vuelve a subir el listón del macro competitivo con series más limpias y lectura de mapa',
  },
}

function landingNews(article) {
  return { ...article, ...LANDING_NEWS_COPY[article.id] }
}

function normalizeLandingNews(article) {
  return {
    id: article._id || article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    image: article.cover || article.image || '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    tag: article.category || article.tag || 'general',
    date: article.date || (article.createdAt ? new Date(article.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''),
    color: article.color || '#00E676',
    featured: article.featured,
  }
}

function Sec({ eyebrow, title, sub, children, id, alt }) {
  return (
    <section className={`lsec ${alt ? 'lsec--alt' : ''}`} id={id}>
      <div className="lsec__inner">
        <motion.div className="lsec__head" variants={stagger(0.12)} initial="hidden" whileInView="show" viewport={VP}>
          {eyebrow && <motion.div className="l-eyebrow" variants={fadeUp}>{eyebrow}</motion.div>}
          <motion.h2 className="l-h2" variants={fadeUp}>{title}</motion.h2>
          {sub && <motion.p className="l-lead" variants={fadeUp}>{sub}</motion.p>}
        </motion.div>
        {children}
      </div>
    </section>
  )
}

function Hero({ started }) {
  const navigate = useNavigate()
  const { lang } = useLang()
  const isEs = lang === 'es'
  const ease = [0.16, 1, 0.3, 1]
  const fd = (d, y = 28) => ({
    initial: { opacity: 0, y },
    animate: started ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.7, delay: d, ease },
  })

  const stats = isEs
    ? [['DEMO', 'plataforma'], ['8', 'torneos de muestra'], ['ST', 'Steliant']]
    : [['DEMO', 'platform'], ['8', 'sample tournaments'], ['ST', 'Steliant']]

  return (
    <section className="lhero">
      <HeroSlider slides={HERO_SLIDES} />

      <div className="lhero__inner">
        <div className="lhero__text">
          <motion.div className="lhero__pill" {...fd(0.05, 14)}>
            <span className="lhero__dot" />
            {isEs ? 'Inscripciones abiertas | compite hoy' : 'Registrations open | compete today'}
          </motion.div>

          <motion.div className="lhero__signal" {...fd(0.1, 14)} aria-hidden="true">
            <span>STELIANT ESPORTS</span>
            <i />
            <span>{isEs ? 'temporada 01' : 'season 01'}</span>
          </motion.div>

          <motion.h1 className="lhero__h1" {...fd(0.14)}>
            {isEs
              ? <>Compite, sube ranking<br />y encuentra tu <span className="lhero__accent lhero__elite">squad</span></>
              : <>Compete, climb ranks<br />and find your <span className="lhero__accent lhero__elite">squad</span></>}
          </motion.h1>

          <motion.p className="lhero__sub" {...fd(0.24)}>
            {isEs
              ? 'Torneos con prize pool, rankings por region y comunidades por juego para gamers competitivos de LATAM.'
              : 'Tournaments with prize pools, regional rankings, and game communities for competitive LATAM players.'}
          </motion.p>

          <motion.div className="lhero__ctas" {...fd(0.34)}>
            <Button variant="primary" size="lg" onClick={() => navigate('/register')}>
              {isEs ? 'Únete gratis' : 'Join free'}
            </Button>
{!isBetaHidden('/tv') && (
            <Button variant="ghost" size="lg" onClick={() => navigate('/tv')}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/>
              </svg>
              {isEs ? 'Ver transmisiones' : 'Watch live'}
            </Button>
)}
          </motion.div>

          <motion.div className="lhero__stats" {...fd(0.44, 16)}>
            {stats.map(([n, l]) => (
              <div className="lhero__stat" key={l}>
                <b>{n}</b><span>{l}</span>
              </div>
            ))}
          </motion.div>

          <motion.div className="lhero__ticker" {...fd(0.52, 12)} aria-hidden="true">
            <span>{isEs ? 'Matchmaking por habilidad' : 'Skill matchmaking'}</span>
            <span>{isEs ? 'Brackets automaticos' : 'Automatic brackets'}</span>
            <span>{isEs ? 'Comunidades por juego' : 'Game communities'}</span>
          </motion.div>
        </div>

        <motion.div
          className="lhero__deck"
          initial={{ opacity: 0 }}
          animate={started ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <GameDeck games={GAMES.slice(0, 5)} />
        </motion.div>
      </div>

      <motion.div className="lhero__scroll" initial={{ opacity: 0 }} animate={started ? { opacity: 1 } : {}} transition={{ delay: 1.5 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 5v14M5 12l7 7 7-7"/>
        </svg>
        <span>{isEs ? 'Desliza' : 'Scroll'}</span>
      </motion.div>
    </section>
  )
}

function TournamentsSection() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const isEs = lang === 'es'
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    api('/tournaments?limit=6')
      .then(({ tournaments: items = [] }) => {
        if (!alive) return
        if (!items.length) return
        const list = items.map(item => normalizeLandingTournament(item, isEs))
        const live = list.find(t => t.status === 'live') || list[0]
        const upcoming = list.filter(t => t.id !== live.id && t.status !== 'finished').slice(0, 2)
        setData({ live, upcoming })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [isEs])

  // Solo torneos reales. Antes, sin torneos se mostraban los de ejemplo
  // ("GG Spring Split · EN VIVO · $5,000") que llevaban a /torneos/1 (404).
  const live = data?.live || null
  const upcoming = data?.upcoming || []
  const progress = live?.slots ? Math.round((live.filled / live.slots) * 100) : 0

  return (
    <Sec
      eyebrow={lang === 'es' ? 'Competencia' : 'Competition'}
      title={lang === 'es' ? <>Torneos que <GlitchText>importan</GlitchText></> : <>Tournaments that <GlitchText>matter</GlitchText></>}
      sub={lang === 'es' ? 'Prize pools reales, brackets automaticos y streaming en vivo integrado.' : 'Real prize pools, automatic brackets, and integrated live streaming.'}
      alt
      id="torneos"
    >
      {!live ? (
        <motion.div className="ltour__layout" variants={fadeUp} initial="hidden" whileInView="show" viewport={VP}>
          <div className="ltour__card" style={{ gridColumn: '1 / -1', cursor: 'default' }}>
            <div className="ltour__card-body">
              <b>{lang === 'es' ? 'Los próximos torneos se anuncian aquí' : 'Upcoming tournaments will be announced here'}</b>
              <span>{lang === 'es' ? 'Todavía no hay torneos publicados.' : 'No tournaments have been published yet.'}</span>
            </div>
            <div className="ltour__card-right">
              <button className="l-link-btn" onClick={() => navigate('/torneos')}>
                {lang === 'es' ? 'Ver torneos ->' : 'View tournaments ->'}
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
      <div className="ltour__layout">
        <motion.div variants={slideL} initial="hidden" whileInView="show" viewport={VP}>
          <div className="ltour__featured" style={{ '--tc': live.color, '--tour-img': `url(${tournamentArt(live)})` }} onClick={() => navigate(`/torneos/${live.id}`)}>
            <div className="ltour__feat-media" />
            <div className="ltour__feat-content">
              <div className="ltour__feat-top">
                <TStatus status={live.status} />
                <span>{live.gameCode || live.game}</span>
              </div>
              <h3>{live.name}</h3>
              <p className="ltour__game-label">{live.platform} - {live.format?.replace('_', ' ')}</p>
              <div className="ltour__meta-row">
                <div className="ltour__prize"><b>{live.prize}</b><span>prize pool</span></div>
                <div className="ltour__slots-pill">{live.filled}/{live.slots} {lang === 'es' ? 'equipos' : 'teams'}</div>
              </div>
              <div className="ltour__progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
              <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/torneos/${live.id}`) }}>
                {lang === 'es' ? 'Ver bracket ->' : 'View bracket ->'}
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div className="ltour__stack" variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={VP}>
          {upcoming.map(t => (
            <motion.div key={t.id} variants={slideR}>
              <div className="ltour__card" style={{ '--tc': t.color, '--tour-img': `url(${tournamentArt(t)})` }} onClick={() => navigate(`/torneos/${t.id}`)}>
                <div className="ltour__card-accent" />
                <div className="ltour__card-thumb" />
                <div className="ltour__card-body">
                  <TStatus status={t.status} />
                  <b>{t.name}</b>
                  <span>{t.gameCode || t.game} - {t.date}</span>
                </div>
                <div className="ltour__card-right">
                  <b>{t.prize}</b>
                  <span>{t.filled}/{t.slots}</span>
                </div>
              </div>
            </motion.div>
          ))}
          <motion.div variants={fadeUp}>
            <button className="l-link-btn l-link-btn--full" onClick={() => navigate('/torneos')}>
              {lang === 'es' ? 'Ver todos los torneos ->' : 'View all tournaments ->'}
            </button>
          </motion.div>
        </motion.div>
      </div>
      )}
    </Sec>
  )
}

function NewsSection() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const [liveNews, setLiveNews] = useState([])

  useEffect(() => {
    api('/news?status=publicado&limit=4')
      .then(({ news = [] }) => setLiveNews(news.map(normalizeLandingNews)))
      .catch(() => setLiveNews([]))
  }, [])

  const fallbackNews = [landingNews(FEATURED_NEWS), ...NEWS.slice(0, 3).map(landingNews)]
  const shownNews = liveNews.length ? liveNews : fallbackNews
  const featured = shownNews.find(item => item.featured) || shownNews[0]
  const secondary = shownNews.filter(item => item.id !== featured?.id).slice(0, 3)

  return (
    <Sec
      eyebrow={lang === 'es' ? 'Noticias' : 'News'}
      title={lang === 'es' ? 'Lo último del competitivo' : 'Latest from the competitive scene'}
      sub={lang === 'es' ? 'Parches, resultados, guías y análisis del meta global.' : 'Patches, results, guides, and global meta analysis.'}
      alt
      id="noticias"
    >
      <div className="lnews__layout">
        <motion.article className="lnews__featured" style={{ '--nc': featured.color }} onClick={() => navigate(featured.slug ? `/noticias/${featured.slug}` : '/noticias')} variants={slideL} initial="hidden" whileInView="show" viewport={VP}>
          <img src={featured.image} alt={featured.title} className="lnews__featured-img" />
          <div className="lnews__feat-overlay" />
          <div className="lnews__feat-body">
            <Badge variant="accent">{featured.tag}</Badge>
            <h3>{featured.title}</h3>
            <p>{featured.excerpt}</p>
            <span className="lnews__date">{featured.date}</span>
          </div>
        </motion.article>

        <motion.div className="lnews__stack" variants={stagger(0.09)} initial="hidden" whileInView="show" viewport={VP}>
          {secondary.map((n, i) => (
            <motion.article key={n.id} className="lnews__card" style={{ '--nc': n.color }} onClick={() => navigate(n.slug ? `/noticias/${n.slug}` : '/noticias')} variants={slideR}>
              <div className="lnews__card-img-wrap">
                <img src={n.image} alt={n.title} className="lnews__card-img" />
                <div className="lnews__card-img-overlay" />
              </div>
              <div className="lnews__card-body">
                <Badge variant="muted">{n.tag}</Badge>
                <b>{n.title}</b>
                <span>{n.date}</span>
              </div>
            </motion.article>
          ))}
          <motion.div variants={fadeUp}>
            <button className="l-link-btn l-link-btn--full" onClick={() => navigate('/noticias')}>
              {lang === 'es' ? 'Leer más noticias ->' : 'Read more news ->'}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </Sec>
  )
}

function CTASection() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const stats = lang === 'es'
    ? [['120K+', 'jugadores'], ['$50K', 'en premios S01'], ['32', 'países'], ['99.9%', 'uptime']]
    : [['120K+', 'players'], ['$50K', 'in S01 prizes'], ['32', 'countries'], ['99.9%', 'uptime']]

  return (
    <section className="lcta" id="join">
      <div className="lcta__bg-img" style={{ backgroundImage: 'url(/demos/steliant-esports/ImaHorizontal/Valo.jpg)' }} />
      <div className="lcta__glow" />
      <div className="lcta__lines" />
      <motion.div className="lcta__inner" variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
        <motion.div className="lcta__badge" variants={fadeUp}>
          <span className="lhero__dot" />{lang === 'es' ? 'Sin costo | Sin tarjeta requerida' : 'No cost | No card required'}
        </motion.div>
        <motion.h2 className="lcta__h2" variants={fadeUp}>
          {lang === 'es'
            ? <>Listo para competir<br />en <span className="lhero__accent"><GlitchText>serio</GlitchText></span>?</>
            : <>Ready to compete<br />for <span className="lhero__accent"><GlitchText>real</GlitchText></span>?</>}
        </motion.h2>
        <motion.p className="lcta__sub" variants={fadeUp}>
          {lang === 'es'
            ? <>Únete a <b>120K+ jugadores</b> de LATAM y el mundo.<br />Tu primera temporada competitiva empieza ahora.</>
            : <>Join <b>120K+ players</b> from LATAM and around the world.<br />Your first competitive season starts now.</>}
        </motion.p>
        <motion.div className="lcta__btns" variants={fadeUp}>
          <Button variant="primary" size="lg" onClick={() => navigate('/register')}>{lang === 'es' ? 'Crear cuenta gratis' : 'Create free account'}</Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/login')}>{lang === 'es' ? 'Ya tengo cuenta' : 'I already have an account'}</Button>
        </motion.div>
        <motion.div className="lcta__stats" variants={stagger(0.06)}>
          {stats.map(([n, l]) => (
            <motion.div key={l} className="lcta__stat" variants={scaleUp}>
              <b>{n}</b><span>{l}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}

function TStatus({ status }) {
  const { lang } = useLang()
  const map = lang === 'es'
    ? { live: ['live', 'En vivo'], upcoming: ['upcoming', 'Próximo'], finished: ['done', 'Finalizado'] }
    : { live: ['live', 'Live'], upcoming: ['upcoming', 'Upcoming'], finished: ['done', 'Finished'] }
  const [cls, txt] = map[status] || map.upcoming
  return <span className={`ltour__status ltour__status--${cls}`}>{txt}</span>
}

export default function Landing({ started }) {
  const { lang } = useLang()

  return (
    <>
      <div className="bg-fx" aria-hidden="true">
        <div className="bg-glow" />
        <div className="bg-grid" />
        <div className="bg-scan" />
      </div>
      <Navbar visible={started} />
      <main className="land">
        <div className="land__announce">
          <span className="land__announce-dot" />
          {lang === 'es' ? 'Inscripciones abiertas para Season 01 -' : 'Season 01 registrations are open -'}
          <a href="/torneos">{lang === 'es' ? ' ver torneos ->' : ' view tournaments ->'}</a>
        </div>
        <Hero started={started} />
        <TournamentsSection />
        <NewsSection />
        <CTASection />
        <Footer />
      </main>
      <ThemeSwitcher />
    </>
  )
}


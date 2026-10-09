import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useLang } from '../i18n/LangContext.jsx'
import Logo from '../components/Logo/Logo.jsx'
import './AuthLayout.css'

const authMedia = {
  video: '',
  poster: '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
  tiles: [
    { src: '/demos/steliant-esports/ImaVertical/valorant.jpg', label: 'Valorant' },
    { src: '/demos/steliant-esports/ImaVertical/Apex.jpg', label: 'Apex Legends' },
    { src: '/demos/steliant-esports/ImaVertical/Tekken8.jpg', label: 'Tekken 8' },
  ],
}

// La animacion mueve la tira -50% de su propio ancho (loop sin costuras),
// asi que las dos mitades deben ser identicas. Repetimos el set varias veces
// dentro de cada mitad para que la tira sea mas ancha que cualquier pantalla
// real: si no, en monitores anchos el texto se acababa antes del loop y se
// veia un tramo vacio de la barra.
const TICKER_WORDS = ['STELIANT ESPORTS ACCESS', 'PLAYER ID', 'RANKED READY', 'SECURE LOBBY']
const TICKER_REPEAT = 6
const TICKER_HALF = Array.from({ length: TICKER_REPEAT }).flatMap(() => TICKER_WORDS)
const TICKER_ITEMS = [...TICKER_HALF, ...TICKER_HALF]

export default function AuthLayout({ children, title, sub }) {
  const { t } = useLang()
  const features = [t.auth.feature1, t.auth.feature2, t.auth.feature3]

  return (
    <div className="gg-auth">
      <div className="gg-auth__ticker" aria-hidden="true">
        <div className="gg-auth__ticker-in">
          {TICKER_ITEMS.map((word, i) => (
            word === TICKER_WORDS[0]
              ? <b key={i}>{word}</b>
              : <span key={i}>{word}</span>
          ))}
        </div>
      </div>
      <div className="gg-auth__arcade-fx" aria-hidden="true">
        <span />
        <span />
        <i />
      </div>
      <div className="gg-auth__bg" aria-hidden="true">
        <video
          className="gg-auth__video"
          poster={authMedia.poster}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        >
          <source src={authMedia.video} type="video/mp4" />
        </video>
        <div className="gg-auth__media-overlay" />
      </div>

      <div className="gg-auth__brand">
        <div className="gg-auth__brand-inner">
          <Link to="/" className="gg-auth__logo">
            <Logo size={46} withText />
          </Link>

          <motion.div
            className="gg-auth__pitch"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <span className="gg-auth__eyebrow">GlitchGang Access</span>
            <h2>{t.auth.brandPitch}</h2>
            <ul>
              {features.map((feature) => (
                <li key={feature}><span>{feature}</span></li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="gg-auth__showcase"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22 }}
          >
            <div className="gg-auth__live-card">
              <span>Lobby activo</span>
              <b>Ranked noche</b>
              <small>Squads, torneos y comunidad en una sola cuenta.</small>
            </div>
            <div className="gg-auth__tiles">
              {authMedia.tiles.map((tile) => (
                <figure key={tile.label} className="gg-auth__tile">
                  <img src={tile.src} alt="" loading="lazy" />
                  <figcaption>{tile.label}</figcaption>
                </figure>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="gg-auth__stats"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <div className="gg-auth__stat"><b>120K+</b><span>Jugadores</span></div>
            <div className="gg-auth__stat"><b>4.8K</b><span>Torneos</span></div>
            <div className="gg-auth__stat"><b>32</b><span>Paises</span></div>
          </motion.div>

          <div className="gg-auth__by">por <b>Steliant</b></div>
        </div>
      </div>

      <div className="gg-auth__form-panel">
        <motion.div
          className="gg-auth__form-box"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/" className="gg-auth__mobile-header">
            <Logo size={40} withText />
          </Link>

          <div className="gg-auth__form-head">
            <h1>{title}</h1>
            {sub && <p>{sub}</p>}
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  )
}


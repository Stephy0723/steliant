import { motion } from 'framer-motion'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { GAMES } from '../../data/games.js'
import './Games.css'

export default function Games() {
  const { t } = useLang()
  const p = t.pages

  return (
    <div className="gg-page">
      <PageHeader title={t.side.juegos} sub="Elige tu arena competitiva." />
      <div className="gg-games-grid">
        {GAMES.map((g, i) => (
          <motion.div className="gg-game-card" key={g.id}
            style={{ '--game-color': g.color, '--game-bg': g.colorB }}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className="gg-game-card__top">
              {g.image
                ? <img src={g.image} alt={g.name} className="gg-game-card__cover" loading="lazy" />
                : <div className="gg-game-card__cover" />}
              <div className="gg-game-card__genre">{g.genre}</div>
            </div>
            <div className="gg-game-card__body">
              <h3>{g.name}</h3>
              <div className="gg-game-card__stats">
                <span><b>{g.players}</b> {p.players}</span>
                <span className="live-dot"><b>{g.active}</b> {p.playing}</span>
              </div>
              <button className="gg-btn gg-btn--primary gg-btn--sm">{p.playNow}</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}


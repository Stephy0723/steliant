import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useLang } from '../../../i18n/LangContext.jsx'
import { api } from '../../../lib/api.js'
import { GAME_STATS as GAME_COLORS } from '../../../data/playerStats.js'
import './PlayerPerformance.css'

const TR = {
  es: {
    title: 'Mi Rendimiento', sub: 'Estadisticas detalladas por juego, personajes y mapas',
    winrate: 'Win rate', matches: 'Partidas', wins: 'Victorias', losses: 'Derrotas',
    kda: 'KDA', hours: 'Jugadas', peak: 'Peak rank', main: 'Main',
    topPicks: 'Personajes mas usados', skills: 'Perfil de habilidades', byMap: 'Rendimiento por mapa',
    games: 'partidas', empty: 'Agrega juegos en tu perfil para generar esta vista.',
    noPicks: 'Aún no hay partidas con personaje registradas.', noMaps: 'Aún no hay partidas con mapa registradas en este juego.',
    noSkills: 'Todavía no medimos habilidades por jugador. Aparecerá cuando tengamos datos reales de tus partidas.',
    loading: 'Cargando tu rendimiento...', error: 'No se pudo cargar tu rendimiento. Intenta de nuevo mas tarde.',
  },
  en: {
    title: 'My Performance', sub: 'Detailed stats by game, agents and maps',
    winrate: 'Win rate', matches: 'Matches', wins: 'Wins', losses: 'Losses',
    kda: 'KDA', hours: 'Played', peak: 'Peak rank', main: 'Main',
    topPicks: 'Most played characters', skills: 'Skill profile', byMap: 'Performance by map',
    games: 'matches', empty: 'Add games to your profile to generate this view.',
    noPicks: 'No matches with a character recorded yet.', noMaps: 'No matches with a map recorded for this game yet.',
    noSkills: 'We do not measure player skills yet. This will appear once we have real match data.',
    loading: 'Loading your performance...', error: 'Could not load your performance. Please try again later.',
  },
}

function normalize(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Solo datos reales: los numeros salen de /players/me/stats/games. De la
// tabla de playerStats.js solo se toma el color de cada juego. Antes, sin
// partidas, se rellenaban winrate/KDA/rango con datos de ejemplo.
const colorFor = game => GAME_COLORS.find(row => normalize(row.game) === normalize(game))?.color || 'var(--accent)'

function buildGameStats(user, apiStats = []) {
  const rank = user?.gamerProfile?.rank || '-'
  const mainPick = user?.gamerProfile?.mainCharacters?.[0] || '-'
  if (apiStats.length) {
    return apiStats.map(item => ({
      ...item,
      color: colorFor(item.game),
      rank: item.rank || rank,
      peak: item.peak || rank,
      mainPick: item.mainPick || mainPick,
    }))
  }

  // Juegos del perfil sin partidas registradas: todo en cero.
  const games = user?.games?.length ? user.games : [user?.gamerProfile?.mainGame].filter(Boolean)
  return [...new Set(games.filter(Boolean))].map(game => ({
    game, color: colorFor(game), rank, peak: rank, mainPick,
    winrate: 0, matches: 0, wins: 0, losses: 0, kda: 0, hours: 0,
  }))
}

export default function PlayerPerformance() {
  const { lang } = useLang()
  const { user } = useAuth()
  const L = TR[lang] || TR.es
  const [apiStats, setApiStats] = useState([])
  const [apiCharacters, setApiCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const gameStats = useMemo(() => buildGameStats(user, apiStats), [user, apiStats])
  const [game, setGame] = useState('')
  const active = gameStats.find(item => item.game === (game || gameStats[0]?.game)) || gameStats[0]
  const [mapStats, setMapStats] = useState([])

  // Rendimiento por mapa del juego elegido (PlayerMatch.map).
  useEffect(() => {
    if (!active?.game || !active.matches) { setMapStats([]); return undefined }
    let alive = true
    api(`/players/me/stats/maps?game=${encodeURIComponent(active.game)}`)
      .then(res => { if (alive) setMapStats(Array.isArray(res?.maps) ? res.maps : []) })
      .catch(() => { if (alive) setMapStats([]) })
    return () => { alive = false }
  }, [active?.game, active?.matches])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    Promise.allSettled([
      api('/players/me/stats/games'),
      api('/players/me/characters/top'),
    ]).then(([statsRes, charsRes]) => {
      if (!alive) return
      setApiStats(statsRes.status === 'fulfilled' ? statsRes.value?.stats || [] : [])
      setApiCharacters(charsRes.status === 'fulfilled' ? charsRes.value?.characters || [] : [])
      if (statsRes.status === 'rejected' && charsRes.status === 'rejected') {
        setError(L.error)
      }
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [L.error])

  // Sin partidas con personaje no se inventan winrates: lista vacia.
  const picks = apiCharacters

  return (
    <div className="pp-page">
      <div className="pp-page__header">
        <div>
          <h1>{L.title}</h1>
          <p>{L.sub}</p>
        </div>
      </div>

      {loading ? (
        <div className="pp-card pp-perf-state"><GGLoader label={L.loading} size="sm" /></div>
      ) : error ? (
        <div className="pp-card pp-perf-state pp-perf-state--error">{Icon.alert}<p>{error}</p></div>
      ) : gameStats.length === 0 ? (
        <div className="pp-card pp-hist-empty">{Icon.gamepad} {L.empty}</div>
      ) : (
        <>
          <motion.div className="pp-perf-games" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {gameStats.map(g => (
              <button
                key={g.game}
                className={`pp-perf-game ${(game || gameStats[0]?.game) === g.game ? 'active' : ''}`}
                style={(game || gameStats[0]?.game) === g.game ? { borderColor: g.color, boxShadow: `0 0 16px ${g.color}33` } : undefined}
                onClick={() => setGame(g.game)}
              >
                <span className="pp-perf-game__dot" style={{ background: g.color }} />
                <div>
                  <b>{g.game}</b>
                  <small>{g.rank}</small>
                </div>
                <span className="pp-perf-game__wr">{g.winrate}%</span>
              </button>
            ))}
          </motion.div>

          <motion.div key={active.game} className="pp-perf-stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="pp-perf-stat"><b>{active.winrate}%</b><span>{L.winrate}</span></div>
            <div className="pp-perf-stat"><b>{active.matches}</b><span>{L.matches}</span></div>
            <div className="pp-perf-stat pp-perf-stat--green"><b>{active.wins}</b><span>{L.wins}</span></div>
            <div className="pp-perf-stat pp-perf-stat--red"><b>{active.losses}</b><span>{L.losses}</span></div>
            <div className="pp-perf-stat"><b>{active.kda ?? '—'}</b><span>{L.kda}</span></div>
            <div className="pp-perf-stat"><b>{active.hours == null ? '—' : `${active.hours}h`}</b><span>{L.hours}</span></div>
            <div className="pp-perf-stat"><b>{active.peak}</b><span>{L.peak}</span></div>
            <div className="pp-perf-stat"><b>{active.mainPick}</b><span>{L.main}</span></div>
          </motion.div>

          <div className="pp-grid-2">
            <div className="pp-card">
              <div className="pp-card__title">{Icon.star} {L.topPicks}</div>
              <div className="pp-picks">
                {!picks.length && <p className="pp-perf-empty">{L.noPicks}</p>}
                {picks.map(pk => (
                  <div key={pk.name} className="pp-pick">
                    <div className="pp-pick__top">
                      <b>{pk.name}</b>
                      <span className="pp-pick__role">{pk.role}</span>
                      <span className="pp-pick__wr">{pk.winrate}%</span>
                    </div>
                    <div className="pp-bar"><div className="pp-bar__fill" style={{ width: `${pk.winrate}%` }} /></div>
                    <div className="pp-pick__meta">{pk.matches} {L.games} · {pk.kda ?? '—'} KDA</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pp-card pp-card--center">
              <div className="pp-card__title">{Icon.target} {L.skills}</div>
              <p className="pp-perf-empty">{L.noSkills}</p>
            </div>
          </div>

          <div className="pp-card">
            <div className="pp-card__title">{Icon.layoutGrid} {L.byMap}</div>
            <div className="pp-maps">
              {!mapStats.length && <p className="pp-perf-empty">{L.noMaps}</p>}
              {mapStats.map(m => (
                <div key={m.map} className="pp-map">
                  <div className="pp-map__head">
                    <b>{m.map}</b>
                    <span className={m.winrate >= 60 ? 'good' : m.winrate >= 50 ? 'mid' : 'bad'}>{m.winrate}%</span>
                  </div>
                  <div className="pp-bar">
                    <div className="pp-bar__fill" style={{
                      width: `${m.winrate}%`,
                      background: m.winrate >= 60 ? '#22c55e' : m.winrate >= 50 ? 'var(--pp-color)' : '#ef4444',
                    }} />
                  </div>
                  <small>{m.matches} {L.games}</small>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}


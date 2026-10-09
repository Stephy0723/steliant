import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useLang } from '../../../i18n/LangContext.jsx'
import { api } from '../../../lib/api.js'
import { GAMES } from '../../../data/games.js'
import './PlayerHistory.css'
import { STAT_FIELDS } from '../../../../../shared/matchStats.mjs'

const GAME_NAME = Object.fromEntries(GAMES.map(g => [g.id, g.name]))

const TR = {
  es: {
    title: 'Historial', sub: 'Tus partidas recientes y resultados en torneos',
    matches: 'Partidas', won: 'Ganadas', winrate: 'Win rate',
    allG: 'Todos', allR: 'Todas', wins: 'Victorias', losses: 'Derrotas',
    hResult: 'Resultado', hMatch: 'Partida', hTeam: 'Equipo', hKda: 'KDA', hRating: 'Rating', hRp: 'RP', hDate: 'Fecha',
    win: 'Victoria', loss: 'Derrota', empty: 'Sin partidas registradas todavia',
    tournResults: 'Resultados en torneos', of: 'de',
    teamsTitle: 'Trayectoria de equipos', current: 'Actual', former: 'Anterior', left: 'Salió',
    emptyMatches: 'Aún no tienes partidas registradas. Aparecerán cuando se confirmen tus partidas de torneo.',
    emptyTourns: 'Aún no tienes resultados de torneos.',
    emptyTeams: 'Aún no has estado en ningún equipo.',
    loading: 'Cargando tu historial…',
  },
  en: {
    title: 'History', sub: 'Your recent matches and tournament results',
    matches: 'Matches', won: 'Won', winrate: 'Win rate',
    allG: 'All', allR: 'All', wins: 'Wins', losses: 'Losses',
    hResult: 'Result', hMatch: 'Match', hTeam: 'Team', hKda: 'KDA', hRating: 'Rating', hRp: 'RP', hDate: 'Date',
    win: 'Win', loss: 'Loss', empty: 'No matches recorded yet',
    tournResults: 'Tournament results', of: 'of',
    teamsTitle: 'Team history', current: 'Current', former: 'Former', left: 'Left',
    emptyMatches: 'You have no recorded matches yet. They appear once your tournament matches are confirmed.',
    emptyTourns: 'You have no tournament results yet.',
    emptyTeams: 'You have not been on any team yet.',
    loading: 'Loading your history…',
  },
}

const PLACE_LABEL = { 1: '#1', 2: '#2', 3: '#3' }

export default function PlayerHistory() {
  const { lang } = useLang()
  const { user } = useAuth()
  const L = TR[lang] || TR.es
  const [game, setGame] = useState('all')
  const [result, setResult] = useState('all')
  const [apiMatches, setApiMatches] = useState([])
  const [apiTournaments, setApiTournaments] = useState([])
  const [currentTeams, setCurrentTeams] = useState([])
  const [formerTeams, setFormerTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api('/players/me/matches?limit=100'),
      api('/players/me/tournaments?limit=100'),
      api('/teams/mine'),
      api('/teams/mine/history'),
    ]).then(([matches, tournaments, teams, history]) => {
      if (!alive) return
      setApiMatches(matches.status === 'fulfilled' ? matches.value?.matches || [] : [])
      setApiTournaments(tournaments.status === 'fulfilled' ? tournaments.value?.results || [] : [])
      setCurrentTeams(teams.status === 'fulfilled' ? teams.value?.teams || [] : [])
      setFormerTeams(history.status === 'fulfilled' ? history.value?.teams || [] : [])
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const userMatches = apiMatches
  const userTournaments = apiTournaments
  const games = useMemo(() => ['all', ...new Set(userMatches.map(match => match.game).filter(Boolean))], [userMatches])
  const filtered = userMatches.filter(match => (
    (game === 'all' || match.game === game) &&
    (result === 'all' || match.result === result)
  ))
  const wins = filtered.filter(match => match.result === 'win').length
  const wr = filtered.length ? Math.round((wins / filtered.length) * 100) : 0
  const stats = useMemo(() => {
    const byGame = {}
    const teams = new Map()
    for (const match of userMatches) {
      if (match.game) byGame[match.game] = (byGame[match.game] || 0) + 1
      const key = match.team || 'Solo'
      const current = teams.get(key) || { name: key, tag: key.slice(0, 3).toUpperCase(), wins: 0, losses: 0 }
      if (match.result === 'win') current.wins += 1
      else if (match.result === 'loss') current.losses += 1
      teams.set(key, current)
    }
    const totalWins = userMatches.filter(match => match.result === 'win').length
    return {
      detailed: {
        winRate: userMatches.length ? Math.round((totalWins / userMatches.length) * 100) : 0,
        teams: Array.from(teams.values()).slice(0, 3),
        byGame,
      },
    }
  }, [userMatches])

  return (
    <div className="pp-page">
      <div className="pp-page__header">
        <div>
          <h1>{L.title}</h1>
          <p>{L.sub}</p>
        </div>
        <div className="pp-hist-summary">
          <div><b>{filtered.length}</b><span>{L.matches}</span></div>
          <div><b className="green">{wins}</b><span>{L.won}</span></div>
          <div><b style={{ color: 'var(--pp-color)' }}>{wr}%</b><span>{L.winrate}</span></div>
        </div>
      </div>

      {/* Estadísticas detalladas -- beneficio del plan Pro. El backend solo
          manda `stats.detailed` cuando el plan del usuario ya no es Free. */}
      {stats.detailed && (
        <div className="pp-hist-detailed">
          <div className="pp-hist-detailed__badge">{Icon.crown} {lang === 'en' ? 'Detailed stats' : 'Estadísticas detalladas'}</div>
          <div className="pp-hist-summary">
            <div><b>{stats.detailed.winRate}%</b><span>{lang === 'en' ? 'Win rate' : 'Tasa de victorias'}</span></div>
            {stats.detailed.teams.map(t => (
              <div key={t.name}><b>{t.wins}-{t.losses}</b><span>{t.tag} · {lang === 'en' ? 'W-L' : 'V-D'}</span></div>
            ))}
          </div>
          {Object.keys(stats.detailed.byGame).length > 0 && (
            <div className="pp-hist-detailed__games">
              {Object.entries(stats.detailed.byGame).map(([g, count]) => (
                <span key={g} className="pp-chip">{GAME_NAME[g] || g}: {count}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pp-hist-filters">
        <div className="pp-hist-filters__group">
          {games.map(item => (
            <button key={item} className={`pp-chip ${game === item ? 'active' : ''}`} onClick={() => setGame(item)}>
              {item === 'all' ? L.allG : item}
            </button>
          ))}
        </div>
        <div className="pp-hist-filters__group">
          {[{ k: 'all', l: L.allR }, { k: 'win', l: L.wins }, { k: 'loss', l: L.losses }].map(item => (
            <button key={item.k} className={`pp-chip ${result === item.k ? 'active' : ''}`} onClick={() => setResult(item.k)}>
              {item.l}
            </button>
          ))}
        </div>
      </div>

      <div className="pp-card pp-hist-table-card">
        <div className="pp-hist-table">
          <div className="pp-hist-row pp-hist-row--head">
            <span>{L.hResult}</span>
            <span>{L.hMatch}</span>
            <span className="hide-sm">{L.hTeam}</span>
            <span className="hide-sm">{L.hKda}</span>
            <span>{L.hRating}</span>
            <span>{L.hRp}</span>
            <span className="hide-sm">{L.hDate}</span>
          </div>
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              className="pp-hist-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
            >
              <span><span className={`pp-result pp-result--${m.result}`}>{m.result === 'win' ? L.win : L.loss}</span></span>
              <span className="pp-hist-match">
                <b>vs {m.vs}</b>
                <small>{m.game} · {m.mode} · {m.map}</small>
                {m.stats && <details><summary>Estadísticas · partida {m.gameNumber}</summary>
                  {Object.entries(STAT_FIELDS).map(([key, label]) => <small key={key} style={{ display: 'block' }}>{label}: {m.stats[key] ?? '—'}</small>)}
                  <small>MVP: {m.stats.mvp == null ? '—' : m.stats.mvp ? 'Sí' : 'No'}</small>
                </details>}
              </span>
              <span className="hide-sm pp-hist-team">{m.team}</span>
              <span className="hide-sm pp-hist-kda">{m.kda}</span>
              <span className={`pp-hist-rating ${Number(m.rating || 0) >= 1 ? 'good' : 'bad'}`}>{m.rating == null ? '—' : Number(m.rating).toFixed(2)}</span>
              <span className={`pp-hist-rp ${m.rp >= 0 ? 'up' : 'down'}`}>{m.rp >= 0 ? '+' : ''}{m.rp}</span>
              <span className="hide-sm pp-hist-date">{m.date}</span>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="pp-hist-empty">{Icon.search} {loading ? L.loading : L.emptyMatches}</div>
          )}
        </div>
      </div>

      <div className="pp-card">
        <div className="pp-card__title">{Icon.trophy} {L.tournResults}</div>
        <div className="pp-tourns">
          {userTournaments.length === 0 ? (
            <div className="pp-hist-empty">{Icon.trophy} {loading ? L.loading : L.emptyTourns}</div>
          ) : userTournaments.map(t => (
            <div key={t.id} className="pp-tourn">
              <span className={`pp-tourn__place ${t.placement <= 3 ? 'podium' : ''}`}>
                {PLACE_LABEL[t.placement] || `#${t.placement}`}
              </span>
              <div className="pp-tourn__info">
                <b>{t.name}</b>
                <small>{t.game} · {t.team} · {String(t.date || '').slice(0, 10)}</small>
              </div>
              <span className="pp-tourn__of">{L.of} {t.of}</span>
              <span className={`pp-tourn__prize ${t.prize > 0 ? '' : 'zero'}`}>
                {t.prize > 0 ? `$${t.prize.toLocaleString()}` : '-'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pp-card">
        <div className="pp-card__title">{Icon.team} {L.teamsTitle}</div>
        <div className="pp-tourns">
          {currentTeams.length + formerTeams.length === 0 ? (
            <div className="pp-hist-empty">{Icon.team} {loading ? L.loading : L.emptyTeams}</div>
          ) : (
            <>
              {currentTeams.map(team => (
                <div key={team._id || team.id} className="pp-tourn">
                  <span className="pp-tourn__place podium">{team.tag || String(team.name || '?').slice(0, 3).toUpperCase()}</span>
                  <div className="pp-tourn__info">
                    <b>{team.name}</b>
                    <small>{GAME_NAME[team.gameId] || team.game || '-'}</small>
                  </div>
                  <span className="pp-tourn__of">{L.current}</span>
                </div>
              ))}
              {formerTeams.map(team => (
                <div key={`${team.id}-${team.leftAt}`} className="pp-tourn">
                  <span className="pp-tourn__place">{team.tag || String(team.name || '?').slice(0, 3).toUpperCase()}</span>
                  <div className="pp-tourn__info">
                    <b>{team.name}</b>
                    <small>{GAME_NAME[team.gameId] || team.game || '-'}{team.role ? ` · ${team.role}` : ''}{team.leftAt ? ` · ${L.left} ${String(team.leftAt).slice(0, 10)}` : ''}</small>
                  </div>
                  <span className="pp-tourn__of">{L.former}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


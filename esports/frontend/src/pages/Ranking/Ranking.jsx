import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import GGLoader from '../../components/GGLoader/GGLoader.jsx'
import { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import './Ranking.css'

const TABS = [
  { id: 'rd',       label: 'Rep. Dom.',  sub: 'Top jugadores dominicanos' },
  { id: 'latam',    label: 'LATAM',      sub: 'Top jugadores latinoamericanos' },
  { id: 'world',    label: 'Global',     sub: 'Top jugadores del mundo' },
  { id: 'platform', label: 'GlitchGang', sub: 'Ranking de la plataforma' },
]

const GAME_COLORS = {
  'Valorant': '#ff4655',
  'League of Legends': '#c89b3c',
  'CS2': '#f0a500',
  'Fortnite': '#00d4ff',
  'Apex Legends': '#cd4229',
  'Rocket League': '#0082ca',
}

function RankIcon({ type, rank }) {
  if (type === 'medal') {
    return (
      <svg className={`gg-rank-icon gg-rank-icon--medal medal-${rank}`} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3h3l1 6-3 2-4-8h3Zm8 0h3l-4 8-3-2 1-6h3Z" />
        <circle cx="12" cy="15" r="5" />
        <path d="M12 12.5v5M10.5 14H12" />
      </svg>
    )
  }
  if (type === 'region') return <span className="gg-rank-icon-wrap">{Icon.globe}</span>
  if (type === 'platform') return <span className="gg-rank-icon-wrap platform">{Icon.bolt}</span>
  if (type === 'arrow') {
    return (
      <svg className="gg-rank-icon gg-rank-icon--arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14m-5-5 5 5-5 5" />
      </svg>
    )
  }
  return <span className="gg-rank-icon-wrap">{Icon.shield}</span>
}

function ChangeArrow({ change }) {
  if (change === 0) return <span className="gg-rank-change neutral">-</span>
  return (
    <span className={`gg-rank-change ${change > 0 ? 'up' : 'down'}`}>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d={change > 0 ? 'm6 2 4 5H2Z' : 'm6 10 4-5H2Z'} /></svg>
      {Math.abs(change)}
    </span>
  )
}

function RankRow({ item, idx, showExtra }) {
  const isTop3 = item.pos <= 3
  return (
    <motion.div
      className={`gg-rank-row ${item.isMe ? 'me' : ''} ${isTop3 ? `top${item.pos}` : ''}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <div className="gg-rank-row__pos">
        {item.pos <= 3
          ? <RankIcon type="medal" rank={item.pos} />
          : <span className="gg-pos-num">#{item.pos}</span>
        }
      </div>
      <div className="gg-rank-row__player">
        <div className="gg-rank-row__avatar">
          {item.nick.substring(0, 2).toUpperCase()}
        </div>
        <div className="gg-rank-row__info">
          <b>{item.nick} {item.isMe && <span className="gg-me-tag">TÚ</span>}</b>
          <span>{item.country} · {item.game || item.badge}</span>
        </div>
      </div>
      {item.rank && (
        <div className="gg-rank-row__rank" style={{ color: GAME_COLORS[item.game] || 'var(--accent)' }}>
          {item.rank}
        </div>
      )}
      <div className="gg-rank-row__pts">
        <b>{(item.pts).toLocaleString()}</b>
        <span>pts</span>
      </div>
      {showExtra && (
        <div className="gg-rank-row__extra">
          <span>{item.wins || item.torneos} {item.wins !== undefined ? 'wins' : 'torneos'}</span>
        </div>
      )}
      <ChangeArrow change={item.change ?? 0} />
    </motion.div>
  )
}

function PlatformRow({ item, idx }) {
  return (
    <motion.div
      className={`gg-rank-row gg-plat-row ${item.isMe ? 'me' : ''} ${item.pos <= 3 ? `top${item.pos}` : ''}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <div className="gg-rank-row__pos">
        {item.pos <= 3
          ? <RankIcon type="medal" rank={item.pos} />
          : <span className="gg-pos-num">#{item.pos}</span>
        }
      </div>
      <div className="gg-rank-row__player">
        <div className="gg-rank-row__avatar">{item.nick.substring(0, 2).toUpperCase()}</div>
        <div className="gg-rank-row__info">
          <b>{item.nick} {item.isMe && <span className="gg-me-tag">TÚ</span>}</b>
          <span>{item.country} · <span className={`gg-plat-badge badge-${item.badge?.toLowerCase()}`}>{item.badge}</span></span>
        </div>
      </div>
      <div className="gg-plat-stats">
        <div className="gg-plat-stat"><span>Torneos</span><b>{item.torneos}</b></div>
        <div className="gg-plat-stat"><span>Logros</span><b>{item.achievements}</b></div>
        <div className="gg-plat-stat"><span>Reputación</span><b>{item.rep.toLocaleString()}</b></div>
      </div>
      <div className="gg-rank-row__pts">
        <b>{item.pts.toLocaleString()}</b>
        <span>pts</span>
      </div>
    </motion.div>
  )
}

export default function Ranking() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('rd')
  const [search, setSearch] = useState('')
  const [rankingPlayers, setRankingPlayers] = useState([])
  const [rankingTeams, setRankingTeams] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      api('/rankings').catch(() => ({ ranking: [] })),
      api('/rankings/teams').catch(() => ({ ranking: [] })),
    ])
      .then(([players, teams]) => {
        const normalized = (players.ranking || []).map(r => ({
          pos: r.rank,
          nick: r.nick,
          country: r.countryCode || '—',
          game: r.games?.[0] || '—',
          pts: r.gp || 0,
          wins: 0,
          change: 0,
          isMe: r.isMe,
          rank: r.plan || '—',
          achievements: 0,
          torneos: 0,
          rep: r.gp || 0,
          badge: r.plan || 'Free',
        }))
        setRankingPlayers(normalized)
        setRankingTeams((teams.ranking || []).map(t => ({
          pos: t.rank,
          nick: t.name,
          country: '—',
          pts: t.pts || 0,
          wins: t.wins || 0,
          change: 0,
          isMe: t.mine,
          game: t.game || '—',
          rank: t.tag || '—',
        })))
      })
      .finally(() => setLoading(false))
  }, [user])

  const currentTab = TABS.find(t => t.id === activeTab)

  const getData = () => {
    if (!user) return []
    let data
    switch (activeTab) {
      case 'rd':       data = rankingPlayers.filter(r => r.country === 'DO'); break
      case 'latam':    data = rankingPlayers; break
      case 'world':    data = rankingPlayers; break
      case 'platform': data = rankingPlayers; break
      default:         data = rankingPlayers
    }
    if (search) return data.filter(r => r.nick.toLowerCase().includes(search.toLowerCase()))
    return data
  }

  const data = getData()
  const myEntry = data.find(r => r.isMe)
  const topData = data.filter(r => !r.isMe || r.pos <= 10).slice(0, 10)
  const showMyRow = myEntry && myEntry.pos > 10 && !search

  if (!user) {
    return (
      <div className="gg-page gg-ranking-page">
        <PageHeader title="Ranking" sub="Inicia sesión para ver el ranking global." />
        <div className="gg-rank-empty" style={{ padding: '80px 0', textAlign: 'center' }}>
          <p>Debes iniciar sesión para ver el ranking.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="gg-page gg-ranking-page">
        <PageHeader title="Ranking" sub={currentTab.sub} />
        <div className="gg-rank-empty" style={{ padding: '80px 0', textAlign: 'center' }}>
          <GGLoader label="Sincronizando ranking" size="sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="gg-page gg-ranking-page">
      <PageHeader title="Ranking" sub={currentTab.sub}>
        <div className="gg-ranking-search">
          <span className="gg-search-icon">{Icon.search}</span>
          <input
            placeholder="Buscar jugador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </PageHeader>

      {/* Priority banner */}
      <div className="gg-rank-priority">
        <div className="gg-rank-priority__item active" onClick={() => setActiveTab('rd')}>
          <RankIcon type="local" />
          <div>
            <b>Rep. Dominicana</b>
            <small>Prioridad local</small>
          </div>
        </div>
        <div className="gg-rank-priority__arrow"><RankIcon type="arrow" /></div>
        <div className="gg-rank-priority__item" onClick={() => setActiveTab('latam')}>
          <RankIcon type="region" />
          <div>
            <b>LATAM</b>
            <small>Regional</small>
          </div>
        </div>
        <div className="gg-rank-priority__arrow"><RankIcon type="arrow" /></div>
        <div className="gg-rank-priority__item" onClick={() => setActiveTab('world')}>
          <RankIcon type="region" />
          <div>
            <b>Mundial</b>
            <small>Global</small>
          </div>
        </div>
        <div className="gg-rank-priority__arrow"><RankIcon type="arrow" /></div>
        <div className="gg-rank-priority__item" onClick={() => setActiveTab('platform')}>
          <RankIcon type="platform" />
          <div>
            <b>Plataforma</b>
            <small><GlitchGangText>GlitchGang</GlitchGangText></small>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="gg-rank-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`gg-rank-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setSearch('') }}
          >
            <RankIcon type={tab.id === 'platform' ? 'platform' : tab.id === 'rd' ? 'local' : 'region'} />
            <GlitchGangText>{tab.label}</GlitchGangText>
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      {!search && activeTab !== 'platform' && (
        <div className="gg-podium">
          {data.slice(0, 3).map((item, i) => (
            <motion.div
              key={item.nick}
              className={`gg-podium-slot podium-${i + 1}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="gg-podium-avatar">{item.nick.substring(0, 2).toUpperCase()}</div>
              <div className="gg-podium-medal"><RankIcon type="medal" rank={i + 1} /></div>
              <b>{item.nick}</b>
              <span>{item.country}</span>
              <div className="gg-podium-pts">{item.pts.toLocaleString()} pts</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Main list */}
      <div className="gg-rank-list">
        <div className="gg-rank-list__header">
          <span>POS</span>
          <span>JUGADOR</span>
          {activeTab !== 'platform' && <span>RANGO</span>}
          <span>PTS</span>
          {activeTab !== 'platform' && <span>WINS</span>}
          <span>CAMBIO</span>
        </div>

        {activeTab === 'platform'
          ? data.map((item, i) => <PlatformRow key={item.pos} item={item} idx={i} />)
          : topData.map((item, i) => (
              <RankRow key={item.pos} item={item} idx={i} showExtra />
            ))
        }

        {/* My row separator if outside top 10 */}
        {showMyRow && activeTab !== 'platform' && (
          <>
            <div className="gg-rank-separator">
              <span>···</span>
            </div>
            <RankRow item={myEntry} idx={0} showExtra />
          </>
        )}

        {data.length === 0 && (
          <div className="gg-rank-empty">
            <p>No se encontraron jugadores con ese nombre.</p>
          </div>
        )}
      </div>
    </div>
  )
}


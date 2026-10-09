import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Tabs from '../../components/Tabs/Tabs.jsx'
import EmptyState from '../../components/EmptyState/EmptyState.jsx'
import GGTeamCard from '../../components/GGTeamCard/GGTeamCard.jsx'
import GGLoader from '../../components/GGLoader/GGLoader.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { GAMES, GAME_BY_ID, normalizeGameId } from '../../data/games.js'
import { api } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { flagUrl, teamGenderKey, teamGenderLabel } from '../../lib/teamEligibility.js'
import './UniversidadPerfil.css'

// Perfil público de una universidad: presentación, juegos, equipos y logros.
// Datos: /university/catalog/:id trae todo en una llamada -- catálogo,
// tarjetas de equipo con roster, stats del ranking, puesto (`rank`) y
// `achievements` (torneos universitarios terminados con su puesto, la misma
// fuente que los contadores de campeonatos/finales/semifinales).

const TABS = [
  { id: 'sobre',   label: 'Sobre' },
  { id: 'equipos', label: 'Equipos' },
  { id: 'juegos',  label: 'Juegos' },
  { id: 'logros',  label: 'Logros' },
]

const key = (value) => String(value || '').trim().toLowerCase()

// Los juegos llegan como id ("valorant", "mlbb") o como nombre ("Valorant").
function findGame(value) {
  const k = key(value)
  if (!k) return null
  const byId = normalizeGameId(k, '')
  if (byId) return GAME_BY_ID[byId]
  // Exacto primero; si no, nombre corto ("Mobile Legends", "Wild Rift").
  return GAMES.find(g => key(g.name) === k)
    || GAMES.find(g => key(g.name).startsWith(`${k}:`) || key(g.name).endsWith(`: ${k}`))
    || null
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function adaptTeam(t, uni, title) {
  const roster = (Array.isArray(t.roster) ? t.roster : []).map(row => ({
    nick: row.nick || 'Jugador',
    role: row.role || 'Jugador',
    avatar: row.avatar || '/demos/steliant-esports/avatar-default.svg',
  }))
  return {
    name: t.name,
    crest: t.logo || '',
    initials: String(t.tag || t.name || 'GG').slice(0, 2).toUpperCase(),
    code: t.publicCode || '',
    shortCode: t.tag || '',
    game: t.game,
    region: uni.tag,
    country: t.country || 'RD',
    flag: flagUrl(t.country || 'RD'),
    gender: t.gender ? { key: teamGenderKey(t.gender), label: teamGenderLabel(t.gender) } : null,
    founded: t.createdAt ? new Date(t.createdAt).getFullYear() : '',
    bio: t.slogan ? `"${t.slogan}"` : '',
    tags: [{ label: 'Universitario', on: true }, ...[t.rank].filter(l => l && key(l) !== 'universitario')],
    members: roster.map(row => row.avatar),
    capacity: Number(t.maxMembers) > 0 ? Number(t.maxMembers) : Math.max(5, Number(t.memberCount) || roster.length),
    roster,
    title: title ? { tournament: title.title, date: formatDate(title.date), placement: 1, ribbon: 'Campeón' } : null,
  }
}

function useUniversityProfile(uniId) {
  const [state, setState] = useState({ loading: true, error: '', uni: null })

  useEffect(() => {
    let alive = true
    setState(s => ({ ...s, loading: true, error: '' }))
    api(`/university/catalog/${encodeURIComponent(uniId)}`)
      .then(uni => { if (alive) setState({ loading: false, error: '', uni }) })
      .catch(err => {
        if (alive) setState(s => ({ ...s, loading: false, error: err?.status === 404 ? 'notfound' : (err?.message || 'error') }))
      })
    return () => { alive = false }
  }, [uniId])

  return state
}

export default function UniversidadPerfil() {
  const { uniId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('sobre')
  const { loading, error, uni } = useUniversityProfile(uniId)
  const rank = uni?.rank || null
  const total = uni?.rankTotal || 0

  // Torneos universitarios terminados (vienen ya ordenados por fecha).
  const achievements = useMemo(() => {
    const history = (uni?.achievements || []).map(row => ({
      ...row,
      id: row.publicId || row.tournamentId,
      title: row.title || 'Torneo',
      status: 'finished',
    }))
    return { titles: history.filter(row => row.placement === 1), history }
  }, [uni])

  // Juegos: los que la universidad declara en el catálogo + los de sus equipos.
  const games = useMemo(() => {
    if (!uni) return []
    const map = new Map()
    const add = (raw, fromTeam) => {
      const game = findGame(raw)
      const id = game?.id || key(raw)
      if (!id) return
      const entry = map.get(id) || { id, name: game?.name || raw, game, teams: 0, official: false }
      if (fromTeam) entry.teams += 1
      else entry.official = true
      map.set(id, entry)
    }
    ;(uni.games || []).forEach(g => add(g, false))
    ;(uni.teams || []).forEach(t => add(t.game, true))
    return Array.from(map.values()).sort((a, b) => b.teams - a.teams || a.name.localeCompare(b.name))
  }, [uni])

  if (loading) {
    return <div className="gg-page gg-uniprof"><GGLoader label="Cargando universidad" /></div>
  }

  if (error || !uni) {
    return (
      <div className="gg-page gg-uniprof">
        <EmptyState
          icon={Icon.award}
          title={error === 'notfound' ? 'Universidad no encontrada' : 'No se pudo cargar la universidad'}
          description={error === 'notfound' ? 'Puede que ya no forme parte del circuito universitario.' : 'Revisa tu conexión e inténtalo de nuevo.'}
        >
          <button type="button" className="gg-uniprof__btn gg-uniprof__btn--primary" onClick={() => navigate('/universidad')}>Ver universidades</button>
        </EmptyState>
      </div>
    )
  }

  const stats = uni.stats || {}
  const isMine = key(user?.university?.universityId) === key(uni.id) && user?.university?.verificationStatus === 'verified'
  const teams = uni.teams || []

  return (
    <div className="gg-page gg-uniprof" style={{ '--uc': uni.color || 'var(--accent)' }}>
      <Link to="/universidad" className="gg-uniprof__back">{Icon.chevronRight} Universidades</Link>

      {/* ── Hero ── */}
      <motion.header className="gg-uniprof__hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="gg-uniprof__banner" />
        <div className="gg-uniprof__id">
          <div className="gg-uniprof__logo" style={{ background: uni.color || '#333' }}>
            {uni.logo ? <img src={uni.logo} alt={uni.tag} /> : uni.tag}
          </div>
          <div className="gg-uniprof__title">
            <span className="gg-uniprof__eyebrow">Universidad // {uni.tag}</span>
            <h1 data-text={uni.name}>{uni.name}</h1>
            <p className="gg-uniprof__meta">
              {uni.city && <span>{Icon.mapPin}{uni.city}, Rep. Dom.</span>}
              {uni.founded && <span>Est. {uni.founded}</span>}
            </p>
            <div className="gg-uniprof__tags">
              {uni.verified && <span className="gg-uniprof__tag gg-uniprof__tag--on">{Icon.check} Verificada</span>}
              {isMine && <span className="gg-uniprof__tag gg-uniprof__tag--mine">Mi universidad</span>}
              {rank && <span className="gg-uniprof__tag">Ranking #{rank}/{total}</span>}
            </div>
          </div>
          <div className="gg-uniprof__cta">
            {!user && <button type="button" className="gg-uniprof__btn gg-uniprof__btn--primary" onClick={() => navigate('/login')}>Iniciar sesión</button>}
            {user && !isMine && user?.university?.verificationStatus !== 'verified' && (
              <button type="button" className="gg-uniprof__btn gg-uniprof__btn--primary" onClick={() => navigate('/universidad')}>¿Estudias aquí? Verifícate</button>
            )}
          </div>
        </div>

        <div className="gg-uniprof__stats">
          {[
            { label: 'Puntos', value: (uni.points || 0).toLocaleString('es-DO'), icon: Icon.star },
            { label: 'Estudiantes verificados', value: uni.verifiedStudentsCount || 0, icon: Icon.users },
            { label: 'Equipos', value: uni.activeTeamsCount || teams.length, icon: Icon.team },
            { label: 'Torneos jugados', value: stats.tournamentsPlayed || 0, icon: Icon.gamepad },
            { label: 'Títulos', value: stats.championships || 0, icon: Icon.trophy },
          ].map(s => (
            <div key={s.label} className="gg-uniprof__stat">
              <span className="gg-uniprof__stat-ic">{s.icon}</span>
              <b>{s.value}</b>
              <small>{s.label}</small>
            </div>
          ))}
        </div>
      </motion.header>

      <Tabs
        tabs={TABS.map(t => ({
          ...t,
          badge: t.id === 'equipos' ? teams.length || null : t.id === 'juegos' ? games.length || null : null,
        }))}
        value={tab}
        onChange={setTab}
      />

      {/* ── Sobre ── */}
      {tab === 'sobre' && (
        <div className="gg-uniprof__sobre">
          <section className="gg-uniprof__card gg-uniprof__bio">
            <h2 className="gg-uniprof__h">Sobre la universidad</h2>
            {uni.bio
              ? uni.bio.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)
              : <p className="gg-uniprof__muted">{uni.name} todavía no ha escrito su presentación.</p>}
          </section>

          <aside className="gg-uniprof__facts">
            <FactList title="Campus" icon={Icon.mapPin} items={uni.campuses} empty="Sin campus registrados" />
            <FactList title="Ofrece a sus gamers" icon={Icon.gem} items={uni.offers} empty="Sin beneficios publicados" />
            <FactList title="Carreras" icon={Icon.fileText} items={uni.programs} empty="Sin carreras registradas" collapse={8} />
          </aside>

          {teams.length > 0 && (
            <section className="gg-uniprof__preview">
              <div className="gg-uniprof__row-head">
                <h2 className="gg-uniprof__h">Equipos destacados</h2>
                <button type="button" onClick={() => setTab('equipos')}>Ver los {teams.length} {Icon.chevronRight}</button>
              </div>
              <TeamGrid teams={teams.slice(0, 3)} uni={uni} titles={achievements.titles} navigate={navigate} />
            </section>
          )}
        </div>
      )}

      {/* ── Equipos ── */}
      {tab === 'equipos' && (
        teams.length === 0
          ? <EmptyState icon={Icon.team} title="Sin equipos todavía" description={`${uni.name} aún no tiene equipos universitarios. Los estudiantes verificados pueden crear el primero desde Equipos.`}>
              {isMine && <button type="button" className="gg-uniprof__btn gg-uniprof__btn--primary" onClick={() => navigate('/equipos')}>Crear equipo</button>}
            </EmptyState>
          : <TeamGrid teams={teams} uni={uni} titles={achievements.titles} navigate={navigate} />
      )}

      {/* ── Juegos ── */}
      {tab === 'juegos' && (
        games.length === 0
          ? <EmptyState icon={Icon.gamepad} title="Sin juegos registrados" description="Cuando la universidad tenga equipos o declare sus juegos, aparecerán aquí." />
          : <div className="gg-uniprof__games">
              {games.map((g, i) => (
                <motion.div
                  key={g.id}
                  className="gg-uniprof__game"
                  style={{ '--gc': g.game?.color || 'var(--uc)' }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { if (g.teams) setTab('equipos') }}
                >
                  <div className="gg-uniprof__game-art">
                    {g.game?.image && <img src={g.game.image} alt="" loading="lazy" />}
                    {g.game?.images?.logo && <img className="gg-uniprof__game-logo" src={g.game.images.logo} alt="" loading="lazy" />}
                  </div>
                  <div className="gg-uniprof__game-body">
                    <b>{g.name}</b>
                    <span>{g.game?.category || 'Juego'}</span>
                    <div className="gg-uniprof__game-tags">
                      {g.teams > 0 && <em>{g.teams} {g.teams === 1 ? 'equipo' : 'equipos'}</em>}
                      {g.official && <em className="alt">Programa oficial</em>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
      )}

      {/* ── Logros ── */}
      {tab === 'logros' && (
        <div className="gg-uniprof__logros">
          <div className="gg-uniprof__medals">
            {[
              { label: 'Campeonatos', value: stats.championships || 0, tone: 'gold', icon: Icon.trophy },
              { label: 'Finales', value: stats.finals || 0, tone: 'silver', icon: Icon.award },
              { label: 'Semifinales', value: stats.semifinals || 0, tone: 'bronze', icon: Icon.award },
              { label: 'Partidas ganadas', value: stats.matchWins || 0, tone: 'accent', icon: Icon.bolt },
            ].map((m, i) => (
              <motion.div key={m.label} className={`gg-uniprof__medal gg-uniprof__medal--${m.tone}`}
                initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <span>{m.icon}</span>
                <b>{m.value}</b>
                <small>{m.label}</small>
              </motion.div>
            ))}
          </div>
          <p className="gg-uniprof__note">Conteo de los torneos universitarios oficiales de GlitchGang (los que suman al ranking).</p>

          <section>
            <h2 className="gg-uniprof__h">Títulos</h2>
            {achievements.titles.length === 0
              ? <p className="gg-uniprof__muted">
                  {stats.championships
                    ? 'El detalle de cada título aparecerá aquí en cuanto se cargue.'
                    : 'Aún sin títulos. El primero puede llegar en el próximo torneo.'}
                </p>
              : <div className="gg-uniprof__titles">
                  {achievements.titles.map(t => (
                    <Link key={`${t.id}:${t.teamId}`} to={`/torneos/${t.id}`} className="gg-uniprof__title-card">
                      <span className="gg-uniprof__title-ic">{Icon.trophy}</span>
                      <div>
                        <b>{t.title}</b>
                        <span>{t.teamName}{t.game ? ` · ${findGame(t.game)?.name || t.game}` : ''}</span>
                      </div>
                      <small>{formatDate(t.date)}</small>
                    </Link>
                  ))}
                </div>}
          </section>

          <section>
            <h2 className="gg-uniprof__h">Historial de torneos</h2>
            {achievements.history.length === 0
              ? <p className="gg-uniprof__muted">Sus equipos todavía no han terminado ningún torneo universitario.</p>
              : <div className="gg-uniprof__history">
                  {achievements.history.map(h => (
                    <Link key={`${h.id}:${h.teamId}`} to={`/torneos/${h.id}`} className="gg-uniprof__hist-row">
                      <span className={`gg-uniprof__place p${Math.min(h.placement || 9, 4)}`}>
                        {h.placement ? `${h.placement}º` : h.status === 'finished' ? '—' : '•'}
                      </span>
                      <span className="gg-uniprof__hist-main">
                        <b>{h.title}</b>
                        <small>{h.teamName}{h.game ? ` · ${findGame(h.game)?.name || h.game}` : ''}</small>
                      </span>
                      <small className="gg-uniprof__hist-date">
                        {h.status === 'finished' ? formatDate(h.date) : h.status === 'ongoing' || h.status === 'live' ? 'En curso' : 'Próximo'}
                      </small>
                    </Link>
                  ))}
                </div>}
          </section>
        </div>
      )}
    </div>
  )
}

function FactList({ title, icon, items, empty, collapse }) {
  const [open, setOpen] = useState(false)
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  const shown = collapse && !open ? list.slice(0, collapse) : list
  return (
    <div className="gg-uniprof__card gg-uniprof__fact">
      <h3>{icon} {title}</h3>
      {list.length === 0
        ? <p className="gg-uniprof__muted">{empty}</p>
        : <div className="gg-uniprof__chips">
            {shown.map(item => <span key={item}>{item}</span>)}
            {collapse && list.length > collapse && (
              <button type="button" onClick={() => setOpen(v => !v)}>
                {open ? 'Ver menos' : `+${list.length - collapse} más`}
              </button>
            )}
          </div>}
    </div>
  )
}

function TeamGrid({ teams, uni, titles, navigate }) {
  return (
    <div className="gg-uniprof__teams">
      {teams.map((basic, i) => {
        const title = titles.find(t => t.teamId === basic.id)
        return (
          <GGTeamCard
            key={basic.id}
            team={adaptTeam(basic, uni, title)}
            tier="universitario"
            index={i}
            hideJoin
            viewLabel="Ver equipo"
            onView={() => navigate(`/equipos/${basic.id}`)}
          />
        )
      })}
    </div>
  )
}


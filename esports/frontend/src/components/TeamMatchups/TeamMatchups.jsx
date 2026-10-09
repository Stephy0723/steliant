// Enfrentamiento del equipo: rival, horario, formato y check-in del próximo
// partido, más un historial reciente. Se usa tanto en /jugador (su equipo
// principal) como en /mi-equipo (el equipo que esté gestionando).
//
// La fuente de verdad es el bracket real que ya arma el organizador
// (bracketStore.matchesForTeam) -- nada acá inventa datos: si el torneo no
// tiene bracket publicado o no hay horario cargado, se dice explícitamente
// en vez de mostrar algo falso.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'
import GGLoader from '../GGLoader/GGLoader.jsx'
import { tournamentsApi, registrationsApi } from '../../lib/serverApi.js'
import TournamentAnnouncements from '../TournamentAnnouncements/TournamentAnnouncements.jsx'
import { pullBracket, getBracket, matchesForTeam, seriesForRound } from '../../lib/bracketStore.js'
import './TeamMatchups.css'
import MatchStats from '../MatchStats/MatchStats.jsx'
import MatchReport from '../MatchReport/MatchReport.jsx'
import { isMobileLegends } from '../../../../shared/matchStats.mjs'

function fmtWhen(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('es-DO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function initialsOf(name) {
  return String(name || '??').trim().slice(0, 2).toUpperCase()
}

const CHECKIN_OK = new Set(['checked_in', 'confirmed'])

export default function TeamMatchups({ team }) {
  const teamId = team?.id || team?._id
  const teamName = team?.name || team?.tag
  const [status, setStatus] = useState('loading') // loading | no-team | empty | ready
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!teamId) { setStatus('no-team'); return }
    let alive = true
    setStatus('loading')
    tournamentsApi.byTeam(teamId, { includeFinished: true })
      .then(async (res) => {
        const list = Array.isArray(res?.tournaments) ? res.tournaments : (Array.isArray(res) ? res : [])
        if (!alive) return
        if (!list.length) { setRows([]); setStatus('empty'); return }
        const computed = await Promise.all(list.map(async (tItem) => {
          const tid = tItem.id || tItem._id
          await pullBracket(tid).catch(() => {})
          const stored = getBracket(tid)
          const data = matchesForTeam(tItem, stored, teamName)
          let regEntry = null
          try {
            const r = await registrationsApi.list(tid)
            const regs = Array.isArray(r?.registrations) ? r.registrations : []
            const norm = (s) => String(s || '').trim().toLowerCase()
            regEntry = regs.find(reg => norm(reg.name || reg.tag) === norm(teamName)) || null
          } catch { /* check-in es informativo, no bloquea el resto */ }
          return { tournament: tItem, data, regEntry }
        }))
        if (!alive) return
        setRows(computed)
        setStatus('ready')
      })
      .catch(() => { if (alive) { setRows([]); setStatus('empty') } })
    return () => { alive = false }
  }, [teamId, teamName])

  // El enfrentamiento mas proximo entre TODOS los torneos activos del equipo
  // (por si juega mas de uno a la vez) -- el que tenga horario mas cercano
  // gana; los sin horario todavia quedan al final.
  const nextEntry = useMemo(() => {
    const withNext = rows.filter(r => r.data?.next && r.tournament.status !== 'finished')
    return [...withNext].sort((a, b) => {
      const ta = a.data.next.scheduledAt ? new Date(a.data.next.scheduledAt).getTime() : Infinity
      const tb = b.data.next.scheduledAt ? new Date(b.data.next.scheduledAt).getTime() : Infinity
      return ta - tb
    })[0] || null
  }, [rows])

  const others = rows.filter(r => r !== nextEntry && r.tournament.status !== 'finished' && (r.data?.next || r.data?.recent?.length))

  if (status === 'no-team') {
    return (
      <div className="tmu tmu--empty">
        <div className="tmu-empty__icon">{Icon.users}</div>
        <h3>Todavía no tienes equipo</h3>
        <p>Únete o crea un equipo para ver sus enfrentamientos acá.</p>
      </div>
    )
  }

  if (status === 'loading') {
    return <div className="tmu tmu--empty"><GGLoader label="Sincronizando enfrentamientos" size="sm" /></div>
  }

  if (status === 'empty') {
    return (
      <div className="tmu tmu--empty">
        <div className="tmu-empty__icon">{Icon.calendar}</div>
        <h3>Sin enfrentamientos activos</h3>
        <p>Cuando {teamName || 'tu equipo'} esté inscrito en un torneo con el bracket publicado, acá va a aparecer el rival, el horario y todo lo que necesitan para el partido.</p>
      </div>
    )
  }

  return (
    <div className="tmu">
      {nextEntry ? (
        <NextMatchCard entry={nextEntry} teamName={teamName} />
      ) : (
        <div className="tmu-card tmu-card--empty">
          <p>{Icon.alert} {teamName || 'Tu equipo'} está inscrito, pero el bracket todavía no está publicado o no tiene un próximo enfrentamiento cargado.</p>
        </div>
      )}

      {rows.filter(r => r.tournament?.announcements?.length).map(r => (
        <TournamentAnnouncements
          key={`ann-${r.tournament.id || r.tournament._id}`}
          announcements={r.tournament.announcements}
          title={`Comunicados · ${r.tournament.title}`}
          compact
        />
      ))}

      {rows.filter(r => isMobileLegends(r.tournament.game)).map(entry => (
        <div key={`stats-${entry.tournament.id || entry.tournament._id}`}>
          {(entry.data?.all || []).filter(m => !m.bye && !m.pending).map(m => (
            <StatsDisclosure key={m.id} tournament={entry.tournament} match={m} />
          ))}
        </div>
      ))}

      {others.length > 0 && (
        <div className="tmu-others">
          <h4>{Icon.trophy} Otros torneos activos</h4>
          {others.map(entry => (
            <OtherTournamentRow key={entry.tournament.id || entry.tournament._id} entry={entry} />
          ))}
        </div>
      )}

      {nextEntry?.data?.recent?.length > 0 && (
        <div className="tmu-recent">
          <h4>{Icon.clock} Historial reciente · {nextEntry.tournament.title}</h4>
          {nextEntry.data.recent.map(m => (
            <div key={m.id} className={`tmu-recent__row ${m.won ? 'win' : 'loss'}`}>
              <span className="tmu-recent__result">{m.won ? 'V' : 'D'}</span>
              <span className="tmu-recent__vs">vs {m.opponent}</span>
              <span className="tmu-recent__score">{m.scoreA}-{m.scoreB}</span>
              <span className="tmu-recent__round">{m.round}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatsDisclosure({ tournament, match }) {
  const [open, setOpen] = useState(false)
  return <details className="tmu-card" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Capturas y estadísticas · {tournament.title} · vs {match.opponent} · {match.round}</summary>
    {open && <MatchStats tournamentId={tournament.id || tournament._id} matchId={match.id} series={seriesForRound(tournament.competition || {}, match.round)} />}
  </details>
}

function NextMatchCard({ entry, teamName }) {
  const { tournament, data, regEntry } = entry
  const m = data.next
  const pubId = tournament.publicId || tournament.id || tournament._id
  const when = fmtWhen(m.scheduledAt)
  const series = tournament.competition ? seriesForRound(tournament.competition, m.round) : null
  const checkinOk = Boolean(regEntry && CHECKIN_OK.has(regEntry.status))
  const rivalTbd = m.opponent === 'Por definir'

  return (
    <div className="tmu-card tmu-next">
      <div className="tmu-next__head">
        <span className="tmu-eyebrow">{Icon.trophy} Próximo enfrentamiento</span>
        <h2>{tournament.title}</h2>
        <span className="tmu-next__game">{tournament.game} · {m.round}</span>
      </div>

      <div className="tmu-vs">
        <div className="tmu-vs__team">
          <div className="tmu-vs__avatar">{initialsOf(teamName)}</div>
          <b>{teamName}</b>
        </div>
        <span className="tmu-vs__x">VS</span>
        <div className="tmu-vs__team">
          <div className={`tmu-vs__avatar tmu-vs__avatar--rival ${rivalTbd ? 'is-tbd' : ''}`}>{rivalTbd ? '?' : initialsOf(m.opponent)}</div>
          <b>{rivalTbd ? 'Rival por definir' : m.opponent}</b>
        </div>
      </div>

      <div className="tmu-facts">
        <div className="tmu-fact">
          <span>{Icon.clock} Horario</span>
          <b className={when ? '' : 'warn'}>{when || 'Por confirmar'}</b>
        </div>
        <div className="tmu-fact">
          <span>{Icon.check} Check-in</span>
          <b className={regEntry ? (checkinOk ? 'ok' : 'warn') : 'muted'}>{regEntry ? (checkinOk ? 'Confirmado' : 'Pendiente') : 'Sin datos'}</b>
        </div>
        <div className="tmu-fact">
          <span>{Icon.award} Formato</span>
          <b>{series || 'A definir'}</b>
        </div>
      </div>

      <div className="tmu-actions">
        <Link className="tmu-btn tmu-btn--primary" to={`/torneos/${pubId}?tab=bracket`}>{Icon.eye} Ver bracket completo</Link>
        <Link className="tmu-btn" to={`/torneos/${pubId}?tab=reglas`}>{Icon.fileText} Reglamento</Link>
        <Link className="tmu-btn" to={`/torneos/${pubId}`}>{Icon.trophy} Ver torneo</Link>
      </div>

      {!rivalTbd && <MatchReport tournamentId={tournament.id || tournament._id} matchId={m.id} />}
    </div>
  )
}

function OtherTournamentRow({ entry }) {
  const { tournament, data } = entry
  const pubId = tournament.publicId || tournament.id || tournament._id
  const m = data.next
  return (
    <Link className="tmu-other" to={`/torneos/${pubId}?tab=bracket`}>
      <b>{tournament.title}</b>
      <span>{m ? `vs ${m.opponent === 'Por definir' ? 'rival por definir' : m.opponent} · ${m.round}` : 'Sin próximo enfrentamiento cargado'}</span>
    </Link>
  )
}


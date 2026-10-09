// "Resultados por revisar" y el caso de cada partida (spec-lector-resultados,
// secciones 2 y 4). Lo usan la página global del organizador
// (/organizador/resultados) y la pestaña "Resultados" de cada torneo
// (tournamentId), donde también entra el staff con permiso.
// El árbitro ve lado a lado las capturas, lo que leyó la IA de cada equipo
// (con las diferencias resaltadas), lo declarado y el roster congelado.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'
import { resultsApi } from '../../lib/serverApi.js'
import { STAT_FIELDS } from '../../../../shared/matchStats.mjs'
import { reportScreenshotLabel } from '../../../../shared/reportScreenshots.mjs'
import './ResultsReview.css'

const STATE = {
  analyzing: { icon: '⏳', label: 'Analizando', tone: 'muted' },
  validated: { icon: '🟢', label: 'Validado', tone: 'ok' },
  pending_review: { icon: '⚪', label: 'Por confirmar', tone: 'warn' },
  arbitration: { icon: '🟠', label: 'En arbitraje', tone: 'bad' },
  rejected: { icon: '🔴', label: 'Rechazado', tone: 'bad' },
}
const DECLARED = { win: 'Victoria', lose: 'Derrota', draw: 'Empate' }
const SOURCE = { 'ai-validated': 'capturas de los dos equipos', declarations: 'declaraciones de los dos equipos', arbiter: 'decisión del árbitro' }
const FILTERS = [
  { value: '', label: 'Abiertos' },
  { value: 'pending_review', label: '⚪ Por confirmar' },
  { value: 'arbitration', label: '🟠 En arbitraje' },
  { value: 'decided', label: 'Decididos' },
]

function ago(date) {
  const min = Math.max(0, Math.round((Date.now() - new Date(date)) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`
}
const fmt = v => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString() : String(v))

function StateChip({ state }) {
  const st = STATE[state] || STATE.analyzing
  return <span className={`rr-chip rr-chip--${st.tone}`}>{st.icon} {st.label}</span>
}

export default function ResultsReview({ tournamentId = null }) {
  const [params, setParams] = useSearchParams()
  const caseId = params.get('caso')
  const open = id => setParams(prev => { const next = new URLSearchParams(prev); if (id) next.set('caso', id); else next.delete('caso'); return next })
  return caseId ? <CaseDetail id={caseId} onBack={() => open(null)} /> : <CaseList tournamentId={tournamentId} onOpen={open} />
}

function CaseList({ tournamentId, onOpen }) {
  const [filters, setFilters] = useState({ torneo: tournamentId || '', estado: '', sinArbitro: false })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    resultsApi.review({ ...filters, torneo: tournamentId || filters.torneo, sinArbitro: filters.sinArbitro ? '1' : '' })
      .then(d => { setData(d); setError('') })
      .catch(e => setError(e.message || 'No se pudieron cargar los resultados.'))
  }, [filters, tournamentId])
  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])
  const decided = filters.estado === 'decided'

  return (
    <section className="rr">
      <div className="rr-filters">
        {!tournamentId && (
          <label>Torneo
            <select value={filters.torneo} onChange={e => setFilters(f => ({ ...f, torneo: e.target.value }))}>
              <option value="">Todos</option>
              {(data?.tournaments || []).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        )}
        <label>Estado
          <select value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
            {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        {!decided && <label className="rr-check"><input type="checkbox" checked={filters.sinArbitro} onChange={e => setFilters(f => ({ ...f, sinArbitro: e.target.checked }))} /> Sin árbitro</label>}
        <button type="button" className="rr-btn rr-btn--ghost" onClick={load}>{Icon.refresh} Actualizar</button>
      </div>

      {error && <p className="rr-error" role="alert">{Icon.alert} {error}</p>}
      {!data ? <p className="rr-muted">Cargando…</p> : data.cases.length === 0 ? (
        <div className="rr-empty">{Icon.check}<p>{decided ? 'Todavía no hay partidas decididas.' : 'No hay resultados esperando a un árbitro. Las partidas cuyas capturas coinciden avanzan solas.'}</p></div>
      ) : (
        <ul className="rr-list">
          {data.cases.map(c => (
            <li key={c.id}>
              <button type="button" className={`rr-row ${c.urgent ? 'is-urgent' : ''}`} onClick={() => onOpen(c.id)}>
                <span className="rr-row__main">
                  {!tournamentId && <small>{c.tournament.title}</small>}
                  <b>{c.matchLabel}</b>
                  <span>{c.teams.join(' vs ')}</span>
                </span>
                <span className="rr-row__state">
                  <StateChip state={c.state} />
                  {c.appealed && <span className="rr-chip rr-chip--bad">Apelado</span>}
                </span>
                <span className="rr-row__reason">{decided ? `Gana ${c.winnerName}` : c.reasons.join(' · ')}</span>
                <span className="rr-row__meta">
                  <span>{c.assignedName ? `Lo revisa ${c.assignedToMe ? 'tú' : c.assignedName}` : 'Sin árbitro'}</span>
                  <span>{c.urgent && Icon.alert} hace {ago(decided ? c.decidedAt : c.openedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReadTable({ read, teams, diff, rosterNick }) {
  if (!read) return <p className="rr-muted">Sin lectura automática.</p>
  if (read.status !== 'done') return <p className="rr-muted">{read.status === 'failed' ? `La lectura falló: ${read.error}` : 'Leyendo…'}</p>
  const teamName = id => teams.find(t => t.id === id)?.name || '—'
  return (
    <div className="rr-read">
      <p className="rr-read__head">
        La IA leyó: <b>gana {read.winnerTeamId ? teamName(read.winnerTeamId) : '— (no se ve)'}</b>
        <span>Confianza {read.confidence != null ? `${Math.round(read.confidence * 100)}%` : '—'}</span>
        {read.flags.length > 0 && <span className="rr-flag">{Icon.alert} {read.flags.join(' · ')}</span>}
      </p>
      <div className="rr-table">
        <table>
          <thead><tr><th>Jugador</th><th>Héroe</th>{Object.entries(STAT_FIELDS).map(([k, l]) => <th key={k}>{l}</th>)}<th>MVP</th></tr></thead>
          <tbody>
            {read.players.map((p, i) => {
              const fields = diff[p.playerId] || []
              return (
                <tr key={i} className={!p.playerId ? 'is-unknown' : ''}>
                  <td title={p.rawName}>
                    <span className="rr-team-dot" data-side={p.teamId === teams[0].id ? 'A' : 'B'} />
                    {p.rawName || '—'}{p.playerId ? (rosterNick(p.playerId) && rosterNick(p.playerId) !== p.rawName ? <small> · {rosterNick(p.playerId)}</small> : null) : <small> · no está en el roster</small>}
                  </td>
                  <td>{p.character || '—'}</td>
                  {Object.keys(STAT_FIELDS).map(k => <td key={k} className={fields.includes(k) ? 'is-diff' : (p.uncertain || []).includes(k) ? 'is-doubt' : ''}>{fmt(p[k])}</td>)}
                  <td className={fields.includes('mvp') ? 'is-diff' : ''}>{p.mvp == null ? '—' : p.mvp ? 'Sí' : 'No'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CaseDetail({ id, onBack }) {
  const [c, setC] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ decision: 'confirm', winnerTeamId: '', teamId: '', minutes: 15, reason: '' })
  const load = useCallback(() => resultsApi.get(id).then(d => { setC(d); setError('') }).catch(e => setError(e.message || 'No se pudo cargar el caso.')), [id])
  useEffect(() => { load() }, [load])
  const rosterNick = useMemo(() => (pid => c?.roster.find(p => p.playerId === pid)?.nick || ''), [c])

  const run = async action => {
    setBusy(true); setError('')
    try { setC(await action()) } catch (e) { setError(e.message || 'No se pudo completar la acción.') } finally { setBusy(false) }
  }
  if (!c) return <section className="rr">{error ? <p className="rr-error">{Icon.alert} {error}</p> : <p className="rr-muted">Cargando caso…</p>}<button type="button" className="rr-btn rr-btn--ghost" onClick={onBack}>Volver</button></section>

  const open = ['pending_review', 'arbitration'].includes(c.state)
  const mine = c.case.assignedToMe
  const canDecide = c.permissions.canArbitrate && (mine || !c.case.assignedTo)
  const readWinners = c.reads.filter(r => r?.status === 'done').map(r => r.winnerTeamId).filter(Boolean)
  const declaredWinners = c.reports.filter(Boolean).map(r => (r.declared === 'win' ? r.team : r.declared === 'lose' ? c.teamIds.find(t => t !== r.team) : '')).filter(Boolean)
  const against = form.decision !== 'confirm' || !form.winnerTeamId || readWinners.some(w => w !== form.winnerTeamId) || declaredWinners.some(w => w !== form.winnerTeamId) || c.reports.filter(Boolean).length < 2 || Boolean(c.case.appealedAt)
  const reasonMissing = against && form.reason.trim().length < 10
  const needsTeam = ['request_capture', 'reject'].includes(form.decision)
  const ready = !busy && !reasonMissing && (form.decision !== 'confirm' || form.winnerTeamId) && (!needsTeam || form.teamId)

  return (
    <section className="rr rr-case">
      <button type="button" className="rr-btn rr-btn--ghost rr-back" onClick={onBack}>← Resultados por revisar</button>
      <header className="rr-case__head">
        <div>
          <small>{c.tournament.title}</small>
          <h3>{c.matchLabel}</h3>
          <p>{c.teams.map(t => t.name).join(' vs ')} · Serie {c.series} · {c.seriesScore.scoreA}-{c.seriesScore.scoreB}</p>
        </div>
        <div className="rr-case__actions">
          <StateChip state={c.state} />
          {c.statsPath && <Link className="rr-btn rr-btn--ghost" to={c.statsPath}>{Icon.chartBar} Editar estadísticas</Link>}
          {c.permissions.canTake && !mine && <button type="button" className="rr-btn" disabled={busy} onClick={() => run(() => resultsApi.take(id))}>{c.case.assignedTo ? 'Tomar (reasignar a mí)' : 'Tomar caso'}</button>}
        </div>
      </header>

      {error && <p className="rr-error" role="alert">{Icon.alert} {error}</p>}
      {c.permissions.isAdmin && <p className="rr-note">Vista de soporte: el admin de GlitchGang solo mira; deciden el organizador y su staff.</p>}
      {c.case.assignedTo && open && <p className="rr-note">{mine ? 'Tienes este caso.' : `Lo revisa ${c.case.assignedName}.`}</p>}
      {c.case.appealedAt && <p className="rr-note rr-note--bad">{Icon.alert} Apelado: “{c.case.appealReason}”. {open ? 'Debe revisarlo otra persona distinta de quien decidió.' : ''}</p>}
      {c.reasons.length > 0 && c.state !== 'validated' && <ul className="rr-reasons">{c.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
      {c.state === 'validated' && <p className="rr-note rr-note--ok">🟢 Gana {c.teams.find(t => t.id === c.winnerTeamId)?.name} · {SOURCE[c.source] || ''}{c.decidedAt ? ` · ${new Date(c.decidedAt).toLocaleString()}` : ''}</p>}

      <div className="rr-sides">
        {c.teams.map((team, i) => {
          const report = c.reports[i]
          return (
            <div className="rr-side" key={team.id}>
              <div className="rr-side__head">
                <b>{team.name}</b>
                {report ? <span className={`rr-chip rr-chip--${report.declared === 'win' ? 'ok' : report.declared === 'lose' ? 'bad' : 'muted'}`}>Declaró {DECLARED[report.declared] || '—'}</span> : <span className="rr-chip rr-chip--muted">Sin reporte</span>}
              </div>
              {report?.missing?.length > 0 && <p className="rr-flag">{Icon.alert} Falta: {report.missing.map(reportScreenshotLabel).join(', ')}</p>}
              {report && (
                <div className="rr-shots">
                  {report.evidence.map(e => (
                    <a key={e.url} href={e.url} target="_blank" rel="noreferrer"><img src={e.url} alt={`${team.name} · ${reportScreenshotLabel(e.key)}`} loading="lazy" /><span>{reportScreenshotLabel(e.key)}</span></a>
                  ))}
                </div>
              )}
              <ReadTable read={c.reads[i]} teams={c.teams} diff={c.diff} rosterNick={rosterNick} />
            </div>
          )
        })}
      </div>

      <VoiceRecordings caseId={id} c={c} />

      {c.roster.length > 0 && (
        <details className="rr-roster">
          <summary>Roster congelado en el check-in</summary>
          <div className="rr-sides">
            {c.teams.map(team => (
              <ul key={team.id}>
                <li><b>{team.name}</b></li>
                {c.roster.filter(p => p.teamId === team.id).map(p => (
                  <li key={p.playerId}>{p.nick}{p.gameId ? <small> · ID {p.gameId}</small> : null} {p.verified ? <span className="rr-chip rr-chip--ok">✅ Verificada</span> : <span className="rr-chip rr-chip--muted">Sin verificar</span>}</li>
                ))}
              </ul>
            ))}
          </div>
        </details>
      )}

      {open && c.permissions.canArbitrate && (
        <div className="rr-decide">
          <h4>Decisión</h4>
          {!canDecide && <p className="rr-muted">Toma el caso para decidir.</p>}
          <fieldset disabled={!canDecide || busy}>
            <div className="rr-decide__options">
              {[['confirm', '✅ Confirmar ganador'], ['request_capture', '📸 Pedir nueva captura'], ['replay', '🔁 Repetir partida'], ['reject', '🔴 Rechazar reporte']].map(([value, label]) => (
                <label key={value} className={form.decision === value ? 'is-on' : ''}><input type="radio" name="decision" value={value} checked={form.decision === value} onChange={() => setForm(f => ({ ...f, decision: value }))} /> {label}</label>
              ))}
            </div>
            {form.decision === 'confirm' && (
              <label>Ganador de la partida
                <select value={form.winnerTeamId} onChange={e => setForm(f => ({ ...f, winnerTeamId: e.target.value }))}>
                  <option value="">Elegir</option>
                  {c.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            )}
            {needsTeam && (
              <label>{form.decision === 'reject' ? 'Reporte que se rechaza (queda como falta)' : 'Equipo que debe mandar la captura'}
                <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
                  <option value="">Elegir</option>
                  {c.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            )}
            {form.decision === 'request_capture' && (
              <label>Plazo (minutos)<input type="number" min="5" max="120" value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} /></label>
            )}
            <label>Motivo {against ? '(obligatorio, mínimo 10 caracteres)' : '(opcional)'}
              <textarea rows={3} maxLength={1000} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ej.: captura de daño borrosa, resultado claro en ambas" />
            </label>
            {form.decision === 'confirm' && c.statsPath && <p className="rr-muted">Las estadísticas se confirman con la lectura de mayor confianza. Si hay que corregir una cifra, usa “Editar estadísticas”.</p>}
            <button type="button" className="rr-btn" disabled={!ready} onClick={() => run(() => resultsApi.decide(id, form))}>{busy ? 'Guardando…' : 'Guardar decisión y avisar a los equipos'}</button>
          </fieldset>
        </div>
      )}

      {c.history.length > 0 && (
        <details className="rr-history">
          <summary>Intentos anteriores ({c.history.length})</summary>
          <ul>{c.history.map((h, i) => <li key={i}>{h.decision === 'replay' ? '🔁 Partida repetida' : '🔴 Reporte rechazado'} · {h.byName} · {new Date(h.at).toLocaleString()} · “{h.reason}”</li>)}</ul>
        </details>
      )}
      <details className="rr-history" open>
        <summary>Auditoría ({c.audit.length})</summary>
        <ol>{[...c.audit].reverse().map((a, i) => <li key={i}><time>{new Date(a.at).toLocaleString()}</time> <b>{a.actorName}</b> {a.detail}</li>)}</ol>
      </details>
    </section>
  )
}

const clock = ms => {
  const total = Math.max(0, Math.round((ms || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// Descarga (con la sesión) las pistas pedidas y guarda sus object URLs.
function useTrackUrls(caseId) {
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState({})
  const [error, setError] = useState('')
  const urlsRef = useRef({})
  useEffect(() => () => Object.values(urlsRef.current).forEach(URL.revokeObjectURL), [])
  const load = useCallback(async (recordingId, discordUserId) => {
    const key = `${recordingId}:${discordUserId}`
    if (urlsRef.current[key]) return urlsRef.current[key]
    setLoading(l => ({ ...l, [key]: true }))
    try {
      const url = URL.createObjectURL(await resultsApi.recordingTrack(caseId, recordingId, discordUserId))
      urlsRef.current[key] = url
      setUrls(u => ({ ...u, [key]: url }))
      setError('')
      return url
    } catch (e) {
      setError(e.message || 'No se pudo cargar la grabación.')
      return null
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }, [caseId])
  return { urls, loading, error, load }
}

// Toda la sala a la vez: las pistas están alineadas al inicio de la
// grabación, así que basta con reproducirlas juntas y mantenerlas en hora.
function RoomPlayer({ recording, tracks, load }) {
  const audios = useRef([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  useEffect(() => () => audios.current.forEach(a => a.pause()), [])
  useEffect(() => {
    if (!playing) return undefined
    const timer = setInterval(() => {
      const [lead, ...rest] = audios.current
      if (!lead) return
      setTime(lead.currentTime)
      rest.forEach(a => { if (Math.abs(a.currentTime - lead.currentTime) > 0.25) a.currentTime = lead.currentTime })
      if (lead.ended) setPlaying(false)
    }, 500)
    return () => clearInterval(timer)
  }, [playing])

  const prepare = async () => {
    setBusy(true)
    const urls = await Promise.all(tracks.map(t => load(recording.id, t.discordUserId)))
    setBusy(false)
    if (urls.some(u => !u)) return false
    audios.current = urls.map(u => new Audio(u))
    setReady(true)
    return true
  }
  const toggle = async () => {
    if (!ready && !(await prepare())) return
    if (playing) { audios.current.forEach(a => a.pause()); setPlaying(false); return }
    const at = audios.current[0]?.currentTime || 0
    audios.current.forEach(a => { a.currentTime = at })
    await Promise.all(audios.current.map(a => a.play().catch(() => {})))
    setPlaying(true)
  }
  const seek = value => {
    audios.current.forEach(a => { a.currentTime = value })
    setTime(value)
  }
  const total = (recording.durationMs || 0) / 1000
  if (!tracks.length) return <p className="rr-muted">Nadie habló en esta sala.</p>
  return (
    <div className="rr-voice__room">
      <button type="button" className="rr-btn rr-btn--xs" disabled={busy} onClick={toggle}>
        {busy ? 'Cargando…' : playing ? '❚❚ Pausar' : <>{Icon.play} Toda la sala</>}
      </button>
      {ready && (
        <>
          <input type="range" min="0" max={Math.max(1, total)} step="1" value={Math.min(time, total)} onChange={e => seek(Number(e.target.value))} aria-label="Posición en la grabación" />
          <span className="rr-voice__time">{clock(time * 1000)} / {clock(recording.durationMs)}</span>
        </>
      )}
    </div>
  )
}

/**
 * Voz de las salas de los dos equipos para esta partida (/start-match →
 * /report). Una pista por jugador; solo la oye quien arbitra y cada
 * descarga queda en la auditoría del caso.
 */
function VoiceRecordings({ caseId, c }) {
  const { urls, loading, error, load } = useTrackUrls(caseId)
  const recordings = c.recordings || []
  if (!recordings.length && !c.hiddenRecordings) return null
  if (!recordings.length) {
    return <p className="rr-note">🎙️ Esta partida tiene {c.hiddenRecordings === 1 ? 'una grabación' : `${c.hiddenRecordings} grabaciones`} de voz. Solo las escucha quien arbitra (organizador o staff con “Resultados” en edición).</p>
  }
  const teamOrder = c.teams.map(t => t.id)
  const sorted = [...recordings].sort((a, b) => (teamOrder.indexOf(a.teamId) - teamOrder.indexOf(b.teamId)) || (new Date(a.startedAt) - new Date(b.startedAt)))
  const expires = recordings.map(r => r.expiresAt).filter(Boolean).sort()[0]
  return (
    <section className="rr-voice">
      <h4>🎙️ Grabaciones de voz</h4>
      <p className="rr-muted">
        Una pista por jugador, todas desde el inicio de la sala: el minuto 3:00 es el mismo momento en cada una.
        Solo las escucha quien arbitra y cada escucha queda en la auditoría.
        {expires ? ` Se borran solas el ${new Date(expires).toLocaleDateString()}; con el caso abierto no se borran.` : ''}
      </p>
      {error && <p className="rr-error" role="alert">{Icon.alert} {error}</p>}
      <div className="rr-sides">
        {sorted.map(rec => (
          <div className="rr-side rr-voice__rec" key={rec.id}>
            <div className="rr-side__head">
              <b>{rec.teamName || 'Equipo'}</b>
              <span className="rr-voice__chips">
                {rec.gameNumber ? <span className="rr-chip">Partida {rec.gameNumber}</span> : null}
                {rec.voided && <span className="rr-chip rr-chip--warn">Intento anterior</span>}
                {rec.matchStatus === 'cancelled' && <span className="rr-chip rr-chip--muted">Cancelada</span>}
              </span>
            </div>
            <small className="rr-muted">{new Date(rec.startedAt).toLocaleString()} · {clock(rec.durationMs)}</small>
            {rec.screenShareOff.length > 0 && (
              <p className="rr-flag">{Icon.alert} Apagó la pantalla compartida: {rec.screenShareOff.map(e => `${e.username} (${new Date(e.at).toLocaleTimeString()})`).join(', ')}</p>
            )}
            <RoomPlayer recording={rec} tracks={rec.tracks.filter(t => t.spoke)} load={load} />
            <ul className="rr-voice__tracks">
              {rec.tracks.map(t => {
                const key = `${rec.id}:${t.discordUserId}`
                return (
                  <li key={t.discordUserId}>
                    <span className="rr-voice__who">
                      <b>{t.name}</b>
                      {t.discordName && t.discordName !== t.name ? <small> · @{t.discordName}</small> : null}
                      {!t.spoke && <span className="rr-chip rr-chip--muted">No habló</span>}
                    </span>
                    {urls[key] ? (
                      <span className="rr-voice__player">
                        <audio controls preload="metadata" src={urls[key]} />
                        <a className="rr-btn rr-btn--ghost rr-btn--xs" href={urls[key]} download={`${rec.teamName || 'equipo'}-P${rec.gameNumber || 0}-${t.discordName || t.discordUserId}.ogg`}>Descargar</a>
                      </span>
                    ) : (
                      <button type="button" className="rr-btn rr-btn--ghost rr-btn--xs" disabled={loading[key]} onClick={() => load(rec.id, t.discordUserId)}>
                        {loading[key] ? 'Cargando…' : <>{Icon.play} Escuchar</>}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Botón "Apelar" del capitán (una vez por partida decidida). */
export function AppealButton({ caseId, onDone }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!open) return <button type="button" className="rr-btn rr-btn--ghost rr-btn--xs" onClick={() => setOpen(true)}>Apelar</button>
  const send = async () => {
    setBusy(true); setError('')
    try { await resultsApi.appeal(caseId, reason); setOpen(false); onDone?.() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="rr-appeal">
      <textarea rows={2} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="¿Por qué apelas? Lo revisa otra persona del staff. Solo se puede apelar una vez." />
      {error && <p className="rr-error">{error}</p>}
      <div>
        <button type="button" className="rr-btn rr-btn--ghost rr-btn--xs" onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="rr-btn rr-btn--xs" disabled={busy || reason.trim().length < 10} onClick={send}>Enviar apelación</button>
      </div>
    </div>
  )
}


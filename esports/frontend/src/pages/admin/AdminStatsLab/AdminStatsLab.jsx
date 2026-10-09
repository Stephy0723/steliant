// TEMPORAL — Laboratorio de capturas. Prueba la misma lectura con IA que usan los
// torneos (extractMatchStats) con capturas sueltas, sin torneo ni roster. Nada se
// guarda en el servidor; el historial de pruebas vive solo en este navegador.
// Borrar junto con backend/src/controllers/matchStatsLab.controller.js.
import { useEffect, useMemo, useState } from 'react'
import Button from '../../../components/Button/Button.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { normalizeNick } from '../../../../../shared/matchStats.mjs'
import './AdminStatsLab.css'

const HISTORY_KEY = 'gg-stats-lab-history'
const MAX_BYTES = 5 * 1024 * 1024
const COLUMNS = [
  ['kills', 'K'], ['deaths', 'D'], ['assists', 'A'], ['kda', 'KDA'], ['gold', 'Oro'],
  ['damageDealt', 'Daño'], ['damageTaken', 'Recibido'], ['towerDamage', 'Torres'], ['teamfightParticipation', 'Part. %'],
]
// Categorías que tendría una tabla de destacados de torneo / del mes.
const HIGHLIGHTS = [
  { key: 'kills', label: 'Más kills' },
  { key: 'assists', label: 'Más asistencias' },
  { key: 'kda', label: 'Mejor KDA' },
  { key: 'damageDealt', label: 'Más daño' },
  { key: 'damageTaken', label: 'Más aguante', hint: 'daño recibido' },
  { key: 'gold', label: 'Más oro' },
  { key: 'towerDamage', label: 'Más daño a torres' },
  { key: 'teamfightParticipation', label: 'Más participación' },
  { key: 'deaths', label: 'Más muertes', bad: true },
]
const VERDICTS = [
  { id: 'ok', label: 'Acertó todo' },
  { id: 'minor', label: 'Errores menores' },
  { id: 'bad', label: 'Falló bastante' },
]

const kdaOf = p => [p.kills, p.deaths, p.assists].every(v => typeof v === 'number') ? Math.round((p.kills + p.assists) / Math.max(p.deaths, 1) * 100) / 100 : null
const withKda = raw => (raw?.players || []).map(p => ({ ...p, kda: kdaOf(p) }))
const fmt = v => v == null ? '—' : typeof v === 'number' ? v.toLocaleString('es-DO') : String(v)
const fmtDate = iso => new Date(iso).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch { /* sin almacenamiento: el historial no persiste */ }
}
function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
function leaders(players, key) {
  const rows = players.filter(p => typeof p[key] === 'number')
  if (!rows.length) return { value: null, names: [] }
  const value = Math.max(...rows.map(p => p[key]))
  return { value, names: rows.filter(p => p[key] === value).map(p => p.rawName || '¿?') }
}

function TeamTable({ title, side, raw, players }) {
  const rows = players.filter(p => p.side === side)
  const score = side === 'A' ? raw.scoreA : raw.scoreB
  const sum = rows.length && rows.every(p => typeof p.kills === 'number') ? rows.reduce((s, p) => s + p.kills, 0) : null
  const mismatch = sum != null && score != null && sum !== score
  return (
    <section className={`gg-statslab__team${raw.winnerSide === side ? ' is-winner' : ''}`}>
      <header>
        <div>
          <span className="gg-statslab__side">{side === 'A' ? 'Arriba / izquierda' : 'Abajo / derecha'}</span>
          <h4>{title}</h4>
        </div>
        <div className="gg-statslab__score">
          {raw.winnerSide === side && <span className="gg-statslab__badge">Ganador</span>}
          <b>{fmt(score)}</b><small>kills</small>
        </div>
      </header>
      {mismatch && <p className="gg-statslab__warn">{Icon.alert} Los jugadores suman {sum} kills, pero el marcador leído dice {score}.</p>}
      {rows.length !== 5 && <p className="gg-statslab__warn">{Icon.alert} La IA leyó {rows.length} jugadores en este lado (debería haber 5).</p>}
      <div className="gg-statslab__tablewrap">
        <table className="gg-statslab__table">
          <thead><tr><th>Jugador</th><th>Héroe</th>{COLUMNS.map(([k, l]) => <th key={k}>{l}</th>)}<th>MVP</th></tr></thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i}>
                <td className={p.uncertain?.includes('rawName') ? 'is-unsure' : ''}><b>{p.rawName || '—'}</b></td>
                <td className={p.uncertain?.includes('character') ? 'is-unsure' : ''}>{fmt(p.character)}</td>
                {COLUMNS.map(([k]) => <td key={k} className={`${p[k] == null ? 'is-null' : ''}${p.uncertain?.includes(k) ? ' is-unsure' : ''}`}>{fmt(p[k])}</td>)}
                <td className={p.uncertain?.includes('mvp') ? 'is-unsure' : ''}>{p.mvp == null ? '—' : p.mvp ? '★' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Result({ entry, onVerdict, onNote }) {
  const { raw } = entry
  const players = useMemo(() => withKda(raw), [raw])
  const unsure = players.reduce((n, p) => n + (p.uncertain?.length || 0), 0)
  const nulls = players.reduce((n, p) => n + COLUMNS.filter(([k]) => k !== 'kda' && p[k] == null).length, 0)
  return (
    <div className="gg-statslab__result">
      <div className="gg-statslab__meta">
        <span>{entry.fileName}</span>
        <span>Modelo <b>{entry.model}</b></span>
        <span>{(entry.ms / 1000).toFixed(1)} s</span>
        <span>{players.length} jugadores leídos</span>
        <span>{nulls} datos vacíos</span>
        <span className={unsure ? 'is-unsure' : ''}>{unsure} campos dudosos</span>
        {raw.winnerSide == null && <span className="is-unsure">No identificó ganador</span>}
      </div>

      <div className="gg-statslab__teams">
        <TeamTable title={entry.teamA} side="A" raw={raw} players={players} />
        <TeamTable title={entry.teamB} side="B" raw={raw} players={players} />
      </div>

      <section className="gg-admin-card">
        <h3>Destacados de esta partida</h3>
        <div className="gg-statslab__highlights">
          {HIGHLIGHTS.map(h => {
            const top = leaders(players, h.key)
            return (
              <div key={h.key} className={`gg-statslab__hl${h.bad ? ' is-bad' : ''}`}>
                <span>{h.label}{h.hint && <small> · {h.hint}</small>}</span>
                <b>{top.names.length ? top.names.join(', ') : 'Sin datos'}</b>
                <em>{fmt(top.value)}</em>
              </div>
            )
          })}
          <div className="gg-statslab__hl">
            <span>MVP</span>
            <b>{players.filter(p => p.mvp).map(p => p.rawName).join(', ') || 'Sin datos'}</b>
          </div>
        </div>
      </section>

      <section className="gg-admin-card">
        <h3>¿Cómo lo hizo la IA?</h3>
        <p className="gg-statslab__hint">Compara cada número con la captura. Las celdas amarillas son las que la IA marcó como dudosas; "—" es un dato que no pudo leer (no lo inventa).</p>
        <div className="gg-statslab__verdicts">
          {VERDICTS.map(v => (
            <button key={v.id} type="button" className={`gg-statslab__verdict is-${v.id}${entry.verdict === v.id ? ' active' : ''}`} onClick={() => onVerdict(v.id)}>{v.label}</button>
          ))}
        </div>
        <textarea className="gg-statslab__note" value={entry.note || ''} onChange={e => onNote(e.target.value)} placeholder="Notas: qué leyó mal (ej. confundió el daño de Hayabusa, nick con símbolos...)" maxLength={500} />
      </section>

      <details className="gg-statslab__raw">
        <summary>Ver respuesta cruda de la IA (JSON)</summary>
        <pre>{JSON.stringify(raw, null, 2)}</pre>
      </details>
    </div>
  )
}

function Accumulated({ history }) {
  const [sortKey, setSortKey] = useState('kills')
  const rows = useMemo(() => {
    const byNick = new Map()
    for (const entry of history) for (const p of entry.raw?.players || []) {
      const id = normalizeNick(p.rawName)
      if (!id) continue
      const row = byNick.get(id) || { nick: p.rawName, games: 0, wins: 0, mvp: 0, kills: 0, deaths: 0, assists: 0, damageDealt: 0, damageTaken: 0, gold: 0 }
      row.games += 1
      if (entry.raw.winnerSide && entry.raw.winnerSide === p.side) row.wins += 1
      if (p.mvp) row.mvp += 1
      for (const k of ['kills', 'deaths', 'assists', 'damageDealt', 'damageTaken', 'gold']) if (typeof p[k] === 'number') row[k] += p[k]
      byNick.set(id, row)
    }
    return [...byNick.values()].map(r => ({ ...r, kda: kdaOf(r) })).sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1))
  }, [history, sortKey])
  if (!rows.length) return null
  const cols = [['games', 'Partidas'], ['wins', 'Victorias'], ['kills', 'Kills'], ['deaths', 'Muertes'], ['assists', 'Asist.'], ['kda', 'KDA'], ['damageDealt', 'Daño'], ['damageTaken', 'Aguante'], ['gold', 'Oro'], ['mvp', 'MVP']]
  return (
    <section className="gg-admin-card">
      <h3>Tabla acumulada de tus pruebas</h3>
      <p className="gg-statslab__hint">Así se vería una tabla de torneo o del mes: suma todas las capturas que leíste, agrupando por nick. Toca una columna para ordenar.</p>
      <div className="gg-statslab__tablewrap">
        <table className="gg-statslab__table">
          <thead><tr><th>#</th><th>Jugador</th>{cols.map(([k, l]) => <th key={k}><button type="button" className={sortKey === k ? 'active' : ''} onClick={() => setSortKey(k)}>{l}</button></th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.nick}><td>{i + 1}</td><td><b>{r.nick}</b></td>{cols.map(([k]) => <td key={k}>{fmt(r[k])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

export default function AdminStatsLab() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(loadHistory)
  const [currentId, setCurrentId] = useState(() => loadHistory()[0]?.id || '')

  useEffect(() => { saveHistory(history) }, [history])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    const onPaste = e => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
      if (item) pick(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function pick(next) {
    setError('')
    if (!next) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type)) return setError('Usa una imagen PNG, JPG o WebP.')
    if (next.size > MAX_BYTES) return setError('La captura supera 5 MB.')
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  async function read() {
    if (!file || busy) return
    setBusy(true); setError('')
    try {
      const dataUrl = await readDataUrl(file)
      const result = await api('/admin/match-stats-lab', { method: 'POST', body: { dataUrl } })
      const entry = {
        id: `${Date.now()}`, at: new Date().toISOString(), fileName: file.name || 'captura pegada',
        teamA: teamA.trim() || 'Equipo A', teamB: teamB.trim() || 'Equipo B',
        model: result.model, ms: result.ms, raw: result.raw, verdict: '', note: '',
      }
      setHistory(list => [entry, ...list].slice(0, 50))
      setCurrentId(entry.id)
    } catch (err) {
      setError(err?.message || 'No se pudo leer la captura.')
    } finally { setBusy(false) }
  }

  const patch = (id, changes) => setHistory(list => list.map(e => e.id === id ? { ...e, ...changes } : e))
  const remove = id => { setHistory(list => list.filter(e => e.id !== id)); if (id === currentId) setCurrentId('') }
  const current = history.find(e => e.id === currentId)
  const rated = history.filter(e => e.verdict)
  const score = id => rated.filter(e => e.verdict === id).length

  return (
    <div className="gg-admin-page gg-statslab">
      <div className="gg-admin-page__header">
        <div>
          <h2>Laboratorio de capturas <span className="gg-statslab__tag">Temporal</span></h2>
          <p>Sube una captura de resultados de Mobile Legends y mira cómo la IA la puntúa. Usa la misma lectura que los torneos, pero no guarda nada en la web.</p>
        </div>
      </div>

      <div className="gg-statslab__top">
        <section className="gg-admin-card gg-statslab__upload">
          <h3>Nueva prueba</h3>
          <label
            className={`gg-statslab__drop${preview ? ' has-image' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
          >
            {preview ? <img src={preview} alt="Captura seleccionada" /> : <span>{Icon.upload}<b>Arrastra, elige o pega (Ctrl+V) una captura</b><small>PNG, JPG o WebP · máx. 5 MB</small></span>}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { pick(e.target.files[0]); e.target.value = '' }} />
          </label>
          <div className="gg-statslab__names">
            <label>Equipo de arriba / izquierda<input value={teamA} onChange={e => setTeamA(e.target.value)} placeholder="Equipo A" maxLength={60} /></label>
            <label>Equipo de abajo / derecha<input value={teamB} onChange={e => setTeamB(e.target.value)} placeholder="Equipo B" maxLength={60} /></label>
          </div>
          {error && <p className="gg-statslab__error" role="alert">{error}</p>}
          <Button type="button" disabled={!file || busy} onClick={read}>{busy ? 'Leyendo con IA…' : 'Leer con IA'}</Button>
          <p className="gg-statslab__hint">La captura se envía a Google (Gemini) para leerla. Límite: unas 4 lecturas por minuto.</p>
        </section>

        <section className="gg-admin-card gg-statslab__history">
          <div className="gg-admin-card__heading">
            <h3 style={{ margin: 0 }}>Pruebas ({history.length})</h3>
            {history.length > 0 && <Button size="sm" variant="ghost" type="button" onClick={() => { if (window.confirm('¿Borrar todas las pruebas de este navegador?')) { setHistory([]); setCurrentId('') } }}>Borrar todo</Button>}
          </div>
          {rated.length > 0 && (
            <div className="gg-statslab__accuracy">
              <span className="is-ok"><b>{score('ok')}</b> acertó todo</span>
              <span className="is-minor"><b>{score('minor')}</b> errores menores</span>
              <span className="is-bad"><b>{score('bad')}</b> falló</span>
            </div>
          )}
          {history.length === 0 ? <p className="gg-statslab__hint">Todavía no hay pruebas. Se guardan solo en este navegador.</p> : (
            <ul>
              {history.map(e => (
                <li key={e.id} className={e.id === currentId ? 'active' : ''}>
                  <button type="button" onClick={() => setCurrentId(e.id)}>
                    <b>{e.teamA} {fmt(e.raw?.scoreA)} – {fmt(e.raw?.scoreB)} {e.teamB}</b>
                    <small>{fmtDate(e.at)} · {e.fileName}{e.verdict && ` · ${VERDICTS.find(v => v.id === e.verdict)?.label}`}</small>
                  </button>
                  <button type="button" className="gg-statslab__del" aria-label="Borrar prueba" onClick={() => remove(e.id)}>{Icon.trash}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {current && <Result key={current.id} entry={current} onVerdict={v => patch(current.id, { verdict: v })} onNote={note => patch(current.id, { note })} />}
      <Accumulated history={history} />
    </div>
  )
}


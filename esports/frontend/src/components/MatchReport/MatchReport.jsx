// Reporte de resultado del capitán (POST /tournaments/:id/bracket/matches/:matchId/report).
// Cada capitán manda su marcador + una captura; si los dos coinciden la
// organización lo publica con un clic, si no queda en disputa con ambas
// capturas a la vista. El bracket solo cambia cuando la organización confirma.
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import { tournamentsApi, uploadsApi } from '../../lib/serverApi.js'
import { seriesTarget } from '../../lib/bracketStore.js'
import DiscordReports, { discordReportState } from './DiscordReports.jsx'
import './MatchReport.css'

const STATUS = {
  none: { tone: 'muted', text: 'Sin reportes todavía' },
  waiting_rival: { tone: 'warn', text: 'Esperando el reporte del rival' },
  agreed: { tone: 'ok', text: 'Ambos coinciden: falta que la organización lo publique' },
  disputed: { tone: 'bad', text: 'En disputa: los marcadores no coinciden' },
}

export default function MatchReport({ tournamentId, matchId }) {
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState(null) // null | 'forbidden' | 'hidden' | 'error'
  const [form, setForm] = useState({ mine: '', theirs: '', evidenceUrl: '', note: '' })
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const fill = (data) => {
    const own = data.mySide && data[data.mySide]
    if (own) {
      const mine = data.mySide === 'A' ? own.scoreA : own.scoreB
      const theirs = data.mySide === 'A' ? own.scoreB : own.scoreA
      setForm({ mine: String(mine), theirs: String(theirs), evidenceUrl: own.evidenceUrl, note: own.note || '' })
    }
  }

  useEffect(() => {
    let alive = true
    setState(null); setLoadError(null); setEditing(false)
    tournamentsApi.getMatchReport(tournamentId, matchId)
      .then(data => { if (alive) { setState(data); fill(data) } })
      .catch(err => {
        if (!alive) return
        setLoadError(err.status === 403 ? 'forbidden' : err.status === 409 || err.status === 404 ? 'hidden' : 'error')
      })
    return () => { alive = false }
  }, [tournamentId, matchId])

  if (loadError === 'hidden') return null
  if (loadError === 'forbidden') {
    return <p className="mrp-note">{Icon.alert} El capitán de tu equipo reporta el resultado de esta partida.</p>
  }
  if (loadError === 'error') return <p className="mrp-note mrp-note--bad">{Icon.alert} No se pudo cargar el reporte de resultado.</p>
  if (!state) return null

  const { match, mySide } = state
  const myName = mySide === 'A' ? match.a : match.b
  const rivalName = mySide === 'A' ? match.b : match.a
  const own = mySide ? state[mySide] : null
  const rival = mySide ? state[mySide === 'A' ? 'B' : 'A'] : null
  // Sin reportes web, el estado sale de los /report de Discord.
  const discordState = discordReportState(state.discord?.A, state.discord?.B)
  const status = STATUS[state.status === 'none' ? discordState : state.status] || STATUS.none
  const { win: target, max: maxGames } = seriesTarget(match.series)
  const showForm = state.canReport && (!own || editing)

  const scoreText = (r) => r ? (mySide === 'A' ? `${r.scoreA} - ${r.scoreB}` : `${r.scoreB} - ${r.scoreA}`) : '—'

  const onFile = async (file) => {
    if (!file || uploading) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Usa una captura JPG, PNG o WebP de hasta 5 MB.')
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadsApi.upload(file)
      if (!uploaded.url) throw new Error('No se recibió la URL de la captura.')
      setForm(f => ({ ...f, evidenceUrl: uploaded.url }))
    } catch (err) {
      setError(err.message || 'No se pudo subir la captura. Vuelve a intentarlo.')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await tournamentsApi.submitMatchReport(tournamentId, matchId, {
        scoreFor: Number(form.mine), scoreAgainst: Number(form.theirs), evidenceUrl: form.evidenceUrl, note: form.note,
      })
      setState(s => ({ ...s, status: res.status, A: res.A, B: res.B }))
      setEditing(false)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el reporte.')
    } finally {
      setSaving(false)
    }
  }

  const ready = form.mine !== '' && form.theirs !== '' && form.evidenceUrl && !uploading && !saving

  return (
    <div className="mrp">
      <div className="mrp-head">
        <span className="mrp-title">{Icon.edit} Reporte de resultado · {match.series}</span>
        {state.confirmed
          ? <span className="mrp-chip mrp-chip--ok">{Icon.check} Confirmado por la organización</span>
          : <span className={`mrp-chip mrp-chip--${status.tone}`}>{status.text}</span>}
      </div>

      {(own || rival) && (
        <div className="mrp-sides">
          {[{ label: `Tu reporte · ${myName}`, r: own }, { label: `Reporte de ${rivalName}`, r: rival }].map(({ label, r }) => (
            <div className="mrp-side" key={label}>
              <span>{label}</span>
              <b>{scoreText(r)}</b>
              {r?.evidenceUrl
                ? <a href={r.evidenceUrl} target="_blank" rel="noreferrer">{Icon.camera} Ver captura</a>
                : <em>{r ? '' : 'Sin reportar'}</em>}
            </div>
          ))}
        </div>
      )}

      {(state.discord?.A?.length > 0 || state.discord?.B?.length > 0) && (
        <div className="mrp-discord">
          <span className="mrp-sub">{Icon.discord} Reportes por Discord (/report)</span>
          <DiscordReports a={match.a} b={match.b} A={state.discord.A} B={state.discord.B} mySide={mySide} cases={state.cases}
            onAppeal={() => tournamentsApi.getMatchReport(tournamentId, matchId).then(setState).catch(() => {})} />
        </div>
      )}

      {!state.confirmed && !state.canReport && (
        <p className="mrp-note">{Icon.clock} El reporte se habilita cuando la organización inicie el torneo.</p>
      )}

      {state.canReport && own && !editing && (
        <button type="button" className="tmu-btn" onClick={() => setEditing(true)}>{Icon.edit} Corregir mi reporte</button>
      )}

      {showForm && (
        <form className="mrp-form" onSubmit={submit}>
          <div className="mrp-scores">
            <label>{myName}<input type="number" min="0" max={target} value={form.mine} onChange={e => setForm(f => ({ ...f, mine: e.target.value }))} /></label>
            <span className="mrp-vs">VS</span>
            <label>{rivalName}<input type="number" min="0" max={target} value={form.theirs} onChange={e => setForm(f => ({ ...f, theirs: e.target.value }))} /></label>
          </div>
          <p className="mrp-hint">Serie {match.series} · el ganador llega a {target} (máximo {maxGames} {maxGames === 1 ? 'partida' : 'partidas'})</p>

          <button type="button" className={`mrp-drop ${form.evidenceUrl ? 'has-img' : ''}`} disabled={uploading}
            style={form.evidenceUrl ? { backgroundImage: `url(${form.evidenceUrl})` } : undefined}
            onClick={() => fileRef.current?.click()}>
            {!form.evidenceUrl && <>{Icon.camera}<span>{uploading ? 'Subiendo captura…' : 'Subir captura del resultado'}</span></>}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />

          <textarea rows={2} maxLength={500} placeholder="Comentario para la organización (opcional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />

          {error && <p className="mrp-note mrp-note--bad" role="alert">{Icon.alert} {error}</p>}
          <div className="mrp-actions">
            {editing && <button type="button" className="tmu-btn" onClick={() => { setEditing(false); fill(state) }}>Cancelar</button>}
            <button type="submit" className="tmu-btn tmu-btn--primary" disabled={!ready}>{Icon.send} {saving ? 'Enviando…' : own ? 'Guardar corrección' : 'Enviar reporte'}</button>
          </div>
        </form>
      )}
    </div>
  )
}


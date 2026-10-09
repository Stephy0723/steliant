import { useCallback, useEffect, useMemo, useState } from 'react'
import { matchStatsApi } from '../../lib/matchStatsApi.js'
import { uploadsApi } from '../../lib/serverApi.js'
import { STAT_FIELDS, emptyStats, validateStats, compareStats } from '../../../../shared/matchStats.mjs'
import { MATCH_STATS_LIMITS } from '../../../../shared/matchStatsContract.mjs'
import { reportScreenshotLabel } from '../../../../shared/reportScreenshots.mjs'
import './MatchStats.css'

export default function MatchStats({ tournamentId, matchId, series = 'BO1', initialGameNumber = 1 }) {
  const [gameNumber, setGameNumber] = useState(Math.max(1, Math.min(MATCH_STATS_LIMITS.games, Number(initialGameNumber) || 1)))
  const [locked, setLocked] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const receiveContext = useCallback(c => setMetadata({ series: c.match?.series, a: c.match?.a, b: c.match?.b, title: c.tournament?.title }), [])
  const max = Math.min(MATCH_STATS_LIMITS.games, Number(String(metadata?.series || series).replace(/\D/g, '')) || 1)
  return <section className="match-stats">
    <h3>Estadísticas de Mobile Legends</h3>
    {metadata?.a && <p><b>{metadata.title} · {metadata.a} vs {metadata.b}</b></p>}
    <p>Una ficha por partida jugada. El marcador de kills no cambia el resultado de la serie.</p>
    <label>Partida de la serie <select disabled={locked} value={gameNumber} onChange={e => setGameNumber(Number(e.target.value))}>
      {Array.from({ length: max }, (_, i) => <option key={i} value={i + 1}>Partida {i + 1}</option>)}
    </select></label>
    <StatsEditor key={`${tournamentId}-${matchId}-${gameNumber}`} tournamentId={tournamentId} matchId={matchId} gameNumber={gameNumber} onLock={setLocked} onContext={receiveContext} />
  </section>
}

function StatsEditor({ tournamentId, matchId, gameNumber, onLock, onContext }) {
  const client = useMemo(() => matchStatsApi(tournamentId, matchId, gameNumber), [tournamentId, matchId, gameNumber])
  const [context, setContext] = useState(null), [data, setData] = useState(emptyStats())
  const [source, setSource] = useState(''), [evidenceUrls, setEvidenceUrls] = useState([])
  const [selectedImage, setSelectedImage] = useState(''), [firstSideTeamId, setFirstSideTeamId] = useState('')
  const [consent, setConsent] = useState(false), [reviewed, setReviewed] = useState(false)
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => { onLock(dirty || busy) }, [dirty, busy, onLock])
  const ownSource = c => c.access.organizer ? 'organizer' : c.access.captainTeams[0]
  function selectSubmission(c, key) {
    const submission = c.draft?.submissions.find(s => s.source === key)
    setSource(key); setData(submission?.data || emptyStats(c.roster))
    setEvidenceUrls(submission?.evidenceUrls || []); setSelectedImage(submission?.evidenceUrls?.[0] || '')
    setReviewed(false); setConsent(false); setReason(''); setDirty(false)
  }
  function acceptContext(c) {
    setContext(c)
    onContext(c)
    const selected = c.draft?.confirmation?.source || c.draft?.submissions.find(s => s.source === ownSource(c))?.source || c.draft?.submissions[0]?.source || ownSource(c)
    selectSubmission(c, selected)
  }
  useEffect(() => {
    let alive = true
    client.get().then(c => { if (alive) acceptContext(c) }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [client])
  useEffect(() => {
    if (!dirty && !busy) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy])
  const confirmed = context?.draft?.status === 'confirmed'
  const editable = context && !confirmed && source === ownSource(context) && !busy
  const validation = context ? validateStats(data, context.roster, context.teams.map(t => t.id)) : { errors: [], warnings: [] }
  const conflicts = context?.draft?.submissions.filter(s => s.source !== source).flatMap(s => compareStats(data, s.data)) || []
  const canConfirm = context && (context.access.organizer || (source !== 'organizer' && !context.access.captainTeams.includes(source) && context.access.captainTeams.some(id => id !== source) && context.draft?.submissions.find(s => s.source === source)?.authorId !== context.access.userId))
  const touch = next => { setData(next); setDirty(true); setReviewed(false); setNotice('') }
  const patchPlayer = (index, patch) => touch({ ...data, players: data.players.map((p, i) => i === index ? { ...p, ...patch } : p) })
  async function run(action) {
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e.message || 'No se pudo completar la acción.') } finally { setBusy(false) }
  }
  const reload = () => run(async () => { acceptContext(await client.get()); setNotice('Borrador actualizado desde el servidor.') })
  const save = () => run(async () => {
    const result = await client.save({ source, data, evidenceUrls, revision: context.draft?.revision || 0 })
    setContext(c => ({ ...c, draft: result.draft })); setData(result.data); setDirty(false); setReviewed(false)
    setNotice('Borrador guardado. Falta la confirmación del rival o del organizador.')
  })
  const confirm = () => run(async () => {
    const result = await client.confirm({ source, revision: context.draft.revision, reviewed, reason })
    setContext(c => ({ ...c, draft: result.draft })); setNotice('Estadísticas confirmadas y guardadas en el historial de los diez jugadores.')
  })
  const extract = () => run(async () => {
    const result = await client.extract({ evidenceUrl: selectedImage, firstSideTeamId, consent })
    touch(result.data)
    setNotice('Lectura lista. Revisa nombres, ganador y cifras antes de guardar. Los campos vacíos no se inventan.')
  })
  const upload = file => run(async () => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MATCH_STATS_LIMITS.imageBytes) throw new Error('Usa PNG, JPG o WebP de hasta 5 MB.')
    if (evidenceUrls.length >= MATCH_STATS_LIMITS.images) throw new Error('Máximo cuatro capturas por reporte.')
    const result = await uploadsApi.upload(file)
    setEvidenceUrls(urls => [...urls, result.url]); setSelectedImage(result.url); setConsent(false); setDirty(true); setReviewed(false)
  })
  return <>
    {error && <p className="match-stats__error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!context ? <button type="button" disabled={busy} onClick={reload}>Reintentar carga</button> : <>
      {!context.rosterReady && <p className="match-stats__warning">Faltan titulares vinculados en el roster congelado. El organizador debe revisar las inscripciones antes de registrar estadísticas.</p>}
      <div className="match-stats__actions">
        <label>Reporte <select disabled={busy || dirty || confirmed} value={source} onChange={e => selectSubmission(context, e.target.value)}>
          {[...new Set([ownSource(context), ...(context.draft?.submissions || []).map(s => s.source)])].map(s => <option key={s} value={s}>{s === 'organizer' ? 'Organizador' : context.teams.find(t => t.id === s)?.name}</option>)}
        </select></label>
        <button type="button" disabled={busy} onClick={reload}>Recargar / descartar cambios</button>
        {!confirmed && source !== ownSource(context) && <button type="button" disabled={busy} onClick={() => { setSource(ownSource(context)); setDirty(true); setReviewed(false) }}>Copiar a mi borrador para corregir</button>}
      </div>
      {confirmed && <p role="status">Confirmado {{ organizer: 'por el organizador', opponent: 'por el capitán rival', system: 'automáticamente: las capturas de los dos equipos coinciden', arbiter: 'por el árbitro' }[context.draft.confirmation.role] || ''}. {context.draft.historyWrittenAt ? 'Historial guardado.' : 'El guardado del historial quedó pendiente y se reintentará automáticamente.'}</p>}
      {context.draft?.revisions?.length > 0 && <details className="match-stats__audit"><summary>Historial de revisiones ({context.draft.revisions.length})</summary>
        <ol>{context.draft.revisions.map(r => <li key={r.revision}>Versión {r.revision} · {r.source === 'organizer' ? 'Organizador' : context.teams.find(t => t.id === r.source)?.name} · {new Date(r.at).toLocaleString()} · {r.evidenceUrls.length} captura(s)</li>)}</ol>
        {confirmed && <p>Confirmada la versión {context.draft.confirmation.revision} el {new Date(context.draft.confirmation.at).toLocaleString()}.{context.draft.confirmation.reason && ` Motivo: ${context.draft.confirmation.reason}`}</p>}
      </details>}
      {confirmed && !context.draft.historyWrittenAt && context.draft.confirmation.userId === context.access.userId && <button type="button" disabled={busy} onClick={confirm}>Reintentar guardado del historial</button>}
      <div className="match-stats__images">
        {evidenceUrls.map(url => <div key={url}>
          <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Captura de estadísticas" /></a>
          <label><input type="radio" name={`evidence-${matchId}-${gameNumber}`} checked={selectedImage === url} onChange={() => { setSelectedImage(url); setConsent(false) }} /> Leer esta captura</label>
          {editable && <button type="button" onClick={() => { setEvidenceUrls(evidenceUrls.filter(u => u !== url)); if (selectedImage === url) setSelectedImage(''); setDirty(true); setReviewed(false) }}>Quitar</button>}
        </div>)}
      </div>
      {!confirmed && <>
        <label>Subir captura <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editable || evidenceUrls.length >= 4} onChange={e => { upload(e.target.files[0]); e.target.value = '' }} /></label>
        {context.discordEvidence.length > 0 && <label>Usar evidencia de /report <select value="" disabled={!editable || evidenceUrls.length >= 4} onChange={e => {
          const url = e.target.value
          if (url) run(async () => {
            const imported = await client.importEvidence(url)
            setEvidenceUrls([...evidenceUrls, imported.url]); setSelectedImage(imported.url); setConsent(false); setDirty(true); setReviewed(false)
          })
        }}><option value="">Seleccionar captura (verifica fecha y partida)</option>{context.discordEvidence.map(e => <option key={e.id} value={e.url}>{context.teams.find(t => t.id === e.teamId)?.name}{e.gameNumber ? ` · Partida ${e.gameNumber}` : ''} · {e.key ? reportScreenshotLabel(e.key) : e.name} · {new Date(e.date).toLocaleString()}</option>)}</select></label>}
        <div className="match-stats__ai">
          {context.capabilities?.vision === false && <p role="status">La lectura automática no está disponible. Puedes completar y guardar los datos manualmente.</p>}
          <label>Equipo que aparece arriba o a la izquierda de la captura <select value={firstSideTeamId} disabled={!editable} onChange={e => setFirstSideTeamId(e.target.value)}><option value="">Seleccionar</option>{context.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label><input type="checkbox" checked={consent} disabled={!editable} onChange={e => setConsent(e.target.checked)} /> Acepto enviar esta captura, incluidos los nicks, a Google para leerla. En el servicio gratuito Google puede usar el contenido para mejorar sus productos. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Condiciones</a></label>
          <button type="button" disabled={!editable || context.capabilities?.vision === false || !context.rosterReady || !selectedImage || !firstSideTeamId || !consent} onClick={extract}>Leer / reintentar con Gemini</button>
          <p>La lectura reemplaza los datos de este borrador sin guardar. También puedes completar todo a mano. Esta lectura manual no confirma nada: solo la lectura automática de /report confirma sola, y únicamente cuando las capturas de los dos equipos coinciden.</p>
        </div>
      </>}
      <div className="match-stats__actions">
        <label>Ganador de esta partida <select value={data.winnerTeamId} disabled={!editable} onChange={e => touch({ ...data, winnerTeamId: e.target.value })}><option value="">Por revisar</option>{context.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {context.teams.map((t, i) => { const key = i === 0 ? 'scoreA' : 'scoreB'; return <label key={t.id}>Kills de {t.name}<input type="number" min="0" step="1" value={data[key] ?? ''} disabled={!editable} onChange={e => touch({ ...data, [key]: e.target.value === '' ? null : Number(e.target.value) })} /></label> })}
      </div>
      <p>Vacío = no visible / desconocido. Cero = cero comprobado. Daños y oro se introducen como cantidades; participación como porcentaje.</p>
      <div className="match-stats__table"><table><thead><tr><th>Nombre leído / titular</th><th>Héroe</th>{Object.entries(STAT_FIELDS).map(([k, label]) => <th key={k}>{label}</th>)}<th>MVP</th></tr></thead><tbody>
        {data.players.map((p, index) => <tr key={index} className={!p.playerId || p.uncertain?.length ? 'match-stats__uncertain' : ''}>
          <td><input aria-label={`Nombre leído fila ${index + 1}`} value={p.rawName} disabled={!editable} onChange={e => patchPlayer(index, { rawName: e.target.value })} />
            <select aria-label={`Titular fila ${index + 1}`} value={p.playerId} disabled={!editable} onChange={e => { const player = context.roster.find(r => r.playerId === e.target.value); patchPlayer(index, { playerId: player?.playerId || '', teamId: player?.teamId || '', uncertain: (p.uncertain || []).filter(k => k !== 'rawName') }) }}>
              <option value="">Nombre por resolver</option>{context.roster.map(r => <option key={r.playerId} value={r.playerId}>{context.teams.find(t => t.id === r.teamId)?.name} · {r.nick}</option>)}
            </select></td>
          <td><input aria-label={`Héroe fila ${index + 1}`} value={p.character || ''} disabled={!editable} onChange={e => patchPlayer(index, { character: e.target.value })} /></td>
          {Object.entries(STAT_FIELDS).map(([k, label]) => <td key={k} className={p.uncertain?.includes(k) ? 'match-stats__uncertain' : ''}><input aria-label={`${label} fila ${index + 1}`} type="number" min="0" max={k === 'teamfightParticipation' ? 100 : 100000000} step={k === 'teamfightParticipation' ? 'any' : 1} value={p[k] ?? ''} disabled={!editable} onChange={e => patchPlayer(index, { [k]: e.target.value === '' ? null : Number(e.target.value), uncertain: (p.uncertain || []).filter(f => f !== k) })} /></td>)}
          <td><select aria-label={`MVP fila ${index + 1}`} disabled={!editable} value={p.mvp == null ? '' : String(p.mvp)} onChange={e => patchPlayer(index, { mvp: e.target.value === '' ? null : e.target.value === 'true' })}><option value="">?</option><option value="true">Sí</option><option value="false">No</option></select></td>
        </tr>)}
      </tbody></table></div>
      {editable && data.players.length !== 10 && <button type="button" onClick={() => {
        const missing = emptyStats(context.roster).players.filter(p => !data.players.some(r => r.playerId === p.playerId))
        touch({ ...data, players: [...data.players, ...missing].slice(0, 10) })
      }}>Completar filas faltantes con el roster</button>}
      {[...validation.errors, ...validation.warnings].length > 0 && <ul className="match-stats__warning">{[...validation.errors, ...validation.warnings].map((w, i) => <li key={i}>{w}</li>)}</ul>}
      {conflicts.length > 0 && <div className="match-stats__warning"><b>Los reportes discrepan:</b><p>{[...new Set(conflicts)].join(' · ')}</p><p>Solo el organizador puede resolver esta diferencia.</p></div>}
      {!confirmed && <>
        {context.access.organizer && conflicts.length > 0 && <label>Motivo de resolución<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} /></label>}
        <label><input type="checkbox" checked={reviewed} disabled={busy || dirty || !canConfirm} onChange={e => setReviewed(e.target.checked)} /> Revisé las capturas, los diez titulares, el ganador y las cifras. Los campos vacíos quedan como desconocidos.</label>
        <div className="match-stats__actions">
          <button type="button" disabled={!editable || !context.rosterReady} onClick={save}>Guardar borrador para revisión</button>
          <button type="button" disabled={busy || dirty || !reviewed || !canConfirm || !context.draft || validation.errors.length > 0 || (conflicts.length > 0 && (!context.access.organizer || reason.trim().length < 10))} onClick={confirm}>Confirmar y guardar estadísticas</button>
        </div>
        {dirty && <p>Hay cambios sin guardar. Guarda el borrador antes de confirmarlo.</p>}
      </>}
      {busy && <p role="status">Procesando…</p>}
    </>}
  </>
}


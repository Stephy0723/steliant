import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icons.jsx'
import CompetitionFields from '../../TorneoCrear/CompetitionFields.jsx'
import { getBracket, pullBracket } from '../../../lib/bracketStore.js'
import { tournamentsApi } from '../../../lib/serverApi.js'
import { bracketLock, changeNoticeText, competitionChanges } from '../../../lib/competitionChanges.js'
import {
  COMPETITION_SYSTEMS, SYSTEM_TO_FORMAT, competitionPhases, normalizeCompetition, validateCompetition,
} from '../../../../../shared/tournamentSetup.mjs'
import '../../TorneoCrear/TorneoCrear.css'
import './TabCompetencia.css'

const PHASE_SYSTEM = Object.fromEntries(Object.entries(COMPETITION_SYSTEMS).map(([k, v]) => [k, v.label]))
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Estructura competitiva editable despues de publicar. Todo cambio pasa por
// "Revisar y confirmar": se muestra que cambia y se manda con `changeNotice`
// para que el servidor avise a equipos inscritos y staff (notificacion, panel
// del equipo y Discord del torneo). Ver BACKEND-PENDIENTE #competencia-aviso-cambios.
// Candados (decision 1/oct): con el bracket generado, sistema/cupos/grupos/
// puntuacion quedan fijos; la serie de una ronda ya jugada tampoco se toca.
export default function TabCompetencia({ t, onSave }) {
  const savedSlots = t.capacity || 2
  const savedComp = useMemo(() => normalizeCompetition(t.competition || {}, savedSlots), [t.competition, savedSlots])
  const [draft, setDraft] = useState(savedComp)
  const [slots, setSlots] = useState(savedSlots)
  useEffect(() => { setDraft(savedComp); setSlots(savedSlots) }, [savedComp, savedSlots])

  // Mismo id que usa la pestaña Bracket para su cache (bracketStore).
  const [bracket, setBracket] = useState(() => getBracket(t.id))
  const [bracketState, setBracketState] = useState('loading') // loading | ready | error
  useEffect(() => {
    let alive = true
    setBracketState('loading')
    pullBracket(t.id).then(ok => {
      if (!alive) return
      setBracket(getBracket(t.id))
      setBracketState(ok ? 'ready' : 'error')
    })
    return () => { alive = false }
  }, [t.id])

  const finished = ['finished', 'cancelled'].includes(t.status)
  const lock = useMemo(() => bracketLock(bracket, savedComp, savedSlots), [bracket, savedComp, savedSlots])
  // Sin saber como esta el bracket, lo prudente es no dejar tocar la estructura.
  const structureLocked = finished || bracketState !== 'ready' || lock.generated
  const lockedRounds = lock.playedRounds

  const slotsNum = Math.round(Number(slots))
  const next = useMemo(() => normalizeCompetition(draft, slotsNum), [draft, slotsNum])
  const activeTeams = (t.registrations || []).filter(r => r.status !== 'withdrawn').length
  const acceptedStaff = (t.staffMembers || []).filter(m => m.status === 'accepted').length
  const errors = useMemo(() => {
    const e = validateCompetition(draft, slotsNum)
    if (!e.maxSlots && slotsNum < activeTeams) e.maxSlots = `Ya hay ${plural(activeTeams, 'equipo inscrito', 'equipos inscritos')}: los cupos no pueden ser menos.`
    return e
  }, [draft, slotsNum, activeTeams])
  const hasErrors = Object.keys(errors).length > 0
  const changes = useMemo(() => competitionChanges(savedComp, next, savedSlots, slotsNum), [savedComp, next, savedSlots, slotsNum])
  const dirty = changes.length > 0

  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [outcome, setOutcome] = useState(null) // { sent, recipients, discord }
  const notice = changeNoticeText(t.title, changes, note.trim())

  const discard = () => { setDraft(savedComp); setSlots(savedSlots); setOutcome(null) }

  const confirmSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        competition: next,
        changeNotice: {
          section: 'competencia',
          sectionLabel: 'Competencia',
          title: notice.title,
          message: note.trim(),
          changes,
        },
      }
      if (slotsNum !== savedSlots) payload.maxSlots = slotsNum
      if (next.system !== savedComp.system) payload.format = SYSTEM_TO_FORMAT[next.system]
      const saved = await onSave(payload)
      // El servidor confirma el envio en `changeNotice`; si no lo devuelve, el
      // cambio quedo guardado pero nadie fue avisado todavia.
      const result = saved?.changeNotice
      setOutcome(result ? { sent: true, recipients: Number(result.recipients) || 0, discord: result.discord } : { sent: false })
      setConfirming(false)
      setNote('')
    } catch (err) {
      setSaveError(err.message || 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  // Regenerar = el bracket vuelve a borrador (sin publicar, sin resultados).
  // Solo mientras no haya ningun resultado confirmado: con partidas jugadas
  // se perderian resultados que ya generaron avisos y estadisticas.
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenBusy, setRegenBusy] = useState(false)
  const [regenError, setRegenError] = useState('')
  const regenerate = async () => {
    setRegenBusy(true)
    setRegenError('')
    try {
      await tournamentsApi.saveBracket(t.id, { published: false, status: 'idle', results: {}, format: '' })
      const ok = await pullBracket(t.id)
      setBracket(getBracket(t.id))
      setBracketState(ok ? 'ready' : 'error')
      setRegenOpen(false)
    } catch (err) {
      setRegenError(err.message || 'No se pudo regenerar el bracket.')
    } finally {
      setRegenBusy(false)
    }
  }

  const phases = competitionPhases(next, slotsNum >= 2 ? slotsNum : 2)
  const seriesOf = key => next.seriesByRound?.[key] || next.defaultSeries
  const ms = t.matchSchedule
  const manageBase = `/organizador/torneo/${t.dbId || t.id}/gestionar`

  return (
    <div className={`otm-panel otm-comp${dirty && !finished ? ' is-dirty' : ''}`}>
      <div className="otm-panel__head">
        <div>
          <h2>Competencia</h2>
          <p className="otm-muted">Sistema, cupos, series por ronda y puntuacion. Es lo mismo que definiste en el asistente al crear el torneo.</p>
        </div>
      </div>

      <div className="otm-comp__notice" role="note">
        {Icon.alert}
        <div>
          <b>Todo cambio que guardes y confirmes se notificará a los jugadores y al staff del torneo.</b>
          <span>Les llega un comunicado en el panel de su equipo y en el Discord del torneo con lo que cambió (por ejemplo: "Semifinal: BO1 → BO3").</span>
        </div>
      </div>

      <LockBanner
        finished={finished}
        bracketState={bracketState}
        lock={lock}
        onRegenerate={() => { setRegenError(''); setRegenOpen(true) }}
      />

      {outcome && !dirty && (
        <div className={`otm-comp__outcome${outcome.sent ? ' is-sent' : ''}`} role="status">
          {outcome.sent ? Icon.check : Icon.alert}
          <span>
            {outcome.sent
              ? `Cambios guardados. Aviso enviado a ${plural(outcome.recipients, 'persona', 'personas')}${outcome.discord === 'posted' ? ' y publicado en el Discord del torneo' : ''}.`
              : 'Cambios guardados. El comunicado a jugadores y staff todavía no se envía: esa parte del servidor está pendiente.'}
          </span>
        </div>
      )}

      <section className="otm-section">
        <h3>Así se juega</h3>
        <ol className="otm-comp__phases">
          {phases.map((phase, i) => (
            <li className="otm-comp__phase" key={phase.id}>
              <div className="otm-comp__phase-head">
                <span className="otm-comp__phase-step">{i + 1}</span>
                <b>{phase.name}</b>
                <span className="otm-muted">
                  {PHASE_SYSTEM[phase.system] || phase.system}
                  {phase.groups > 1 ? ` · ${phase.groups} grupos · pasan ${phase.advancePerGroup} por grupo` : ''}
                </span>
              </div>
              <div className="otm-comp__rounds">
                {phase.rounds.map(round => {
                  const played = lockedRounds.has(round.key)
                  return (
                    <span className={`otm-comp__round${played ? ' is-played' : ''}`} key={round.key} title={played ? 'Ronda jugada' : undefined}>
                      {played && Icon.check}
                      {round.label}
                      <em>{seriesOf(round.key)}</em>
                    </span>
                  )
                })}
              </div>
            </li>
          ))}
        </ol>
        <p className="otm-muted otm-comp__pace">
          {Icon.clock}{' '}
          {ms
            ? `Cada partida ~${ms.durationMins} min + ${ms.breakMins} min de descanso; aviso ${ms.reminderMins} min antes.`
            : 'Sin ritmo de partidas configurado.'}{' '}
          <Link to={`${manageBase}/checkin`}>Se edita en Check-in</Link>
        </p>
      </section>

      <section className="otm-section">
        <h3>Estructura</h3>
        <div className="otm-comp__form">
          <CompetitionFields
            competition={draft}
            maxSlots={slots}
            errors={errors}
            onChange={setDraft}
            onMaxSlots={setSlots}
            disabled={finished}
            lockStructure={structureLocked}
            lockedRounds={lockedRounds}
          />
        </div>
      </section>

      {dirty && !finished && (
        <div className="otm-comp__savebar" role="status">
          <span>{Icon.alert} {plural(changes.length, 'cambio sin guardar', 'cambios sin guardar')}</span>
          <div>
            <button type="button" className="otm-btn otm-btn--ghost" onClick={discard}>Descartar</button>
            <button type="button" className="otm-btn otm-btn--primary" disabled={hasErrors}
              onClick={() => { setSaveError(''); setConfirming(true) }}>
              Revisar y confirmar
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="otm-jm" onClick={() => !saving && setConfirming(false)}>
          <div className="otm-jm__card otm-comp__confirm" role="dialog" aria-modal="true" aria-labelledby="otm-comp-confirm-title" onClick={e => e.stopPropagation()}>
            <div className="otm-jm__head">
              <div>
                <span className="otm-jm__pre">CONFIRMAR CAMBIOS · COMPETENCIA</span>
                <h3 id="otm-comp-confirm-title">Esto es lo que cambia</h3>
              </div>
              <button type="button" className="otm-iconbtn" onClick={() => setConfirming(false)} disabled={saving} aria-label="Cerrar">{Icon.x}</button>
            </div>

            <ul className="otm-comp__diff">
              {changes.map(ch => (
                <li key={ch.label}>
                  <span>{ch.label}</span>
                  <div><s>{ch.before}</s>{Icon.chevronRight}<b>{ch.after}</b></div>
                </li>
              ))}
            </ul>

            <p className="otm-comp__audience">
              {Icon.bell}
              <span>
                {activeTeams || acceptedStaff
                  ? `Se avisará a ${plural(activeTeams, 'equipo inscrito', 'equipos inscritos')} y ${plural(acceptedStaff, 'persona del staff', 'personas del staff')}: notificación, panel del equipo y Discord del torneo.`
                  : 'Todavía no hay equipos inscritos ni staff confirmado: el cambio se guarda y queda registrado en Actividad.'}
              </span>
            </p>

            <div className="otm-field">
              <label htmlFor="otm-comp-note">Mensaje para los equipos (opcional)</label>
              <textarea id="otm-comp-note" rows={3} maxLength={500} value={note}
                placeholder="Ej.: Por la cantidad de inscritos pasamos a fase de grupos."
                onChange={e => setNote(e.target.value)} />
            </div>

            <details className="otm-comp__preview">
              <summary>Ver el comunicado completo</summary>
              <b>{notice.title}</b>
              <p>{notice.body}</p>
            </details>

            {saveError && <p className="otm-jm__err" role="alert">{Icon.alert} {saveError}</p>}

            <div className="otm-comp__confirm-actions">
              <button type="button" className="otm-btn otm-btn--ghost" onClick={() => setConfirming(false)} disabled={saving}>Seguir editando</button>
              <button type="button" className="otm-btn otm-btn--primary" onClick={confirmSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Confirmar y notificar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {regenOpen && (
        <div className="otm-jm" onClick={() => !regenBusy && setRegenOpen(false)}>
          <div className="otm-jm__card otm-comp__confirm" role="dialog" aria-modal="true" aria-labelledby="otm-comp-regen-title" onClick={e => e.stopPropagation()}>
            <div className="otm-jm__head">
              <div>
                <span className="otm-jm__pre">REGENERAR BRACKET</span>
                <h3 id="otm-comp-regen-title">¿Volver el bracket a borrador?</h3>
              </div>
              <button type="button" className="otm-iconbtn" onClick={() => setRegenOpen(false)} disabled={regenBusy} aria-label="Cerrar">{Icon.x}</button>
            </div>
            <ul className="otm-comp__regen-list">
              <li>El bracket deja de verse públicamente hasta que lo publiques otra vez en la pestaña <b>Bracket</b>.</li>
              <li>No hay resultados confirmados, así que no se pierde ninguna partida.</li>
              <li>Los equipos siguen inscritos y el sorteo de la ruleta se conserva.</li>
              <li>Después podrás cambiar el sistema, los cupos y los grupos aquí.</li>
            </ul>
            {regenError && <p className="otm-jm__err" role="alert">{Icon.alert} {regenError}</p>}
            <div className="otm-comp__confirm-actions">
              <button type="button" className="otm-btn otm-btn--ghost" onClick={() => setRegenOpen(false)} disabled={regenBusy}>Cancelar</button>
              <button type="button" className="otm-btn otm-btn--danger" onClick={regenerate} disabled={regenBusy}>
                {regenBusy ? 'Regenerando...' : 'Regenerar bracket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LockBanner({ finished, bracketState, lock, onRegenerate }) {
  if (finished) {
    return <div className="otm-comp__lock">{Icon.lock}<span>El torneo terminó: la estructura queda como registro y ya no se puede cambiar.</span></div>
  }
  if (bracketState === 'loading') {
    return <div className="otm-comp__lock">{Icon.clock}<span>Comprobando el bracket guardado…</span></div>
  }
  if (bracketState === 'error') {
    return <div className="otm-comp__lock">{Icon.alert}<span>No se pudo comprobar el bracket guardado. Por seguridad, el sistema, los cupos y los grupos quedan bloqueados hasta que recargues la página.</span></div>
  }
  if (!lock.generated) return null
  if (lock.confirmedCount > 0) {
    return (
      <div className="otm-comp__lock">
        {Icon.lock}
        <span>
          Ya hay {plural(lock.confirmedCount, 'resultado confirmado', 'resultados confirmados')}: el sistema, los cupos, los grupos y la puntuación no se pueden cambiar sin perderlos.
          Sí puedes cambiar el BO de las rondas que todavía no se jugaron.
        </span>
      </div>
    )
  }
  return (
    <div className="otm-comp__lock">
      {Icon.lock}
      <span>
        El bracket ya está generado: el sistema, los cupos, los grupos y la puntuación están bloqueados. Puedes cambiar el BO de cualquier ronda.
        Para cambiar el sistema, primero regenera el bracket.
      </span>
      <button type="button" className="otm-btn otm-btn--ghost otm-btn--xs" onClick={onRegenerate}>{Icon.refresh} Regenerar bracket</button>
    </div>
  )
}


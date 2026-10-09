import { useState } from 'react'
import {
  COMPETITION_SYSTEMS, SCORING_MODELS, SERIES_OPTIONS, DEFAULT_TIEBREAKERS, TIEBREAKER_LABELS,
  competitionPhases, initialCompetition,
} from '../../../../shared/tournamentSetup.mjs'

const NEEDS_POINTS = c => COMPETITION_SYSTEMS[c.system]?.scoring === 'match_points' || c.system === 'groups_playoffs'

// Config competitiva: sistema -> fases -> rondas, cada ronda con su serie.
// El componente es controlado: recibe `competition` y `maxSlots` y emite el
// objeto completo ya modificado.
// Panel del organizador (pestaña Competencia): `lockStructure` congela sistema,
// cupos, grupos y puntuacion cuando el bracket ya existe; `lockedRounds` (Set
// de claves de ronda) congela la serie de las rondas ya jugadas.
export default function CompetitionFields({ competition, maxSlots, errors = {}, onChange, onMaxSlots, disabled, lockStructure = false, lockedRounds = null }) {
  const c = { ...initialCompetition(), ...competition }
  const structureOff = disabled || lockStructure
  const anyRoundLocked = Boolean(lockedRounds?.size)
  const [perRound, setPerRound] = useState(() => Object.keys(c.seriesByRound || {}).length > 0)
  const patch = next => onChange({ ...c, ...next })
  const patchScoring = next => onChange({ ...c, scoring: { ...c.scoring, ...next } })
  const phases = competitionPhases(c, maxSlots)

  const setRoundSeries = (key, value) => {
    const seriesByRound = { ...c.seriesByRound }
    if (!value || value === c.defaultSeries) delete seriesByRound[key]
    else seriesByRound[key] = value
    patch({ seriesByRound })
  }

  return <div className="tc-competition">
    <fieldset className="tc-field--full tc-competition__systems" disabled={structureOff}>
      <legend>Sistema competitivo *</legend>
      <div className="tc-competition__system-grid">
        {Object.entries(COMPETITION_SYSTEMS).map(([value, meta]) => (
          <label className={`tc-competition__system${c.system === value ? ' is-active' : ''}`} key={value}>
            <input type="radio" name="tc-system" value={value} checked={c.system === value}
              onChange={() => patch({ system: value, scoring: { ...c.scoring, model: COMPETITION_SYSTEMS[value].scoring === 'match_points' ? 'match_points' : 'wins' }, seriesByRound: {} })} />
            <span><b>{meta.label}</b><small>{meta.hint}</small></span>
          </label>
        ))}
      </div>
      {errors.system && <span className="tc-error" role="alert">{errors.system}</span>}
    </fieldset>

    <div className="tc-grid">
      <div className="tc-field">
        <label htmlFor="tc-maxSlots">Cupos *</label>
        <input id="tc-maxSlots" type="number" min={2} max={1024} step={1} value={maxSlots}
          aria-invalid={Boolean(errors.maxSlots)} disabled={structureOff}
          onChange={e => onMaxSlots(e.target.value)} />
        {errors.maxSlots && <span className="tc-error">{errors.maxSlots}</span>}
      </div>

      {c.system === 'round_robin' && (
        <div className="tc-field">
          <label htmlFor="tc-legs">Enfrentamientos</label>
          <select id="tc-legs" value={c.legs} disabled={structureOff} onChange={e => patch({ legs: Number(e.target.value) })}>
            <option value={1}>Solo ida</option>
            <option value={2}>Ida y vuelta</option>
          </select>
        </div>
      )}

      {c.system === 'swiss' && (
        <div className="tc-field">
          <label htmlFor="tc-swissRounds">Rondas suizas</label>
          <input id="tc-swissRounds" type="number" min={3} max={12} step={1} value={c.swissRounds}
            aria-invalid={Boolean(errors.swissRounds)} disabled={structureOff}
            onChange={e => patch({ swissRounds: Number(e.target.value) })} />
          {errors.swissRounds && <span className="tc-error">{errors.swissRounds}</span>}
        </div>
      )}

      {c.system === 'single_elim' && (
        <label className="tc-check tc-field--full"><input type="checkbox" checked={c.thirdPlace} disabled={structureOff}
          onChange={e => patch({ thirdPlace: e.target.checked })} /><span>Jugar partido por el 3er puesto</span></label>
      )}
      {c.system === 'double_elim' && (
        <label className="tc-check tc-field--full"><input type="checkbox" checked={c.grandFinalReset} disabled={structureOff}
          onChange={e => patch({ grandFinalReset: e.target.checked })} /><span>Gran final con reinicio de llave (el que viene del cuadro inferior debe ganar dos series)</span></label>
      )}

      {c.system === 'groups_playoffs' && <>
        <div className="tc-field">
          <label htmlFor="tc-groups">Grupos</label>
          <input id="tc-groups" type="number" min={1} max={32} step={1} value={c.groups}
            aria-invalid={Boolean(errors.groups)} disabled={structureOff}
            onChange={e => patch({ groups: Number(e.target.value) })} />
          {errors.groups && <span className="tc-error">{errors.groups}</span>}
        </div>
        <div className="tc-field">
          <label htmlFor="tc-advancePerGroup">Clasifican por grupo</label>
          <input id="tc-advancePerGroup" type="number" min={1} max={64} step={1} value={c.advancePerGroup}
            aria-invalid={Boolean(errors.advancePerGroup)} disabled={structureOff}
            onChange={e => patch({ advancePerGroup: Number(e.target.value) })} />
          {errors.advancePerGroup && <span className="tc-error">{errors.advancePerGroup}</span>}
        </div>
        <div className="tc-field">
          <label htmlFor="tc-groupsPhaseSystem">Sistema de la fase de grupos</label>
          <select id="tc-groupsPhaseSystem" value={c.groupsPhaseSystem} disabled={structureOff}
            onChange={e => patch({ groupsPhaseSystem: e.target.value })}>
            <option value="round_robin">Todos contra todos</option>
            <option value="swiss">Suizo</option>
          </select>
        </div>
        <div className="tc-field">
          <label htmlFor="tc-playoffsSystem">Sistema de playoffs</label>
          <select id="tc-playoffsSystem" value={c.playoffsSystem} disabled={structureOff}
            onChange={e => patch({ playoffsSystem: e.target.value })}>
            <option value="single_elim">Eliminacion simple</option>
            <option value="double_elim">Eliminacion doble</option>
          </select>
        </div>
        {c.groupsPhaseSystem === 'swiss' && (
          <div className="tc-field">
            <label htmlFor="tc-swissRounds-g">Rondas suizas por grupo</label>
            <input id="tc-swissRounds-g" type="number" min={3} max={12} step={1} value={c.swissRounds}
              aria-invalid={Boolean(errors.swissRounds)} disabled={structureOff}
              onChange={e => patch({ swissRounds: Number(e.target.value) })} />
            {errors.swissRounds && <span className="tc-error">{errors.swissRounds}</span>}
          </div>
        )}
      </>}

      <div className="tc-field">
        <label htmlFor="tc-defaultSeries">Serie por defecto</label>
        <select id="tc-defaultSeries" value={c.defaultSeries} disabled={disabled || anyRoundLocked}
          aria-invalid={Boolean(errors.defaultSeries)}
          onChange={e => patch({ defaultSeries: e.target.value })}>
          {SERIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {errors.defaultSeries && <span className="tc-error">{errors.defaultSeries}</span>}
      </div>
    </div>

    <label className="tc-check tc-field--full">
      <input type="checkbox" checked={perRound} disabled={disabled || (perRound && anyRoundLocked)} onChange={e => {
        setPerRound(e.target.checked)
        if (!e.target.checked) patch({ seriesByRound: {} })
      }} />
      <span>Personalizar la serie ronda por ronda (ej. semifinal BO3, final BO5)</span>
    </label>

    {perRound && (
      <div className="tc-competition__rounds tc-field--full">
        {phases.map(phase => (
          <div className="tc-competition__phase" key={phase.id}>
            {phases.length > 1 && <h4>{phase.name}{phase.groups > 1 ? ` · ${phase.groups} grupos` : ''}</h4>}
            <div className="tc-competition__round-grid">
              {phase.rounds.map(round => (
                <label className="tc-field" key={round.key}>
                  <span>{round.label}{lockedRounds?.has(round.key) ? ' · jugada' : ''}</span>
                  <select value={c.seriesByRound?.[round.key] || c.defaultSeries} disabled={disabled || Boolean(lockedRounds?.has(round.key))}
                    onChange={e => setRoundSeries(round.key, e.target.value)}>
                    {SERIES_OPTIONS.map(o => <option key={o} value={o}>{o}{o === c.defaultSeries ? ' (por defecto)' : ''}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ))}
        {errors.seriesByRound && <span className="tc-error" role="alert">{errors.seriesByRound}</span>}
      </div>
    )}

    {NEEDS_POINTS(c) && (
      <section className="tc-subsection tc-field--full">
        <h3>Puntuacion</h3>
        <div className="tc-grid">
          <div className="tc-field">
            <label htmlFor="tc-scoringModel">Modelo</label>
            <select id="tc-scoringModel" value={c.scoring.model} disabled={structureOff}
              onChange={e => patchScoring({ model: e.target.value })}>
              {['match_points', 'wins'].map(m => <option key={m} value={m}>{SCORING_MODELS[m]}</option>)}
            </select>
          </div>
          {c.scoring.model === 'match_points' && <>
            <div className="tc-field"><label htmlFor="tc-pw">Puntos por victoria</label>
              <input id="tc-pw" type="number" min={0} max={100} step={1} value={c.scoring.win} disabled={structureOff}
                onChange={e => patchScoring({ win: Number(e.target.value) })} /></div>
            <div className="tc-field"><label htmlFor="tc-pd">Puntos por empate</label>
              <input id="tc-pd" type="number" min={0} max={100} step={1} value={c.scoring.draw} disabled={structureOff || !c.scoring.allowDraw}
                onChange={e => patchScoring({ draw: Number(e.target.value) })} /></div>
            <div className="tc-field"><label htmlFor="tc-pl">Puntos por derrota</label>
              <input id="tc-pl" type="number" min={0} max={100} step={1} value={c.scoring.loss} disabled={structureOff}
                onChange={e => patchScoring({ loss: Number(e.target.value) })} /></div>
            <label className="tc-check tc-field--full"><input type="checkbox" checked={c.scoring.allowDraw} disabled={structureOff}
              onChange={e => patchScoring({ allowDraw: e.target.checked })} /><span>Permitir empates</span></label>
            <fieldset className="tc-field--full">
              <legend>Criterios de desempate (en orden)</legend>
              {DEFAULT_TIEBREAKERS.map(tb => (
                <label className="tc-check" key={tb}>
                  <input type="checkbox" checked={c.scoring.tiebreakers.includes(tb)} disabled={structureOff}
                    onChange={e => patchScoring({
                      tiebreakers: e.target.checked
                        ? DEFAULT_TIEBREAKERS.filter(t => c.scoring.tiebreakers.includes(t) || t === tb)
                        : c.scoring.tiebreakers.filter(t => t !== tb),
                    })} />
                  <span>{TIEBREAKER_LABELS[tb]}</span>
                </label>
              ))}
            </fieldset>
          </>}
        </div>
        {errors.scoring && <span className="tc-error" role="alert">{errors.scoring}</span>}
      </section>
    )}
  </div>
}


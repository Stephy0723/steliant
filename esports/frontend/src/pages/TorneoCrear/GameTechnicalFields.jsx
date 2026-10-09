import { useState } from 'react'
import { Icon } from '../../components/icons/Icons.jsx'
import { gameConfig, mapNames } from '../../data/tournamentGameConfig.mjs'

function CustomSelect({ id, label, value, options, onChange, error }) {
  const [custom, setCustom] = useState(false)
  const isCustom = custom || Boolean(value && !options.some(option => option.value === value))
  return <div className="tc-field">
    <label htmlFor={`tc-${id}`}>{label}</label>
    <select id={`tc-${id}`} value={isCustom ? '__custom__' : value} aria-invalid={Boolean(error)} aria-describedby={error ? `tc-${id}-error` : undefined} onChange={e => {
      setCustom(e.target.value === '__custom__')
      onChange(e.target.value === '__custom__' ? '' : e.target.value)
    }}>
      <option value="">Seleccionar</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      <option value="__custom__">Personalizado...</option>
    </select>
    {isCustom && <input id={`tc-${id}-custom`} aria-label={`${label.replace(' *', '')} personalizado`} maxLength={160} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `tc-${id}-error` : undefined} onChange={e => onChange(e.target.value)} />}
    {error && <span className="tc-error" id={`tc-${id}-error`}>{error}</span>}
  </div>
}

export function ServerField({ game, value, onChange, error }) {
  const config = gameConfig(game?.id)
  return <div className="tc-technical-field">
    <CustomSelect id="server" label={config.declaredRegions ? 'Region de la sala (declarada) *' : 'Region / servidor de juego *'} value={value} onChange={onChange} options={config.servers} error={error} />
    {config.serverSource && <a className="tc-source" href={config.serverSource} target="_blank" rel="noreferrer">Regiones del juego</a>}
  </div>
}

export function PatchField({ game, value, onChange, error }) {
  const config = gameConfig(game?.id)
  return <div className="tc-field">
    <label htmlFor="tc-patch">Parche / version del torneo</label>
    <input id="tc-patch" value={value} maxLength={160} placeholder="Version pendiente de confirmar" aria-invalid={Boolean(error)} onChange={e => onChange(e.target.value)} />
    {config.patch && <a className="tc-source" href={config.patch.source} target="_blank" rel="noreferrer">Referencia {config.patch.version} / {config.patch.verifiedAt}</a>}
  </div>
}

export function MapsField({ game, mode, value, onChange, error }) {
  const config = gameConfig(game?.id)
  const selected = mapNames(value)
  const [customName, setCustomName] = useState('')
  const [customOptions, setCustomOptions] = useState(() => selected.filter(name => !config.maps.includes(name)))
  const choices = mapNames([...config.maps, ...customOptions, ...selected].join(', '))
  const add = () => {
    setCustomOptions(previous => mapNames([...previous, customName].join(', ')))
    onChange(mapNames([...selected, ...mapNames(customName)].join(', ')).join(', '))
    setCustomName('')
  }
  return <div className="tc-map-field tc-field--full">
    {mode === 'fixed' ? <CustomSelect key="fixed" id="mapPool" label="Mapa *" value={value} onChange={onChange} options={config.maps.map(name => ({ value: name, label: name }))} error={error} /> : <>
      <fieldset className="tc-map-options" id="tc-mapPool" aria-describedby={error ? 'tc-mapPool-error' : undefined}>
        <legend>{mode === 'random' ? 'Mapas del sorteo' : 'Mapas para veto'} ({selected.length}) *</legend>
        <div className="tc-map-choices">{choices.map(name => <label className="tc-check" key={name}>
          <input type="checkbox" checked={selected.some(item => item.toLowerCase() === name.toLowerCase())} onChange={e => onChange((e.target.checked ? [...selected, name] : selected.filter(item => item.toLowerCase() !== name.toLowerCase())).join(', '))} /><span>{name}</span>
        </label>)}</div>
        <label className="tc-custom-map-label" htmlFor="tc-custom-map">Mapa personalizado</label>
        <div className="tc-map-add"><input id="tc-custom-map" maxLength={160} value={customName} aria-invalid={Boolean(error)} onChange={e => setCustomName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (customName.trim()) add() } }} />
          <button type="button" className="tc-icon-button" title="Agregar mapa" aria-label="Agregar mapa" disabled={!customName.trim()} onClick={add}>{Icon.plus}</button>
        </div>
      </fieldset>
      {error && <span className="tc-error" id="tc-mapPool-error">{error}</span>}
    </>}
    {config.mapSource && <a className="tc-source" href={config.mapSource} target="_blank" rel="noreferrer">Catalogo de mapas / rotacion por confirmar</a>}
  </div>
}


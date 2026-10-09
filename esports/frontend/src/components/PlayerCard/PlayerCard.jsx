import { useRef, useState } from 'react'
import { CosmeticFrame, CosmeticPlate } from '../Cosmetics/Cosmetics.jsx'
import './PlayerCard.css'

const B = 22
const CLIPS = {
  tlbr: `polygon(${B}px 0,100% 0,100% calc(100% - ${B}px),calc(100% - ${B}px) 100%,0 100%,0 ${B}px)`,
  br: `polygon(0 0,100% 0,100% calc(100% - ${B}px),calc(100% - ${B}px) 100%,0 100%)`,
  soft: 'inset(0 round 16px)',
  trbl: `polygon(0 0,calc(100% - ${B}px) 0,100% ${B}px,100% 100%,${B}px 100%,0 calc(100% - ${B}px))`,
  step: 'polygon(0 0,calc(100% - 34px) 0,calc(100% - 34px) 12px,100% 12px,100% 100%,34px 100%,34px calc(100% - 12px),0 calc(100% - 12px))',
  all: 'polygon(14px 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px),0 14px)',
  tr: `polygon(0 0,calc(100% - ${B}px) 0,100% ${B}px,100% 100%,0 100%)`,
  tl: `polygon(${B}px 0,100% 0,100% 100%,0 100%,0 ${B}px)`,
}

export const CARD_MODELS = [
  { id: 'punk', name: 'Bisel', accent: '#FF2E88', paper: '#08070c', clip: CLIPS.tlbr, wm: 'GANG', layout: 'rail-left' },
  { id: 'ak', name: 'Rejilla', accent: '#22FF88', paper: '#040a07', clip: CLIPS.br, wm: 'GG-01', layout: 'rail-right' },
  { id: 'goku', name: 'Halo', accent: '#38BDF8', paper: '#050b12', clip: CLIPS.soft, wm: 'GLITCH', layout: 'plate-bottom' },
  { id: 'rock', name: 'Chaflan', accent: '#8B5CF6', paper: '#08060f', clip: CLIPS.trbl, wm: 'GANG', layout: 'plate-top' },
  { id: 'neon', name: 'Escalon', accent: '#FF2E88', paper: '#0b0710', clip: CLIPS.step, wm: 'GLITCH', layout: 'rail-fill' },
  { id: 'hazard', name: 'Octagono', accent: '#FF8A00', paper: '#0a0703', clip: CLIPS.all, wm: 'DIV-A', layout: 'chip' },
  { id: 'mono', name: 'Mono', accent: '#F8FAFC', paper: '#06070b', clip: CLIPS.tr, wm: 'GG', layout: 'bar-bottom' },
  { id: 'pulse', name: 'Pulso', accent: '#A855F7', paper: '#07060e', clip: CLIPS.tl, wm: 'GANG', layout: 'eq' },
]

const MODEL_BY_ID = Object.fromEntries(CARD_MODELS.map(model => [model.id, model]))
const MODEL_ALIASES = {
  crimson: 'punk',
  split: 'ak',
  passport: 'goku',
  tactical: 'hazard',
  broadcast: 'pulse',
}

export function resolveCardModel(id) {
  return MODEL_BY_ID[id] ? id : MODEL_ALIASES[id] || 'punk'
}

function Ticks({ n = 5, col = false }) {
  return <span className={`pcm__ticks${col ? ' pcm__ticks--col' : ''}`}>{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>
}

function Eq({ n = 9 }) {
  return <span className="pcm__eq">{Array.from({ length: n }, (_, i) => <i key={i} style={{ height: 3 + ((i * 5) % 12) }} />)}</span>
}

function Chrome({ model, serial }) {
  if (model.layout === 'rail-left') return (
    <>
      <div className="pcm__rail pcm__rail--l"><Ticks n={4} col /><span className="pcm__vtext">temporada 2026 / rd</span><Ticks n={4} col /></div>
      <div className="pcm__top" style={{ paddingLeft: 36 }}><span className="pcm__wm">{model.wm}</span><span className="pcm__x">XXX</span><span className="pcm__micro">{serial}</span></div>
    </>
  )
  if (model.layout === 'rail-right') return (
    <>
      <div className="pcm__rail pcm__rail--r"><Ticks n={3} col /><span className="pcm__vtext">{model.wm}</span><span className="pcm__seal" /></div>
      <div className="pcm__top" style={{ paddingRight: 36 }}><Ticks n={6} /><span className="pcm__micro">rq 5.5*8.5cm</span><span className="pcm__code">{serial}</span></div>
    </>
  )
  if (model.layout === 'plate-bottom') return (
    <>
      <div className="pcm__top"><span className="pcm__micro">glitch gang / serie a</span><span className="pcm__hatch" /><span className="pcm__code">{serial}</span></div>
      <span className="pcm__bracket pcm__bracket--tl" /><span className="pcm__bracket pcm__bracket--tr" />
    </>
  )
  if (model.layout === 'plate-top') return (
    <>
      <div className="pcm__top"><span className="pcm__wm pcm__wm--plate">{model.wm}</span><span className="pcm__micro">glitch gang / temporada 2026</span></div>
      <span className="pcm__corner-hatch" />
    </>
  )
  if (model.layout === 'rail-fill') return (
    <>
      <div className="pcm__rail pcm__rail--l pcm__rail--fill"><span className="pcm__x">X</span><span className="pcm__vtext">glitch gang / rd</span><span className="pcm__x">X</span></div>
      <div className="pcm__top" style={{ paddingLeft: 36 }}><span className="pcm__wm">{model.wm}</span><span className="pcm__micro">{serial}</span></div>
    </>
  )
  if (model.layout === 'chip') return (
    <>
      <div className="pcm__top"><span className="pcm__chip">{model.wm}</span><span className="pcm__micro">{serial}</span><span className="pcm__seal" /></div>
      <span className="pcm__bracket pcm__bracket--tl" /><span className="pcm__bracket pcm__bracket--tr" /><span className="pcm__bracket pcm__bracket--bl" /><span className="pcm__bracket pcm__bracket--br" />
    </>
  )
  if (model.layout === 'bar-bottom') return (
    <div className="pcm__top"><span className="pcm__micro">glitchgang id</span><Ticks n={4} /><span className="pcm__code">{serial}</span></div>
  )
  return <div className="pcm__top"><span className="pcm__wm">{model.wm}</span><span className="pcm__micro">+ + +</span><span className="pcm__micro">{serial}</span></div>
}

function Strip({ model, serial, joined }) {
  if (model.layout === 'rail-left') return <div className="pcm__strip pcm__strip--solid" style={{ paddingLeft: 36 }}><span className="pcm__bar" /><span className="pcm__code">{serial}</span></div>
  if (model.layout === 'rail-right') return <div className="pcm__strip" style={{ paddingRight: 36 }}><span className="pcm__micro">alta {joined}</span><span className="pcm__bar" /></div>
  if (model.layout === 'plate-bottom') return <div className="pcm__strip pcm__strip--center"><span className="pcm__wm pcm__wm--small">{model.wm}</span><span className="pcm__hatch pcm__hatch--sm" /><span className="pcm__micro">{serial}</span></div>
  if (model.layout === 'rail-fill') return <div className="pcm__strip" style={{ paddingLeft: 36 }}><span className="pcm__chip">{serial}</span><span className="pcm__bar" /></div>
  if (model.layout === 'chip') return <div className="pcm__strip"><span className="pcm__seal" /><span className="pcm__micro">auditoria / verificado</span><span className="pcm__code">{serial}</span></div>
  if (model.layout === 'bar-bottom') return <div className="pcm__strip pcm__strip--solid pcm__strip--tall"><span className="pcm__wm">{model.wm}</span><span className="pcm__code">{serial}</span></div>
  if (model.layout === 'eq') return <div className="pcm__strip"><Eq /><span className="pcm__code">{serial}</span><span className="pcm__seal" /></div>
  return <div className="pcm__strip"><span className="pcm__code">{serial}</span><span className="pcm__micro">alta {joined}</span></div>
}

export default function PlayerCard({
  player = {},
  model = 'punk',
  // frame: marco de data/cosmetics.js (FRAMES); badge: placa (PLATES).
  frame,
  badge,
  status,
  background,
  tilt = true,
  flippable = true,
  // Tarjetas de rol profesional (RoleProfileCard): color propio, 3 datos al
  // frente en lugar de rango/rol/juego, y bloques propios en el reverso.
  accent,
  stats,
  backBlocks,
  width = 300,
  className = '',
}) {
  const selectedModel = MODEL_BY_ID[resolveCardModel(model)]
  const cardRef = useRef(null)
  const [flipped, setFlipped] = useState(false)
  const gamer = player.gamer || {}
  const serial = player.code || '-'
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const art = background?.poster || background?.image || ''
  const artStyle = art ? { backgroundImage: `url(${art})` } : background?.gradient ? { background: background.gradient } : undefined
  const inset = selectedModel.layout === 'rail-left' || selectedModel.layout === 'rail-fill'
    ? { marginLeft: 26 }
    : selectedModel.layout === 'rail-right'
      ? { marginRight: 26 }
      : undefined
  const tags = player.roles || player.tags || []

  const accentColor = accent || selectedModel.accent
  // El reverso lista "IDs especializados" al final: cada ID extra (creador,
  // organizador, interno...) alarga la tarjeta para que no quede cortado.
  const extraIds = (player.specialIds?.length || 0) + (player.internalId ? 1 : 0)
  const vars = {
    '--s': width / 300,
    '--ch': `${464 + 40 * Math.min(extraIds, 4)}px`,
    '--e': accentColor,
    '--paper': selectedModel.paper,
    '--clip': selectedModel.clip,
    '--st': status?.color || accentColor,
  }

  const move = event => {
    if (!tilt || reduceMotion || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    cardRef.current.style.setProperty('--gx', `${px * 100}%`)
    cardRef.current.style.setProperty('--gy', `${py * 100}%`)
    cardRef.current.style.transform = `rotateY(${(px - 0.5) * 18}deg) rotateX(${(0.5 - py) * 14}deg) translateZ(12px)${flipped ? ' rotateY(180deg)' : ''}`
  }

  const leave = () => {
    if (cardRef.current) cardRef.current.style.transform = flipped ? 'rotateY(180deg)' : ''
  }

  const toggle = () => {
    if (!flippable) return
    setFlipped(value => !value)
    if (cardRef.current) cardRef.current.style.transform = !flipped ? 'rotateY(180deg)' : ''
  }

  return (
    <div className={`pcm-wrap ${className}`} style={vars} onMouseMove={move} onMouseLeave={leave}>
      <div className="pcm-scale">
        <div ref={cardRef} className={`pcm${flipped ? ' flipped' : ''}`} onClick={toggle} role={flippable ? 'button' : undefined} tabIndex={flippable ? 0 : undefined}>
          <div className="pcm__face">
            <div className="pcm__edge" />
            <div className="pcm__in">
              <Chrome model={selectedModel} serial={serial} />
              <div className="pcm__win" style={inset}>
                <div className="pcm__art" style={artStyle} />
                <div className="pcm__winline" />
                <div className="pcm__id">
                  <div className="pcm__av">
                    {frame && frame.id !== 'none'
                      ? <CosmeticFrame id={frame.id} avatar={player.avatar} size={66} className="pcm__fx" />
                      : player.avatar ? <img src={player.avatar} alt="" /> : <span data-no-translate>{(player.nick || player.name || '?').slice(0, 1)}</span>}
                    {status && <i className="pcm__dot" />}
                  </div>
                  <h3 className="pcm__nick" data-no-translate>{player.nick || player.name || 'Jugador'}</h3>
                  {badge && <CosmeticPlate id={badge.id} nick={player.nick || player.name || 'Jugador'} width={236} className="pcm__plate" />}
                  {status && <span className="pcm__st">{status.label}</span>}
                </div>
              </div>
              {stats?.length > 0 && (
                <div className="pcm__gamer" style={inset}>
                  {stats.slice(0, 3).map(item => <div className="pcm__g" key={item.label}><b>{item.value || '-'}</b><span>{item.label}</span></div>)}
                </div>
              )}
              {!stats && (gamer.rank || gamer.mainRole || gamer.game) && (
                <div className="pcm__gamer" style={inset}>
                  <div className="pcm__g"><b data-no-translate>{gamer.rank || '-'}</b><span>rango</span></div>
                  <div className="pcm__g"><b>{gamer.mainRole || '-'}</b><span>rol</span></div>
                  <div className="pcm__g"><b data-no-translate>{gamer.game || '-'}</b><span>juego</span></div>
                </div>
              )}
              <Strip model={selectedModel} serial={serial} joined={player.joined || '-'} />
              <div className="pcm__noise" />
            </div>
            <div className="pcm__glare" />
          </div>

          <div className="pcm__face pcm__face--b">
            <div className="pcm__edge" />
            <div className="pcm__bk">
              <div className="pcm__top"><span className="pcm__micro">datos verificables</span><span className="pcm__code">{serial}</span></div>
              {backBlocks ? backBlocks.map(block => (
                <div className="pcm__blk" key={block.title}>
                  <div className="pcm__blk-h">{block.title}</div>
                  {block.text && <p className="pcm__text" data-no-translate={block.raw ? '' : undefined}>{block.text}</p>}
                  {block.tags?.length > 0 && <div className="pcm__tags">{block.tags.map(tag => <span key={tag} className="pcm__tag">{tag}</span>)}</div>}
                  {block.rows?.length > 0 && (
                    <div className="pcm__g2">
                      {block.rows.map(row => <Data key={row.label} label={row.label} value={row.value} mono={row.mono} wide={row.wide} />)}
                    </div>
                  )}
                </div>
              )) : (<>
              <div className="pcm__blk">
                <div className="pcm__blk-h">Roles</div>
                <div className="pcm__tags">{tags.map(tag => <span key={tag} className={`pcm__tag${String(tag).toLowerCase() === String(player.role || '').toLowerCase() ? ' pcm__tag--r' : ''}`}>{tag}</span>)}</div>
              </div>
              <div className="pcm__blk">
                <div className="pcm__blk-h">Cuenta e informacion</div>
                <div className="pcm__g2">
                  <Data label="nombre" value={player.legalName} raw />
                  <Data label="nivel" value={player.level} />
                  <Data label="sexo" value={player.sex} />
                  <Data label="nacimiento" value={player.birth} />
                  <Data label="pais / region" value={player.region} />
                  <Data label="plataforma" value={player.platform} />
                  <Data label="equipo" value={player.team} raw />
                  <Data label="juego secundario" value={gamer.secondGame} raw />
                  <Data label="sensibilidad" value={gamer.sensitivity} mono />
                  <Data label="dpi" value={gamer.dpi} mono />
                  <Data label="correo" value={player.email} mono wide />
                  <Data label="seguridad" value={player.security} />
                  <Data label="id usuario" value={player.uid} mono />
                </div>
              </div>
              </>)}
              <div className="pcm__blk">
                <div className="pcm__blk-h">IDs especializados</div>
                <div className="pcm__kv">
                  <div><span>codigo publico</span><b>{serial}</b></div>
                  {player.internalId && <div><span>{player.internalLabel || 'id interno'}</span><b className="amber">{player.internalId}</b></div>}
                  {(player.specialIds || []).map(item => <div key={item.label}><span>{item.label}</span><b>{item.value}</b></div>)}
                </div>
              </div>
              <div className="pcm__hint">click para volver</div>
              <div className="pcm__noise" />
            </div>
            <div className="pcm__glare" />
          </div>
        </div>
      </div>
    </div>
  )
}

// mono = dato literal (correo, id, dpi): el traductor legacy no lo toca.
function Data({ label, value, mono = false, wide = false, raw = mono }) {
  return <div className="pcm__c" style={wide ? { gridColumn: '1 / -1' } : undefined}><span>{label}</span><b className={mono ? 'm' : undefined} data-no-translate={raw ? '' : undefined}>{value || '-'}</b></div>
}


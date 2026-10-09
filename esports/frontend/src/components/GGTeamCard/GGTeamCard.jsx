import { useRef, useState } from 'react'
import { flagUrl, teamGenderKey, teamGenderLabel } from '../../lib/teamEligibility.js'
import './GGTeamCard.css'

function TrophyIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 9V4h12v5a6 6 0 0 1-12 0Z" />
      <path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M9 18h6M12 14v4M8 21h8" />
    </svg>
  )
}

function SaveIcon({ active }) {
  return (
    <svg width="14" height="10" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="1" y="1" width="22" height="14" rx="4" />
      <circle cx={active ? 17 : 7} cy="8" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export const GG_TEAM_TIERS = {
  novato: { label: 'Novato', color: '#00E676', bg: '#00E676' },
  universitario: { label: 'Universitario', color: '#3B82F6', bg: '#3B82F6' },
  femenino: { label: 'Femenino', color: '#FF4FD8', bg: '#FF4FD8' },
  semipro: { label: 'Semi Pro', color: '#FACC15', bg: '#FACC15' },
  profesional: { label: 'Profesional', color: '#EF4444', bg: '#EF4444' },
  elite: {
    label: 'Seleccion',
    color: '#FF4FD8',
    bg: 'linear-gradient(90deg,#00E676,#3B82F6,#FF4FD8,#FACC15,#EF4444)',
    elite: true,
  },
  // Equipo del que el jugador ya salio: el historial no guarda su categoria,
  // asi que no se le inventa una.
  anterior: { label: 'Equipo anterior', color: '#8B8F9C', bg: '#8B8F9C' },
}

const TIER_ALIASES = {
  nuevo: 'novato', novato: 'novato', universitario: 'universitario', femenino: 'femenino',
  profesional: 'profesional', semipro: 'semipro', semi_pro: 'semipro', semi: 'semipro',
  sig_liga: 'semipro', 'sig-liga': 'semipro', legendario: 'elite', elite: 'elite',
}

// Categoria real del equipo (team.tiers, lo que elige el lider al crearlo)
// para la tarjeta. Antes varias pantallas la escribian fija ("universitario")
// y todo equipo salia como universitario.
export function teamTierIds(team) {
  const ids = (Array.isArray(team?.tiers) ? team.tiers : [])
    .map(tier => TIER_ALIASES[String(tier || '').toLowerCase()])
    .filter(Boolean)
  if (team?.university?.isUniversityTeam && !ids.includes('universitario')) ids.push('universitario')
  if (!ids.length) {
    const category = String(team?.category || team?.level || '').toLowerCase()
    if (category.includes('fem')) ids.push('femenino')
    else if (category.includes('semi')) ids.push('semipro')
    else if (category.includes('prof') || category.includes('elite')) ids.push('profesional')
  }
  return ids.length ? [...new Set(ids)] : ['novato']
}

const POS = { 1: '#ffc700', 2: '#a8a9ad', 3: '#b07757' }

function initialsFor(team) {
  return team.initials || String(team.name || 'GG').slice(0, 2).toUpperCase()
}

function safeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

// Foto de jugador que no carga (link viejo, archivo borrado): avatar por
// defecto en vez del icono de imagen rota.
function avatarFallback(event) {
  const img = event.currentTarget
  img.onerror = null
  img.src = '/demos/steliant-esports/avatar-default.svg'
}

export default function GGTeamCard({
  team = {},
  tier = 'novato',
  tiers,
  index = 0,
  onView,
  onJoin,
  actions,
  joinLabel = 'Unirse',
  sentLabel = 'Solicitud enviada',
  fullLabel = 'Completo',
  viewLabel = 'Ver equipo',
  hideJoin = false,
  layout = 'vertical',
  defaultOpen = false,
  width,
  // "Guardar equipo": solo sale si quien usa la tarjeta pasa onPin. Antes
  // salia siempre y no guardaba nada (estado local, se perdia al recargar).
  pinned = false,
  onPin,
}) {
  const rowLayout = layout === 'row' || layout === 'split'
  const ids = safeList(tiers?.length ? tiers : [tier]).filter(id => GG_TEAM_TIERS[id])
  const tierList = ids.length ? ids.map(id => GG_TEAM_TIERS[id]) : [GG_TEAM_TIERS.novato]
  const vip = tierList.length > 1
  const t = vip
    ? {
        label: tierList.map(item => item.label).join(' / '),
        color: tierList[0].color,
        bg: `linear-gradient(100deg,${tierList.map(item => item.color).join(',')})`,
        elite: tierList.some(item => item.elite),
      }
    : tierList[0]

  const ref = useRef(null)
  const [open, setOpen] = useState(defaultOpen)
  const [sent, setSent] = useState(false)
  const [crestBroken, setCrestBroken] = useState(false)
  const members = safeList(team.members)
  const roster = safeList(team.roster)
  const tags = safeList(team.tags)
  // capacity 0 = sin cupo que mostrar (equipo anterior): ni avatares ni barra.
  const capacity = team.capacity === 0 ? 0 : Number(team.capacity || 5)
  const showRoster = capacity > 0
  const full = members.length >= capacity
  const champ = Boolean(team.title)
  // Bandera y género: se aceptan ya calculados o se derivan del código de país
  // ("RD", "MX"...) y del texto de género guardado ("Femenino", "Mixto"...).
  const flag = team.flag !== undefined ? team.flag : flagUrl(team.country)
  const gender = team.gender && typeof team.gender === 'object'
    ? team.gender
    : team.gender ? { key: teamGenderKey(team.gender), label: teamGenderLabel(team.gender, !/^en/i.test(document?.documentElement?.lang || 'es')) } : null

  const onMove = (event) => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
    el.style.transform = `translateY(-5px) rotateY(${(px - 0.5) * 9}deg) rotateX(${(0.5 - py) * 7}deg)`
  }

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = ''
  }

  const [sending, setSending] = useState(false)
  const handleJoin = async (event) => {
    event.stopPropagation()
    if (full && !sent || sending) return
    setSending(true)
    try {
      // No marcar "enviado" a ciegas: si el pedido falla (equipo cerrado,
      // error de red, etc.), el boton no debe quedar mintiendo que se envio.
      const ok = await onJoin?.()
      if (ok !== false) setSent(true)
    } finally {
      setSending(false)
    }
  }

  const handleView = (event) => {
    event.stopPropagation()
    onView?.()
  }

  const headerBlock = (
    <div className="gg-tc__hd">
      <div className="gg-tc__crest">
        {team.crest && !crestBroken
          ? <img src={team.crest} alt="" onError={() => setCrestBroken(true)} />
          : initialsFor(team)}
      </div>
      <div className="gg-tc__codes">
        {team.code && <span className="gg-tc__code">{team.code}</span>}
        {team.longCode && <span className="gg-tc__code">{team.longCode}</span>}
      </div>
      {onPin && (
        <button
          className={`gg-tc__pin${pinned ? ' on' : ''}`}
          type="button"
          title={pinned ? 'Guardado' : 'Guardar equipo'}
          onClick={(event) => {
            event.stopPropagation()
            onPin(!pinned)
          }}
        >
          <SaveIcon active={pinned} />
        </button>
      )}
    </div>
  )

  const mainBlock = (
    <>
      <div className="gg-tc__name">
        <h3>{team.name}</h3>
        <span className={`gg-tc__tier${vip ? ' gg-tc__tier--blend' : ''}`}>{t.label}</span>
        {vip && <span className="gg-tc__vip">VIP</span>}
        {gender && (
          <span className={`gg-tc__gender gg-tc__gender--${gender.key}`} title={gender.label}>
            <i aria-hidden="true">{gender.key === 'female' ? '♀' : gender.key === 'male' ? '♂' : '⚥'}</i>
            {gender.label}
          </span>
        )}
      </div>

      <div className="gg-tc__meta">
        <span>{team.game || 'GlitchGang'}</span>
        <i />
        <span>{team.region || 'Global'}</span>
        {team.country && (
          <>
            <i />
            <span className="gg-tc__country">
              {flag && <img className="gg-tc__flag" src={flag} alt="" loading="lazy" />}
              {team.country}
            </span>
          </>
        )}
        {team.founded && (
          <>
            <i />
            <em>{team.founded}</em>
          </>
        )}
      </div>

      {champ && (
        <div className="gg-tc__champ">
          <span className="gg-tc__champ-ic"><TrophyIcon /></span>
          <div className="gg-tc__champ-b">
            <b>{team.title.tournament}</b>
            <span>{[team.title.date, team.title.scope].filter(Boolean).join(' - ')}</span>
          </div>
          {team.title.placement && (
            <span className="gg-tc__champ-pos" style={{ '--pos': POS[team.title.placement] || '#ffc700' }}>
              {team.title.placement}º
            </span>
          )}
        </div>
      )}

      {team.bio && <p className="gg-tc__bio">{team.bio}</p>}

      {tags.length > 0 && (
        <div className="gg-tc__tags">
          {tags.map(tag => (
            <span key={tag.label || tag} className={`gg-tc__tag${tag.on ? ' gg-tc__tag--on' : ''}`}>
              {tag.label || tag}
            </span>
          ))}
        </div>
      )}
    </>
  )

  const rosterMeterBlock = showRoster && (
    <div className="gg-tc__roster">
      <div className="gg-tc__stack">
        {Array.from({ length: Math.min(capacity, 5) }, (_, i) => (
          <span key={i} className={members[i] ? '' : 'empty'}>
            {members[i] && <img src={members[i]} alt="" onError={avatarFallback} />}
          </span>
        ))}
      </div>
      <div className="gg-tc__meter">
        <div className="gg-tc__seg">
          {Array.from({ length: capacity }, (_, i) => {
            const on = i < members.length
            const ghost = sent && i === members.length
            const next = !on && !ghost && i === members.length
            return <i key={i} style={{ '--n': i }} className={on ? 'on' : ghost ? 'ghost' : next ? 'next' : ''} />
          })}
        </div>
      </div>
      <span className={`gg-tc__count${sent ? ' bump' : ''}`}>{members.length + (sent ? 1 : 0)}/{capacity}</span>
    </div>
  )

  const panelBlock = roster.length > 0 && (
    <div className={`gg-tc__panel${open ? ' open' : ''}`}>
      <div>
        {roster.map((row, n) => (
          <div className="gg-tc__rrow" key={`${row.nick}-${n}`} style={{ '--n': n }}>
            <img src={row.avatar || '/demos/steliant-esports/avatar-default.svg'} alt="" onError={avatarFallback} />
            <b>{row.nick}</b>
            <span>{row.role}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const footBlock = (
    <div className="gg-tc__foot">
      {showRoster && <span className="gg-tc__members">{members.length} {members.length === 1 ? 'miembro' : 'miembros'}</span>}
      <div className="gg-tc__acts">
        {actions?.length ? actions.map(action => (
          <button
            key={action.key || action.label}
            type="button"
            className={`gg-tc__btn${action.primary ? ' gg-tc__btn--go' : ''}${action.danger ? ' gg-tc__btn--danger' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              action.onClick?.(event)
            }}
            disabled={action.disabled}
            title={action.title}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        )) : (
          <>
            <button className="gg-tc__btn" type="button" onClick={handleView}>
              {viewLabel}
            </button>
            {!hideJoin && (
              <button className={`gg-tc__btn gg-tc__btn--go${sent ? ' gg-tc__btn--sent' : ''}`} type="button" onClick={handleJoin} disabled={(full && !sent) || sending}>
                {full ? fullLabel : sent ? sentLabel : sending ? '...' : joinLabel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className={`gg-tc-wrap gg-tc-wrap--${layout}`} style={{ '--i': index, '--tc-w': width ? `${width}px` : undefined }}>
      <article
        ref={ref}
        className={`gg-tc gg-tc--${layout}${t.elite ? ' gg-tc--elite' : ''}${champ ? ' gg-tc--champ' : ''}`}
        style={{ '--t': t.color, '--tbg': t.bg }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onView}
      >
        <div className="gg-tc__rail" />
        {(champ || t.elite) && (
          <div className="gg-tc__ribbon">{champ ? (team.title.ribbon || 'Campeon') : (team.distinction || 'Campeon nacional')}</div>
        )}
        <div className="gg-tc__glow" />
        <div className="gg-tc__mesh" />
        <div className="gg-tc__serial">{team.shortCode || team.code || ''}</div>
        <div className="gg-tc__spec" />
        <div className="gg-tc__sheen" />

        <div className="gg-tc__body">
          {rowLayout ? (
            <>
              <div className="gg-tc__side">{headerBlock}</div>
              <div className="gg-tc__main">{mainBlock}</div>
              <div className="gg-tc__aside">{rosterMeterBlock}{footBlock}</div>
              {panelBlock}
            </>
          ) : (
            <>
              {headerBlock}
              {mainBlock}
              {rosterMeterBlock}
              {panelBlock}
              {footBlock}
            </>
          )}
        </div>
      </article>
    </div>
  )
}


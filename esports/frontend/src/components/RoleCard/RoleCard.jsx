import { Icon } from '../icons/Icons.jsx'
import RoleIdentityCorner from '../RoleIdentityCorner/RoleIdentityCorner.jsx'
import './RoleCard.css'

/**
 * Tarjeta de perfil con 4 modelos visuales distintos según el rol:
 *   - organizer : banner con gradiente + avatar flotante (estilo "Get in Touch")
 *   - brand     : horizontal con logo cuadrado
 *   - player    : oscura con avatar enmarcado y rango
 *   - creator   : header de gradiente vívido con plataforma en vivo
 *
 * props:
 *  variant, name, avatar, verified, subtitle, accent,
 *  banner (img opcional), live (bool, creator), stats [{value,label}],
 *  actionLabel, onAction
 */
export default function RoleCard({
  variant = 'organizer', name, avatar, verified, subtitle, accent = '#00E676',
  banner, live, stats = [], actionLabel = 'Ver', onAction,
  role, profile, publicId, internalId, isOwner, is_owner,
}) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <article className={`gg-rcard gg-rcard--${variant}`} style={{ '--rc': accent }} onClick={onAction}>
      <RoleIdentityCorner
        role={role || variant}
        profile={profile}
        publicId={publicId}
        internalId={internalId}
        isOwner={isOwner}
        is_owner={is_owner}
      />
      <div
        className="gg-rcard__banner"
        style={banner ? { backgroundImage: `linear-gradient(135deg, ${accent}cc, transparent), url(${banner})` } : undefined}
      >
        {variant === 'creator' && live && <span className="gg-rcard__live">● EN VIVO</span>}
      </div>

      <div className="gg-rcard__avatar">
        {avatar ? <img src={avatar} alt={name} /> : <span>{initials}</span>}
        {variant === 'player' && <i className="gg-rcard__ring" />}
      </div>

      <div className="gg-rcard__body">
        <div className="gg-rcard__nameline">
          <b>{name}</b>
          {verified && <span className="gg-rcard__verif" title="Verificado">{Icon.check}</span>}
        </div>
        <span className="gg-rcard__sub">{subtitle}</span>

        <div className="gg-rcard__stats">
          {stats.map((s, i) => (
            <div key={i} className="gg-rcard__stat">
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <button className="gg-rcard__btn" onClick={(e) => { e.stopPropagation(); onAction?.() }}>
          {actionLabel} {Icon.chevronRight}
        </button>
      </div>
    </article>
  )
}


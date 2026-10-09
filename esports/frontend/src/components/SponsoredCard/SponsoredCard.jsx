import { Icon } from '../icons/Icons.jsx'
import './SponsoredCard.css'

function IconGlyph({ name }) {
  return Icon[name] || null
}

export default function SponsoredCard({
  label = 'Patrocinado',
  brand,
  logo,
  title,
  body,
  cta,
  code = 'AD-SLOT-01',
  accent = 'var(--accent)',
  onClose,
  onCta,
  width,
}) {
  return (
    <div className="gg-sponsored-card" style={{ '--sp-a': accent, '--sp-w': width ? `${width}px` : undefined }}>
      <div className="gg-sponsored-card__in">
        <div className="gg-sponsored-card__scan" />
        <div className="gg-sponsored-card__sheen" />
        <div className="gg-sponsored-card__rail">
          <span className="gg-sponsored-card__ticks"><i /><i /></span>
          <span className="gg-sponsored-card__vtext"><IconGlyph name="bolt" />{label}</span>
          <span className="gg-sponsored-card__ticks"><i /><i /></span>
        </div>
        <div className="gg-sponsored-card__body">
          <div className="gg-sponsored-card__head">
            {(logo || brand) && (
              <span className="gg-sponsored-card__logo">
                {logo ? <img src={logo} alt="" /> : brand.slice(0, 2).toUpperCase()}
              </span>
            )}
            {brand && <span className="gg-sponsored-card__brand">Colaborador<b>{brand}</b></span>}
            {onClose && (
              <button className="gg-sponsored-card__close" type="button" onClick={onClose} aria-label="Cerrar">
                <IconGlyph name="x" />
              </button>
            )}
          </div>
          <h3 className="gg-sponsored-card__title">{title}</h3>
          {body && <p className="gg-sponsored-card__text">{body}</p>}
          {cta && (
            <button className="gg-sponsored-card__cta" type="button" onClick={onCta}>
              {cta}
              <IconGlyph name="chevronRight" />
            </button>
          )}
          <div className="gg-sponsored-card__strip">
            <span>{code}</span>
            <span className="gg-sponsored-card__hatch" />
            <span>Contenido pagado</span>
          </div>
        </div>
      </div>
    </div>
  )
}


import { Icon } from '../icons/Icons.jsx'
import './ProfileBanner.css'

function IconGlyph({ name }) {
  return Icon[name] || null
}

export default function ProfileBanner({
  eyebrow = 'Mi perfil',
  name,
  game,
  cover,
  code,
  rail = 'Steliant Esports',
  status = 'Live',
  stats = [],
  accent = 'var(--accent)',
  editLabel = 'Editar perfil',
  onEdit,
}) {
  return (
    <div className="gg-profile-banner" style={{ '--pb-a': accent }}>
      <div className="gg-profile-banner__top">
        <h2 className="gg-profile-banner__eyebrow">{eyebrow}</h2>
        {onEdit !== null && (
          <button className="gg-profile-banner__edit" type="button" onClick={onEdit}>
            <IconGlyph name="edit" />
            <span>{editLabel}</span>
          </button>
        )}
      </div>
      <div className="gg-profile-banner__frame">
        <div className="gg-profile-banner__cover">
          {cover ? <img className="gg-profile-banner__img" src={cover} alt="" /> : <div className="gg-profile-banner__ph" />}
          <div className="gg-profile-banner__scrim" />
          <div className="gg-profile-banner__scan" />
          <div className="gg-profile-banner__rail">
            <span className="gg-profile-banner__ticks"><i /><i /><i /></span>
            <span className="gg-profile-banner__vtext">{rail}</span>
            <span className="gg-profile-banner__ticks"><i /><i /><i /></span>
          </div>
          <span className="gg-profile-banner__bk gg-profile-banner__bk--tr" />
          <span className="gg-profile-banner__bk gg-profile-banner__bk--br" />
          {code && (
            <span className="gg-profile-banner__code">
              <b>{code}</b>
              {status && <>// {status}</>}
            </span>
          )}
          <span className="gg-profile-banner__eq">
            <i style={{ animationDelay: '0s' }} />
            <i style={{ animationDelay: '.2s' }} />
            <i style={{ animationDelay: '.4s' }} />
            <i style={{ animationDelay: '.15s' }} />
            <i style={{ animationDelay: '.35s' }} />
          </span>
          <div className="gg-profile-banner__body">
            <div className="gg-profile-banner__name-wrap">
              <span className="gg-profile-banner__micro">Perfil de jugador</span>
              <h1 className="gg-profile-banner__name">{name || 'Jugador'}</h1>
            </div>
            {game && (
              <span className="gg-profile-banner__game">
                <IconGlyph name="gamepad" />
                {game}
              </span>
            )}
            {stats.length > 0 && (
              <div className="gg-profile-banner__meta">
                {stats.slice(0, 3).map(item => (
                  <span key={item.label}>
                    <b>{item.value}</b>
                    <em>{item.label}</em>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


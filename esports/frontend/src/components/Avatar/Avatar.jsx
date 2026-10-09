import { STATUS_BY_ID } from '../../data/cosmetics.js'
import './Avatar.css'

const FALLBACK = '/demos/steliant-esports/avatar-default.svg'

function handleImgError(e) {
  e.currentTarget.onerror = null
  e.currentTarget.src = FALLBACK
}

// `status` (id de STATUSES, ver data/cosmetics.js) es el estado real del
// usuario -- se usa cuando se conoce (el propio usuario logueado). `online`
// es un booleano simple de respaldo para cuando solo se sabe conectado/no
// (ver Friends.jsx). Sin ninguno de los dos, no se dibuja punto -- antes se
// dibujaba siempre un punto gris fijo aunque nadie hubiera pasado un estado.
export default function Avatar({ src, alt = '', size = 40, online, status, ring = false }) {
  const statusInfo = status ? STATUS_BY_ID[status] : null
  const showDot = Boolean(statusInfo) || online !== undefined
  const dotColor = statusInfo ? statusInfo.color : (online ? '#22c55e' : '#6b7280')

  return (
    <div className={`gg-avatar ${ring ? 'gg-avatar--ring' : ''}`}
      style={{ '--av-size': size + 'px' }}>
      <img src={src || FALLBACK} alt={alt} onError={handleImgError} />
      {showDot && (
        <span
          className={`gg-avatar__dot${statusInfo ? ' gg-avatar__dot--pulse' : ''}`}
          style={{ '--dot-color': dotColor }}
          title={statusInfo?.label}
        />
      )}
    </div>
  )
}


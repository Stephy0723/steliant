import { useState } from 'react'
import { Link } from 'react-router-dom'
import './CookieNotice.css'

// Aviso de cookies. Es solo informativo (sin "Rechazar") porque GlitchGang
// solo usa cookies ESENCIALES: la de sesion (HttpOnly), la de CSRF y
// localStorage para preferencias. No hay analitica ni publicidad de terceros.
// Si algun dia se agrega (Google Analytics, pixel de Meta...), este aviso
// tiene que pasar a pedir consentimiento ANTES de cargar esos scripts.
// Al cambiar el texto de cookies sube la version para volver a mostrarlo.
const STORAGE_KEY = 'gg_cookie_notice_v1'

function readAck() {
  try { return Boolean(localStorage.getItem(STORAGE_KEY)) } catch { return false }
}

export default function CookieNotice() {
  const [visible, setVisible] = useState(() => !readAck())

  if (!visible) return null

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()) } catch { /* modo privado: se vuelve a mostrar, no pasa nada */ }
    setVisible(false)
  }

  return (
    <aside className="gg-cookie-notice" role="region" aria-label="Aviso de cookies">
      <p className="gg-cookie-notice__text">
        Usamos solo cookies esenciales para mantener tu sesión segura y recordar tus preferencias.
        No usamos cookies de publicidad ni de rastreo.{' '}
        <Link to="/privacidad#cookies" className="gg-cookie-notice__link">Más información</Link>
      </p>
      <button type="button" className="gg-cookie-notice__btn" onClick={accept}>
        Entendido
      </button>
    </aside>
  )
}


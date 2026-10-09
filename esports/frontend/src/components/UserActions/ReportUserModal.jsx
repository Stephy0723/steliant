import { useState } from 'react'
import { useLang } from '../../i18n/LangContext.jsx'
import { I } from '../SocialKit/SocialKit.jsx'
import './UserActions.css'

const REASONS = [
  ['spam', 'Spam', 'Spam'],
  ['acoso', 'Acoso', 'Harassment'],
  ['suplantacion', 'Suplantacion', 'Impersonation'],
  ['contenido_inapropiado', 'Contenido inapropiado', 'Inappropriate content'],
  ['trampas', 'Trampas', 'Cheating'],
  ['nombre_ofensivo', 'Nombre ofensivo', 'Offensive name'],
  ['otro', 'Otro', 'Other'],
]

export default function ReportUserModal({ user, open, busy, context, onCancel, onSubmit }) {
  const { lang } = useLang()
  const isEs = lang !== 'en'
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  if (!open) return null

  const submit = event => {
    event.preventDefault()
    if (reason === 'otro' && !details.trim()) return
    onSubmit({ reason, details: details.trim(), alsoBlock, context })
  }

  return (
    <div className="ua-modal" role="presentation" onMouseDown={onCancel}>
      <form className="ua-dialog ua-dialog--wide" role="dialog" aria-modal="true" aria-label={isEs ? 'Reportar usuario' : 'Report user'} onMouseDown={event => event.stopPropagation()} onSubmit={submit}>
        <button type="button" className="ua-close" aria-label={isEs ? 'Cerrar' : 'Close'} onClick={onCancel}><I name="x" size={18} /></button>
        <h2>{isEs ? `Reportar a @${user?.nick || user?.name}` : `Report @${user?.nick || user?.name}`}</h2>
        <div className="ua-reasons">
          {REASONS.map(([value, es, en]) => (
            <label key={value} className="ua-radio">
              <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
              <span>{isEs ? es : en}</span>
            </label>
          ))}
        </div>
        <textarea
          rows={4}
          maxLength={1000}
          value={details}
          onChange={event => setDetails(event.target.value)}
          placeholder={reason === 'otro' ? (isEs ? 'Cuéntanos qué pasó' : 'Tell us what happened') : (isEs ? 'Detalles adicionales (opcional)' : 'Additional details (optional)')}
          required={reason === 'otro'}
        />
        <label className="ua-check">
          <input type="checkbox" checked={alsoBlock} onChange={event => setAlsoBlock(event.target.checked)} />
          <span>{isEs ? 'Bloquear también a este usuario' : 'Also block this user'}</span>
        </label>
        <div className="ua-actions">
          <button type="button" className="ua-btn ua-btn--ghost" onClick={onCancel}>{isEs ? 'Cancelar' : 'Cancel'}</button>
          <button type="submit" className="ua-btn ua-btn--primary" disabled={busy || (reason === 'otro' && !details.trim())}>{busy ? (isEs ? 'Enviando...' : 'Sending...') : (isEs ? 'Enviar' : 'Send')}</button>
        </div>
      </form>
    </div>
  )
}


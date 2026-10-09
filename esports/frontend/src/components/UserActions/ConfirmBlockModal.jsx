import { useLang } from '../../i18n/LangContext.jsx'
import { I } from '../SocialKit/SocialKit.jsx'
import './UserActions.css'

export default function ConfirmBlockModal({ user, open, busy, onCancel, onConfirm }) {
  const { lang } = useLang()
  const isEs = lang !== 'en'
  if (!open) return null

  return (
    <div className="ua-modal" role="presentation" onMouseDown={onCancel}>
      <div className="ua-dialog" role="alertdialog" aria-modal="true" aria-label={isEs ? 'Bloquear usuario' : 'Block user'} onMouseDown={event => event.stopPropagation()}>
        <button type="button" className="ua-close" aria-label={isEs ? 'Cerrar' : 'Close'} onClick={onCancel}><I name="x" size={18} /></button>
        <h2>{isEs ? `Bloquear a @${user?.nick || user?.name}` : `Block @${user?.nick || user?.name}`}</h2>
        <p>{isEs ? 'No podrá enviarte mensajes ni solicitudes, dejará de ver tu perfil y se eliminará de tus amigos.' : 'They will not be able to message you or send friend requests, they will stop seeing your profile, and they will be removed from your friends.'}</p>
        <div className="ua-actions">
          <button type="button" className="ua-btn ua-btn--ghost" onClick={onCancel}>{isEs ? 'Cancelar' : 'Cancel'}</button>
          <button type="button" className="ua-btn ua-btn--danger" disabled={busy} onClick={onConfirm}>{busy ? (isEs ? 'Bloqueando...' : 'Blocking...') : (isEs ? 'Bloquear' : 'Block')}</button>
        </div>
      </div>
    </div>
  )
}


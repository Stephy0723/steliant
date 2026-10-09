import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../i18n/LangContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { toast } from '../../lib/toast.js'
import { I } from '../SocialKit/SocialKit.jsx'
import { useRelationship } from './useRelationship.js'
import ConfirmBlockModal from './ConfirmBlockModal.jsx'
import ReportUserModal from './ReportUserModal.jsx'
import InviteToTeamModal from './InviteToTeamModal.jsx'
import './UserActions.css'

const idOf = value => String(value?._id || value?.id || value || '')
const POPUP_WIDTH = 218
const POPUP_GAP = 8

function popupPosition(anchor, width = POPUP_WIDTH) {
  if (!anchor) return null
  const rect = anchor.getBoundingClientRect()
  const safeWidth = Math.min(width, window.innerWidth - 16)
  const left = Math.min(Math.max(8, rect.right - safeWidth), window.innerWidth - safeWidth - 8)
  const top = Math.min(rect.bottom + POPUP_GAP, window.innerHeight - 16)
  return { left, top, width: safeWidth }
}

export default function UserActionsMenu({ user, context }) {
  const { lang } = useLang()
  const isEs = lang !== 'en'
  const { user: me } = useAuth()
  const rel = useRelationship(user)
  const [open, setOpen] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const popRef = useRef(null)
  const [popStyle, setPopStyle] = useState(null)

  const targetId = idOf(user)
  const hidden = !targetId || targetId === idOf(me)

  useEffect(() => {
    if (!open && !confirmRemove) return undefined
    const onDoc = event => {
      if (
        ref.current && !ref.current.contains(event.target) &&
        popRef.current && !popRef.current.contains(event.target)
      ) {
        setOpen(false)
        setConfirmRemove(false)
      }
    }
    const onKey = event => {
      if (event.key === 'Escape') {
        setOpen(false)
        setConfirmRemove(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, confirmRemove])

  useLayoutEffect(() => {
    if (!open && !confirmRemove) return undefined
    const update = () => setPopStyle(popupPosition(triggerRef.current, confirmRemove ? 280 : POPUP_WIDTH))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, confirmRemove])

  // Después de los hooks: con el return antes, al cambiar `user` entre un
  // perfil ajeno y el propio React rompía por distinto número de hooks.
  if (hidden) return null

  const act = async (fn, ok) => {
    try {
      const result = await fn()
      toast(ok(result), 'success')
      setOpen(false)
      setConfirmRemove(false)
      setConfirmBlock(false)
      setReportOpen(false)
    } catch (err) {
      toast(err.message || (isEs ? 'No se pudo completar la acción' : 'Could not complete the action'), 'error')
    }
  }

  const items = []
  if (rel.status === 'none') items.push(['plus', isEs ? 'Agregar amigo' : 'Add friend', () => act(rel.sendRequest, () => isEs ? 'Solicitud enviada' : 'Request sent')])
  if (rel.status === 'sent') items.push(['x', isEs ? 'Cancelar solicitud' : 'Cancel request', () => act(rel.cancelRequest, () => isEs ? 'Solicitud cancelada' : 'Request canceled')])
  if (rel.status === 'received') {
    items.push(['check', isEs ? 'Aceptar' : 'Accept', () => act(rel.accept, () => isEs ? 'Ahora son amigos' : 'You are now friends')])
    items.push(['x', isEs ? 'Rechazar' : 'Reject', () => act(rel.reject, () => isEs ? 'Solicitud rechazada' : 'Request rejected')])
  }
  if (rel.status === 'friends') {
    items.push(['msg', isEs ? 'Enviar mensaje' : 'Send message', () => { rel.message(); setOpen(false) }])
    items.push(['users', isEs ? 'Invitar a mi equipo' : 'Invite to my team', () => { setOpen(false); setInviteOpen(true) }])
    items.push(['trash', isEs ? 'Eliminar amigo' : 'Remove friend', () => { setOpen(false); setConfirmRemove(true) }, true])
  }
  items.push(['user', isEs ? 'Ver perfil' : 'View profile', () => { rel.profile(); setOpen(false) }])
  items.push(['shield', rel.status === 'blocked' ? (isEs ? 'Desbloquear' : 'Unblock') : (isEs ? 'Bloquear' : 'Block'), () => {
    if (rel.status === 'blocked') act(rel.unblock, () => isEs ? 'Usuario desbloqueado' : 'User unblocked')
    else { setOpen(false); setConfirmBlock(true) }
  }, rel.status !== 'blocked'])
  items.push(['alert', isEs ? 'Reportar' : 'Report', () => { setOpen(false); setReportOpen(true) }, true])

  return (
    <div className="ua-menu" ref={ref}>
      <button ref={triggerRef} type="button" className={'sx-ico ua-trigger' + (open ? ' on' : '')} aria-haspopup="menu" aria-expanded={open} aria-label={isEs ? 'Acciones de usuario' : 'User actions'} onClick={() => setOpen(value => !value)}>
        <I name="moreVertical" size={18} />
      </button>
      {open && popStyle && createPortal(
        <div ref={popRef} className="ua-pop ua-pop--portal" role="menu" style={{ left: popStyle.left, top: popStyle.top, width: popStyle.width }}>
          {items.map(([icon, label, onClick, danger]) => (
            <button key={label} type="button" role="menuitem" className={danger ? 'ua-danger' : ''} disabled={Boolean(rel.busy)} onClick={onClick}>
              <I name={icon} size={16} />{label}
            </button>
          ))}
        </div>,
        document.body,
      )}
      {confirmRemove && popStyle && createPortal(
        <div ref={popRef} className="ua-mini-confirm ua-mini-confirm--portal" role="alertdialog" style={{ left: popStyle.left, top: popStyle.top, width: popStyle.width }}>
          <p>{isEs ? `¿Eliminar a @${user?.nick || user?.name} de tus amigos?` : `Remove @${user?.nick || user?.name} from friends?`}</p>
          <div>
            <button type="button" className="ua-btn ua-btn--ghost" onClick={() => setConfirmRemove(false)}>{isEs ? 'Cancelar' : 'Cancel'}</button>
            <button type="button" className="ua-btn ua-btn--danger" disabled={rel.busy === 'remove'} onClick={() => act(rel.removeFriend, () => isEs ? 'Amigo eliminado' : 'Friend removed')}>{isEs ? 'Eliminar' : 'Remove'}</button>
          </div>
        </div>,
        document.body,
      )}
      <InviteToTeamModal user={user} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ConfirmBlockModal user={user} open={confirmBlock} busy={rel.busy === 'block'} onCancel={() => setConfirmBlock(false)} onConfirm={() => act(rel.block, () => isEs ? 'Usuario bloqueado' : 'User blocked')} />
      <ReportUserModal
        user={user}
        open={reportOpen}
        busy={rel.busy === 'report'}
        context={context}
        onCancel={() => setReportOpen(false)}
        onSubmit={payload => act(() => rel.report(payload), result => `${isEs ? 'Reporte enviado. El equipo de moderación lo revisará.' : 'Report sent. The moderation team will review it.'}${result?.ticketCode ? ` ${result.ticketCode}` : ''}`)}
      />
    </div>
  )
}


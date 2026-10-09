import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Icon } from '../icons/Icons.jsx'
import { tournamentsApi } from '../../lib/serverApi.js'
import { DRAFT_EVENT, readDraft, reminderKey, writeDraft } from '../../lib/tournamentDraft.js'
import { REMINDER_INTERVAL } from '../../../../shared/tournamentSetup.mjs'
import './TournamentDraftReminder.css'

export default function TournamentDraftReminder() {
  const { user } = useAuth()
  const userId = user?._id || user?.id
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    setDraft(null)
    if (!userId) return
    let active = true
    const refresh = () => {
      const next = readDraft(userId)
      setDraft(next)
      if (!next) setVisible(false)
    }
    refresh()
    tournamentsApi.draft().then(({ draft: remote }) => {
      if (!active || !remote) return
      const local = readDraft(userId)
      if (!local || remote.savedAt > local.savedAt) writeDraft(userId, remote)
    }).catch(() => {})
    window.addEventListener(DRAFT_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => { active = false; window.removeEventListener(DRAFT_EVENT, refresh); window.removeEventListener('storage', refresh) }
  }, [userId])

  // No molestar donde ya se ve el borrador (asistente y panel del organizador).
  const suppressed = pathname === '/torneos/crear' || pathname.startsWith('/organizador')

  useEffect(() => {
    if (!userId || !draft) return
    const check = () => {
      if (document.visibilityState !== 'visible' || suppressed) { setVisible(false); return }
      let last = 0
      try { last = Number(localStorage.getItem(reminderKey(userId))) || draft.savedAt } catch { last = draft.savedAt }
      if (Date.now() - last >= REMINDER_INTERVAL) setVisible(true)
    }
    check()
    const timer = window.setInterval(check, 15000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [userId, draft, suppressed])

  const dismiss = () => {
    try { localStorage.setItem(reminderKey(userId), String(Date.now())) } catch {}
    setVisible(false)
  }
  if (!visible || !draft || !userId || suppressed) return null
  return <aside className="gg-draft-reminder" role="status" aria-label="Torneo pendiente">
    <span className="gg-draft-reminder__icon">{Icon.bell}</span>
    <div><strong>Tienes un torneo pendiente</strong><p>{draft.form.title || 'Nuevo torneo'}</p>
      <button type="button" onClick={() => { dismiss(); navigate('/torneos/crear') }}>Retomar torneo {Icon.chevronRight}</button>
    </div>
    <button className="gg-draft-reminder__close" type="button" title="Posponer 5 minutos" aria-label="Posponer 5 minutos" onClick={dismiss}>{Icon.x}</button>
  </aside>
}


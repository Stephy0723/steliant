import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'

const idOf = value => String(value?._id || value?.id || value || '')

function withoutId(list = [], id) {
  const target = String(id)
  return (list || []).filter(item => idOf(item) !== target)
}

function withUser(list = [], user) {
  const id = idOf(user)
  if (!id || (list || []).some(item => idOf(item) === id)) return list || []
  return [user, ...(list || [])]
}

export function useRelationship(targetUser) {
  const navigate = useNavigate()
  const { user: me, updateUser } = useAuth()
  const [busy, setBusy] = useState('')
  const targetId = idOf(targetUser)
  const meId = idOf(me)

  const status = useMemo(() => {
    if (!me || !targetId || targetId === meId) return 'self'
    if ((me.blockedUsers || []).some(item => idOf(item) === targetId)) return 'blocked'
    if ((me.friends || []).some(item => idOf(item) === targetId)) return 'friends'
    if ((me.friendRequests?.sent || []).some(item => idOf(item) === targetId)) return 'sent'
    if ((me.friendRequests?.received || []).some(item => idOf(item) === targetId)) return 'received'
    return 'none'
  }, [me, meId, targetId])

  const mutate = updater => updateUser?.(current => updater(current || {}))
  const run = async (name, request, optimistic, rollback) => {
    if (!targetId || busy) return null
    setBusy(name)
    const before = me
    if (optimistic) mutate(optimistic)
    try {
      return await request()
    } catch (err) {
      if (rollback && before) updateUser?.(before)
      throw err
    } finally {
      setBusy('')
    }
  }

  const sendRequest = () => run(
    'send',
    () => api(`/profile/me/friends/request/${targetId}`, { method: 'POST' }),
    current => ({ ...current, friendRequests: { ...(current.friendRequests || {}), sent: withUser(current.friendRequests?.sent, targetUser) } }),
    true,
  )

  const cancelRequest = () => run(
    'cancel',
    () => api(`/profile/me/friends/request/${targetId}`, { method: 'DELETE' }),
    current => ({ ...current, friendRequests: { ...(current.friendRequests || {}), sent: withoutId(current.friendRequests?.sent, targetId) } }),
    true,
  )

  const accept = () => run(
    'accept',
    () => api(`/profile/me/friends/${targetId}`, { method: 'PATCH', body: { action: 'accept' } }),
    current => ({
      ...current,
      friends: withUser(current.friends, targetUser),
      friendRequests: { ...(current.friendRequests || {}), received: withoutId(current.friendRequests?.received, targetId) },
    }),
    true,
  )

  const reject = () => run(
    'reject',
    () => api(`/profile/me/friends/${targetId}`, { method: 'PATCH', body: { action: 'reject' } }),
    current => ({ ...current, friendRequests: { ...(current.friendRequests || {}), received: withoutId(current.friendRequests?.received, targetId) } }),
    true,
  )

  const removeFriend = () => run(
    'remove',
    () => api(`/profile/me/friends/${targetId}`, { method: 'DELETE' }),
    current => ({ ...current, friends: withoutId(current.friends, targetId) }),
    true,
  )

  const block = () => run(
    'block',
    () => api(`/profile/me/block/${targetId}`, { method: 'POST' }),
    current => ({
      ...current,
      blockedUsers: withUser(current.blockedUsers, targetUser),
      friends: withoutId(current.friends, targetId),
      friendRequests: {
        ...(current.friendRequests || {}),
        sent: withoutId(current.friendRequests?.sent, targetId),
        received: withoutId(current.friendRequests?.received, targetId),
      },
    }),
    true,
  )

  const unblock = () => run(
    'unblock',
    () => api(`/profile/me/block/${targetId}`, { method: 'DELETE' }),
    current => ({ ...current, blockedUsers: withoutId(current.blockedUsers, targetId) }),
    true,
  )

  const report = (payload) => run(
    'report',
    () => api(`/profile/${targetId}/report`, { method: 'POST', body: payload }),
    payload?.alsoBlock ? current => ({
      ...current,
      blockedUsers: withUser(current.blockedUsers, targetUser),
      friends: withoutId(current.friends, targetId),
    }) : null,
    Boolean(payload?.alsoBlock),
  )

  const message = () => navigate(`/mensajes?dm=${encodeURIComponent(targetId)}&name=${encodeURIComponent(targetUser?.nick || targetUser?.name || '')}`)
  const profile = () => navigate(`/perfil?user=${encodeURIComponent(targetUser?.nick || targetId)}`)

  return { status, busy, sendRequest, cancelRequest, accept, reject, removeFriend, block, unblock, report, message, profile }
}


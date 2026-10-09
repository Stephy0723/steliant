import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

/* Amigos y equipos reales para <ShareModal>. user.friends en el contexto de
   auth solo trae IDs, así que se piden poblados (nick/avatar) -- mismo
   endpoint que la página de Amigos. Solo carga mientras `open` es true, para
   no disparar una petición por cada PostCard del feed. */

const uploadPath = value => {
  if (!value) return ''
  try {
    const url = new URL(String(value), window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch { /* no es URL */ }
  return String(value)
}

export function useShareDestinations(open) {
  const { user } = useAuth() || {}
  const userId = user?._id || user?.id
  const [friends, setFriends] = useState([])
  const [teams, setTeams] = useState([])

  useEffect(() => {
    if (!open || !userId) return
    let alive = true
    api(`/profile/${userId}`)
      .then(({ user: me }) => {
        if (!alive) return
        setFriends((me?.friends || [])
          .filter(f => f && typeof f === 'object' && f.nick)
          .map(f => ({ id: String(f._id || f.id), name: f.nick, avatar: uploadPath(f.avatar), subtitle: 'Amigo' })))
      })
      .catch(() => { if (alive) setFriends([]) })
    api('/teams/mine')
      .then(res => {
        if (!alive) return
        const list = Array.isArray(res) ? res : Array.isArray(res?.teams) ? res.teams : []
        setTeams(list.map(t => ({
          id: String(t._id || t.id || t.publicCode),
          name: t.name,
          subtitle: t.tag ? `${t.tag} - Equipo` : 'Equipo',
          avatar: uploadPath(t.logo),
          logo: uploadPath(t.logo),
        })))
      })
      .catch(() => { if (alive) setTeams([]) })
    return () => { alive = false }
  }, [open, userId])

  return { friends, teams }
}


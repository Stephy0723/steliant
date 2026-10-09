import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

export const ACTIVE_COMMUNITY_KEY = 'gg.community.active.id'
export const ACTIVE_COMMUNITY_EVENT = 'gg-community-active:update'

function normalizeId(value) {
  return String(value || '').trim()
}

function mergeCommunities(primary = [], secondary = []) {
  const map = new Map()
  ;[...secondary, ...primary].forEach(item => {
    if (!item) return
    const key = normalizeId(item.id || item._id || item.publicId || item.slug)
    if (!key) return
    map.set(key, { ...map.get(key), ...item, id: item.id || item._id || key })
  })
  return [...map.values()]
}

export function setActiveCommunityPreference(communityOrId) {
  const id = normalizeId(typeof communityOrId === 'object' ? communityOrId?.id || communityOrId?._id : communityOrId)
  if (id) localStorage.setItem(ACTIVE_COMMUNITY_KEY, id)
  else localStorage.removeItem(ACTIVE_COMMUNITY_KEY)
  window.dispatchEvent(new CustomEvent(ACTIVE_COMMUNITY_EVENT, { detail: { id } }))
  return id
}

export function getActiveCommunityPreference() {
  return normalizeId(localStorage.getItem(ACTIVE_COMMUNITY_KEY))
}

export function useActiveCommunity() {
  const [activeId, setActiveIdState] = useState(() => getActiveCommunityPreference())
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onActive = event => setActiveIdState(normalizeId(event.detail?.id || getActiveCommunityPreference()))
    const onStorage = event => {
      if (event.key === ACTIVE_COMMUNITY_KEY) setActiveIdState(normalizeId(event.newValue))
    }
    window.addEventListener(ACTIVE_COMMUNITY_EVENT, onActive)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(ACTIVE_COMMUNITY_EVENT, onActive)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      // GET /communities/mine, no /my -- con /my este hook (usado en varias
      // pantallas) siempre fallaba en silencio (Promise.allSettled) y
      // "mis comunidades" quedaba vacio en todos lados que lo usan.
      const [mine, publicRows] = await Promise.allSettled([
        api('/communities/mine'),
        api('/communities'),
      ])
      const myCommunities = mine.status === 'fulfilled' && Array.isArray(mine.value.communities) ? mine.value.communities : []
      const allCommunities = publicRows.status === 'fulfilled' && Array.isArray(publicRows.value.communities) ? publicRows.value.communities : []
      setCommunities(mergeCommunities(myCommunities, allCommunities))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    reload().finally(() => {
      if (!alive) return
    })
    return () => { alive = false }
  }, [reload])

  const community = useMemo(() => {
    if (!activeId) return null
    return communities.find(item => {
      return [item.id, item._id, item.publicId, item.publicCode, item.slug]
        .map(normalizeId)
        .includes(activeId)
    }) || null
  }, [activeId, communities])

  const setActiveCommunity = useCallback((communityOrId) => {
    const id = setActiveCommunityPreference(communityOrId)
    setActiveIdState(id)
  }, [])

  return {
    activeId,
    community,
    communities,
    loading,
    reload,
    setActiveCommunity,
  }
}


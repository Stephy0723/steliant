import { api } from './api.js'

export const listCommunities = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return api(`/communities${qs ? `?${qs}` : ''}`)
}
// Oficiales por juego (?official=true) + creadas por jugadores: GET
// /communities por defecto excluye las oficiales, y son las que tienen el
// estado real de "unido" y el conteo de miembros de cada juego.
export const listAllCommunities = async () => {
  const [official, created] = await Promise.all([
    listCommunities({ official: 'true', limit: 50 }).catch(() => ({ communities: [] })),
    listCommunities({ limit: 50 }).catch(() => ({ communities: [] })),
  ])
  return [...(official.communities || []), ...(created.communities || [])]
}
export const createCommunity =(payload) => api('/communities', { method: 'POST', body: JSON.stringify(payload) })
export const joinCommunity = (id) => api(`/communities/${id}/join`, { method: 'POST' })
export const leaveCommunity = (id) => api(`/communities/${id}/leave`, { method: 'POST' })
export const getCommunityDetail = (id) => api(`/communities/${id}`)
export const updateCommunity = (id, payload) => api(`/communities/${id}`, { method: 'PUT', body: JSON.stringify(payload) })

export const getMyCommunities = () => api('/communities/mine')
export const getCommunityStats = (id) => api(`/communities/${id}/stats`)
export const listCommunityMembers = (id) => api(`/communities/${id}/members`)
export const removeCommunityMember = (id, userId) => api(`/communities/${id}/members/${userId}`, { method: 'DELETE' })
export const listCommunityBans = (id) => api(`/communities/${id}/bans`)
export const unbanCommunityMember = (id, userId) => api(`/communities/${id}/bans/${userId}`, { method: 'DELETE' })
export const transferOwnership = (id, userId) => api(`/communities/${id}/transfer`, { method: 'POST', body: JSON.stringify({ userId }) })
export const deleteCommunity = (id) => api(`/communities/${id}`, { method: 'DELETE' })

export const getCommunityFeedPosts = (id, before) =>
  api(`/communities/${id}/posts${before ? `?before=${encodeURIComponent(before)}` : ''}`)
export const createCommunityFeedPost = (id, payload) => api(`/communities/${id}/posts`, { method: 'POST', body: JSON.stringify(payload) })
export const updateCommunityFeedPost = (id, postId, payload) => api(`/communities/${id}/posts/${postId}`, { method: 'PUT', body: JSON.stringify(payload) })
export const toggleCommunityFeedLike = (id, postId) => api(`/communities/${id}/posts/${postId}/like`, { method: 'POST' })
export const addCommunityFeedComment = (id, postId, text) => api(`/communities/${id}/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) })
export const voteCommunityFeedPoll = (id, postId, optionId) => api(`/communities/${id}/posts/${postId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) })
export const toggleCommunityFeedInterested = (id, postId) => api(`/communities/${id}/posts/${postId}/interested`, { method: 'POST' })
export const reportCommunityFeedPost = (id, postId, reason) => api(`/communities/${id}/posts/${postId}/report`, { method: 'POST', body: JSON.stringify({ reason }) })
export const deleteCommunityFeedPost = (id, postId) => api(`/communities/${id}/posts/${postId}`, { method: 'DELETE' })


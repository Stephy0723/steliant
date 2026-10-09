const sanitize = (s) => String(s || 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'USER'

function disabledCommunityWarning(action) {
  console.warn(`[GlitchGang] ${action} local de comunidades deshabilitado. Usa un backend de comunidades.`)
}

export function generateCommunityId(creatorCode, date = new Date(), seq = 1) {
  const yy = String(date.getFullYear()).slice(2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `COM-${sanitize(creatorCode)}-${yy}${mm}${dd}-${String(seq).padStart(4, '0')}`
}

export function loadCommunities() {
  return []
}

export function addCommunity() {
  disabledCommunityWarning('Creacion')
  return null
}

export function updateCommunity() {
  disabledCommunityWarning('Actualizacion')
  return null
}

export function removeCommunity() {
  disabledCommunityWarning('Eliminacion')
  return []
}

export function getCommunityById() {
  return null
}

export function getMyCommunities() {
  return []
}

export function setActiveCommunityId() {
  disabledCommunityWarning('Seleccion')
}

export function getActiveCommunityId() {
  return ''
}

export function getManagedCommunityForUser() {
  return null
}

export function toPublicCommunity(record) {
  return record || null
}

export function getPublicCommunities() {
  return []
}

export function getPublicCommunityBySlug() {
  return null
}


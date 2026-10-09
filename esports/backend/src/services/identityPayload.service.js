const INTERNAL_ROLE_FIELDS = Object.freeze([
  'organizerInternalCode',
  'creatorInternalCode',
  'coachInternalCode',
  'casterInternalCode',
  'analystInternalCode',
  'sponsorInternalCode',
])

const idOf = value => value?._id || value?.id || value

export function isOwnerOrAdmin(viewer, owner) {
  if (viewer?.role === 'admin' || viewer?.isAdmin) return true
  const viewerId = idOf(viewer)
  const ownerId = idOf(owner)
  return Boolean(viewerId && ownerId && String(viewerId) === String(ownerId))
}

export function stripUserInternalIds(user) {
  if (!user) return user
  delete user.internalCode
  for (const profile of Object.values(user.roleProfiles || {})) {
    if (!profile || typeof profile !== 'object') continue
    for (const field of INTERNAL_ROLE_FIELDS) delete profile[field]
  }
  return user
}

export function sanitizeUserIdentityPayload(user, viewer) {
  if (!user) return user
  if (!isOwnerOrAdmin(viewer, user)) stripUserInternalIds(user)
  return user
}

export function sanitizeTournamentIdentityPayload(tournament, viewer) {
  if (!tournament) return tournament
  const owner = tournament.organizer?._id || tournament.organizer
  const privileged = isOwnerOrAdmin(viewer, owner)
  if (!privileged) delete tournament.tournamentCode

  if (tournament.organizer && typeof tournament.organizer === 'object') {
    if (!privileged) stripUserInternalIds(tournament.organizer)
  }
  return tournament
}

import { useAuth } from '../../context/AuthContext.jsx'
import RoleIdentityCorner from '../RoleIdentityCorner/RoleIdentityCorner.jsx'

const valueId = value => value?._id || value?.id || value

export function isTournamentOwner(tournament, currentUser) {
  const organizerId = tournament?.organizerId || valueId(tournament?.organizer)
  const userId = valueId(currentUser)
  return Boolean(organizerId && userId && String(organizerId) === String(userId))
}

export default function TournamentIdentityCorner({ tournament, isOwner = false, is_owner = false, currentUser, shortOnly = false }) {
  const auth = useAuth()
  const viewer = currentUser || auth?.user
  const publicId = tournament?.publicId || tournament?.publicCode
  const internalId = tournament?.tournamentCode || tournament?.internalId || tournament?.internalCode || tournament?.tournamentInternalCode
  const ownsTournament = Boolean(isOwner || is_owner || isTournamentOwner(tournament, viewer))

  return (
    <RoleIdentityCorner
      role="tournament"
      profile={tournament}
      publicId={publicId}
      internalId={shortOnly ? '' : internalId}
      isOwner={shortOnly ? false : ownsTournament}
      currentUser={viewer}
      className="gg-role-id-corner--tournament"
    />
  )
}


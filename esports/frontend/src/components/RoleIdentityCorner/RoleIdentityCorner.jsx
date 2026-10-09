import { useAuth } from '../../context/AuthContext.jsx'
import './RoleIdentityCorner.css'

const ROLE_FIELDS = Object.freeze({
  organizer: ['organizerCode', 'organizerInternalCode'],
  creator:   ['creatorCode', 'creatorInternalCode'],
  coach:     ['coachCode', 'coachInternalCode'],
  caster:    ['casterCode', 'casterInternalCode'],
  analyst:   ['analystCode', 'analystInternalCode'],
  moderator: ['moderatorCode', 'moderatorInternalCode'],
  sponsor:   ['sponsorCode', 'sponsorInternalCode'],
})

const ROLE_ALIASES = Object.freeze({ brand: 'sponsor' })

const clean = value => typeof value === 'string' ? value.trim().toUpperCase() : ''
const identityOf = value => value?._id || value?.id || value?.userId || value?.user?._id || value?.user?.id || value?.user

export function resolveRoleIdentity(profile, role, publicId, internalId) {
  const normalizedRole = ROLE_ALIASES[role] || role
  const [publicField, internalField] = ROLE_FIELDS[normalizedRole] || []
  const roleProfile = profile?.roleProfiles?.[normalizedRole] || profile?.profiles?.[normalizedRole] || {}

  return {
    role: normalizedRole,
    publicId: clean(publicId || roleProfile.publicCode || roleProfile[publicField] || profile?.[publicField]),
    internalId: clean(internalId || roleProfile.internalCode || roleProfile[internalField] || profile?.[internalField]),
  }
}

export default function RoleIdentityCorner({
  role,
  profile,
  publicId,
  internalId,
  isOwner = false,
  is_owner = false,
  currentUser,
  className = '',
}) {
  const auth = useAuth()
  const viewer = currentUser || auth?.user
  const identity = resolveRoleIdentity(profile, role, publicId, internalId)
  const profileId = identityOf(profile)
  const viewerId = identityOf(viewer)
  const ownsProfile = Boolean(isOwner || is_owner || (profileId && viewerId && String(profileId) === String(viewerId)))
  const isAdmin = Boolean(viewer?.role === 'admin' || viewer?.isAdmin)
  const canSeeInternal = ownsProfile || isAdmin

  if (!identity.publicId) return null

  const visibleText = canSeeInternal && identity.internalId
    ? `${identity.publicId} / ${identity.internalId}`
    : identity.publicId

  return (
    <div
      className={`gg-role-id-corner gg-role-id-corner--${identity.role || 'profile'} ${className}`.trim()}
      title={visibleText}
      aria-label={`ID ${visibleText}`}
      data-no-translate
    >
      <span className="gg-role-id-corner__public">{identity.publicId}</span>
      {canSeeInternal && identity.internalId && (
        <>
          <span className="gg-role-id-corner__slash" aria-hidden="true">/</span>
          <span className="gg-role-id-corner__internal">{identity.internalId}</span>
        </>
      )}
    </div>
  )
}


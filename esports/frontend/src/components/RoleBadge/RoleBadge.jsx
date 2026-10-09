import { Icon } from '../icons/Icons.jsx'
import { ROLES } from '../../data/communities.js'
import './RoleBadge.css'

const ROLE_ICONS = {
  member: Icon.user,
  creator: Icon.play,
  'event-organizer': Icon.bolt,
  'tournament-organizer': Icon.trophy,
  moderator: Icon.shield,
  admin: Icon.crown,
}

export default function RoleBadge({ role, compact = false }) {
  const config = ROLES[role] || ROLES.member
  const ico = ROLE_ICONS[role] || Icon.user

  return (
    <span
      className={`gg-role-badge ${compact ? 'compact' : ''}`}
      style={{ '--rb': config.color }}
      title={config.label}
    >
      <span className="gg-role-badge__icon">{ico}</span>
      {!compact && <span className="gg-role-badge__label">{config.label}</span>}
    </span>
  )
}


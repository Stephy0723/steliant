import { useState } from 'react'
import { motion } from 'framer-motion'
import Badge from '../Badge/Badge.jsx'
import { Icon } from '../icons/Icons.jsx'
import './CreatorCard.css'

const PLATFORM_ICONS = {
  twitch:    Icon.twitch,
  youtube:   Icon.youtube,
  tiktok:    Icon.tiktok,
  instagram: Icon.instagram,
}

const PLATFORM_LABELS = {
  twitch:    'Twitch',
  youtube:   'YouTube',
  tiktok:    'TikTok',
  instagram: 'Instagram',
}

export default function CreatorCard({ creator, delay = 0 }) {
  const [following, setFollowing] = useState(false)
  const { nick, avatar, platform, followers, live, game, description } = creator

  return (
    <motion.div
      className="gg-creator-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {/* Avatar + live indicator */}
      <div className="gg-creator__avatar-wrap">
        <img src={avatar} alt={nick} className="gg-creator__avatar" />
        {live && <span className="gg-creator__live">EN VIVO</span>}
      </div>

      {/* Info */}
      <div className="gg-creator__body">
        <div className="gg-creator__row">
          <span className="gg-creator__nick">{nick}</span>
          {live && <Badge variant="live">● Live</Badge>}
        </div>

        <div className="gg-creator__platform">
          <span className="gg-creator__plat-icon">{PLATFORM_ICONS[platform]}</span>
          <span>{PLATFORM_LABELS[platform]}</span>
          <span className="gg-creator__dot">·</span>
          <span>{followers} seguidores</span>
        </div>

        <p className="gg-creator__desc">{description}</p>

        <div className="gg-creator__footer">
          <Badge variant="muted">{game}</Badge>
          <button
            className={`gg-btn gg-btn--sm ${following ? 'gg-btn--ghost' : 'gg-btn--primary'}`}
            onClick={() => setFollowing(v => !v)}
          >
            {following ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}


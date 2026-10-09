import { Icon } from '../icons/Icons.jsx'
import './GlitchSocials.css'

const SOCIALS = [
  { icon: Icon.discord,   color: '#5865F2', name: 'Discord' },
  { icon: Icon.whatsapp,  color: '#25D366', name: 'WhatsApp' },
  { icon: Icon.youtube,   color: '#FF0000', name: 'YouTube' },
  { icon: Icon.twitch,    color: '#9146FF', name: 'Twitch' },
  { icon: Icon.tiktok,    color: '#e0e0e0', name: 'TikTok' },
  { icon: Icon.instagram, color: '#E1306C', name: 'Instagram' },
]

export default function GlitchSocials({ size = 'sm' }) {
  return (
    <div className={`gg-gsoc gg-gsoc--${size}`}>
      {SOCIALS.map(({ icon, color, name }, i) => (
        <span
          key={name}
          className="gg-gsoc__item"
          style={{ '--sc': color, '--si': i }}
          title={name}
        >
          {icon}
        </span>
      ))}
    </div>
  )
}


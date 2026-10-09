import './SocialLinks.css'

const ICONS = {
  Discord: 'M20 4.4A19 19 0 0 0 15.3 3l-.3.5a14 14 0 0 1 4 2 13 13 0 0 0-13.5 0 14 14 0 0 1 4-2L9.2 3A19 19 0 0 0 4.5 4.4 19.7 19.7 0 0 0 1 17.6 19 19 0 0 0 6.8 21l.8-1.4a12 12 0 0 1-2-1l.5-.4a13.6 13.6 0 0 0 11.8 0l.5.4a12 12 0 0 1-2 1L17.2 21A19 19 0 0 0 23 17.6 19.7 19.7 0 0 0 20 4.4ZM8.5 14.7c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9Zm7 0c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9Z',
  X: 'M18.2 2H21l-6.5 7.4L22 22h-6.3l-4.9-6.4L5.1 22H2.3l7-8L2 2h6.4l4.4 5.9zm-1.1 18h1.6L7 3.7H5.3z',
  Instagram: '', Twitch: 'M4 3 3 6v13h4v3h3l3-3h4l5-5V3zm16 9-3 3h-4l-3 3v-3H7V5h13zM15 7h-2v5h2zm-5 0H8v5h2z',
  YouTube: 'M23 12s0-3.8-.5-5.6a3 3 0 0 0-2.1-2.1C18.6 3.7 12 3.7 12 3.7s-6.6 0-8.4.5A3 3 0 0 0 1.5 6.4C1 8.2 1 12 1 12s0 3.8.5 5.6a3 3 0 0 0 2.1 2.1c1.8.5 8.4.5 8.4.5s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1C23 15.8 23 12 23 12zM10 15.5v-7l6 3.5z',
}

export default function SocialLinks() {
  return (
    <div className="gg-socials">
      {['Discord', 'X', 'Instagram', 'Twitch', 'YouTube'].map((name) => (
        <button key={name} type="button" title={name} aria-label={name} disabled>
          {name === 'Instagram' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d={ICONS[name]} /></svg>
          )}
        </button>
      ))}
    </div>
  )
}


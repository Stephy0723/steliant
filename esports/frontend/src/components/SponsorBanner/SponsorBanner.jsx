import { useNavigate } from 'react-router-dom'
import './SponsorBanner.css'

/**
 * SponsorBanner — "Patrocinado por" strip for high-traffic pages.
 * Props:
 *   sponsor  — sponsor object from sponsors.js (required)
 *   variant  — 'header' (wide top banner) | 'compact' (slim inline bar)
 */
export default function SponsorBanner({ sponsor, variant = 'header' }) {
  const navigate = useNavigate()
  if (!sponsor) return null

  return (
    <div
      className={`gg-sponsor-banner gg-sponsor-banner--${variant}`}
      style={{ '--sb-color': sponsor.color, '--sb-accent': sponsor.accentColor }}
    >
      <div className="gg-sponsor-banner__pulse" />
      <div className="gg-sponsor-banner__ticker" aria-hidden="true">
        <span>SPONSORED DROP</span><span>TOURNAMENT BOOST</span><span>COMMUNITY REWARD</span><span>LIVE OFFER</span>
      </div>
      <div className="gg-sponsor-banner__inner">
        <div className="gg-sponsor-banner__left">
          <span className="gg-sponsor-banner__label">Patrocinado por</span>
          <div className="gg-sponsor-banner__logo">
            <span className="gg-sponsor-banner__initials" style={{ background: sponsor.color }}>
              {sponsor.logo
                ? <img src={sponsor.logo} alt="" />
                : sponsor.logoInitials}
            </span>
            <span className="gg-sponsor-banner__name">{sponsor.name}</span>
          </div>
        </div>

        <div className="gg-sponsor-banner__center">
          {sponsor.campaign?.badge && (
            <span className="gg-sponsor-banner__badge">{sponsor.campaign.badge}</span>
          )}
          <span className="gg-sponsor-banner__tagline">{sponsor.tagline}</span>
        </div>

        <div className="gg-sponsor-banner__right">
          <button
            className="gg-btn gg-btn--sm gg-btn--primary"
            onClick={() => {
              const url = sponsor.btnUrl || '/marcas'
              if (url.startsWith('http')) window.open(url, '_blank')
              else navigate(url)
            }}
          >
            {sponsor.campaign?.badge || 'Ver oferta'}
          </button>
        </div>
      </div>
      <div className="gg-sponsor-banner__line" />
    </div>
  )
}


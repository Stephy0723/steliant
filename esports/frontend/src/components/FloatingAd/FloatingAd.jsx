import { useState, useEffect } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { getSiteAds, trackSiteAdView, trackSiteAdClick } from '../../lib/siteAdsApi.js'
import { useAdsVisibility } from '../../context/AdsVisibilityContext.jsx'
import './FloatingAd.css'

const DISMISS_KEY = 'gg-floating-ad-dismissed'

export default function FloatingAd() {
  const [visible, setVisible] = useState(false)
  const [ad, setAd] = useState(null)
  const { visibility } = useAdsVisibility()

  useEffect(() => {
    if (!visibility.floating) return
    if (sessionStorage.getItem(DISMISS_KEY)) return
    let cancelled = false

    getSiteAds().then(ads => {
      if (cancelled) return
      const slot = ads.find(a => a.slot === 'floating' && a.active)
      if (!slot?.title) return
      setAd(slot)
      setTimeout(() => { if (!cancelled) { setVisible(true); trackSiteAdView(slot.id) } }, 3000)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [visibility.floating])

  const dismiss = () => {
    setVisible(false)
    sessionStorage.setItem(DISMISS_KEY, '1')
  }

  if (!ad) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="gg-fad"
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.94 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ '--fad-c1': ad.color1, '--fad-c2': ad.color2 }}
        >
          <button className="gg-fad__close" onClick={dismiss} title="Cerrar">{Icon.x}</button>

          {ad.imageUrl && (
            <div className="gg-fad__img">
              <img src={ad.imageUrl} alt={ad.title} />
              <div className="gg-fad__img-overlay" />
            </div>
          )}

          <div className="gg-fad__body">
            <span className="gg-fad__tag">{Icon.bolt} PATROCINADO</span>
            <h4 className="gg-fad__title">{ad.title}</h4>
            {ad.description && <p className="gg-fad__desc">{ad.description}</p>}
            {ad.btnUrl && ad.btnText && (
              <a
                href={safeHref(ad.btnUrl)}
                className="gg-fad__btn"
                style={{ background: ad.color1, color: ad.textColor }}
                target={ad.btnUrl.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                onClick={() => trackSiteAdClick(ad.id)}
              >
                {ad.btnText} {Icon.chevronRight}
              </a>
            )}
          </div>

          <div className="gg-fad__glow" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}


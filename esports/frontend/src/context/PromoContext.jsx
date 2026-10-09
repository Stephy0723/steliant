import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { PROMO_ROUTES } from '../data/sponsors.js'
import { getSitePromos } from '../lib/siteAdsApi.js'
import { useAdsVisibility } from './AdsVisibilityContext.jsx'

const PromoContext = createContext(null)
export const usePromo = () => useContext(PromoContext)

const SESSION_KEY = 'gg-promo-shown'

export function PromoProvider({ children }) {
  const [visible, setVisible] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const { pathname } = useLocation()
  const triggeredRef = useRef(false)
  const { visibility } = useAdsVisibility()

  useEffect(() => {
    if (!visibility.promo) return
    if (!PROMO_ROUTES.includes(pathname)) return

    const LAST_SHOWN_KEY = 'gg-promo-last-shown'
    const INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
    
    const last = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0)
    const now = Date.now()

    if (now - last >= INTERVAL_MS) {
      localStorage.setItem(LAST_SHOWN_KEY, now.toString())

      getSitePromos().then(all => {
        const promos = all.filter(p => p.active !== false)
        if (promos.length === 0) return
        const idx = Math.floor(now / INTERVAL_MS) % promos.length
        setCampaign(promos[idx])
        setVisible(true)
      }).catch(() => {})
    }
  }, [pathname, visibility.promo])

  const close = useCallback(() => setVisible(false), [])

  return (
    <PromoContext.Provider value={{ visible, campaign, close }}>
      {children}
    </PromoContext.Provider>
  )
}


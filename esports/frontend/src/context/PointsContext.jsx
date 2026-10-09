import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from './AuthContext.jsx'
import { getProfileLevel } from '../data/rewards.js'

const PointsContext = createContext(null)

const EMPTY = {
  referralCode: '', referrals: [], stats: { friends: 0, titles: 0, tournaments: 0 },
  progress: [], achievements: [], unlockedAchievements: 0,
}

export function PointsProvider({ children }) {
  const { user } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const res = await api('/rewards')
      setData(res)
    } catch {
      // sin conexión: mantiene el estado actual
    } finally {
      setLoaded(true)
    }
  }, [user])

  useEffect(() => {
    if (!user) { setData(EMPTY); setLoaded(true); return }
    load()
  }, [user, load])

  const profilePoints = useMemo(() => data.progress.reduce((total, item) => total + item.points, 0), [data.progress])
  const maxProfilePoints = useMemo(() => data.progress.reduce((total, item) => total + item.maxPoints, 0), [data.progress])
  const { level, nextLevel } = useMemo(() => getProfileLevel(profilePoints), [profilePoints])

  const value = useMemo(() => ({
    ...data,
    loaded,
    profilePoints,
    maxProfilePoints,
    balance: profilePoints,
    lifetime: profilePoints,
    // Referidos con correo verificado o plan de pago (lo usa Ajustes).
    verifiedReferrals: (data.referrals || []).filter(ref => ref.status !== 'registered').length,
    level,
    nextLevel,
    refresh: load,
  }), [data, loaded, profilePoints, maxProfilePoints, level, nextLevel, load])

  return <PointsContext.Provider value={value}>{children}</PointsContext.Provider>
}

export const usePoints = () => useContext(PointsContext)


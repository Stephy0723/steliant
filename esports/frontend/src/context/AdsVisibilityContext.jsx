import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getAdsVisibility } from '../lib/adsSettingsApi.js'

// Interruptor global por sección — controla si cada tipo de anuncio se
// muestra en el sitio, independiente del contenido/estado de cada anuncio
// individual. Viene del backend real (Settings.ads) para que apague/encienda
// igual para todos los visitantes. Por defecto todo apagado hasta confirmar
// con el backend, para no mostrar nada mientras carga.
const DEFAULT_VISIBILITY = { banner: false, tournament: false, floating: false, dashboard: false, promo: false }

const AdsVisibilityContext = createContext({ visibility: DEFAULT_VISIBILITY, loaded: false, refresh: () => {} })

export function AdsVisibilityProvider({ children }) {
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(() => {
    getAdsVisibility()
      .then(data => { setVisibility({ ...DEFAULT_VISIBILITY, ...data }); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <AdsVisibilityContext.Provider value={{ visibility, loaded, refresh }}>
      {children}
    </AdsVisibilityContext.Provider>
  )
}

export const useAdsVisibility = () => useContext(AdsVisibilityContext)


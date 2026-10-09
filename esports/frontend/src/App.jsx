import { useEffect, useState } from 'react'
import { useRoutes, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx'
import ToastHost from './components/Toast/ToastHost.jsx'
import PerfMonitor from './components/PerfMonitor/PerfMonitor.jsx'
import AppRoutes from './routes/AppRoutes.jsx'
import TournamentDraftReminder from './components/TournamentDraftReminder/TournamentDraftReminder.jsx'
import SocialLinkNotice from './components/SocialLinkNotice/SocialLinkNotice.jsx'
import GGAssistant from './components/GGAssistant/GGAssistant.jsx'
import CookieNotice from './components/CookieNotice/CookieNotice.jsx'
import { startOffscreenAnimationPause } from './lib/offscreenAnimations.js'

function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) return
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      const content = document.querySelector('.gg-content')
      if (content) content.scrollTop = 0
    })
  }, [location.pathname, location.search, location.hash])

  return null
}

// El preloader vive en index.html (arranca antes que React); aquí solo
// avisamos que la app montó y esperamos a que termine para arrancar la Landing.
export default function App() {
  const [ready, setReady] = useState(() => !!window.__ggIntroDone)
  const location = useLocation()
  const routing = useRoutes(AppRoutes({ ready }))
  // Pausa las animaciones en bucle que estan fuera de pantalla o con la
  // pestaña en segundo plano (ver lib/offscreenAnimations.js).
  useEffect(() => startOffscreenAnimationPause(), [])
  useEffect(() => {
    window.__ggAppReady = true
    if (window.__ggIntroDone) { setReady(true); return }
    const onDone = () => setReady(true)
    window.addEventListener('gg:intro-done', onDone)
    return () => window.removeEventListener('gg:intro-done', onDone)
  }, [])
  return (
    <>
      <ScrollToTop />
      <ErrorBoundary routeKey={location.pathname}>
        {routing}
      </ErrorBoundary>
      <ToastHost />
      <SocialLinkNotice />
      <TournamentDraftReminder />
      <GGAssistant />
      {ready && <CookieNotice />}
      <PerfMonitor />
    </>
  )
}


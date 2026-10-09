import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar.jsx'
import Topbar from '../components/Topbar/Topbar.jsx'
import Footer from '../sections/Footer/Footer.jsx'
import WhatsNew from '../components/WhatsNew/WhatsNew.jsx'
import PublishModal from '../components/PublishModal/PublishModal.jsx'
import FloatingAd from '../components/FloatingAd/FloatingAd.jsx'
import './DashboardLayout.css'

export default function DashboardLayout() {
  const [showPublish, setShowPublish] = useState(false)

  useEffect(() => {
    const handler = () => setShowPublish(true)
    window.addEventListener('gg:publish', handler)
    return () => window.removeEventListener('gg:publish', handler)
  }, [])

  return (
    <div className="gg-app">
      <WhatsNew />
      <Sidebar />
      <div className="gg-main">
        <Topbar />
        <div className="gg-content">
          <Outlet />
          <Footer />
        </div>
      </div>
      <PublishModal open={showPublish} onClose={() => setShowPublish(false)} />
      <FloatingAd />
    </div>
  )
}


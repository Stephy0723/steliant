import './steliantDemo.js';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { LangProvider } from './i18n/LangContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { AdsVisibilityProvider } from './context/AdsVisibilityContext.jsx'
import { NotificationsProvider } from './context/NotificationsContext.jsx'
import { PromoProvider } from './context/PromoContext.jsx'
import { AdminProvider } from './context/AdminContext.jsx'
import { PointsProvider } from './context/PointsContext.jsx'
import { initClientLogCapture } from './lib/clientLogs.js'
import './index.css'

initClientLogCapture()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <LangProvider>
          <AuthProvider>
            <AdsVisibilityProvider>
              <PointsProvider>
                <NotificationsProvider>
                  <AdminProvider>
                    <PromoProvider>
                      <App />
                    </PromoProvider>
                  </AdminProvider>
                </NotificationsProvider>
              </PointsProvider>
            </AdsVisibilityProvider>
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
)


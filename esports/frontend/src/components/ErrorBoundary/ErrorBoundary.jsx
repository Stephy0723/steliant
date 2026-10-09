import { Component } from 'react'
import { pushClientLog } from '../../lib/clientLogs.js'
import { Icon } from '../icons/Icons.jsx'
import './ErrorBoundary.css'

// Captura errores de render para que un crash en una pagina
// no deje la app entera en blanco.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
    pushClientLog('error', '[ErrorBoundary]', {
      message: error?.message || 'Error inesperado',
      stack: error?.stack || '',
      componentStack: info?.componentStack || '',
    })
  }

  componentDidUpdate(prevProps) {
    if (prevProps.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || 'Error inesperado al renderizar.'
      return (
        <main className="gg-error-page" role="alert">
          <section className="gg-error-card">
            <div className="gg-error-card__scan" />
            <div className="gg-error-card__code">GG-RENDER-ERR</div>
            <div className="gg-error-card__icon" aria-hidden="true">
              <span data-glitch="!">!</span>
            </div>

            <p className="gg-error-card__eyebrow">Interferencia detectada</p>
            <h1 className="gg-error-card__title" data-text="Algo salio mal">
              Algo salio mal
            </h1>
            <p className="gg-error-card__message">{message}</p>

            <div className="gg-error-card__actions">
              <button className="gg-error-btn gg-error-btn--primary" type="button" onClick={() => this.setState({ error: null })}>
                {Icon.refresh || Icon.bolt || Icon.check} Reintentar
              </button>
              <button className="gg-error-btn" type="button" onClick={() => window.history.back()}>
                {Icon.chevronRight} Volver
              </button>
              <button className="gg-error-btn" type="button" onClick={() => { window.location.href = '/dashboard' }}>
                {Icon.home || Icon.globe} Inicio
              </button>
            </div>

            <div className="gg-error-card__hint">
              El sistema guardo el reporte local para revision tecnica.
            </div>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}


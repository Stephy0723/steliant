import { useEffect, useState } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'

// Tarjeta de accion: el formato de las notificaciones que piden hacer algo
// (layout: 'action' en NotificationsContext). Cabecera con visual por tipo,
// estado, datos clave, proximos pasos y boton principal + secundarios.

const STATUS_ICON = {
  success: Icon.check,
  warning: Icon.alert,
  error: Icon.x,
  pending: Icon.clock,
  celebrate: Icon.bolt,
  admin: Icon.shield,
  info: Icon.bell,
}

const STEP_ICON = { done: Icon.check, warn: Icon.alert }

function initialsOf(str) {
  const words = String(str || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function hueOf(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

function Monogram({ name }) {
  return (
    <span className="nda-mono" style={{ '--mono-hue': hueOf(String(name || '')) }}>
      {initialsOf(name)}
    </span>
  )
}

function Hero({ hero }) {
  const kind = hero?.kind
  if (kind === 'avatar') {
    return (
      <div className="nda-hero nda-hero--avatar">
        {hero.image ? <img src={hero.image} alt={hero.name || ''} /> : <Monogram name={hero.name} />}
      </div>
    )
  }
  if (kind === 'banner') {
    return (
      <div className="nda-hero nda-hero--banner" style={hero.image ? { backgroundImage: `url(${hero.image})` } : undefined}>
        {!hero.image && Icon.trophy}
      </div>
    )
  }
  if (kind === 'versus' || kind === 'score') {
    const score = kind === 'score' && Array.isArray(hero.score) ? hero.score : null
    return (
      <div className={`nda-hero nda-hero--${kind}`}>
        <Monogram name={hero.left} />
        <b>{score ? `${score[0]}-${score[1]}` : 'VS'}</b>
        <Monogram name={hero.right} />
      </div>
    )
  }
  if (kind === 'trophy') {
    return (
      <div className={`nda-hero nda-hero--trophy nda-hero--place-${hero.place || 1}`}>
        {Icon.trophy}
        <span className="nda-hero__place">{hero.place || 1}º</span>
      </div>
    )
  }
  const icon = { checkin: Icon.clock, staff: Icon.award, support: Icon.messageSquare, discord: Icon.discord }[kind] || Icon.bell
  return <div className={`nda-hero nda-hero--icon nda-hero--${kind || 'default'}`}>{icon}</div>
}

function remainingLabel(deadline, now) {
  const ms = new Date(deadline).getTime() - now
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return ''
  const min = Math.ceil(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${min % 60} min`
}

function StatusLine({ status }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!status?.deadline) return undefined
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [status?.deadline])

  if (!status) return null
  const remaining = status.deadline ? remainingLabel(status.deadline, now) : null
  const expired = remaining === ''
  const tone = expired ? 'error' : status.tone
  return (
    <div className={`nda-status nda-status--${tone || 'info'}`}>
      <span className="nda-status__icon">{STATUS_ICON[tone] || Icon.bell}</span>
      <span>
        <small>Estado actual</small>
        {expired ? status.expiredText || status.text : status.text}
        {remaining && <em> ({status.deadlineLabel || 'Quedan'} {remaining})</em>}
      </span>
    </div>
  )
}

function ActionButton({ action, primary, onDo }) {
  const className = `nda-btn ${primary ? 'nda-btn--primary' : 'nda-btn--link'}`
  if (action.do) {
    return <button type="button" className={className} onClick={() => onDo(action.do)}>{action.label}</button>
  }
  const link = String(action.link || '')
  if (/^https?:\/\//.test(link)) {
    return <a className={className} href={safeHref(link)} target="_blank" rel="noreferrer">{action.label}</a>
  }
  return <Link className={className} to={link}>{action.label}</Link>
}

export default function NotificationActionCard({ notification, onClose, onAccept, onDecline, onReply }) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    setReplyOpen(false)
    setReplyText('')
    setDetailsOpen(false)
  }, [notification.id])

  const actions = notification.actions || []
  const [primary, ...secondary] = actions
  const steps = notification.steps?.items || []

  const runAction = (what) => {
    if (what === 'accept') onAccept?.(notification.id, '')
    if (what === 'decline') onDecline?.(notification.id, '')
    if (what === 'reply') setReplyOpen(true)
    if (what === 'details') setDetailsOpen(v => !v)
  }

  const sendReply = () => {
    const text = replyText.trim()
    if (!text) return
    onReply?.(notification.id, text)
    setReplyText('')
    setReplyOpen(false)
  }

  return (
    <div className="nda">
      <button className="nda-close" onClick={onClose} aria-label="Cerrar">{Icon.x}</button>

      <header className="nda-head">
        <Hero hero={notification.hero} />
        <div className="nda-head__text">
          <h3>{notification.title}</h3>
          {notification.subtitle && <p>{notification.subtitle}</p>}
        </div>
      </header>

      <div className="nda-body">
        <StatusLine status={notification.status} />

        {notification.facts?.length > 0 && (
          <dl className="nda-facts">
            {notification.facts.map(fact => (
              <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>
        )}

        {notification.quote && (
          <blockquote className="nda-quote">
            <span>{notification.quote.label}</span>
            <p>{notification.quote.text}</p>
          </blockquote>
        )}

        {steps.length > 0 && (
          <section className="nda-steps">
            <h4>Próximos pasos requeridos</h4>
            <ol className={`nda-steps__list nda-steps__list--${notification.steps.kind}`}>
              {steps.map((step, index) => (
                <li key={index} className={step.state ? `is-${step.state}` : undefined}>
                  <span className="nda-steps__mark">
                    {notification.steps.kind === 'checklist' ? STEP_ICON[step.state] || null : index + 1}
                  </span>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {detailsOpen && notification.details && (
          <pre className="nda-details">{notification.details}</pre>
        )}

        {notification.replied && (
          <div className="nda-replied">{Icon.check}<span>Respuesta enviada al staff.</span></div>
        )}

        {replyOpen && (
          <div className="nd-reply">
            <textarea rows={3} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Escribe tu respuesta..." autoFocus />
            <div className="nd-reply__actions">
              <button className="nd-btn nd-btn--primary" onClick={sendReply}>{Icon.send} Enviar</button>
              <button className="nd-btn nd-btn--ghost" onClick={() => setReplyOpen(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {!replyOpen && primary && (
        <footer className="nda-foot">
          <ActionButton action={primary} primary onDo={runAction} />
          {secondary.length > 0 && (
            <div className="nda-foot__secondary">
              {secondary.map(action => (
                <ActionButton key={action.label} action={action} onDo={runAction} />
              ))}
            </div>
          )}
        </footer>
      )}
    </div>
  )
}


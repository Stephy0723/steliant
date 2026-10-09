import { useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import './ShareSheet.css'

function IconGlyph({ name }) {
  return Icon[name] || null
}

export default function ShareSheet({
  title = 'Compartir',
  kicker = 'Compartir',
  subtitle,
  post,
  url = '',
  tabs = [],
  emptyText = 'No hay destinos en esta categoria. Prueba otra pestana o copia el enlace.',
  linkLabel = 'Compartir el enlace',
  sendLabel = 'Enviar dentro de GlitchGang',
  fullLabel = 'Compartir mensaje completo',
  accent = 'var(--accent)',
  onClose,
  onCopy,
  onShare,
  onSend,
  width,
}) {
  const { mode = 'dark' } = useTheme() || {}
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const active = tabs[tab] || {}
  const dests = active.items || []

  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    onCopy?.(url)
  }

  return (
    <div className="gg-share-sheet" data-theme-mode={mode} style={{ '--sh-a': accent, '--sh-w': width ? `${width}px` : undefined }}>
      <div className="gg-share-sheet__in">
        <div className="gg-share-sheet__scan" />
        <div className="gg-share-sheet__head">
          <span className="gg-share-sheet__icon"><IconGlyph name="send" /></span>
          <div className="gg-share-sheet__title">
            <i>{kicker}</i>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {onClose && (
            <button className="gg-share-sheet__close" type="button" onClick={onClose} aria-label="Cerrar">
              <IconGlyph name="x" />
            </button>
          )}
        </div>

        {post && (
          <div className="gg-share-sheet__preview">
            <span className="gg-share-sheet__thumb">
              {post.thumb ? <img src={post.thumb} alt="" /> : (post.brand || 'GG').slice(0, 2).toUpperCase()}
            </span>
            <div className="gg-share-sheet__post">
              {post.brand && <i>{post.brand}</i>}
              <b>{post.title}</b>
              {post.line && <span>{post.line}</span>}
            </div>
          </div>
        )}

        <div className="gg-share-sheet__label"><IconGlyph name="globe" />{linkLabel}</div>
        <div className="gg-share-sheet__url">
          <input value={url} readOnly onFocus={event => event.target.select()} />
          <button className={`gg-share-sheet__copy${copied ? ' ok' : ''}`} type="button" onClick={copy} aria-label="Copiar enlace">
            <IconGlyph name={copied ? 'check' : 'fileText'} />
          </button>
        </div>

        <button className="gg-share-sheet__full" type="button" onClick={onShare}>
          <IconGlyph name="send" />
          {fullLabel}
        </button>

        {tabs.length > 0 && (
          <>
            <div className="gg-share-sheet__label"><IconGlyph name="users" />{sendLabel}</div>
            <div className="gg-share-sheet__tabs">
              {tabs.map((item, index) => (
                <button key={item.label} className={`gg-share-sheet__tab${index === tab ? ' on' : ''}`} type="button" onClick={() => setTab(index)}>
                  {item.icon && <IconGlyph name={item.icon} />}
                  {item.label}
                  {item.count > 0 && <span>{item.count}</span>}
                </button>
              ))}
            </div>
            {dests.length > 0 ? (
              <div className="gg-share-sheet__list">
                {dests.map(dest => (
                  <button className="gg-share-sheet__row" key={dest.key || dest.name} type="button" onClick={() => onSend?.(dest, active)}>
                    <img src={dest.avatar || '/demos/steliant-esports/avatar-default.svg'} alt="" />
                    <b>{dest.name}</b>
                    {dest.meta && <em>{dest.meta}</em>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="gg-share-sheet__empty">
                <IconGlyph name="users" />
                {emptyText}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


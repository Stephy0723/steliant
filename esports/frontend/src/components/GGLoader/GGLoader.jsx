import GGMark from '../Logo/GGMark.jsx'
import './GGLoader.css'

export default function GGLoader({ label = 'Sincronizando', sub = '', size = 'md', className = '' }) {
  return (
    <div className={`gg-loader gg-loader--${size} ${className}`} role="status" aria-live="polite">
      <div className="gg-loader__mark" aria-hidden="true">
        <GGMark className="gg-loader__svg gg-loader__svg--main" />
        <GGMark className="gg-loader__svg gg-loader__svg--red" />
        <GGMark className="gg-loader__svg gg-loader__svg--cyan" />
      </div>
      {label && <b>{label}</b>}
      {sub && <span>{sub}</span>}
    </div>
  )
}


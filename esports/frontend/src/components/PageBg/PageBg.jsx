import './PageBg.css'

// Fondo grande atmosférico para el final de páginas importantes
export default function PageBg({ gradient, imageUrl, style = {} }) {
  const bgStyle = imageUrl
    ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center top', ...style }
    : { background: gradient || 'linear-gradient(180deg,transparent 0%,rgba(var(--accent-rgb),.04) 40%,rgba(var(--accent-rgb),.12) 100%)', ...style }

  return (
    <div className="gg-pagebg">
      <div className="gg-pagebg__img" style={bgStyle} />
      <div className="gg-pagebg__fade" />
      <div className="gg-pagebg__grid" />
    </div>
  )
}


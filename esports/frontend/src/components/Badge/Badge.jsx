import './Badge.css'

// Badge reutilizable con variantes: accent | live | muted | warn | error.
export default function Badge({ children, variant = 'accent', className = '' }) {
  return (
    <span className={`gg-badge gg-badge--${variant} ${className}`}>{children}</span>
  )
}


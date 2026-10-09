import './Card.css'

// Tarjeta glassmorphism reutilizable con variantes de tamaño y hover.
export default function Card({ children, className = '', glow = false, ...rest }) {
  return (
    <div className={`gg-card-base ${glow ? 'gg-card-base--glow' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}


import './EmptyState.css'

// Estado vacío genérico con icono, título y descripción opcional.
export default function EmptyState({ icon, title, description, children }) {
  return (
    <div className="gg-empty">
      {icon && <div className="gg-empty__icon">{icon}</div>}
      <h3 className="gg-empty__title">{title}</h3>
      {description && <p className="gg-empty__desc">{description}</p>}
      {children && <div className="gg-empty__action">{children}</div>}
    </div>
  )
}


import './PageHeader.css'
import { GlitchGangText } from '../GlitchText/GlitchText.jsx'

// Cabecera de página reutilizable con título, subtítulo y slot para acciones.
export default function PageHeader({ title, sub, children }) {
  return (
    <div className="gg-ph">
      <div className="gg-ph__text">
        <h2 className="gg-ph__title"><GlitchGangText>{title}</GlitchGangText></h2>
        {sub && <p className="gg-ph__sub"><GlitchGangText>{sub}</GlitchGangText></p>}
      </div>
      {children && <div className="gg-ph__actions">{children}</div>}
    </div>
  )
}


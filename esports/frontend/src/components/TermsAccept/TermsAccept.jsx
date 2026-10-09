import { Link } from 'react-router-dom'
import './TermsAccept.css'

// Checkbox reutilizable de aceptación de Términos y Condiciones.
// Úsalo en cualquier formulario. Props: checked, onChange, error (bool), id.
export default function TermsAccept({ checked, onChange, error, id = 'terms-accept' }) {
  return (
    <label className={`gg-terms-accept ${error ? 'is-error' : ''}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={!!checked}
        onChange={e => onChange?.(e.target.checked)}
      />
      <span>
        He leído y acepto los{' '}
        <Link to="/terminos" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
          Términos y Condiciones
        </Link>{' '}
        y la Política de Privacidad.
      </span>
    </label>
  )
}


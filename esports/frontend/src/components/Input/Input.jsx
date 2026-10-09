import { useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import './Input.css'

// Componente de input reutilizable con label, error y opción de mostrar/ocultar contraseña.
export default function Input({
  label, error, type = 'text', className = '', ...rest
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (show ? 'text' : 'password') : type

  return (
    <div className={`gg-input ${error ? 'gg-input--error' : ''} ${className}`}>
      {label && <label className="gg-input__label">{label}</label>}
      <div className="gg-input__wrap">
        <input className="gg-input__field" {...rest} type={inputType} />
        {isPassword && (
          <button
            type="button"
            className="gg-input__eye"
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={show}
            // Sin esto el clic le quita el foco al input; se mantiene el
            // cursor donde estaba mientras se alterna la visibilidad.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShow((v) => !v)}
            tabIndex={-1}
          >
            {show ? Icon.eyeOff : Icon.eye}
          </button>
        )}
      </div>
      {error && <span className="gg-input__err">{error}</span>}
    </div>
  )
}


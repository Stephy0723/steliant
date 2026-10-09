import { sfx } from '../../lib/sfx.js'
import './Button.css'

export default function Button({ variant = 'primary', size = 'md', className = '', children, onClick, ...rest }) {
  // Los botones principales (las acciones importantes) suenan con un clic digital.
  const handleClick = variant === 'primary' ? event => { sfx('click'); onClick?.(event) } : onClick
  return (
    <button className={`gg-btn gg-btn--${variant} gg-btn--${size}${className ? ' ' + className : ''}`} onClick={handleClick} {...rest}>
      {children}
    </button>
  )
}


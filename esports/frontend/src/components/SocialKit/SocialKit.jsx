import { useEffect, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import '../../styles/social-kit.css'

// Piezas compartidas del kit "Chat y Amigos" (ui_kits/social) para /mensajes y /amigos.

export function I({ name, size = 16 }) {
  return <span className="sx-i" style={{ width: size, height: size }}>{Icon[name]}</span>
}

// Siglas de 2 letras: varias palabras -> inicial de las dos primeras
// ("Bot GlitchGang" -> BG); una palabra con mayusculas internas -> esas
// mayusculas ("AdminGG" -> AG); si no, las 2 primeras letras ("bra" -> BR).
export function avatarInitials(name = '') {
  const text = String(name).replace(/^#\s*/, '').trim()
  if (!text) return 'GG'
  const words = text.split(/[\s_\-.]+/).filter(Boolean)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  const caps = text.match(/[A-Z0-9]/g) || []
  if (caps.length >= 2 && /^[a-zA-Z]/.test(text) && caps[0] === text[0].toUpperCase()) return (caps[0] + caps[1]).toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

// `dot`: color del estado elegido (lib/presence.js); `dotLabel`: su nombre.
export function Av({ name = '', c, s = 44, on, sq, img, dot, dotLabel }) {
  // Si la imagen no carga (ruta rota en los datos) se muestran las iniciales, como en el kit.
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [img])
  const photo = img && !broken
  // data-no-translate: el traductor legacy cambiaba las siglas "AD" (AdminGG)
  // por "Anuncio" (diccionario Ad -> Anuncio) y el texto se salia del circulo.
  return (
    <span className={'sx-av' + (sq ? ' sx-av--sq' : '') + (photo ? ' sx-av--photo' : '')} style={{ '--s': s + 'px', '--c': c }} data-no-translate>
      {photo ? <img src={img} alt="" onError={() => setBroken(true)} /> : avatarInitials(name)}
      {on !== undefined && <i className={on === true ? '' : on === 'away' ? 'away' : 'off'} style={on && dot ? { background: dot } : undefined} title={dotLabel} />}
    </span>
  )
}


// Codigo de marcado internacional por pais (codigo de plataforma -- 'RD'
// para Republica Dominicana, no el ISO 'DO'). Fuente unica para Register.jsx
// y EditProfile.jsx: antes cada uno tenia su propia copia y se desalineaban.
export const DIAL_CODES = {
  RD: '+1', US: '+1', CA: '+1', MX: '+52', AR: '+54', CO: '+57', VE: '+58', CL: '+56', PE: '+51',
  EC: '+593', BO: '+591', PY: '+595', UY: '+598', BR: '+55', PA: '+507', CR: '+506', SV: '+503',
  GT: '+502', HN: '+504', NI: '+505', CU: '+53', PR: '+1', ES: '+34',
}

export function dialCodeFor(countryCode) {
  return DIAL_CODES[String(countryCode || '').toUpperCase()] || ''
}

// Lista de codigos unicos para un selector libre -- el codigo de telefono
// de alguien no depende de su pais de registro/residencia (ej. un
// dominicano viviendo afuera sigue teniendo un numero +1), asi que se deja
// elegir aparte en vez de derivarlo del campo "Pais".
export const UNIQUE_DIAL_CODES = [...new Set(Object.values(DIAL_CODES))]
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))

// Si el usuario pega/escribe su numero con el codigo de pais incluido
// (ej. "+18092183837" o "0018092183837"), esto separa el codigo del resto
// para autocompletar el selector -- sin adivinar nada cuando el numero no
// trae codigo (un "8092183837" suelto se deja tal cual, no hay forma
// confiable de saber a que pais pertenece un numero local sin el +).
export function splitDialCode(rawInput) {
  let value = String(rawInput || '').trim()
  if (value.startsWith('00')) value = `+${value.slice(2)}`
  if (!value.startsWith('+')) return null

  const match = UNIQUE_DIAL_CODES
    .filter(code => value.startsWith(code))
    .sort((a, b) => b.length - a.length)[0]
  if (!match) return null

  return { dialCode: match, number: value.slice(match.length).replace(/\D/g, '') }
}


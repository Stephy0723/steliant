// Enlaces escritos por usuarios (comunidades, solicitudes, comprobantes...) se
// pintan en href. Un "javascript:..." ahí ejecuta código al hacer clic -- y
// como la sesión vive en localStorage, robaría la cuenta de quien lo abra
// (incluido el admin que revisa solicitudes). Solo se dejan pasar http(s),
// mailto y rutas internas; todo lo demás queda sin enlace.
export function safeHref(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  try {
    const url = new URL(raw)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined
  } catch {
    // "midominio.com" sin protocolo: se asume https.
    return /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(raw) ? `https://${raw}` : undefined
  }
}


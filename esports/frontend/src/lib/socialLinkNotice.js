let listeners = new Set()
// showSocialLinkNotice se llama seguido dentro del useEffect de la pagina
// que vuelve del OAuth (Settings.jsx, ConnectDiscord.jsx...), que puede
// montar y disparar el aviso ANTES de que <SocialLinkNotice/> (montado mas
// abajo en App.jsx) alcance a suscribirse. Sin este buffer, ese aviso se
// emite sin nadie escuchando y se pierde para siempre.
let pending = []

export function subscribeSocialLinkNotices(cb) {
  listeners.add(cb)
  if (pending.length) {
    pending.forEach(item => cb(item))
    pending = []
  }
  return () => listeners.delete(cb)
}

export function showSocialLinkNotice(network, status = 'success', opts = {}) {
  const normalizedNetwork = network === 'whatsapp' ? 'whatsapp' : 'discord'
  const normalizedStatus = status === 'error' ? 'error' : 'success'
  const item = {
    id: Date.now() + Math.random(),
    network: normalizedNetwork,
    status: normalizedStatus,
    title: opts.title || '',
    message: opts.message || '',
    detail: opts.detail || '',
    duration: opts.duration ?? (normalizedStatus === 'error' ? 6800 : 5200),
  }
  if (listeners.size) {
    listeners.forEach(cb => cb(item))
  } else {
    pending.push(item)
  }
  return item.id
}


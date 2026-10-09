// ════════════════════════════════════════════════════════════
//  Sistema de notificaciones (toasts) global, sin contexto.
//  Reemplaza window.alert() por avisos modernos in-app.
//
//  Uso:  import { toast } from '../../lib/toast.js'
//        toast('Mensaje')                       // info
//        toast('Listo', 'success')              // success | error | info | warn
//        toast('Inscrito', 'success', { sound: 'register' })  // sonido propio; false = sin sonido
// ════════════════════════════════════════════════════════════

import { sfx } from './sfx.js'

let listeners = new Set()
let counter = 0

// Sonido por tipo de aviso; los informativos no suenan.
const TOAST_SOUNDS = { success: 'success', error: 'error', warn: 'denied', warning: 'denied' }

export function subscribeToasts(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function toast(message, type = 'success', opts = {}) {
  const item = {
    id: ++counter,
    message: String(message),
    type,                       // success | error | info | warn
    title: opts.title || '',
    action: opts.action || null,
    duration: opts.duration ?? 3800,
  }
  const sound = opts.sound ?? TOAST_SOUNDS[type]
  if (sound) sfx(sound)
  listeners.forEach(cb => cb(item))
  return item.id
}


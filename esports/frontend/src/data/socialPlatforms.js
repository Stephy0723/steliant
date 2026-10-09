// Redes sociales soportadas en perfiles (organizador, staff, comunidad...).
// `icon` es la clave en components/icons/Icons.jsx. `build` recibe el valor
// guardado (handle o URL) y devuelve la URL final; acepta ya una URL completa.

import { WHATSAPP_ENABLED } from '../config/featureFlags.js'

const handle = (base) => (value) => {
  const v = String(value || '').trim().replace(/^@/, '')
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  return base + v
}

export const SOCIAL_PLATFORMS = [
  { id: 'twitter',   label: 'X (Twitter)', icon: 'socialX',   placeholder: '@usuario',        build: handle('https://x.com/') },
  { id: 'instagram', label: 'Instagram',   icon: 'instagram', placeholder: '@usuario',        build: handle('https://instagram.com/') },
  { id: 'tiktok',    label: 'TikTok',      icon: 'tiktok',    placeholder: '@usuario',        build: handle('https://tiktok.com/@') },
  { id: 'youtube',   label: 'YouTube',     icon: 'youtube',   placeholder: '@canal',          build: handle('https://youtube.com/') },
  { id: 'twitch',    label: 'Twitch',      icon: 'twitch',    placeholder: 'canal',           build: handle('https://twitch.tv/') },
  { id: 'kick',      label: 'Kick',        icon: 'kick',      placeholder: 'canal',           build: handle('https://kick.com/') },
  { id: 'facebook',  label: 'Facebook',    icon: 'facebook',  placeholder: 'pagina o perfil', build: handle('https://facebook.com/') },
  { id: 'discord',   label: 'Discord',     icon: 'discord',   placeholder: 'invitacion o usuario', build: (v) => (/^https?:\/\//i.test(String(v || '').trim()) ? String(v).trim() : '') },
  { id: 'telegram',  label: 'Telegram',    icon: 'telegram',  placeholder: '@usuario o canal', build: handle('https://t.me/') },
  ...(WHATSAPP_ENABLED ? [{ id: 'whatsapp',  label: 'WhatsApp',    icon: 'whatsapp',  placeholder: 'link de grupo o numero', build: (v) => {
    const s = String(v || '').trim()
    if (!s) return ''
    if (/^https?:\/\//i.test(s)) return s
    const digits = s.replace(/[^\d]/g, '')
    return digits ? `https://wa.me/${digits}` : ''
  } }] : []),
]

export function organizerSocialLinks(social = {}) {
  return SOCIAL_PLATFORMS
    .map(p => ({ ...p, url: p.build(social[p.id]) }))
    .filter(p => p.url)
}


export const BANNER_GIFT_STORAGE_KEY = 'gg-banner-gift-unlocked'
export const BANNER_GIFT_EQUIPPED_KEY = 'gg-banner-gift-equipped'
export const BANNER_GIFT_NOTIFICATION_DISMISSED_KEY = 'gg-banner-gift-notification-dismissed'
// La notificacion de bienvenida no existe en el backend: se arma en el
// cliente en cada carga de /notifications (al entrar y en cada poll de 30s).
// Sin guardar el "leida" aqui, volvia a salir sin leer cada vez.
export const BANNER_GIFT_NOTIFICATION_READ_KEY = 'gg-banner-gift-notification-read'
export const BANNER_GIFT_NOTIFICATION_ID = 7001

export const BANNER_GIFT_ITEMS = [
  { id: 'basic-1', type: 'image', label: 'Basic 1', src: '/demos/steliant-esports/banner/Basic1.jpg' },
  { id: 'basic-2', type: 'image', label: 'Basic 2', src: '/demos/steliant-esports/banner/Basic2.jpg' },
  { id: 'basic-3', type: 'image', label: 'Basic Motion', src: '/demos/steliant-esports/banner/Basic2.jpg', poster: '/demos/steliant-esports/banner/Basic2.jpg' },
  { id: 'basic-4', type: 'image', label: 'Basic 4', src: '/demos/steliant-esports/banner/Basic4.jpg' },
  { id: 'basic-5', type: 'image', label: 'Basic 5', src: '/demos/steliant-esports/banner/Basic5.jpg' },
]

export const DEFAULT_BANNER_GIFT = BANNER_GIFT_ITEMS[0]

export function unlockBannerGift() {
  localStorage.setItem(BANNER_GIFT_STORAGE_KEY, '1')
  localStorage.removeItem(BANNER_GIFT_NOTIFICATION_DISMISSED_KEY)
  localStorage.removeItem(BANNER_GIFT_NOTIFICATION_READ_KEY)
  if (!localStorage.getItem(BANNER_GIFT_EQUIPPED_KEY)) {
    localStorage.setItem(BANNER_GIFT_EQUIPPED_KEY, DEFAULT_BANNER_GIFT.src)
  }
}

export function isBannerGiftUnlocked() {
  return localStorage.getItem(BANNER_GIFT_STORAGE_KEY) === '1'
}

export function getEquippedBannerGift() {
  const src = localStorage.getItem(BANNER_GIFT_EQUIPPED_KEY)
  return BANNER_GIFT_ITEMS.find(item => item.src === src) || DEFAULT_BANNER_GIFT
}

export function buildBannerGiftNotification() {
  return {
    id: BANNER_GIFT_NOTIFICATION_ID,
    type: 'bienvenida',
    category: 'sistema',
    group: 'hoy',
    title: 'Regalo de bienvenida desbloqueado',
    desc: 'Has recibido tu pack de banners iniciales para personalizar tu perfil y dashboard.',
    time: 'ahora',
    read: localStorage.getItem(BANNER_GIFT_NOTIFICATION_READ_KEY) === '1',
    rewardGift: {
      title: 'Paquete Starter Banner',
      subtitle: 'Desbloqueado para tu cuenta nueva',
      note: 'Este pack ya está activo como fondo principal y también queda guardado para tu perfil.',
      items: BANNER_GIFT_ITEMS,
      equipped: getEquippedBannerGift().src,
    },
  }
}


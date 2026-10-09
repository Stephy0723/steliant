// ════════════════════════════════════════════════════════════
//  Preferencias del usuario — persistidas en localStorage.
//  Hace que los ajustes sean realmente funcionales entre sesiones.
// ════════════════════════════════════════════════════════════

const KEY = 'gg-settings'

// NOTA: 2FA, conexiones sociales, notificaciones, alertas de login y
// "mensajes/equipos" de Privacidad NO viven aquí — son datos reales del
// usuario (`user.twoFactorEnabled`, `user.discord`, `user.notificationPrefs`,
// `user.security`, `user.privacy`) que vienen del backend y se guardan via
// PATCH /profile/me (ver Settings.jsx). Este store es solo para preferencias
// de interfaz que todavía no tienen un campo en el servidor.
export const DEFAULT_SETTINGS = {
  // Rendimiento y experiencia
  perfMode: false,      // baja la calidad (desactiva animaciones/efectos pesados)
  autoReduce: true,     // sugerir modo rendimiento si la web va lenta
  sound: false,         // sonidos/melodías ambientales
  sfx: true,            // efectos de sonido (listo, error, inscripción...)
  volume: 0.35,
}

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return raw ? { ...DEFAULT_SETTINGS, ...raw } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* noop */ }
}


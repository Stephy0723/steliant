// El backend es la fuente real por defecto.
// Solo usa VITE_USE_BACKEND=false para demos aisladas sin datos compartidos.
export const USE_BACKEND = String(import.meta.env.VITE_USE_BACKEND ?? 'true') !== 'false'


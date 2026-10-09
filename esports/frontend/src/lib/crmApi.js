// Cliente de la API del CRM del bot de Discord (datos reales de SQLite).
// Base configurable por env; por defecto el CRM_PORT del bot (3001).
const CRM_BASE = import.meta.env.VITE_CRM_URL || 'http://localhost:3001'

export async function crmApi(path) {
  const res = await fetch(`${CRM_BASE}${path}`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && (data.error || data.message)) || `CRM respondió ${res.status}`)
  return data
}

export { CRM_BASE }


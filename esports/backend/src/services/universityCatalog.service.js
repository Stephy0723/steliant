// Catálogo de universidades respaldado en Mongo (editable por admins).
// La primera vez se siembra desde config/universityCatalog.js; si Mongo está
// deshabilitado se usa ese catálogo estático tal cual.
import { UniversityCatalog } from '../models/UniversityCatalog.js'
import { getUniversityCatalogByRegion } from '../config/universityCatalog.js'
import { config } from '../config/index.js'

let seeded = false

// Catálogo estático ya enriquecido con carreras, campus y dominios
const STATIC_CATALOG = getUniversityCatalogByRegion('rd')

const localLogo = (id) => `/universities/${id}.png`

export const matchesUniversityDomain = (domains = [], email = '') => {
  const value = String(email || '').trim().toLowerCase()
  const domain = value.includes('@') ? value.split('@').pop() : value
  if (!domain) return false
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`))
}

export async function ensureUniversitySeed() {
  if (seeded || !config.mongoEnabled) return
  const existing = await UniversityCatalog.find({ id: { $exists: true } }).select('id logo allowedDomains').lean()
  const byId = new Map(existing.map((u) => [u.id, u]))

  const ops = []
  for (const item of STATIC_CATALOG) {
    const current = byId.get(item.id)
    if (!current) {
      ops.push({ insertOne: { document: { ...item, active: true } } })
      continue
    }
    const $set = {}
    // El catálogo anterior no tenía dominios: se toman de las reglas estáticas.
    if (!Array.isArray(current.allowedDomains) || current.allowedDomains.length === 0) {
      $set.allowedDomains = item.allowedDomains
    }
    // Los logos /universities/<id>.jpeg del catálogo anterior nunca se subieron
    // al repo (imagen rota): se apuntan al PNG oficial que sí existe.
    if (!current.logo || (/^\/universities\//.test(current.logo) && current.logo !== localLogo(item.id))) {
      $set.logo = localLogo(item.id)
    }
    if (Object.keys($set).length) ops.push({ updateOne: { filter: { _id: current._id }, update: { $set } } })
  }
  if (ops.length) await UniversityCatalog.bulkWrite(ops)
  seeded = true
}

const staticItem = (id) => STATIC_CATALOG.find((u) => u.id === id) || null

export async function listCatalog({ region = 'rd', includeInactive = false } = {}) {
  if (!config.mongoEnabled) return STATIC_CATALOG.filter((u) => !region || u.region === region)
  await ensureUniversitySeed()
  const filter = { id: { $exists: true } }
  if (region) filter.region = region
  if (!includeInactive) filter.active = true
  return UniversityCatalog.find(filter).sort(includeInactive ? { active: -1, name: 1 } : { name: 1 }).lean()
}

export async function getCatalogItem(id = '', { includeInactive = false } = {}) {
  const key = String(id || '').trim().toLowerCase()
  if (!key) return null
  if (!config.mongoEnabled) return staticItem(key)
  await ensureUniversitySeed()
  const filter = { id: key }
  if (!includeInactive) filter.active = true
  return UniversityCatalog.findOne(filter).lean()
}

export async function findCatalogItemByEmail(email = '') {
  const items = await listCatalog({ region: '' })
  return items.find((u) => matchesUniversityDomain(u.allowedDomains || [], email)) || null
}

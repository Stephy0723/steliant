// ── Publication requests ──────────────────────────────────────────
// El request/conteo mensual real ahora vive en el backend (ver
// controllers/publicationRequests.controller.js + PublishModal.jsx /
// AdminBanners.jsx) -- esto era localStorage por navegador, asi que el
// admin nunca podia ver las solicitudes de otra persona ni el limite
// mensual era real (se reseteaba con solo cambiar de navegador).
export const EXTRA_PUB_PRICE = 4

// ── Ads management ────────────────────────────────────────────────
// Slots: 'banner' = hero carousel | 'tournament' = strip torneos | 'floating' = toast flotante
const ADS_KEY = 'gg-ads'

const DEFAULT_ADS = [
  {
    id: 'banner-1', slot: 'banner', active: true, type: 'platform', order: 0,
    title: 'GG SPRING SPLIT', uid: 'AD-GGS01', badge: 'PRO SERIES',
    description: '16 equipos de élite. $5,000 en premios. La temporada arranca ahora.',
    imageUrl: '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    color1: '#FF4655', color2: '#0e1118', textColor: '#fff',
    btnText: 'INSCRIBIRSE', btnUrl: '/torneos/1',
    live: true, prize: '$5,000', scheduledDate: '2026-06-01',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'banner-3', slot: 'banner', active: true, type: 'platform', order: 1,
    title: 'GG INVITATIONAL', uid: 'AD-CS2E1', badge: 'INVITATIONAL',
    description: '32 equipos de CS2 por la gloria y una bolsa de $10,000.',
    imageUrl: '/demos/steliant-esports/ImaHorizontal/cs2.jpg',
    color1: '#F3A800', color2: '#0e1118', textColor: '#000',
    btnText: 'VER DETALLES', btnUrl: '/torneos/3',
    live: false, prize: '$10,000', scheduledDate: '2026-06-05',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'banner-4', slot: 'banner', active: true, type: 'platform', order: 2,
    title: 'APEX GLITCHCUP', uid: 'AD-APX03', badge: 'GLITCHCUP',
    description: 'La batalla definitiva en las Tierras Salvajes con $1,200 en juego.',
    imageUrl: '/demos/steliant-esports/ImaHorizontal/Apex.webp',
    color1: '#CD3333', color2: '#0e1118', textColor: '#fff',
    btnText: 'VER DETALLES', btnUrl: '/torneos/4',
    live: false, prize: '$1,200', scheduledDate: '2026-06-07',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'banner-5', slot: 'banner', active: true, type: 'platform', order: 3,
    title: 'MLBB CARIBBEAN CLASH', uid: 'AD-MLB01', badge: 'CARIBBEAN CLASH',
    description: 'El enfrentamiento más caliente del Caribe en Mobile Legends.',
    imageUrl: '/demos/steliant-esports/ImaHorizontal/MLBB.webp',
    color1: '#3EA7E9', color2: '#0e1118', textColor: '#fff',
    btnText: 'VER DETALLES', btnUrl: '/torneos/8',
    live: false, prize: '$250,000', scheduledDate: '2026-06-05',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  // Floating sponsor toast
  {
    id: 'floating-1', slot: 'floating', active: true, type: 'brand', order: 0,
    title: 'Federacion Dominicana de Videojuegos', uid: 'SPO-FDV-001', badge: 'Aliado institucional',
    description: 'Impulsando torneos, jugadores y comunidades competitivas de Republica Dominicana.',
    imageUrl: '/demos/steliant-esports/brands/fdde.jpg',
    color1: '#0B4F8A', color2: '#0e1118', textColor: '#fff',
    btnText: 'Conocer mas', btnUrl: 'https://www.facebook.com/fdde.do',
    live: false, prize: '', scheduledDate: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'floating-2', slot: 'floating', active: false, type: 'brand', order: 1,
    title: 'NPC Latino', uid: 'SPO-NPC-001', badge: 'Media partner',
    description: 'Noticias, cultura y esports para conectar a la comunidad latina.',
    imageUrl: '/demos/steliant-esports/brands/npc-latino.png',
    color1: '#F47B20', color2: '#0e1118', textColor: '#fff',
    btnText: 'Visitar NPC Latino', btnUrl: 'https://npclatino.com/',
    live: false, prize: '', scheduledDate: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  // Dashboard sponsor strip
  {
    id: 'dashboard-1', slot: 'dashboard', active: true, type: 'brand', order: 0,
    title: 'Federacion Dominicana de Videojuegos', uid: 'SPO-FDV-002', badge: 'Aliado institucional',
    description: 'Competencia organizada, comunidad y desarrollo nacional.',
    imageUrl: '/demos/steliant-esports/brands/fdde.jpg',
    color1: '#0B4F8A', color2: '#0e1118', textColor: '#fff',
    btnText: 'Conocer mas', btnUrl: 'https://www.facebook.com/fdde.do',
    live: false, prize: '', scheduledDate: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dashboard-2', slot: 'dashboard', active: false, type: 'brand', order: 1,
    title: 'NPC Latino', uid: 'SPO-NPC-002', badge: 'Media partner',
    description: 'Cobertura y contenido competitivo para jugadores, fans y organizadores.',
    imageUrl: '/demos/steliant-esports/brands/npc-latino.png',
    color1: '#F47B20', color2: '#0e1118', textColor: '#fff',
    btnText: 'Visitar NPC Latino', btnUrl: 'https://npclatino.com/',
    live: false, prize: '', scheduledDate: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

const ADS_VERSION = 3
const LEGACY_BRAND_PATTERN = /hyperx|logitech|red bull|redbull|corsair|secretlab|msi|hx-2026|lg-2026|rb-2026|cs-2026|sl-2026|msi-2026/i

function isLegacyBrandAd(ad) {
  return LEGACY_BRAND_PATTERN.test([
    ad?.id,
    ad?.uid,
    ad?.title,
    ad?.badge,
    ad?.description,
    ad?.btnText,
  ].filter(Boolean).join(' '))
}

export function getAds() {
  try {
    const raw = localStorage.getItem(ADS_KEY)
    if (!raw) return [...DEFAULT_ADS]
    const saved = JSON.parse(raw).filter(ad => !isLegacyBrandAd(ad))
    // Migrate: inject new slots (floating, dashboard) if missing
    const hasFloating  = saved.some(a => a.slot === 'floating')
    const hasDashboard = saved.some(a => a.slot === 'dashboard')
    if (!hasFloating || !hasDashboard) {
      const newSlots = DEFAULT_ADS.filter(a =>
        (!hasFloating && a.slot === 'floating') || (!hasDashboard && a.slot === 'dashboard')
      )
      const merged = [...saved, ...newSlots]
      saveAds(merged)
      return merged
    }
    if (saved.length !== JSON.parse(raw).length) saveAds(saved)
    return saved
  } catch { return [...DEFAULT_ADS] }
}
export function saveAds(ads) { localStorage.setItem(ADS_KEY, JSON.stringify(ads)) }
export function addAd(ad) { const ads = getAds(); saveAds([...ads, ad]) }
export function updateAd(id, updates) {
  saveAds(getAds().map(a => a.id === id ? { ...a, ...updates } : a))
}
export function deleteAd(id) { saveAds(getAds().filter(a => a.id !== id)) }
export function resetAds() { localStorage.removeItem(ADS_KEY) }

// ── Analytics ─────────────────────────────────────────────────────
// Each entry: { imp: [{h, d}], clk: [{h, d}] }  h=hour 0-23, d='YYYY-MM-DD'
const STATS_KEY = 'gg-ad-stats'

function getRawStats() { try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}') } catch { return {} } }
function saveRawStats(data) { localStorage.setItem(STATS_KEY, JSON.stringify(data)) }

export function trackImpression(adId) {
  if (!adId) return
  const data = getRawStats()
  if (!data[adId]) data[adId] = { imp: [], clk: [] }
  const now = new Date()
  data[adId].imp.push({ h: now.getHours(), d: now.toISOString().slice(0, 10) })
  if (data[adId].imp.length > 8000) data[adId].imp = data[adId].imp.slice(-8000)
  saveRawStats(data)
}

export function trackClick(adId) {
  if (!adId) return
  const data = getRawStats()
  if (!data[adId]) data[adId] = { imp: [], clk: [] }
  const now = new Date()
  data[adId].clk.push({ h: now.getHours(), d: now.toISOString().slice(0, 10) })
  saveRawStats(data)
}

export function getAdStats(adId) {
  const raw = getRawStats()[adId] || { imp: [], clk: [] }

  // Hourly distribution 0-23
  const hourly = Array(24).fill(0)
  raw.imp.forEach(e => { if (e.h >= 0 && e.h < 24) hourly[e.h]++ })

  // Last 7 days
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6 - i))
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('es-DO', { weekday: 'short', day: '2-digit' }), imp: 0, clk: 0 }
  })
  raw.imp.forEach(e => { const day = days.find(d => d.date === e.d); if (day) day.imp++ })
  raw.clk.forEach(e => { const day = days.find(d => d.date === e.d); if (day) day.clk++ })

  // Last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
    return { month: d.toISOString().slice(0, 7), label: d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' }), imp: 0, clk: 0 }
  })
  raw.imp.forEach(e => { const m = months.find(m => m.month === e.d.slice(0, 7)); if (m) m.imp++ })
  raw.clk.forEach(e => { const m = months.find(m => m.month === e.d.slice(0, 7)); if (m) m.clk++ })

  const maxHour = Math.max(...hourly)
  const peakHour = maxHour > 0 ? hourly.indexOf(maxHour) : null

  return {
    impressions: raw.imp.length,
    clicks: raw.clk.length,
    ctr: raw.imp.length ? +(raw.clk.length / raw.imp.length * 100).toFixed(1) : 0,
    hourly,
    peakHour,
    days,
    months,
  }
}

export function getAllStats() {
  const data = getRawStats()
  return Object.fromEntries(Object.keys(data).map(id => [id, getAdStats(id)]))
}

// Seed realistic demo data so the dashboard is not empty on first load
export function seedDemoAnalytics() {
  if (Object.keys(getRawStats()).length > 0) return
  const ads = getAds()
  const data = {}
  const now = new Date()
  // Gaming peak hours: low 0-11, rising 12-15, peak 16-22, drop 23
  const hw = [1,0,0,0,0,1,2,3,4,5,6,7,8,9,11,13,18,23,28,30,26,22,16,8]
  const totalW = hw.reduce((s, v) => s + v, 0)
  const pickHour = () => { let r = Math.random() * totalW; for (let h = 0; h < 24; h++) { r -= hw[h]; if (r <= 0) return h } return 20 }
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

  ads.forEach((ad, i) => {
    data[ad.id] = { imp: [], clk: [] }
    const total = rnd(4000 + i * 600, 12000 + i * 1400)
    for (let n = 0; n < total; n++) {
      const dAgo = rnd(0, 89)
      const d = new Date(now); d.setDate(d.getDate() - dAgo)
      data[ad.id].imp.push({ h: pickHour(), d: d.toISOString().slice(0, 10) })
    }
    const clicks = Math.floor(total * (rnd(4, 11) / 100))
    for (let n = 0; n < clicks; n++) {
      const dAgo = rnd(0, 89)
      const d = new Date(now); d.setDate(d.getDate() - dAgo)
      data[ad.id].clk.push({ h: rnd(15, 22), d: d.toISOString().slice(0, 10) })
    }
  })
  saveRawStats(data)
}

export function resetStats() { localStorage.removeItem(STATS_KEY) }

// ── Brand-level analytics — pre-aggregated (no raw event arrays) ──
// Format: { [brandId]: { impressions, clicks, hourly:[24], days:{'YYYY-MM-DD':{imp,clk}}, months:{'YYYY-MM':{imp,clk}} } }
const BRAND_STATS_KEY = 'gg-brand-stats'
const BRAND_STATS_V = 2  // bump to discard old raw-event data

function getRawBrandStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BRAND_STATS_KEY) || '{}')
    if (parsed.__v !== BRAND_STATS_V) return {}
    return parsed
  } catch { return {} }
}
function saveRawBrandStats(data) {
  try { localStorage.setItem(BRAND_STATS_KEY, JSON.stringify({ ...data, __v: BRAND_STATS_V })) } catch {}
}

function emptyBrand() {
  return { impressions: 0, clicks: 0, hourly: Array(24).fill(0), days: {}, months: {} }
}

export function getBrandStats(brandId) {
  const all = getRawBrandStats()
  const b = all[brandId] || emptyBrand()
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    return { date: key, label: d.toLocaleDateString('es-DO', { weekday: 'short', day: '2-digit' }), ...(b.days[key] || { imp: 0, clk: 0 }) }
  })
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
    const key = d.toISOString().slice(0, 7)
    return { month: key, label: d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' }), ...(b.months[key] || { imp: 0, clk: 0 }) }
  })
  const hourly = b.hourly || Array(24).fill(0)
  const maxH = Math.max(...hourly)
  return {
    impressions: b.impressions || 0,
    clicks: b.clicks || 0,
    ctr: b.impressions ? +(b.clicks / b.impressions * 100).toFixed(1) : 0,
    hourly, peakHour: maxH > 0 ? hourly.indexOf(maxH) : null,
    days, months,
  }
}

export function trackBrandImpression(brandId) {
  if (!brandId) return
  const data = getRawBrandStats()
  if (!data[brandId]) data[brandId] = emptyBrand()
  const now = new Date()
  const h = now.getHours()
  const day = now.toISOString().slice(0, 10)
  const mon = day.slice(0, 7)
  data[brandId].impressions = (data[brandId].impressions || 0) + 1
  data[brandId].hourly[h] = (data[brandId].hourly[h] || 0) + 1
  if (!data[brandId].days[day]) data[brandId].days[day] = { imp: 0, clk: 0 }
  data[brandId].days[day].imp++
  if (!data[brandId].months[mon]) data[brandId].months[mon] = { imp: 0, clk: 0 }
  data[brandId].months[mon].imp++
  saveRawBrandStats(data)
}

export function trackBrandClick(brandId) {
  if (!brandId) return
  const data = getRawBrandStats()
  if (!data[brandId]) data[brandId] = emptyBrand()
  const now = new Date()
  const h = now.getHours()
  const day = now.toISOString().slice(0, 10)
  const mon = day.slice(0, 7)
  data[brandId].clicks = (data[brandId].clicks || 0) + 1
  data[brandId].hourly[h] = (data[brandId].hourly[h] || 0) + 1
  if (!data[brandId].days[day]) data[brandId].days[day] = { imp: 0, clk: 0 }
  data[brandId].days[day].clk++
  if (!data[brandId].months[mon]) data[brandId].months[mon] = { imp: 0, clk: 0 }
  data[brandId].months[mon].clk++
  saveRawBrandStats(data)
}

export function seedDemoBrandAnalytics(sponsors) {
  const existing = getRawBrandStats()
  if (Object.keys(existing).filter(k => k !== '__v').length > 0) return
  const data = {}
  const now = new Date()
  const hw = [1,0,0,0,0,1,2,3,5,7,9,10,11,12,14,17,22,28,32,35,30,25,18,9]
  const totalW = hw.reduce((s, v) => s + v, 0)
  const pickH = () => { let r = Math.random() * totalW; for (let h = 0; h < 24; h++) { r -= hw[h]; if (r <= 0) return h } return 19 }
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
  const tierBase = { platinum: 45000, gold: 22000, silver: 9000 }

  sponsors.forEach(sp => {
    const b = emptyBrand()
    const base = tierBase[sp.tier] || 10000
    const total = rnd(Math.floor(base * 0.8), Math.floor(base * 1.4))
    const clicks = Math.floor(total * (rnd(4, 12) / 100))

    // Distribute impressions across 90 days using hour weights
    for (let n = 0; n < total; n++) {
      const dAgo = rnd(0, 89)
      const d = new Date(now); d.setDate(d.getDate() - dAgo)
      const day = d.toISOString().slice(0, 10)
      const mon = day.slice(0, 7)
      const h = pickH()
      b.impressions++
      b.hourly[h]++
      if (!b.days[day]) b.days[day] = { imp: 0, clk: 0 }
      b.days[day].imp++
      if (!b.months[mon]) b.months[mon] = { imp: 0, clk: 0 }
      b.months[mon].imp++
    }
    // Distribute clicks (peak hours 16-22)
    for (let n = 0; n < clicks; n++) {
      const dAgo = rnd(0, 89)
      const d = new Date(now); d.setDate(d.getDate() - dAgo)
      const day = d.toISOString().slice(0, 10)
      const mon = day.slice(0, 7)
      b.clicks++
      if (!b.days[day]) b.days[day] = { imp: 0, clk: 0 }
      b.days[day].clk++
      if (!b.months[mon]) b.months[mon] = { imp: 0, clk: 0 }
      b.months[mon].clk++
    }
    data[sp.id] = b
  })
  saveRawBrandStats(data)
}

export function resetBrandStats() { localStorage.removeItem(BRAND_STATS_KEY) }

// ── Promo campaigns (interstitial modal ads) ─────────────────────
const PROMOS_KEY = 'gg-promo-campaigns'
const DEFAULT_PROMOS = [
  {
    id: 'fdv-2026', active: true, order: 0,
    title: 'Federacion Dominicana de Videojuegos',
    subtitle: 'Competencia organizada, comunidad y desarrollo nacional',
    description: 'Apoyo institucional para torneos, jugadores, organizadores y comunidades competitivas de Republica Dominicana.',
    badge: 'Aliado institucional',
    cta: 'Conocer la federacion', ctaUrl: 'https://www.facebook.com/fdde.do',
    bg: 'linear-gradient(135deg, #03111f 0%, #0b4f8a 48%, #19070a 100%)',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'npc-2026', active: true, order: 1,
    title: 'NPC Latino',
    subtitle: 'La escena latina de videojuegos en un solo lugar',
    description: 'Cobertura, historias y contenido competitivo para conectar a jugadores, fans y organizadores de LATAM.',
    badge: 'Media partner',
    cta: 'Visitar NPC Latino', ctaUrl: 'https://npclatino.com/',
    bg: 'linear-gradient(135deg, #090909 0%, #1f140d 52%, #f47b20 100%)',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

export function getPromos() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROMOS_KEY))
    if (!saved) return [...DEFAULT_PROMOS]
    const clean = saved.filter(promo => !isLegacyBrandAd(promo))
    if (!clean.length) {
      savePromos(DEFAULT_PROMOS)
      return [...DEFAULT_PROMOS]
    }
    if (clean.length !== saved.length) savePromos(clean)
    return clean
  } catch { return [...DEFAULT_PROMOS] }
}
export function savePromos(promos) { localStorage.setItem(PROMOS_KEY, JSON.stringify(promos)) }
export function addPromo(promo) { savePromos([...getPromos(), promo]) }
export function updatePromo(id, updates) {
  savePromos(getPromos().map(p => p.id === id ? { ...p, ...updates } : p))
}
export function deletePromo(id) { savePromos(getPromos().filter(p => p.id !== id)) }
export function resetPromos() { localStorage.removeItem(PROMOS_KEY) }

// ── Campaign → Banner bridge ──────────────────────────────────────
// Maps an approved Campaign (MongoDB doc) into the ad format used by AdminBanners.
const PLACEMENT_TO_SLOT = {
  'home-banner':    'banner',
  'banner-inicio':  'banner',
  'bracket':        'tournament',
  'banner-torneos': 'tournament',
}
export function injectCampaignToAds(campaign, brand) {
  const adId = `camp-${campaign._id}`
  // Avoid duplicates
  if (getAds().find(a => a.id === adId)) return
  const slot  = PLACEMENT_TO_SLOT[campaign.placement] || 'banner'
  const color = brand?.color || '#F0A500'
  addAd({
    id:            adId,
    campaignId:    campaign._id,
    slot,
    active:        true,
    type:          'brand',
    order:         getAds().length,
    title:         campaign.name,
    uid:           brand?.code ? `SPO-${brand.code}` : `CAMP-${String(campaign._id).slice(-4).toUpperCase()}`,
    badge:         brand?.name || 'Patrocinador',
    description:   campaign.description || '',
    imageUrl:      campaign.imageUrl || '',
    btnText:       'Visitar',
    btnUrl:        campaign.linkUrl || '#',
    color1:        color,
    color2:        '#0e1118',
    textColor:     '#fff',
    live:          false,
    prize:         campaign.budget > 0 ? `$${campaign.budget.toLocaleString()}` : '',
    scheduledDate: campaign.startDate ? String(campaign.startDate).slice(0, 10) : '',
    createdAt:     new Date().toISOString(),
  })
}

import { api } from './api.js'

// Anuncios "de casa" (banner/tournament/floating/dashboard) — reemplaza el
// almacenamiento local que tenía pubStore.js. Ver Creative/Campaign para el
// sistema de anuncios de marcas pagadas, que es independiente de este.
export const getSiteAds       = ()              => api('/site-ads')
export const createSiteAd     = ad              => api('/admin/site-ads', { method: 'POST', body: ad })
export const updateSiteAd     = (id, updates)   => api(`/admin/site-ads/${id}`, { method: 'PATCH', body: updates })
export const deleteSiteAd     = id              => api(`/admin/site-ads/${id}`, { method: 'DELETE' })
export const reorderSiteAds   = items           => api('/admin/site-ads/reorder', { method: 'PATCH', body: { items } })
export const trackSiteAdView  = id              => api(`/site-ads/${id}/impression`, { method: 'POST' }).catch(() => {})
export const trackSiteAdClick = id              => api(`/site-ads/${id}/click`, { method: 'POST' }).catch(() => {})

export const getSitePromos    = ()              => api('/site-promos')
export const createSitePromo  = promo           => api('/admin/site-promos', { method: 'POST', body: promo })
export const updateSitePromo  = (slug, updates) => api(`/admin/site-promos/${slug}`, { method: 'PATCH', body: updates })
export const deleteSitePromo  = slug            => api(`/admin/site-promos/${slug}`, { method: 'DELETE' })


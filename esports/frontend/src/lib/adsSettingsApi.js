import { api } from './api.js'

// GET /settings/ads — público, { banner, tournament, floating, dashboard, promo }
export const getAdsVisibility = () => api('/settings/ads')

// PATCH /admin/settings/ads — solo admin
export const setAdSlotVisibility = (slot, enabled) =>
  api('/admin/settings/ads', { method: 'PATCH', body: { slot, enabled } })


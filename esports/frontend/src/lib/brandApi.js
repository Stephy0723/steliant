import { api } from './api.js'

// ── Public ────────────────────────────────────────────────────────────────────
export const getPublicBrands   = ()     => api('/brands')
export const getPlatformStats  = ()     => api('/demos/steliant-esports/brands/meta/stats')
export const submitApplication = (data) => api('/demos/steliant-esports/brands/apply', { method: 'POST', body: JSON.stringify(data) })

// ── Brand portal ──────────────────────────────────────────────────────────────
export const getMyBrand             = ()     => api('/demos/steliant-esports/brands/me/brand')
export const getSponsorableTourneys = ()     => api('/demos/steliant-esports/brands/me/tournaments')
export const submitProfileChanges   = (data) => api('/demos/steliant-esports/brands/me/profile', { method: 'PATCH', body: JSON.stringify(data) })
export const getBrandReports        = ()     => api('/demos/steliant-esports/brands/me/reports')
export const getBrandReportFile     = (rid)  => api(`/demos/steliant-esports/brands/me/reports/${rid}/file`)
export const markReportRead         = (rid)  => api(`/demos/steliant-esports/brands/me/reports/${rid}/read`, { method: 'PATCH' })

// ── Campaigns ─────────────────────────────────────────────────────────────────
export const getCampaigns            = (id)         => api(`/demos/steliant-esports/brands/${id}/campaigns`)
export const createCampaign          = (id, data)   => api(`/demos/steliant-esports/brands/${id}/campaigns`, { method: 'POST', body: JSON.stringify(data) })
export const updateCampaign          = (id, cid, d) => api(`/demos/steliant-esports/brands/${id}/campaigns/${cid}`, { method: 'PATCH', body: JSON.stringify(d) })
export const deleteCampaign          = (id, cid)    => api(`/demos/steliant-esports/brands/${id}/campaigns/${cid}`, { method: 'DELETE' })
export const submitCampaignForReview = (id, cid)    => api(`/demos/steliant-esports/brands/${id}/campaigns/${cid}/submit`, { method: 'POST' })
export const submitPaymentProof      = (id, cid, d) => api(`/demos/steliant-esports/brands/${id}/campaigns/${cid}/invoice`, { method: 'POST', body: JSON.stringify(d) })

// ── Creatives ─────────────────────────────────────────────────────────────────
export const getCreatives               = (id)          => api(`/demos/steliant-esports/brands/${id}/creatives`)
export const getCreativeFile            = (id, crid)    => api(`/demos/steliant-esports/brands/${id}/creatives/${crid}/file`)
export const uploadCreative             = (id, data)    => api(`/demos/steliant-esports/brands/${id}/creatives`, { method: 'POST', body: JSON.stringify(data) })
export const updateCreative             = (id, crid, d) => api(`/demos/steliant-esports/brands/${id}/creatives/${crid}`, { method: 'PATCH', body: JSON.stringify(d) })
export const deleteCreative             = (id, crid)    => api(`/demos/steliant-esports/brands/${id}/creatives/${crid}`, { method: 'DELETE' })
export const linkCreativeToCampaign     = (id, crid, d) => api(`/demos/steliant-esports/brands/${id}/creatives/${crid}/link`, { method: 'POST', body: JSON.stringify(d) })
export const unlinkCreativeFromCampaign = (id, crid)    => api(`/demos/steliant-esports/brands/${id}/creatives/${crid}/unlink`, { method: 'POST' })

// ── Invoices ──────────────────────────────────────────────────────────────────
export const getMyInvoices = () => api('/demos/steliant-esports/brands/me/invoices')

// ── Tickets ───────────────────────────────────────────────────────────────────
export const getMyTickets    = ()         => api('/demos/steliant-esports/brands/me/tickets')
export const getTicketDetail = (tid)      => api(`/demos/steliant-esports/brands/me/tickets/${tid}`)
export const createTicket    = (data)     => api('/demos/steliant-esports/brands/me/tickets', { method: 'POST', body: JSON.stringify(data) })
export const replyTicket     = (tid, msg) => api(`/demos/steliant-esports/brands/me/tickets/${tid}/reply`, { method: 'POST', body: JSON.stringify({ message: msg }) })

// ── Ads (public — no auth) ────────────────────────────────────────────────────
export const getActiveAds    = (type)  => api(`/ads?type=${type}`)
export const trackImpression = (adId)  => api(`/ads/${adId}/impression`, { method: 'POST' })
export const trackClick      = (adId)  => api(`/ads/${adId}/click`, { method: 'POST' })

// ── Admin: brands & applications ──────────────────────────────────────────────
export const adminGetAllBrands        = ()                 => api('/demos/steliant-esports/brands/admin/all')
export const adminGetApplications     = (status='pending') => api(`/demos/steliant-esports/brands/admin/applications?status=${status}`)
export const adminReviewApplication   = (appId, data)      => api(`/demos/steliant-esports/brands/admin/applications/${appId}`, { method: 'PATCH', body: JSON.stringify(data) })
export const adminCreateBrand         = (data)             => api('/demos/steliant-esports/brands/admin/brands', { method: 'POST', body: JSON.stringify(data) })
export const adminUpdateBrand         = (id, data)         => api(`/demos/steliant-esports/brands/admin/brands/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const adminApproveBrandChanges = (id, action)       => api(`/demos/steliant-esports/brands/admin/brands/${id}/changes`, { method: 'PATCH', body: JSON.stringify({ action }) })
export const adminLinkBrandUser       = (id, emailOrId)    => api(`/demos/steliant-esports/brands/admin/brands/${id}/link-user`, { method: 'POST', body: JSON.stringify(emailOrId.includes('@') ? { email: emailOrId } : { userId: emailOrId }) })

// ── Admin: campaigns ──────────────────────────────────────────────────────────
export const adminGetCampaigns    = (status = '')          => api(`/demos/steliant-esports/brands/admin/campaigns${status ? `?status=${status}` : ''}`)
export const adminApproveCampaign = (cid)                  => api(`/demos/steliant-esports/brands/admin/campaigns/${cid}/approve`, { method: 'PATCH' })
export const adminReviewCampaignPayment = (cid, data)      => api(`/demos/steliant-esports/brands/admin/campaigns/${cid}/payment`, { method: 'PATCH', body: JSON.stringify(data) })
export const adminRejectCampaign  = (cid, reason)          => api(`/demos/steliant-esports/brands/admin/campaigns/${cid}/reject`, { method: 'PATCH', body: JSON.stringify({ rejectionReason: reason }) })

// Alias for legacy callers
export const adminGetPendingCampaigns = () => adminGetCampaigns('pending')

// ── Admin: creatives ──────────────────────────────────────────────────────────
export const adminGetPendingCreatives = ()                          => api('/demos/steliant-esports/brands/admin/pending-creatives')
export const adminReviewCreative      = (crid, action, reason = '') => api(`/demos/steliant-esports/brands/admin/creatives/${crid}`, { method: 'PATCH', body: JSON.stringify({ action, rejectionReason: reason }) })

// ── Admin: invoices ───────────────────────────────────────────────────────────
export const adminGetInvoices   = (status = '')       => api(`/demos/steliant-esports/brands/admin/invoices${status ? `?status=${status}` : ''}`)
export const adminReviewInvoice = (invoiceId, data)   => api(`/demos/steliant-esports/brands/admin/invoices/${invoiceId}`, { method: 'PATCH', body: JSON.stringify(data) })

// ── Admin: reports ────────────────────────────────────────────────────────────
export const adminSendReport      = (brandId, data) => api(`/demos/steliant-esports/brands/admin/brands/${brandId}/reports`, { method: 'POST', body: JSON.stringify(data) })
export const adminGetBrandReports = (brandId)       => api(`/demos/steliant-esports/brands/admin/brands/${brandId}/reports`)

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function guessFormat(file) {
  const { name, type } = file
  const ext = name.split('.').pop().toUpperCase()
  const dimMatch = name.match(/(\d{3,5})[x×_](\d{3,5})/i)
  if (dimMatch) return `${ext} ${dimMatch[1]}×${dimMatch[2]}`
  if (type.startsWith('video/')) return `Video ${ext}`
  return ext
}

export function fmtBytes(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`
  if (n >= 1_000)     return `${Math.round(n / 1_000)} KB`
  return `${n} B`
}

// ── Admin: tickets ────────────────────────────────────────────────────────────
export const adminGetTickets      = (status = 'open') => api(`/demos/steliant-esports/brands/admin/tickets?status=${status}`)
export const adminGetTicketDetail = (tid)             => api(`/demos/steliant-esports/brands/admin/tickets/${tid}`)
export const adminUpdateTicket    = (tid, data)       => api(`/demos/steliant-esports/brands/admin/tickets/${tid}`, { method: 'PATCH', body: JSON.stringify(data) })
export const adminReplyTicket     = (tid, msg)        => api(`/demos/steliant-esports/brands/admin/tickets/${tid}/reply`, { method: 'POST', body: JSON.stringify({ message: msg }) })


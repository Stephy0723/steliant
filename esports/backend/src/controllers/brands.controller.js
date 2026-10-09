import { Brand }            from '../models/Brand.js'
import { BrandApplication } from '../models/BrandApplication.js'
import { BrandReport }      from '../models/BrandReport.js'
import { Campaign }         from '../models/Campaign.js'
import { Creative }         from '../models/Creative.js'
import { Invoice }          from '../models/Invoice.js'
import { Tournament }       from '../models/Tournament.js'
import { User }             from '../models/User.js'
import { createBrandCodes, createBrandApplicationCodes, createBrandReportCodes, createCampaignCodes, createCreativeCodes } from '../services/codes.service.js'
import {
  appendAdminTicketReply,
  createSystemTicketRecord,
  ensureSystemTicketForSource,
} from '../services/systemTickets.service.js'

// ── Public ────────────────────────────────────────────────────────────────────

export async function listBrands(req, res, next) {
  try {
    const brands = await Brand.find({ status: 'active' })
      .select('-pendingChanges')
      .sort({ tier: 1, name: 1 })
    res.json(brands)
  } catch (e) { next(e) }
}

export async function getBrandById(req, res, next) {
  try {
    const brand = await Brand.findById(req.params.id).select('-pendingChanges')
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' })
    res.json(brand)
  } catch (e) { next(e) }
}

export async function getPlatformStats(req, res, next) {
  try {
    const [brandCount, tournamentCount, playerCount] = await Promise.all([
      Brand.countDocuments({ status: 'active' }),
      Tournament.countDocuments({ status: { $ne: 'draft' } }),
      User.countDocuments({ role: 'player' }),
    ])
    res.json({ brandCount, tournamentCount, playerCount })
  } catch (e) { next(e) }
}

// ── Brand application (public, no auth) ───────────────────────────────────────

export async function submitApplication(req, res, next) {
  try {
    const { companyName, industry, tierInterest, website, logoUrl, logoInitials, color, tagline,
            contactName, contactEmail, contactPhone, message } = req.body

    if (!companyName?.trim() || !contactEmail?.trim() || !contactName?.trim() || !industry?.trim()) {
      return res.status(400).json({ error: 'companyName, industry, contactName y contactEmail son requeridos' })
    }

    const existing = await BrandApplication.findOne({ contactEmail: contactEmail.toLowerCase(), status: 'pending' })
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una solicitud pendiente con ese correo' })
    }

    const initials = logoInitials || companyName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

    // Buscar si ya existe un usuario con ese correo para asociar su ref
    const existingUser = await User.findOne({ email: contactEmail.toLowerCase().trim() }).select('_id nick email playerCode countryCode').lean()
    const codes = await createBrandApplicationCodes(
      existingUser?.playerCode || 'GUEST',
      existingUser?._id || 'guest',
      new Date()
    )

    const app = await BrandApplication.create({
      publicCode: codes.publicCode,
      internalCode: codes.internalCode,
      companyName: companyName.trim(),
      industry:    industry.trim(),
      tierInterest: tierInterest || 'silver',
      website:     website || '',
      logoUrl:     logoUrl || '',
      logoInitials: initials,
      color:       color || '#F0A500',
      tagline:     tagline || '',
      contactName:  contactName.trim(),
      contactEmail: contactEmail.toLowerCase().trim(),
      contactPhone: contactPhone || '',
      message:     message || '',
    })

    const ticket = await createSystemTicketRecord({
      requester: existingUser?._id || null,
      requesterUser: existingUser || null,
      requesterName: contactName.trim(),
      requesterEmail: contactEmail.toLowerCase().trim(),
      purpose: 'brand',
      priority: 'medium',
      subject: `Solicitud de marca: ${companyName.trim()}`,
      message: [
        message || `Solicitud para registrar ${companyName.trim()} como marca.`,
        `Industria: ${industry.trim()}`,
        `Tier interesado: ${tierInterest || 'silver'}`,
        website ? `Website: ${website}` : '',
        contactPhone ? `Telefono: ${contactPhone}` : '',
      ].filter(Boolean).join('\n'),
      author: 'user',
      authorId: existingUser?._id || null,
      sourceType: 'brand-application',
      sourceId: String(app._id),
      sourceLabel: companyName.trim(),
      metadata: {
        publicCode: app.publicCode,
        companyName: companyName.trim(),
        industry: industry.trim(),
        tierInterest: tierInterest || 'silver',
        contactName: contactName.trim(),
        contactEmail: contactEmail.toLowerCase().trim(),
      },
    })
    app.systemTicket = ticket._id
    await app.save()
    res.status(201).json({ ok: true, id: app._id, publicCode: codes.publicCode })
  } catch (e) { next(e) }
}

// ── Authenticated: my brand portal ────────────────────────────────────────────

export async function getMyBrand(req, res, next) {
  try {
    let brand = null

    if (req.user.brandId) {
      brand = await Brand.findById(req.user.brandId)
    }
    if (!brand) return res.status(404).json({ error: 'Sin marca asignada' })

    const [campaigns, creatives, unreadReports] = await Promise.all([
      Campaign.find({ brandId: brand._id }).sort({ createdAt: -1 }),
      Creative.find({ brandId: brand._id })
        .populate('campaignId', 'name')
        .sort({ createdAt: -1 })
        .select('-fileData'),
      BrandReport.countDocuments({ brandId: brand._id, readAt: null }),
    ])

    res.json({ brand, campaigns, creatives, unreadReports })
  } catch (e) { next(e) }
}

export async function getSponsorableTournaments(req, res, next) {
  try {
    const tournaments = await Tournament.find({ status: { $in: ['upcoming', 'live'] } })
      .select('title game status startDate prizePool capacity registered publicId')
      .sort({ startDate: 1 })
      .limit(12)
    res.json(tournaments)
  } catch (e) { next(e) }
}

// Brand submits profile changes for admin approval
export async function submitProfileChanges(req, res, next) {
  try {
    let brand = null
    if (req.user.brandId) brand = await Brand.findById(req.user.brandId)
    if (!brand && req.user.role === 'admin') brand = await Brand.findOne({ status: 'active' })
    if (!brand) return res.status(404).json({ error: 'Sin marca asignada' })

    const ALLOWED = ['logoUrl', 'logoInitials', 'tagline', 'website', 'contactName', 'contactEmail', 'contactPhone']
    const changes = { submittedAt: new Date() }
    for (const k of ALLOWED) if (req.body[k] !== undefined) changes[k] = req.body[k]

    brand.pendingChanges = changes
    await brand.save()
    res.json({ ok: true, message: 'Cambios enviados para revisión del administrador' })
  } catch (e) { next(e) }
}

// Brand reads their reports inbox
export async function getBrandReports(req, res, next) {
  try {
    let brandId = req.user.brandId
    if (!brandId && req.user.role === 'admin') {
      const b = await Brand.findOne({ status: 'active' })
      brandId = b?._id
    }
    if (!brandId) return res.status(404).json({ error: 'Sin marca asignada' })

    const reports = await BrandReport.find({ brandId })
      .select('-fileData')
      .sort({ createdAt: -1 })
    res.json(reports)
  } catch (e) { next(e) }
}

// Brand marks a report as read
export async function markReportRead(req, res, next) {
  try {
    let brandId = req.user.brandId
    if (!brandId && req.user.role === 'admin') {
      const b = await Brand.findOne({ status: 'active' })
      brandId = b?._id
    }
    const report = await BrandReport.findOne({ _id: req.params.rid, brandId })
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' })
    if (!report.readAt) { report.readAt = new Date(); await report.save() }
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// Brand gets a single report with file
export async function getBrandReportFile(req, res, next) {
  try {
    let brandId = req.user.brandId
    if (!brandId && req.user.role === 'admin') {
      const b = await Brand.findOne({ status: 'active' })
      brandId = b?._id
    }
    const report = await BrandReport.findOne({ _id: req.params.rid, brandId })
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' })
    res.json(report)
  } catch (e) { next(e) }
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCampaigns(req, res, next) {
  try {
    const campaigns = await Campaign.find({ brandId: req.params.id })
      .sort({ createdAt: -1 })
    // Para cada campaña, adjuntar sus creatividades (sin fileData)
    const withCreatives = await Promise.all(campaigns.map(async c => {
      const [creatives, invoice] = await Promise.all([
        Creative.find({ campaignId: c._id }).select('-fileData'),
        Invoice.findOne({ campaignId: c._id }).select('invoiceNumber status').sort({ createdAt: -1 }).lean(),
      ])
      const campaign = c.toObject()
      if (invoice?.invoiceNumber) campaign.payment.invoiceNumber = invoice.invoiceNumber
      return { ...campaign, creatives }
    }))
    res.json(withCreatives)
  } catch (e) { next(e) }
}

// Brand crea una campaña — nace como borrador
export async function createCampaign(req, res, next) {
  try {
    const { name, objective, budget, startDate, endDate, tournamentId } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la campaña es requerido' })

    const brand = await Brand.findById(req.params.id)
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' })

    let tournamentPublicId = null
    let validTournamentId = null
    if (tournamentId) {
      const tournament = await Tournament.findById(tournamentId)
      if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' })
      tournamentPublicId = tournament.publicId
      validTournamentId = tournament._id
    }

    const codes = await createCampaignCodes(
      brand.code,
      tournamentPublicId,
      brand._id,
      validTournamentId,
      new Date()
    )

    const campaign = await Campaign.create({
      brandId:       brand._id,
      tournamentId:  validTournamentId,
      publicCode:    codes.publicCode,
      internalCode:  codes.internalCode,
      name:          name.trim(),
      objective:     objective || '',
      budget:        Number(budget) || 0,
      startDate:     startDate || null,
      endDate:       endDate || null,
      // placement/linkUrl/targetUniversityId se perdieron del destructuring en
      // un merge (ReferenceError → 500 al crear cualquier campaña) y tampoco
      // existen en el modelo Campaign, así que se quitan.
      status:        'draft',
    })
    res.status(201).json(campaign)
  } catch (e) { next(e) }
}

// Brand edita los datos base de su campaña (solo en draft o rejected)
export async function updateCampaign(req, res, next) {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.cid, brandId: req.params.id })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
    if (!['draft', 'rejected'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Solo puedes editar campañas en borrador o rechazadas' })
    }

    const ALLOWED = ['name', 'objective', 'budget', 'startDate', 'endDate']
    const update = {}
    for (const k of ALLOWED) if (req.body[k] !== undefined) update[k] = req.body[k]

    Object.assign(campaign, update)
    // Si estaba rechazada y la edita, vuelve a draft
    if (campaign.status === 'rejected') { campaign.status = 'draft'; campaign.rejectionReason = '' }
    await campaign.save()
    res.json(campaign)
  } catch (e) { next(e) }
}

// Brand envía la campaña a revisión del admin
export async function submitCampaignForReview(req, res, next) {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.cid, brandId: req.params.id })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
    if (!['draft', 'rejected'].includes(campaign.status)) return res.status(400).json({ error: 'Solo puedes enviar campañas en borrador o rechazadas' })

    // Valida que tenga al menos una creatividad vinculada con adType
    const creativesCount = await Creative.countDocuments({ campaignId: campaign._id, adType: { $ne: '' } })
    if (creativesCount === 0) {
      return res.status(400).json({ error: 'Debes vincular al menos una creatividad con tipo de despliegue antes de enviar' })
    }

    campaign.status = 'pending'
    await campaign.save()
    res.json({ ok: true, campaign })
  } catch (e) { next(e) }
}

export async function deleteCampaign(req, res, next) {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.cid, brandId: req.params.id })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
    if (!['draft', 'rejected'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Solo se pueden eliminar campañas en borrador o rechazadas' })
    }
    // Desvincula creatividades pero no las elimina (vuelven a la galería)
    await Creative.updateMany({ campaignId: campaign._id }, { $set: { campaignId: null, adType: '', linkUrl: '' } })
    await campaign.deleteOne()
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ── Creatives ─────────────────────────────────────────────────────────────────

export async function getCreatives(req, res, next) {
  try {
    const creatives = await Creative.find({ brandId: req.params.id })
      .populate('campaignId', 'name status')
      .sort({ createdAt: -1 })
      .select('-fileData')
    res.json(creatives)
  } catch (e) { next(e) }
}

export async function getCreativeFile(req, res, next) {
  try {
    const creative = await Creative.findOne({ _id: req.params.crid, brandId: req.params.id })
      .select('fileData mimeType name')
    if (!creative) return res.status(404).json({ error: 'Creatividad no encontrada' })
    res.json({ fileData: creative.fileData, mimeType: creative.mimeType, name: creative.name })
  } catch (e) { next(e) }
}

// Sube un asset a la galería (sin campaña) → va a revisión standalone
export async function uploadCreative(req, res, next) {
  try {
    const { name, format, sizeBytes, mimeType, fileData } = req.body
    if (!name || !fileData) return res.status(400).json({ error: 'name y fileData son requeridos' })
    if (fileData.length > 10_000_000) return res.status(413).json({ error: 'El archivo es demasiado grande (max ~7MB)' })

    const creative = await Creative.create({
      brandId:  req.params.id,
      name, format: format || '', sizeBytes: Number(sizeBytes) || 0,
      mimeType: mimeType || '', fileData,
      status: 'review',  // va a revisión admin antes de entrar a la galería
    })
    const out = creative.toObject()
    delete out.fileData
    res.status(201).json(out)
  } catch (e) { next(e) }
}

// Vincula una creatividad aprobada de la galería a una campaña (con adType + linkUrl)
export async function linkCreativeToCampaign(req, res, next) {
  try {
    const { campaignId, adType, linkUrl } = req.body
    if (!campaignId || !adType) return res.status(400).json({ error: 'campaignId y adType son requeridos' })
    if (!['banner', 'strip', 'floating'].includes(adType)) {
      return res.status(400).json({ error: 'adType debe ser banner, strip o floating' })
    }

    const creative = await Creative.findOne({ _id: req.params.crid, brandId: req.params.id })
    if (!creative) return res.status(404).json({ error: 'Creatividad no encontrada' })
    if (!['approved', 'review'].includes(creative.status)) {
      return res.status(400).json({ error: 'Solo se pueden vincular creatividades aprobadas o en revisión' })
    }

    const campaign = await Campaign.findOne({ _id: campaignId, brandId: req.params.id })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
    if (!['draft', 'rejected'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Solo puedes modificar campañas en borrador o rechazadas' })
    }

    creative.campaignId = campaignId
    creative.adType     = adType
    creative.linkUrl    = linkUrl || ''
    await creative.save()

    const out = creative.toObject()
    delete out.fileData
    res.json(out)
  } catch (e) { next(e) }
}

// Desvincula una creatividad de su campaña (vuelve a la galería)
export async function unlinkCreativeFromCampaign(req, res, next) {
  try {
    const creative = await Creative.findOne({ _id: req.params.crid, brandId: req.params.id })
    if (!creative) return res.status(404).json({ error: 'Creatividad no encontrada' })

    creative.campaignId = null
    creative.adType     = ''
    creative.linkUrl    = ''
    await creative.save()

    const out = creative.toObject()
    delete out.fileData
    res.json(out)
  } catch (e) { next(e) }
}

export async function deleteCreative(req, res, next) {
  try {
    const creative = await Creative.findOne({ _id: req.params.crid, brandId: req.params.id })
    if (!creative) return res.status(404).json({ error: 'Creatividad no encontrada' })
    if (['active'].includes(creative.status)) {
      return res.status(400).json({ error: 'No puedes eliminar una creatividad activa en plataforma' })
    }
    await creative.deleteOne()
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ── Admin: applications ───────────────────────────────────────────────────────

export async function adminGetApplications(req, res, next) {
  try {
    const { status = 'pending' } = req.query
    const filter = status === 'all' ? {} : { status }
    const apps = await BrandApplication.find(filter).sort({ createdAt: -1 })
    res.json(apps)
  } catch (e) { next(e) }
}

export async function adminReviewApplication(req, res, next) {
  try {
    const { action, rejectionReason } = req.body  // action: 'approve' | 'reject'
    const app = await BrandApplication.findById(req.params.appId)
    if (!app) return res.status(404).json({ error: 'Solicitud no encontrada' })
    if (app.status !== 'pending') return res.status(400).json({ error: 'Solicitud ya procesada' })

    if (action === 'reject') {
      app.status = 'rejected'
      app.rejectionReason = rejectionReason || ''
      app.reviewedBy  = req.user._id
      app.reviewedAt  = new Date()
      await app.save()
      const ticket = app.systemTicket || await ensureSystemTicketForSource('brand-application', String(app._id), async () => ({
        requester: null,
        requesterName: app.contactName,
        requesterEmail: app.contactEmail,
        purpose: 'brand',
        priority: 'medium',
        subject: `Solicitud de marca: ${app.companyName}`,
        message: app.message || `Solicitud para registrar ${app.companyName} como marca.`,
        author: 'user',
        authorId: null,
        sourceType: 'brand-application',
        sourceId: String(app._id),
        sourceLabel: app.companyName,
        metadata: { publicCode: app.publicCode, companyName: app.companyName, contactEmail: app.contactEmail },
      }))
      if (!app.systemTicket) {
        app.systemTicket = ticket._id
        await app.save()
      }
      await appendAdminTicketReply(ticket, req.user, rejectionReason
        ? `La solicitud de marca fue rechazada. Motivo: ${rejectionReason}.`
        : 'La solicitud de marca fue rechazada.', { close: true })
      return res.json({ ok: true, status: 'rejected' })
    }

    if (action === 'approve') {
      // A previous partial approval may already have created the brand before
      // user linking failed. Reuse it so retries are safe and deterministic.
      let brand = await Brand.findOne({
        $or: [{ contactEmail: app.contactEmail }, { name: app.companyName }],
      })

      if (!brand) {
        const { code, internalCode } = await createBrandCodes()

        brand = await Brand.create({
          code,
          internalCode,
          name:         app.companyName,
          industry:     app.industry,
          tier:         app.tierInterest,
          logoInitials: app.logoInitials,
          color:        app.color,
          tagline:      app.tagline,
          website:      app.website,
          logoUrl:      app.logoUrl,
          contactName:  app.contactName,
          contactEmail: app.contactEmail,
          contactPhone: app.contactPhone,
          status:       'active',
          since:        new Date(),
        })
      }

      // Link to user account if one exists with that email. `role` es un
      // campo unico -- pisarlo a 'brand' sin mas le hacia perder cualquier
      // otro rol ya aprobado (ej. 'player' rompia el acceso a /jugador, ver
      // BACKEND-PENDIENTE.md #role-pisado-por-brand). Igual que en
      // roleApplications.controller.js: el rol nuevo se suma a `roles`
      // (fuente de verdad real, ya la lee el Sidebar), y `role` solo se
      // actualiza si todavia tiene el default neutral 'player' -- cualquier
      // rol ya aprobado (admin, organizer, coach...) se conserva tal cual.
      let linkedUser = null
      const existingUser = await User.findOne({ email: app.contactEmail })
      if (existingUser) {
        existingUser.brandId = brand._id
        if (!existingUser.roles.includes('brand')) existingUser.roles.push('brand')
        if (existingUser.role === 'player') existingUser.role = 'brand'
        await existingUser.save()
        linkedUser = existingUser
      }

      app.status     = 'approved'
      app.brandId    = brand._id
      app.reviewedBy = req.user._id
      app.reviewedAt = new Date()
      await app.save()
      const ticket = app.systemTicket || await ensureSystemTicketForSource('brand-application', String(app._id), async () => ({
        requester: linkedUser?._id || null,
        requesterUser: linkedUser || null,
        requesterName: app.contactName,
        requesterEmail: app.contactEmail,
        purpose: 'brand',
        priority: 'medium',
        subject: `Solicitud de marca: ${app.companyName}`,
        message: app.message || `Solicitud para registrar ${app.companyName} como marca.`,
        author: 'user',
        authorId: linkedUser?._id || null,
        sourceType: 'brand-application',
        sourceId: String(app._id),
        sourceLabel: app.companyName,
        metadata: { publicCode: app.publicCode, brandId: String(brand._id), companyName: app.companyName, contactEmail: app.contactEmail },
      }))
      if (!app.systemTicket) {
        app.systemTicket = ticket._id
        await app.save()
      }
      await appendAdminTicketReply(ticket, req.user, `La solicitud de marca fue aprobada. La marca ${brand.name} ya esta activa en la plataforma.`, { close: true })

      return res.json({ ok: true, status: 'approved', brand, linkedUser: linkedUser?.nick || null })
    }

    res.status(400).json({ error: 'action debe ser approve o reject' })
  } catch (e) { next(e) }
}

// ── Admin: manage brands ──────────────────────────────────────────────────────

export async function adminGetAllBrands(req, res, next) {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 })
    const stats = await Promise.all(brands.map(async b => {
      const [campaigns, creatives, pendingCreatives, reports] = await Promise.all([
        Campaign.countDocuments({ brandId: b._id }),
        Creative.countDocuments({ brandId: b._id }),
        Creative.countDocuments({ brandId: b._id, status: 'review' }),
        BrandReport.countDocuments({ brandId: b._id }),
      ])
      return { ...b.toObject(), _campaigns: campaigns, _creatives: creatives, _pendingCreatives: pendingCreatives, _reports: reports }
    }))
    res.json(stats)
  } catch (e) { next(e) }
}

export async function createBrand(req, res, next) {
  try {
    const { name, industry, tier, logoInitials, color, tagline, website, contactName, contactEmail, contactPhone } = req.body
    if (!name?.trim() || !industry?.trim()) {
      return res.status(400).json({ error: 'name e industry son requeridos' })
    }
    const { code, internalCode } = await createBrandCodes()
    const brand = await Brand.create({
      code, internalCode, name: name.trim(), industry: industry.trim(),
      tier: tier || 'silver', logoInitials, color, tagline, website,
      contactName, contactEmail, contactPhone, status: 'active',
    })
    res.status(201).json(brand)
  } catch (e) { next(e) }
}

export async function updateBrand(req, res, next) {
  try {
    const ALLOWED = ['name', 'industry', 'tier', 'logoInitials', 'color', 'tagline', 'website', 'contactName', 'contactEmail', 'contactPhone', 'status']
    const update = {}
    for (const k of ALLOWED) if (req.body[k] !== undefined) update[k] = req.body[k]

    const brand = await Brand.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' })
    res.json(brand)
  } catch (e) { next(e) }
}

// Admin approves brand's pending profile changes
export async function adminApproveBrandChanges(req, res, next) {
  try {
    const brand = await Brand.findById(req.params.id)
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' })
    if (!brand.pendingChanges?.submittedAt) return res.status(400).json({ error: 'No hay cambios pendientes' })

    const { action } = req.body  // 'approve' | 'reject'
    if (action === 'approve') {
      const ch = brand.pendingChanges
      if (ch.logoUrl)      brand.logoUrl      = ch.logoUrl
      if (ch.logoInitials) brand.logoInitials = ch.logoInitials
      if (ch.tagline)      brand.tagline      = ch.tagline
      if (ch.website)      brand.website      = ch.website
      if (ch.contactName)  brand.contactName  = ch.contactName
      if (ch.contactEmail) brand.contactEmail = ch.contactEmail
      if (ch.contactPhone) brand.contactPhone = ch.contactPhone
    }
    brand.pendingChanges = { submittedAt: null }
    await brand.save()
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ── Admin: campaigns ───────────────────────────────────────────────────────────

export async function adminGetPendingCampaigns(req, res, next) {
  try {
    const { status = 'pending' } = req.query
    const filter = status === 'all' ? {} : { status }
    const campaigns = await Campaign.find(filter)
      .populate('brandId', 'name tier color logoInitials code')
      .sort({ createdAt: 1 })
    // Adjunta creatividades y cuenta de cada campaña
    const withData = await Promise.all(campaigns.map(async c => {
      const creatives = await Creative.find({ campaignId: c._id }).select('-fileData')
      return { ...c.toObject(), creatives }
    }))
    res.json(withData)
  } catch (e) { next(e) }
}

// Admin aprueba una campaña → activa sus creatividades y genera adIds
export async function adminApproveCampaignFull(req, res, next) {
  try {
    const campaign = await Campaign.findById(req.params.cid)
      .populate('brandId', 'name code color logoUrl')
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
    if (campaign.status !== 'pending') return res.status(400).json({ error: 'La campaña no está en revisión' })
    // Candado de pago: sin comprobante verificado no se publica nada (antes
    // un anuncio podia salir en vivo sin que la marca hubiera pagado).
    if (campaign.payment?.status !== 'verified') {
      return res.status(400).json({ error: 'No puedes publicar esta campaña sin verificar antes su comprobante de pago' })
    }

    const creatives = await Creative.find({ campaignId: campaign._id, adType: { $ne: '' } })
    if (creatives.length === 0) {
      return res.status(400).json({ error: 'La campaña no tiene creatividades con tipo de despliegue' })
    }

    // Genera adIds para cada creatividad y las activa
    await Promise.all(creatives.map(async (cr) => {
      const codes = await createCreativeCodes(
        campaign.brandId?.code || 'BRD',
        campaign.publicCode,
        campaign._id,
        cr.adType,
        new Date()
      )
      cr.adId = codes.adId
      cr.internalCode = codes.internalCode
      cr.status = 'active'
      await cr.save()
    }))

    campaign.status      = 'active'
    campaign.activatedAt = new Date()
    campaign.reviewedBy  = req.user._id
    campaign.reviewedAt  = new Date()
    await campaign.save()

    // Campaña ligada a un torneo = patrocinio: la marca queda listada de
    // verdad en Tournament.sponsors (sin duplicarla si ya estaba).
    if (campaign.tournamentId && campaign.brandId?.name) {
      const rawLogo = String(campaign.brandId.logoUrl || '')
      const logo = rawLogo.startsWith('data:') || rawLogo.length > 1000 ? '' : rawLogo
      await Tournament.updateOne(
        { _id: campaign.tournamentId, 'sponsors.name': { $ne: campaign.brandId.name } },
        { $push: { sponsors: { name: campaign.brandId.name, logo, tier: 'Patrocinador', contribution: String(campaign.name || '').slice(0, 500) } } },
      )
    }

    res.json({ ok: true, campaign, activatedCreatives: creatives.length })
  } catch (e) { next(e) }
}

// Admin rechaza una campaña — motivo obligatorio
export async function adminRejectCampaignFull(req, res, next) {
  try {
    const { rejectionReason } = req.body
    if (!rejectionReason?.trim()) {
      return res.status(400).json({ error: 'El motivo de rechazo es obligatorio' })
    }

    const campaign = await Campaign.findById(req.params.cid)
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
    if (campaign.status !== 'pending') return res.status(400).json({ error: 'La campaña no está en revisión' })

    campaign.status          = 'rejected'
    campaign.rejectionReason = rejectionReason.trim()
    campaign.reviewedBy      = req.user._id
    campaign.reviewedAt      = new Date()
    await campaign.save()

    res.json({ ok: true, campaign })
  } catch (e) { next(e) }
}

// ── Admin: creatives queue ─────────────────────────────────────────────────────

export async function adminGetPendingCreatives(req, res, next) {
  try {
    const creatives = await Creative.find({ status: 'review' })
      .populate('brandId', 'name tier color logoInitials')
      .populate('campaignId', 'name')
      .sort({ createdAt: 1 })
      .select('-fileData')
    res.json(creatives)
  } catch (e) { next(e) }
}

export async function adminReviewCreative(req, res, next) {
  try {
    const { action, rejectionReason } = req.body
    const update = {
      status: action === 'approve' ? 'approved' : 'rejected',
      ...(rejectionReason ? { rejectionReason } : {}),
    }
    const creative = await Creative.findByIdAndUpdate(req.params.crid, { $set: update }, { new: true })
      .populate('brandId', 'name').populate('campaignId', 'name').select('-fileData')
    if (!creative) return res.status(404).json({ error: 'Creatividad no encontrada' })
    res.json(creative)
  } catch (e) { next(e) }
}

// ── Admin: send report to brand ────────────────────────────────────────────────

export async function adminSendReport(req, res, next) {
  try {
    const brand = await Brand.findById(req.params.id)
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' })

    const { type, title, body, statsData, fileData, fileName, mimeType } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'title es requerido' })

    const reportCodes = await createBrandReportCodes(brand.code, brand._id)
    const report = await BrandReport.create({
      publicCode:  reportCodes.publicCode,
      internalCode: reportCodes.internalCode,
      brandId:  brand._id,
      sentBy:   req.user._id,
      type:     type || 'message',
      title:    title.trim(),
      body:     body || '',
      statsData: statsData || {},
      fileData:  fileData || '',
      fileName:  fileName || '',
      mimeType:  mimeType || '',
    })
    res.status(201).json({ ok: true, report })
  } catch (e) { next(e) }
}

export async function adminGetBrandReports(req, res, next) {
  try {
    const reports = await BrandReport.find({ brandId: req.params.id })
      .select('-fileData')
      .sort({ createdAt: -1 })
    res.json(reports)
  } catch (e) { next(e) }
}

// Admin assigns a brand to a user account (by userId or email)
export async function adminLinkBrandUser(req, res, next) {
  try {
    const { userId, email } = req.body
    const brand = await Brand.findById(req.params.id)
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' })
    let user
    if (userId) {
      user = await User.findById(userId)
    } else if (email) {
      user = await User.findOne({ email: email.trim().toLowerCase() })
    } else {
      return res.status(400).json({ error: 'Se requiere userId o email' })
    }
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado con ese correo' })
    user.brandId = brand._id
    // Mismo criterio que en el approve de arriba: sumar a `roles`, no pisar
    // `role` salvo que todavia sea el default neutral 'player'.
    if (!user.roles.includes('brand')) user.roles.push('brand')
    if (user.role === 'player') user.role = 'brand'
    await user.save()
    res.json({ ok: true, user: { nick: user.nick, email: user.email, role: user.role, brandId: user.brandId } })
  } catch (e) { next(e) }
}

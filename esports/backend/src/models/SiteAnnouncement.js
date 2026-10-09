import mongoose from 'mongoose'

// Anuncios de la plataforma (/admin/noticias -> pestaña Anuncios). Los activos
// de hoy en adelante los ve cualquier usuario en "Novedades" (WhatsNew).
const siteAnnouncementSchema = new mongoose.Schema({
  type:    { type: String, enum: ['evento', 'recordatorio', 'aviso'], default: 'aviso' },
  title:   { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, default: '', trim: true, maxlength: 400 },
  link:    { type: String, default: '', trim: true, maxlength: 300 },
  date:    { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
  period:  { type: String, enum: ['manana', 'tarde', 'todo'], default: 'todo' },
  active:  { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, versionKey: false })

siteAnnouncementSchema.index({ active: 1, date: 1 })

export const SiteAnnouncement = mongoose.model('SiteAnnouncement', siteAnnouncementSchema)

import mongoose from 'mongoose'

// Registro de cambios de la plataforma (/admin/noticias -> pestaña Changelog),
// publico en "Novedades" (WhatsNew).
const changelogEntrySchema = new mongoose.Schema({
  version: { type: String, default: '', trim: true, maxlength: 20 },
  type:    { type: String, enum: ['feature', 'fix', 'maintenance'], default: 'feature' },
  title:   { type: String, required: true, trim: true, maxlength: 140 },
  items:   [{ type: String, trim: true, maxlength: 200 }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, versionKey: false })

changelogEntrySchema.index({ createdAt: -1 })

export const ChangelogEntry = mongoose.model('ChangelogEntry', changelogEntrySchema)

import mongoose from 'mongoose'

// Solicitud de publicacion (boton "Publicar" -> PublishModal.jsx) para la
// pestaña "Solicitudes" de /admin/banners. Antes vivia solo en el
// localStorage de quien la enviaba, asi que un admin en otro dispositivo
// nunca podia verla -- ver BACKEND-PENDIENTE.md, admin-banners-vs-marcas.
const publicationRequestSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userNick:   { type: String, required: true, trim: true, maxlength: 40 },
  userAvatar: { type: String, default: '' },
  type:       { type: String, enum: ['tournament', 'team', 'event', 'creator', 'brand', 'profile'], required: true },
  title:       { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 400 },
  images:      [{ type: String }],
  link:        { type: String, default: '', trim: true, maxlength: 300 },
  message:     { type: String, default: '', trim: true, maxlength: 200 },
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedAt:  { type: Date, default: null },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewNote:  { type: String, default: '', trim: true, maxlength: 400 },
}, { timestamps: true, versionKey: false })

publicationRequestSchema.index({ user: 1, createdAt: -1 })
publicationRequestSchema.index({ status: 1, createdAt: -1 })

export const PublicationRequest = mongoose.model('PublicationRequest', publicationRequestSchema)

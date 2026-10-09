import mongoose from 'mongoose'

// Anuncio "de casa" (no ligado a un Brand/Campaign pagado) — banner hero,
// strip de torneos, toast flotante o strip del panel del jugador. Ver
// Creative.js para el sistema de anuncios de marcas pagadas, que es
// independiente de este.
export const SITE_AD_SLOTS = ['banner', 'tournament', 'floating', 'dashboard']

const siteAdSchema = new mongoose.Schema({
  slot:          { type: String, enum: SITE_AD_SLOTS, required: true },
  active:        { type: Boolean, default: true },
  order:         { type: Number, default: 0 },
  type:          { type: String, default: 'custom', trim: true },
  game:          { type: String, default: '', trim: true },
  teamTag:       { type: String, default: '', trim: true },
  title:         { type: String, required: true, trim: true, maxlength: 120 },
  uid:           { type: String, default: '', trim: true },
  badge:         { type: String, default: '', trim: true, maxlength: 60 },
  description:   { type: String, default: '', trim: true, maxlength: 500 },
  imageUrl:       { type: String, default: '' },
  color1:        { type: String, default: '#7c3aed' },
  color2:        { type: String, default: '#0e1118' },
  textColor:     { type: String, default: '#fff' },
  btnText:       { type: String, default: '', trim: true, maxlength: 40 },
  btnUrl:        { type: String, default: '', trim: true },
  live:          { type: Boolean, default: false },
  prize:         { type: String, default: '', trim: true, maxlength: 40 },
  scheduledDate: { type: String, default: '' },
  impressions:   { type: Number, default: 0 },
  clicks:        { type: Number, default: 0 },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform(_doc, ret) {
      ret.id = ret._id.toString()
      delete ret._id
      return ret
    },
  },
})

siteAdSchema.index({ slot: 1, order: 1 })

export const SiteAd = mongoose.model('SiteAd', siteAdSchema)

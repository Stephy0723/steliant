import mongoose from 'mongoose'

// Modal interstitial (overlay con countdown) que se muestra en rutas
// seleccionadas. El "id" que ve el admin es un slug legible (ej: "fdv-2026"),
// guardado aquí como `slug` para no chocar con el `_id` real de Mongo.
const sitePromoSchema = new mongoose.Schema({
  slug:        { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/, maxlength: 40 },
  active:      { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
  title:       { type: String, required: true, trim: true, maxlength: 120 },
  subtitle:    { type: String, default: '', trim: true, maxlength: 160 },
  description: { type: String, default: '', trim: true, maxlength: 600 },
  badge:       { type: String, default: '', trim: true, maxlength: 60 },
  cta:         { type: String, default: '', trim: true, maxlength: 40 },
  ctaUrl:      { type: String, default: '', trim: true },
  bg:          { type: String, default: 'linear-gradient(135deg, #001a26 0%, #003d5c 50%, #001a26 100%)' },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform(_doc, ret) {
      ret.id = ret.slug
      delete ret._id
      delete ret.slug
      return ret
    },
  },
})

export const SitePromo = mongoose.model('SitePromo', sitePromoSchema)

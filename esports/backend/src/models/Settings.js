import mongoose from 'mongoose'

// Configuración global del sitio — un único documento ("global").
// Por ahora solo controla qué secciones de anuncios están visibles al público;
// se puede extender con más flags globales más adelante.
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  ads: {
    banner:     { type: Boolean, default: false },
    tournament: { type: Boolean, default: false },
    floating:   { type: Boolean, default: false },
    dashboard:  { type: Boolean, default: false },
    promo:      { type: Boolean, default: false },
  },
}, {
  timestamps: true,
  versionKey: false,
})

export const AD_SLOTS = ['banner', 'tournament', 'floating', 'dashboard', 'promo']

settingsSchema.statics.getGlobal = async function () {
  return this.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { new: true, upsert: true },
  )
}

export const Settings = mongoose.model('Settings', settingsSchema)

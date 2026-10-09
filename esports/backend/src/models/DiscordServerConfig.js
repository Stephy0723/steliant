import mongoose from 'mongoose'

// Funciones que un canal del servidor general de Discord puede cumplir. Cada
// tipo de publicacion cae por defecto en una de estas (ver PUBLICATION_TYPES
// en DiscordPublication.js).
export const DISCORD_CHANNEL_FUNCTIONS = Object.freeze({
  announcements: 'Anuncios',
  news: 'Noticias',
  updates: 'Versiones / actualizaciones',
  rules: 'Reglas',
  sponsors: 'Patrocinadores y marcas',
  registrations: 'Inscripciones',
  support: 'Soporte',
})

const channelMapSchema = new mongoose.Schema(
  Object.fromEntries(Object.keys(DISCORD_CHANNEL_FUNCTIONS).map(key => [key, {
    channelId: { type: String, default: '' },
    channelName: { type: String, default: '' },
  }])),
  { _id: false },
)

// Mensaje automatico de entrada/salida de miembros. Texto con variables
// {usuario} {nombre} {nick} {servidor} {miembros} (las resuelve el bot).
const memberMessageSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  channelId: { type: String, default: '', trim: true },
  channelName: { type: String, default: '', trim: true },
  title: { type: String, default: '', trim: true, maxlength: 256 },
  message: { type: String, default: '', trim: true, maxlength: 2000 },
  imageUrl: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },
}, { _id: false })

const automationsSchema = new mongoose.Schema({
  welcome: { type: memberMessageSchema, default: () => ({}) },
  farewell: { type: memberMessageSchema, default: () => ({}) },
  // Al que entra sin cuenta vinculada, mandarle por DM el enlace a vincular.
  welcomeDm: { type: Boolean, default: true },
  // Noticia publicada en la web -> sale sola a Discord (sin pasar por Publicar).
  newsAutoPublish: { type: Boolean, default: false },
}, { _id: false })

// Documento unico (key: 'main') con el mapa canal -> funcion del servidor
// general. El guildId sale de DISCORD_GUILD_ID; aqui solo se guarda lo que
// el admin elige desde /admin/discord-sync.
const discordServerConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  channels: { type: channelMapSchema, default: () => ({}) },
  automations: { type: automationsSchema, default: () => ({}) },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  versionKey: false,
})

discordServerConfigSchema.statics.getMain = async function getMain() {
  return this.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
}

export const DiscordServerConfig = mongoose.model('DiscordServerConfig', discordServerConfigSchema)

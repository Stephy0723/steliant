import mongoose from 'mongoose'

// tipo -> funcion de canal donde cae por defecto (DISCORD_CHANNEL_FUNCTIONS).
export const PUBLICATION_TYPES = Object.freeze({
  news: 'news',
  announcement: 'announcements',
  banner: 'announcements',
  brand: 'sponsors',
  sponsor: 'sponsors',
  version: 'updates',
  rules: 'rules',
  registration: 'registrations',
})

export const PUBLICATION_STATUSES = ['ready', 'published', 'failed', 'archived']

// Cola de publicaciones del Control Center: algo creado en la web (noticia,
// banner, version...) queda aqui en 'ready' hasta que el admin lo publica.
// La publicacion viaja web -> CRM -> bot y guarda el id del mensaje.
const discordPublicationSchema = new mongoose.Schema({
  publicId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, required: true, enum: Object.keys(PUBLICATION_TYPES) },
  sourceType: { type: String, default: 'manual', trim: true },
  sourceId: { type: String, default: '', trim: true },
  sourceCode: { type: String, default: '', trim: true },

  title: { type: String, required: true, trim: true, maxlength: 256 },
  body: { type: String, default: '', maxlength: 4000 },
  url: { type: String, default: '', trim: true },
  imageUrl: { type: String, default: '', trim: true },
  ctaLabel: { type: String, default: '', trim: true, maxlength: 80 },
  ctaUrl: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },

  // Vacio = usar el canal configurado para la funcion por defecto del tipo.
  targetChannelId: { type: String, default: '', trim: true },
  channelName: { type: String, default: '', trim: true },

  status: { type: String, default: 'ready', enum: PUBLICATION_STATUSES },
  publishedAt: { type: Date, default: null },
  discordMessageId: { type: String, default: '' },
  // Donde quedo el mensaje de verdad (para editarlo o retirarlo). En un foro
  // el mensaje vive dentro del tema: discordChannelId = id del tema.
  discordChannelId: { type: String, default: '' },
  discordThreadId: { type: String, default: '' },
  // Etiquetas del foro (ids de Discord) para temas nuevos.
  appliedTags: { type: [String], default: [] },
  error: { type: String, default: '' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  versionKey: false,
})

discordPublicationSchema.index({ status: 1, createdAt: -1 })
discordPublicationSchema.index({ sourceType: 1, sourceId: 1 })

export const DiscordPublication = mongoose.model('DiscordPublication', discordPublicationSchema)

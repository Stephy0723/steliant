import mongoose from 'mongoose'

// Un cliente que compra el servicio: un servidor de Discord o grupo de
// WhatsApp con sus propios
// torneos/partidas, aislados de los de cualquier otro cliente (incluido
// GlitchGang mismo). El bot resuelve "a que organizacion pertenece esto"
// por interaction.guildId o por el JID del grupo de WhatsApp.
const organizationSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true, maxlength: 120 },
  discordGuildId: { type: String, default: '', trim: true },
  whatsappGroupId:{ type: String, default: '', trim: true },
  owner:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admins:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  welcomeChannelId: { type: String, default: '', trim: true },
  welcomeEnabled: { type: Boolean, default: true },
  welcomeMessage: { type: String, default: '', trim: true, maxlength: 1200 },
  farewellMessage:{ type: String, default: '', trim: true, maxlength: 800 },
  // Panel fijo (un solo mensaje, editado in-place) con los torneos abiertos
  // de este cliente -- lo configura un admin corriendo /torneos-panel en el
  // canal que quiera usar; messageId es el mensaje que el bot edita cada
  // vez en vez de mandar uno nuevo.
  tournamentsPanelChannelId: { type: String, default: '', trim: true },
  tournamentsPanelMessageId: { type: String, default: '', trim: true },
  rules:          { type: String, default: '', trim: true, maxlength: 3000 },
  status:         { type: String, enum: ['active', 'paused'], default: 'active' },
}, {
  timestamps: true,
  versionKey: false,
})

organizationSchema.index({ owner: 1 })
organizationSchema.index(
  { discordGuildId: 1 },
  { unique: true, partialFilterExpression: { discordGuildId: { $type: 'string', $ne: '' } } },
)
organizationSchema.index(
  { whatsappGroupId: 1 },
  { unique: true, partialFilterExpression: { whatsappGroupId: { $type: 'string', $ne: '' } } },
)

export const Organization = mongoose.model('Organization', organizationSchema)

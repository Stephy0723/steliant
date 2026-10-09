import mongoose from 'mongoose'
import { PUBLICATION_TYPES } from './DiscordPublication.js'

// Plantillas de texto del Control Center: rellenan el formulario de una
// publicacion nueva (tipo, titulo, texto, boton, imagen) para no escribir
// siempre lo mismo. Las marcadas builtIn se siembran la primera vez.
const discordTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  type: { type: String, default: 'announcement', enum: Object.keys(PUBLICATION_TYPES) },
  title: { type: String, default: '', trim: true, maxlength: 256 },
  body: { type: String, default: '', maxlength: 4000 },
  imageUrl: { type: String, default: '', trim: true },
  ctaLabel: { type: String, default: '', trim: true, maxlength: 80 },
  ctaUrl: { type: String, default: '', trim: true },
  builtIn: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  versionKey: false,
})

export const DEFAULT_DISCORD_TEMPLATES = [
  {
    name: 'Noticia',
    type: 'news',
    title: '📰 [Titulo de la noticia]',
    body: '[Resumen en 2-3 lineas de lo que paso.]\n\nLee la noticia completa en la web 👇',
    ctaLabel: 'Leer noticia',
    ctaUrl: '/noticias',
  },
  {
    name: 'Anuncio importante',
    type: 'announcement',
    title: '📢 Anuncio importante',
    body: '¡Hola, comunidad GlitchGang!\n\n[Escribe aqui el anuncio.]\n\nCualquier duda, abre un ticket en #soporte.',
  },
  {
    name: 'Mantenimiento',
    type: 'announcement',
    title: '🛠️ Mantenimiento programado',
    body: 'La plataforma estara en mantenimiento el **[fecha]** de **[hora inicio]** a **[hora fin]**.\n\nDurante ese tiempo no podras [inscribirte / entrar a tu panel]. ¡Gracias por la paciencia!',
  },
  {
    name: 'Nuevo patrocinador',
    type: 'sponsor',
    title: '🤝 Bienvenido [marca] a GlitchGang',
    body: 'Nos alegra anunciar que **[marca]** se une como patrocinador.\n\n[Que trae para la comunidad: premios, torneos, descuentos...]',
    ctaLabel: 'Conocer mas',
  },
  {
    name: 'Nueva version',
    type: 'version',
    title: '🚀 GlitchGang [version]',
    body: '**Novedades**\n• [cambio 1]\n• [cambio 2]\n\n**Arreglos**\n• [arreglo 1]\n\nCuentanos que te parece en #sugerencias.',
  },
  {
    name: 'Inscripciones abiertas',
    type: 'registration',
    title: '🎮 Inscripciones abiertas: [torneo]',
    body: 'Ya puedes inscribir a tu equipo en **[torneo]**.\n\n📅 Fecha: [fecha]\n🏆 Premio: [premio]\n👥 Cupos: [cupos]',
    ctaLabel: 'Inscribirme',
    ctaUrl: '/torneos',
  },
]

export const DiscordTemplate = mongoose.model('DiscordTemplate', discordTemplateSchema)

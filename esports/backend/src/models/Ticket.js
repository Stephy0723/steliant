import mongoose from 'mongoose'

// Tickets de soporte entre la marca y el equipo GlitchGang.
// Reemplaza el sistema localStorage de BrandContact.
// La marca crea tickets desde su panel ("Hablar con el equipo").
// El admin responde desde el Centro de Marcas.

const messageSchema = new mongoose.Schema({
  author:     { type: String, enum: ['brand', 'admin'], required: true },
  authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  body:       { type: String, required: true },
  sentAt:     { type: Date, default: Date.now },
}, { _id: false })

const ticketSchema = new mongoose.Schema({
  publicCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode:{ type: String, unique: true, sparse: true, uppercase: true, trim: true },

  brandId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  systemTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'SystemTicket', default: null },

  // Asunto y categoría
  subject:    { type: String, required: true, trim: true },
  category:   {
    type: String,
    enum: ['billing', 'campaign', 'technical', 'creative', 'other'],
    default: 'other',
  },

  // Estado del ticket
  status:     { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
  priority:   { type: String, enum: ['low', 'medium', 'high'], default: 'low' },

  // Hilo de mensajes (primer mensaje = el de la marca al crear el ticket)
  messages:   { type: [messageSchema], default: [] },

  // Admin asignado y fecha de cierre
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  closedAt:   { type: Date, default: null },

  // Contadores de mensajes no leídos por cada parte
  unreadByAdmin: { type: Number, default: 1 },   // empieza en 1 porque la marca lo acaba de crear
  unreadByBrand: { type: Number, default: 0 },

}, { timestamps: true, versionKey: false })

ticketSchema.index({ brandId: 1, status: 1 })
ticketSchema.index({ status: 1, priority: -1 })

export const Ticket = mongoose.model('Ticket', ticketSchema)

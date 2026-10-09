import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true },
  kind:         { type: String, enum: ['plan', 'tournament'], required: true },
  provider:     { type: String, enum: ['stripe', 'paypal', 'transfer'], required: true },
  concept:      { type: String, required: true, trim: true },
  amount:       { type: Number, required: true, min: 0 },
  currency:     { type: String, default: 'USD' },
  planId:       { type: String, default: null },
  billingCycle: { type: String, default: null },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  status:       { type: String, enum: ['requires_payment', 'demo_paid', 'paid', 'refunded', 'failed', 'canceled'], required: true },
  mode:         { type: String, enum: ['live', 'demo'], required: true },
  // Id de la orden en el proveedor real (PayPal order id) -- necesario para
  // capturar el cobro server-to-server y para reconciliar el webhook.
  providerOrderId: { type: String, default: null, index: true },
}, {
  timestamps: true,
  versionKey: false,
})

export const Order = mongoose.model('Order', orderSchema)

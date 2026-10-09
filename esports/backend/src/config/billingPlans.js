// Catálogo de precios de planes -- espejo exacto de frontend/src/data/billing.js
// (PLANS). Es la única fuente de verdad para cuánto cuesta cada plan; nunca se
// debe confiar en un monto que mande el cliente en /payments/checkout.
export const PLANS = [
  { id: 'free', name: 'Básico',    price: { monthly: 0,    annual: 0 } },
  { id: 'pro',  name: 'Pro Trial', price: { monthly: 9.99, annual: 7.99 } },
  { id: 'team', name: 'Team',      price: { monthly: 24.99, annual: 19.99 } },
  // Planes personalizados por rol (ver frontend Premium.jsx CUSTOM_PLANS / data/billing.js).
  { id: 'player-pro',    name: 'Jugador Pro',           price: { monthly: 9.99,  annual: 9.99 } },
  { id: 'organizer-pro', name: 'Organizador',           price: { monthly: 19.99, annual: 19.99 } },
  { id: 'creator-pro',   name: 'Creador de Contenido',  price: { monthly: 14.99, annual: 14.99 } },
]

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) || null
}

export function getPlanPrice(planId, billingCycle) {
  const plan = getPlan(planId)
  if (!plan) return null
  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly'
  return plan.price[cycle]
}

// Etiqueta que se guarda en User.plan al activar/revocar una suscripción.
// 'free' no representa ningún plan pago activo -- se guarda como 'Free'.
export function getPlanLabel(planId) {
  const plan = getPlan(planId)
  if (!plan) return null
  return plan.id === 'free' ? 'Free' : plan.name
}

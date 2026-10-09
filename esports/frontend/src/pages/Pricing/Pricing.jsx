import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { PLANS } from '../../data/billing.js'
import './Pricing.css'

// ── Icono de check ──────────────────────────────────────────
const Check = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd"/>
  </svg>
)
const X = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clipRule="evenodd"/>
  </svg>
)

// ── Data ────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'jugador',
    planId: 'player-pro',
    label: 'Jugador',
    icon: Icon.gamepad,
    color: '#00E676',
    headline: 'Compite al máximo nivel.',
    sub: 'Estadísticas avanzadas, ranking global y matchmaking de élite para jugadores serios.',
    accentBg: 'rgba(0,230,118,.08)',
    free: {
      price: '0',
      name: 'Free',
      badge: null,
      tagline: 'Para empezar a competir',
      features: [
        { label: 'Perfil público con stats básicas', ok: true },
        { label: 'Participar en torneos abiertos', ok: true },
        { label: 'Ranking global (posición)', ok: true },
        { label: '1 equipo activo', ok: true },
        { label: 'Historial de 30 días', ok: true },
        { label: 'Stats avanzadas (KDA, winrate)', ok: false },
        { label: 'Replays y VOD análisis', ok: false },
        { label: 'Matchmaking por habilidad', ok: false },
        { label: 'Insignias exclusivas de rango', ok: false },
        { label: 'Entrenamiento con IA', ok: false },
      ],
    },
    pro: {
      price: '9.99',
      name: 'Pro',
      badge: 'MÁS POPULAR',
      badgeColor: '#00E676',
      tagline: 'Para el jugador competitivo',
      features: [
        { label: 'Perfil público con stats básicas', ok: true },
        { label: 'Participar en torneos abiertos', ok: true },
        { label: 'Ranking global (posición)', ok: true },
        { label: '3 equipos activos', ok: true },
        { label: 'Historial ilimitado', ok: true },
        { label: 'Stats avanzadas (KDA, winrate, heatmaps)', ok: true },
        { label: 'Replays y VOD análisis', ok: true },
        { label: 'Matchmaking por habilidad', ok: true },
        { label: 'Insignias exclusivas de rango', ok: true },
        { label: 'Entrenamiento con IA', ok: true },
      ],
    },
    highlights: [
      { icon: 'trend', color: '#00E676', title: 'Stats que te hacen mejorar', desc: 'Heatmaps de posicionamiento, tasa de acierto, diferencial de daño y comparativa contra tu rango.' },
      { icon: 'target', color: '#6366f1', title: 'Matchmaking inteligente', desc: 'Enfrenta rivales de tu nivel real. Sin stomps ni partidas injustas.' },
      { icon: 'award', color: '#f59e0b', title: 'Insignias y reconocimiento', desc: 'Muéstrale a todos que eres Pro. Badges exclusivos en tu perfil y en el ranking.' },
      { icon: 'eye',   color: '#ec4899', title: 'Replay & VOD análisis', desc: 'Revisa tus partidas frame a frame. Detecta errores y aprende más rápido.' },
    ],
    cta: 'Empezar como jugador Pro',
  },
  {
    id: 'organizador',
    planId: 'organizer-pro',
    label: 'Organizador',
    icon: Icon.trophy,
    color: '#f59e0b',
    headline: 'Organiza torneos que la gente recuerda.',
    sub: 'Herramientas profesionales para crear, gestionar y monetizar torneos desde cero.',
    accentBg: 'rgba(245,158,11,.08)',
    free: {
      price: '0',
      name: 'Free',
      badge: null,
      tagline: 'Para probar la plataforma',
      features: [
        { label: '1 torneo activo a la vez', ok: true },
        { label: 'Hasta 16 participantes', ok: true },
        { label: 'Bracket de eliminación simple', ok: true },
        { label: 'Página pública del torneo', ok: true },
        { label: 'Branding personalizado', ok: false },
        { label: 'Entry fee y cobros', ok: false },
        { label: 'Múltiples formatos de bracket', ok: false },
        { label: 'Stream embed integrado', ok: false },
        { label: 'Analytics de audiencia', ok: false },
        { label: 'Badge "Organizador Verificado"', ok: false },
      ],
    },
    pro: {
      price: '19.99',
      name: 'Pro Org',
      badge: 'PARA ORGANIZADORES',
      badgeColor: '#f59e0b',
      tagline: 'Torneos profesionales sin límites',
      features: [
        { label: 'Torneos simultáneos ilimitados', ok: true },
        { label: 'Hasta 512 participantes', ok: true },
        { label: 'Todos los formatos de bracket', ok: true },
        { label: 'Página pública del torneo', ok: true },
        { label: 'Branding personalizado (logo, colores)', ok: true },
        { label: 'Entry fee — tú te llevas el 90%', ok: true },
        { label: 'Bracket editor visual drag & drop', ok: true },
        { label: 'Stream embed integrado', ok: true },
        { label: 'Analytics completos de audiencia', ok: true },
        { label: 'Badge "Organizador Verificado"', ok: true },
      ],
    },
    highlights: [
      { icon: 'trophy',     color: '#f59e0b', title: 'Cobra entry fees', desc: 'Pon precio de inscripción a tus torneos. GG toma un 10%, el resto es tuyo directo.' },
      { icon: 'star',       color: '#00E676', title: 'Tu marca, tu torneo', desc: 'Logo propio, colores corporativos y URL personalizada. Parece tuyo porque lo es.' },
      { icon: 'tv',         color: '#6366f1', title: 'Stream integrado', desc: 'Embed de Twitch o YouTube dentro de la página del torneo. La audiencia sin salir de GG.' },
      { icon: 'trend',      color: '#ec4899', title: 'Analytics reales', desc: 'Cuánta gente vio, se inscribió, se fue. Mejora cada torneo con datos.' },
    ],
    cta: 'Crear mi primer torneo Pro',
  },
  {
    id: 'creador',
    planId: 'creator-pro',
    label: 'Creador',
    icon: Icon.play,
    color: '#ec4899',
    headline: 'Haz crecer tu audiencia gamer.',
    sub: 'Visibilidad, herramientas de contenido y monetización para streamers y creadores.',
    accentBg: 'rgba(236,72,153,.08)',
    free: {
      price: '0',
      name: 'Free',
      badge: null,
      tagline: 'Para empezar a crear',
      features: [
        { label: 'Perfil de creador público', ok: true },
        { label: 'Enlace a tus redes sociales', ok: true },
        { label: 'Participar en comunidades', ok: true },
        { label: 'Publicar clips (máx 60s)', ok: true },
        { label: 'Sección de creador destacado', ok: false },
        { label: 'Clips sin límite de duración', ok: false },
        { label: 'Analytics de perfil', ok: false },
        { label: 'Overlay GG para stream', ok: false },
        { label: 'Patrocinios de marcas GG', ok: false },
        { label: 'Ingresos por contenido', ok: false },
      ],
    },
    pro: {
      price: '14.99',
      name: 'Creator Pro',
      badge: 'PARA CREADORES',
      badgeColor: '#ec4899',
      tagline: 'Monetiza tu pasión',
      features: [
        { label: 'Perfil de creador verificado', ok: true },
        { label: 'Enlace a tus redes sociales', ok: true },
        { label: 'Participar y liderar comunidades', ok: true },
        { label: 'Clips ilimitados sin restricción', ok: true },
        { label: 'Sección "Creador Destacado" en home', ok: true },
        { label: 'Clips sin límite de duración', ok: true },
        { label: 'Analytics completos de perfil', ok: true },
        { label: 'Overlays GG exclusivos para stream', ok: true },
        { label: 'Acceso a campañas de marcas', ok: true },
        { label: 'Revenue share del contenido', ok: true },
      ],
    },
    highlights: [
      { icon: 'eye',    color: '#ec4899', title: 'Destacado en la plataforma', desc: 'Tu perfil aparece en la sección de creadores destacados vista por miles de usuarios.' },
      { icon: 'star',   color: '#f59e0b', title: 'Campañas con marcas', desc: 'Conéctate directamente con marcas gaming que buscan creadores. GG actúa de puente.' },
      { icon: 'play',   color: '#6366f1', title: 'Overlays para stream', desc: 'Overlays exclusivos con tu nick, stats en vivo y alertas de GG en tu stream.' },
      { icon: 'trend',  color: '#00E676', title: 'Gana con tu contenido', desc: 'Revenue share real. Cuando tu contenido genera impresiones, tú cobras.' },
    ],
    cta: 'Activar Creator Pro',
  },
]

// ── Plan management data (when user already has a plan) ────
// Antes esto era 100% inventado (nombre "Pro Jugador" fijo que ni siquiera
// coincide con ningún valor real de User.plan, fecha de renovación y "activo
// desde" hardcodeadas, toggles de "Analytics/RP x2/AI Coach/Skin Vault" que
// no tocaban el backend para nada, y un botón "Cancelar suscripción" sin
// onClick). Ahora usa el plan y las órdenes reales del usuario -- la cancelación
// real ya vive en Ajustes (Settings.jsx), así que este panel enlaza ahí en
// vez de duplicar esa lógica.
function PlanView() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [renewalDate, setRenewalDate] = useState(null)

  useEffect(() => {
    let cancelled = false
    api('/payments/orders').then(({ orders }) => {
      if (cancelled) return
      const planOrder = (orders || []).find(o => o.kind === 'plan' && (o.status === 'paid' || o.status === 'demo_paid'))
      if (!planOrder) return
      const next = new Date(planOrder.createdAt)
      if (planOrder.billingCycle === 'annual') next.setFullYear(next.getFullYear() + 1)
      else next.setMonth(next.getMonth() + 1)
      setRenewalDate(next.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const plan = PLANS.find(p => p.name === user?.plan)

  return (
    <div className="gg-planview">

      {/* ── Plan header ── */}
      <motion.div className="gg-planview__hero"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="gg-planview__hero-left">
          <div className="gg-planview__badge">{Icon.crown} {user?.plan}</div>
          {plan && <div className="gg-planview__price">${plan.price.monthly}/mes</div>}
          <div className="gg-planview__meta">
            {renewalDate && <span>{Icon.calendar} Renovación: <b>{renewalDate}</b></span>}
            <span className="gg-planview__status">{Icon.bolt} Plan activo</span>
          </div>
        </div>
        <div className="gg-planview__hero-actions">
          <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => navigate('/ajustes?tab=suscripcion')}>
            {Icon.creditCard} Gestionar suscripción
          </button>
          <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => setShowChangePlan(v => !v)}>
            {Icon.trend} {showChangePlan ? 'Ocultar planes' : 'Cambiar plan'}
          </button>
        </div>
      </motion.div>

      {/* ── Beneficios reales de tu plan ── */}
      {plan && (
        <div className="gg-planview__body">
          <motion.div className="gg-planview__card"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .07 }}>
            <div className="gg-planview__card-title">{Icon.bolt} Incluido en tu plan</div>
            <div className="gg-planview__feats">
              {plan.features.map(f => (
                <div key={f} className="gg-planview__feat">
                  <span className="gg-planview__dot on" />
                  <span className="gg-planview__feat-label">{f}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Inline plan selector (toggle) ── */}
      <AnimatePresence>
        {showChangePlan && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: .25 }}
            style={{ overflow: 'hidden' }}>
            <div className="gg-planview__change-title">
              {Icon.trend} Cambiar de plan
            </div>
            <PricingGrid />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Grid de planes (usado tanto stand-alone como dentro de PlanView) ──
function PricingGrid({ activeRoleOverride } = {}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeRole, setActiveRole] = useState(activeRoleOverride || 'jugador')
  const role = ROLES.find(r => r.id === activeRole)
  // Ninguna cuenta real tiene el plan guardado como "Pro"/"Pro Org"/"Creator
  // Pro" (esos son solo nombres de marketing en esta página) -- el nombre
  // real que se guarda en User.plan es el de billingPlans.js (Jugador Pro,
  // Organizador, Creador de Contenido).
  const REAL_PLAN_NAME = { jugador: 'Jugador Pro', organizador: 'Organizador', creador: 'Creador de Contenido' }
  const isCurrentPlan = user?.plan === REAL_PLAN_NAME[activeRole]

  return (
    <>
      <div className="gg-pricing__roles">
        {ROLES.map(r => (
          <button
            key={r.id}
            className={`gg-pricing__role-btn ${activeRole === r.id ? 'active' : ''}`}
            style={{ '--rc': r.color }}
            onClick={() => setActiveRole(r.id)}
          >
            <span className="gg-pricing__role-icon">{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeRole}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}>

          <div className="gg-pricing__hero" style={{ background: role.accentBg, borderColor: `color-mix(in srgb, ${role.color} 20%, transparent)` }}>
            <div className="gg-pricing__hero-icon" style={{ color: role.color }}>{role.icon}</div>
            <div>
              <h2 className="gg-pricing__hero-title" style={{ '--rc': role.color }}>{role.headline}</h2>
              <p className="gg-pricing__hero-sub">{role.sub}</p>
            </div>
          </div>

          <div className="gg-pricing__plans">
            <div className="gg-plan gg-plan--free">
              <div className="gg-plan__header">
                <div className="gg-plan__name">{role.free.name}</div>
                <div className="gg-plan__tagline">{role.free.tagline}</div>
                <div className="gg-plan__price">
                  <span className="gg-plan__price-cur">$</span>
                  <span className="gg-plan__price-val">0</span>
                  <span className="gg-plan__price-per">/mes</span>
                </div>
                <button className="gg-plan__cta gg-plan__cta--ghost" onClick={() => navigate('/register')}>
                  Empezar gratis
                </button>
              </div>
              <ul className="gg-plan__features">
                {role.free.features.map((f, i) => (
                  <li key={i} className={`gg-plan__feat ${f.ok ? 'ok' : 'no'}`}>
                    <span className="gg-plan__feat-icon">{f.ok ? <Check /> : <X />}</span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="gg-plan gg-plan--pro" style={{ '--rc': role.color }}>
              {role.pro.badge && (
                <div className="gg-plan__badge" style={{ background: role.pro.badgeColor }}>{role.pro.badge}</div>
              )}
              <div className="gg-plan__header">
                <div className="gg-plan__name gg-plan__name--pro">{role.pro.name}</div>
                <div className="gg-plan__tagline">{role.pro.tagline}</div>
                <div className="gg-plan__price">
                  <span className="gg-plan__price-cur">$</span>
                  <span className="gg-plan__price-val">{role.pro.price}</span>
                  <span className="gg-plan__price-per">/mes</span>
                </div>
                <button className="gg-plan__cta gg-plan__cta--primary" style={{ background: role.color }}
                  onClick={() => isCurrentPlan ? null : navigate(`/premium/checkout?plan=${role.planId}`)}
                  disabled={isCurrentPlan}>
                  {isCurrentPlan ? 'Plan actual' : role.cta}
                </button>
              </div>
              <ul className="gg-plan__features">
                {role.pro.features.map((f, i) => (
                  <li key={i} className={`gg-plan__feat ${f.ok ? 'ok' : 'no'}`}>
                    <span className="gg-plan__feat-icon" style={f.ok ? { color: role.color } : {}}>{f.ok ? <Check /> : <X />}</span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="gg-pricing__hl-head">
            <span style={{ color: role.color }}>{role.icon}</span>
            <span>¿Qué cambia con Pro?</span>
          </div>
          <div className="gg-pricing__highlights">
            {role.highlights.map((h, i) => (
              <motion.div key={i} className="gg-pricing__hl-card"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * .06, duration: .2 }}>
                <div className="gg-pricing__hl-icon" style={{ background: `color-mix(in srgb, ${h.color} 15%, transparent)`, color: h.color }}>
                  {Icon[h.icon]}
                </div>
                <div className="gg-pricing__hl-body">
                  <div className="gg-pricing__hl-title">{h.title}</div>
                  <div className="gg-pricing__hl-desc">{h.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="gg-pricing__bottom-cta">
            <div className="gg-pricing__bottom-cta-text">
              <strong>¿Listo para el siguiente nivel?</strong>
              <span>Cancela cuando quieras. Sin compromisos.</span>
            </div>
            <button className="gg-plan__cta gg-plan__cta--primary gg-pricing__main-cta"
              style={{ background: role.color }}
              onClick={() => isCurrentPlan ? null : navigate(`/premium/checkout?plan=${role.planId}`)}
              disabled={isCurrentPlan}>
              {isCurrentPlan ? 'Plan actual' : role.cta}
            </button>
          </div>

        </motion.div>
      </AnimatePresence>
    </>
  )
}

// ── Componente principal ────────────────────────────────────
export default function Pricing() {
  const { user } = useAuth()

  // Si el usuario tiene un plan de pago activo → gestión del plan.
  // OJO: User.plan siempre tiene un valor por defecto ('Free'), así que
  // comparar solo `if (user?.plan)` era siempre verdadero para cualquier
  // usuario logueado -- nadie en Free llegaba a ver el selector de planes.
  if (user?.plan && user.plan !== 'Free') {
    return (
      <div className="gg-pricing">
        <PlanView />
      </div>
    )
  }

  // Sin plan → selector de planes
  return (
    <div className="gg-pricing">
      <div className="gg-pricing__head">
        <div className="gg-pricing__badge">
          {Icon.gem}
          <span>PLANES</span>
        </div>
        <h1 className="gg-pricing__title">
          Un plan hecho <em>para ti</em>
        </h1>
        <p className="gg-pricing__sub">
          No todos usan STELIANT ESPORTS igual. Elige tu rol y ve exactamente lo que ganas con Pro.
        </p>
      </div>
      <PricingGrid />
    </div>
  )
}


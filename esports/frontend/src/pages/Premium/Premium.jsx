import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import GlitchText, { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import GlitchSocials from '../../components/GlitchSocials/GlitchSocials.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import './Premium.css'

const FEATURES = [
  {
    id: 'discord',
    icon: Icon.discord,
    color: '#5865F2',
    tag: 'Automatización',
    title: 'Bot de Discord',
    desc: 'Automatiza torneos, notificaciones de partidas y rankings directamente en tu servidor. Comandos slash, alertas en tiempo real y moderación integrada.',
    items: ['Crear torneos con /torneo', 'Notificaciones de partidas', 'Rankings automáticos', 'Moderación de servidor'],
  },
  {
    id: 'bot',
    icon: Icon.chat,
    color: 'var(--accent)',
    tag: 'IA',
    title: 'Bot en Plataforma',
    desc: 'Asistente inteligente integrado en la plataforma. Organiza torneos, responde dudas y gestiona tu equipo con comandos de texto.',
    items: ['Asistente 24/7', 'Organización automática', 'Gestión de equipos', 'Soporte inteligente'],
  },
  {
    id: 'icons',
    icon: Icon.award,
    color: '#FACC15',
    tag: 'Assets',
    title: 'Pack de Iconos',
    desc: '100+ iconos premium exclusivos para equipos, perfiles y torneos. Badges de rango, decoraciones y logos personalizados.',
    items: ['100+ iconos exclusivos', 'Badges de rango custom', 'Logos de equipo', 'Actualizaciones mensuales'],
  },
  {
    id: 'images',
    icon: Icon.camera,
    color: '#F97316',
    tag: 'Diseño',
    title: 'Imágenes & Assets',
    desc: 'Biblioteca profesional de plantillas, banners para torneos, overlays para streams y assets de alta calidad listos para usar.',
    items: ['Banners de torneo', 'Overlays para stream', 'Plantillas de equipo', 'Assets en alta resolución'],
  },
  {
    id: 'dashboard',
    icon: Icon.trophy,
    color: '#EF4444',
    tag: 'Torneos',
    title: 'Dashboard de Torneos',
    desc: 'Crea y organiza torneos con brackets automáticos, gestión completa de equipos, transmisión en vivo integrada y estadísticas post-torneo.',
    items: ['Brackets automáticos', 'Gestión de equipos', 'Transmisión en vivo', 'Estadísticas detalladas'],
  },
]

const CUSTOM_PLANS = [
  {
    id: 'player-pro',
    name: 'Jugador Pro',
    role: 'Para jugadores competitivos',
    icon: Icon.trophy,
    color: '#00E676',
    price: '$9.99',
    period: '/mes',
    highlight: false,
    desc: 'Todo lo que un jugador competitivo necesita para subir de rango, encontrar equipo y destacar en torneos.',
    cta: 'Empezar como Jugador',
    features: [
      'Stats avanzadas por partida',
      'Seguimiento de rango en tiempo real',
      'Team finder por rol y juego',
      'Historial competitivo completo',
      'Badges y frames exclusivos',
      'Acceso a torneos premium',
      'Bot de Discord',
      'Coaching tools y replays',
    ],
  },
  {
    id: 'organizer-pro',
    name: 'Organizador',
    role: 'Para organizadores de torneos y eventos',
    icon: Icon.bolt,
    color: '#F59E0B',
    price: '$19.99',
    period: '/mes',
    highlight: true,
    desc: 'Crea, gestiona y monetiza torneos y eventos con todas las herramientas profesionales de GlitchGang.',
    cta: 'Empezar como Organizador',
    features: [
      'Torneos ilimitados con brackets automáticos',
      'Gestión completa de inscripciones',
      'Sistema de prize pool y pagos',
      'Eventos y scrims gestionados',
      'Panel admin de torneo dedicado',
      'Streaming integrado en torneo',
      'Bot organizador en Discord',
      'Reportes y estadísticas post-torneo',
      'Notificaciones automáticas a equipos',
    ],
  },
  {
    id: 'creator-pro',
    name: 'Creador de Contenido',
    role: 'Para streamers y creadores',
    icon: Icon.play,
    color: '#818CF8',
    price: '$14.99',
    period: '/mes',
    highlight: false,
    desc: 'Herramientas de visibilidad, monetización y comunidad pensadas para streamers y creadores de contenido gaming.',
    cta: 'Empezar como Creador',
    features: [
      'Perfil verificado de creador',
      'Overlays y assets para stream',
      'Canal propio en GlitchGang TV',
      'Conexión directa con marcas',
      'Clips y VODs destacados',
      'Comunidad con suscriptores propios',
      'Stats de audiencia y engagement',
      'Torneos exclusivos para creadores',
      'Pack de iconos y branding personal',
    ],
  },
]

const PLANS = [
  { id: 'free', name: 'Básico', price: 'Gratis', period: '', features: ['Dashboard', 'Torneos públicos', 'Comunidad', 'Stats básicas'], highlight: false },
  { id: 'pro', name: 'Pro Trial', price: '$9.99', period: '/mes', features: ['Todo lo de Básico', 'Bot de Discord', 'Bot en plataforma', 'Pack de iconos', 'Imágenes & Assets', 'Dashboard de torneos'], highlight: true },
  { id: 'team', name: 'Team', price: '$24.99', period: '/mes', features: ['Todo lo de Pro', 'Hasta 10 miembros', 'Torneos privados', 'Soporte prioritario', 'Analytics avanzados'], highlight: false },
]

export default function Premium() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // 'free' no se guarda tal cual en User.plan (queda como la cadena 'Free',
  // o sin plan del todo para cuentas viejas) -- ver getPlanLabel en el backend.
  const isCurrentPlan = (plan) => plan.id === 'free' ? (!user?.plan || user.plan === 'Free') : user?.plan === plan.name

  return (
    <div className="gg-premium-page">

      {/* ── Hero ── */}
      <section className="gg-prm-hero">
        <div className="gg-prm-hero__glow" />
        <motion.div className="gg-prm-hero__content"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
          <div className="gg-prm-hero__badge">{Icon.crown} Pro Plan</div>
          <h1>GLITCH <GlitchGangText>GANG</GlitchGangText> <GlitchText>PRO</GlitchText></h1>
          <p>Lleva tu carrera competitiva al siguiente nivel con herramientas exclusivas, automatización y assets premium.</p>
          <GlitchSocials size="lg" />
          <div className="gg-prm-hero__cta">
            <button className="gg-btn gg-btn--primary gg-btn--lg" onClick={() => navigate('/ajustes')}>
              {Icon.bolt} Comenzar por $9.99/mes
            </button>
            <span>Cancela cuando quieras · Sin compromisos</span>
          </div>
        </motion.div>
      </section>

      {/* ── Features Grid ── */}
      <section className="gg-prm-features">
        <div className="gg-prm-features__header">
          <h2>Todo lo que incluye el plan <span>Pro</span></h2>
          <p>6 herramientas diseñadas para equipos y jugadores competitivos serios</p>
          <button className="gg-btn gg-btn--ghost gg-btn--sm gg-prm-plans-link" onClick={() => navigate('/planes')}>
            {Icon.gem} Ver planes personalizados
          </button>
        </div>

        <div className="gg-prm-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.id}
              className="gg-prm-card"
              style={{ '--fc': f.color }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="gg-prm-card__top">
                <div className="gg-prm-card__icon">{f.icon}</div>
                <span className="gg-prm-card__tag">{f.tag}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <ul className="gg-prm-card__list">
                {f.items.map((item) => (
                  <li key={item}>{Icon.check} <span>{item}</span></li>
                ))}
              </ul>
              <div className="gg-prm-card__inc">Incluido en Pro</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="gg-prm-plans">
        <h2>Elige tu plan</h2>
        <div className="gg-prm-plans__grid">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              className={`gg-prm-plan ${plan.highlight ? 'highlight' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .3 + i * 0.1 }}
            >
              {plan.highlight && <div className="gg-prm-plan__ribbon">Más popular</div>}
              <h3>{plan.name}</h3>
              <div className="gg-prm-plan__price">
                <span>{plan.price}</span>
                <small>{plan.period}</small>
              </div>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{Icon.check} <span>{f}</span></li>
                ))}
              </ul>
              <button
                className={`gg-btn ${plan.highlight ? 'gg-btn--primary' : 'gg-btn--ghost'} gg-btn--full`}
                onClick={() => isCurrentPlan(plan) ? null : navigate(`/premium/checkout?plan=${plan.id}`)}
                disabled={isCurrentPlan(plan)}
              >
                {isCurrentPlan(plan) ? 'Plan actual' : 'Seleccionar'}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Planes Personalizados ── */}
      <section className="gg-prm-pers">
        <div className="gg-prm-pers__head">
          <span className="gg-prm-pers__eyebrow">{Icon.gem} Planes personalizados</span>
          <h2>Elige según tu <span>perfil</span></h2>
          <p>Cada plan está diseñado para un rol específico dentro del ecosistema GlitchGang. Más funciones, más impacto.</p>
        </div>

        <div className="gg-prm-pers__grid">
          {CUSTOM_PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              className={`gg-prm-pers-card ${plan.highlight ? 'highlight' : ''}`}
              style={{ '--pc': plan.color }}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .4 + i * .1 }}
            >
              {plan.highlight && (
                <div className="gg-prm-pers-card__ribbon">Más popular</div>
              )}
              <div className="gg-prm-pers-card__top">
                <div className="gg-prm-pers-card__icon">{plan.icon}</div>
                <div>
                  <span className="gg-prm-pers-card__role">{plan.role}</span>
                  <h3>{plan.name}</h3>
                </div>
              </div>
              <p className="gg-prm-pers-card__desc">{plan.desc}</p>
              <div className="gg-prm-pers-card__price">
                <strong>{plan.price}</strong>
                <small>{plan.period}</small>
              </div>
              <ul className="gg-prm-pers-card__list">
                {plan.features.map(f => (
                  <li key={f}>{Icon.check}<span>{f}</span></li>
                ))}
              </ul>
              <button
                className="gg-prm-pers-card__cta"
                onClick={() => isCurrentPlan(plan) ? null : navigate(`/premium/checkout?plan=${plan.id}`)}
                disabled={isCurrentPlan(plan)}
              >
                {isCurrentPlan(plan) ? 'Plan actual' : plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <div className="gg-prm-pers__footer">
          <button className="gg-btn gg-btn--ghost" onClick={() => navigate('/dashboard')}>
            ← Volver al Dashboard
          </button>
        </div>
      </section>

    </div>
  )
}


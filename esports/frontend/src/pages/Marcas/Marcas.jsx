import { useEffect, useRef, useState } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Badge from '../../components/Badge/Badge.jsx'
import BrandCard from '../../components/BrandCard/BrandCard.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import { getPublicBrands, getPlatformStats, submitApplication } from '../../lib/brandApi.js'
import './Marcas.css'

const TABS = ['Todos', 'Platino', 'Oro', 'Plata']

const PRICING = [
  {
    id: 'silver', name: 'Plata', color: '#94a3b8',
    price: 150, dopPrice: '9,000', period: 'mes',
    tagline: 'Presencia Básica',
    desc: 'Para marcas locales que quieren figurar en la comunidad de forma pasiva.',
    features: [
      { label: 'Carrusel en página principal', ok: true },
      { label: 'Ficha de marca autogestionable', ok: true },
      { label: 'Directorio oficial de socios', ok: true },
      { label: 'Logo en cierre de transmisiones', ok: true },
      { label: 'Reporte de alcance mensual', ok: true },
      { label: 'Campañas de publicidad activas', ok: false },
      { label: 'Banner en dashboard de jugadores', ok: false },
      { label: 'Logo en brackets de torneos', ok: false },
      { label: 'Naming rights del torneo', ok: false },
    ],
  },
  {
    id: 'gold', name: 'Oro', color: '#F59E0B',
    price: 450, dopPrice: '27,000', period: 'mes',
    tagline: 'Campañas Activas',
    desc: 'Para marcas que quieren captar clientes directos de la masa de jugadores.',
    featured: true,
    features: [
      { label: 'Todo lo del plan Plata', ok: true },
      { label: 'Campañas de publicidad activas', ok: true },
      { label: 'Banner en dashboard de jugadores', ok: true },
      { label: 'Logo destacado en brackets', ok: true },
      { label: 'Menciones en vivo (3× por stream)', ok: true },
      { label: 'Reporte de impacto mensual (PDF)', ok: true },
      { label: 'Naming rights del torneo', ok: false },
      { label: 'Branding inmersivo en overlay', ok: false },
    ],
  },
  {
    id: 'platinum', name: 'Platino', color: '#a78bfa',
    price: 1200, dopPrice: '72,000+', period: 'torneo',
    tagline: 'Patrocinador Principal',
    desc: 'Para empresas líderes que financian los prize pools y se adueñan del evento.',
    features: [
      { label: 'Todo lo del plan Oro', ok: true },
      { label: 'Naming rights del torneo', ok: true },
      { label: 'Branding inmersivo en overlay del stream', ok: true },
      { label: 'Formulario de captación directa', ok: true },
      { label: 'Analíticas avanzadas de impresiones', ok: true },
      { label: 'Logo fijo durante todas las partidas', ok: true },
      { label: 'Apoyo en producción visual (assets)', ok: true },
    ],
  },
]

function PriceCard({ tier, onCta }) {
  const Icon_check = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  )
  const Icon_x = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  )

  return (
    <div className={`gg-price-card ${tier.featured ? 'gg-price-card--featured' : ''}`}
      style={{ '--pc': tier.color }}>
      {tier.featured && <div className="gg-price-card__badge">Más popular</div>}
      <div className="gg-price-card__tier">{tier.name}</div>
      <p className="gg-price-card__tagline">{tier.tagline}</p>
      <div className="gg-price-card__price">
        <span className="gg-price-card__currency">$</span>
        <strong>{tier.price.toLocaleString()}</strong>
        <span className="gg-price-card__period">USD/{tier.period}</span>
      </div>
      <div className="gg-price-card__dop">≈ RD$ {tier.dopPrice} / {tier.period}</div>
      <p className="gg-price-card__desc">{tier.desc}</p>
      <ul className="gg-price-card__features">
        {tier.features.map(f => (
          <li key={f.label} className={`gg-price-card__feat ${f.ok ? 'ok' : 'off'}`}>
            <span className="gg-price-card__feat-icon">{f.ok ? Icon_check : Icon_x}</span>
            {f.label}
          </li>
        ))}
      </ul>
      <button className={`gg-btn gg-btn--full ${tier.featured ? 'gg-btn--primary' : 'gg-btn--ghost'} gg-btn--md`}
        onClick={onCta}>
        Registrar mi marca
      </button>
    </div>
  )
}

const INDUSTRIES = [
  'Periféricos gaming', 'Hardware gaming', 'Bebidas energéticas', 'Muebles gaming',
  'Ropa y accesorios', 'Software y tecnología', 'Servicios financieros',
  'Alimentos y bebidas', 'Telecomunicaciones', 'Entretenimiento', 'Otro',
]

const EMPTY_FORM = {
  companyName: '', industry: '', tierInterest: 'silver', website: '', tagline: '',
  contactName: '', contactEmail: '', contactPhone: '', message: '',
}

// ── Beneficios con mockup visual ───────────────────────────────────────────────
const BENEFITS = [
  {
    id: 'stream',
    icon: 'tv',
    label: 'Transmisiones en vivo',
    desc: 'Tu logo aparece durante los streams de torneos ante miles de espectadores en tiempo real. Integrado en overlays, alertas y pantallas de pausa.',
    mockup: 'stream',
  },
  {
    id: 'bracket',
    icon: 'trophy',
    label: 'Brackets y fixtures',
    desc: 'Patrocina el árbol del torneo. Tu marca encabeza cada fixture que los jugadores consultan para seguir su ruta al campeonato.',
    mockup: 'bracket',
  },
  {
    id: 'panel',
    icon: 'layoutGrid',
    label: 'Panel exclusivo',
    desc: 'Banner y acciones de marca dentro del dashboard que usan a diario los competidores. Visibilidad continua, no solo durante el evento.',
    mockup: 'panel',
  },
  {
    id: 'community',
    icon: 'users',
    label: 'Alcance a la comunidad',
    desc: 'Llegás directamente a jugadores activos de la República Dominicana. Publicaciones, sorteos y colaboraciones dentro de la plataforma.',
    mockup: 'community',
  },
  {
    id: 'reports',
    icon: 'chartBar',
    label: 'Reportes de impacto',
    desc: 'Recibís métricas reales: impresiones, clics, participación por torneo y ROI estimado. Datos para justificar cada peso invertido.',
    mockup: 'reports',
  },
]

// ── Mockup visual SVG/HTML ─────────────────────────────────────────────────────
function BenefitMockup({ type }) {
  if (type === 'stream') return (
    <div className="mkp mkp--stream">
      <div className="mkp__screen">
        <div className="mkp__game-bg" />
        <div className="mkp__overlay-top">
          <div className="mkp__score">TEAM A <span>12</span> — <span>8</span> TEAM B</div>
          <div className="mkp__live">● EN VIVO</div>
        </div>
        <div className="mkp__overlay-bottom">
          <div className="mkp__sponsor-tag">
            <div className="mkp__sponsor-logo" />
            <span>PATROCINADO POR <b>TU MARCA</b></span>
          </div>
          <div className="mkp__chat">
            <div className="mkp__msg">gg ez 🔥</div>
            <div className="mkp__msg">gooo team A!</div>
            <div className="mkp__msg">clutch incoming</div>
          </div>
        </div>
      </div>
    </div>
  )

  if (type === 'bracket') return (
    <div className="mkp mkp--bracket">
      <div className="mkp__bracket-header">
        <div className="mkp__bracket-sponsor">TU MARCA AQUÍ</div>
        <span>GG Spring Split · Semifinales</span>
      </div>
      <div className="mkp__bracket-tree">
        <div className="mkp__match mkp__match--winner">
          <div className="mkp__team">Nova Esports</div>
          <div className="mkp__team">Glitch Core</div>
        </div>
        <div className="mkp__bracket-line" />
        <div className="mkp__match">
          <div className="mkp__team">Dark Phoenix</div>
          <div className="mkp__team mkp__team--dim">Royal Guard</div>
        </div>
        <div className="mkp__bracket-final">FINAL</div>
      </div>
    </div>
  )

  if (type === 'panel') return (
    <div className="mkp mkp--panel">
      <div className="mkp__sidebar">
        <div className="mkp__nav-item mkp__nav-item--active" />
        <div className="mkp__nav-item" />
        <div className="mkp__nav-item" />
        <div className="mkp__nav-item" />
      </div>
      <div className="mkp__content">
        <div className="mkp__banner">
          <div className="mkp__banner-logo" />
          <div className="mkp__banner-text">
            <div className="mkp__line mkp__line--title" />
            <div className="mkp__line" />
          </div>
          <div className="mkp__banner-cta">VER OFERTA</div>
        </div>
        <div className="mkp__cards">
          <div className="mkp__card" /><div className="mkp__card" /><div className="mkp__card" />
        </div>
      </div>
    </div>
  )

  if (type === 'community') return (
    <div className="mkp mkp--community">
      <div className="mkp__post">
        <div className="mkp__post-header">
          <div className="mkp__avatar" />
          <div>
            <div className="mkp__line mkp__line--name" />
            <div className="mkp__line mkp__line--sub" />
          </div>
          <div className="mkp__post-badge">PATROCINADO</div>
        </div>
        <div className="mkp__post-img" />
        <div className="mkp__post-actions">
          <div className="mkp__action">❤️ 1.2K</div>
          <div className="mkp__action">💬 234</div>
          <div className="mkp__action">🔄 87</div>
        </div>
      </div>
    </div>
  )

  if (type === 'reports') return (
    <div className="mkp mkp--reports">
      <div className="mkp__report-kpis">
        {[
          { label: 'Impresiones', value: '28.4K', up: true },
          { label: 'Alcance', value: '9.1K', up: true },
          { label: 'CTR', value: '4.7%', up: false },
        ].map(k => (
          <div key={k.label} className="mkp__kpi">
            <div className="mkp__kpi-val">{k.value}</div>
            <div className="mkp__kpi-lbl">{k.label}</div>
            <div className={`mkp__kpi-delta ${k.up ? '' : 'down'}`}>{k.up ? '▲' : '▼'}</div>
          </div>
        ))}
      </div>
      <div className="mkp__chart-bars">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div key={i} className="mkp__bar" style={{ '--h': `${h}%` }} />
        ))}
      </div>
      <div className="mkp__report-label">Impresiones · Últimos 7 días</div>
    </div>
  )

  return null
}

// ── Contador animado ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 1600) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const triggered = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || triggered.current) return
      triggered.current = true
      observer.disconnect()
      const steps = Math.round(duration / 16)
      let i = 0
      const timer = setInterval(() => {
        i++
        setCount(Math.round(target * (i / steps)))
        if (i >= steps) clearInterval(timer)
      }, 16)
    }, { threshold: 0.4 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])
  return [count, ref]
}

function AnimatedStat({ value, label, suffix = '' }) {
  const [count, ref] = useCountUp(value)
  return (
    <div ref={ref} className="gg-marcas-hero__stat">
      <strong>{count.toLocaleString()}{suffix}</strong>
      <span>{label}</span>
    </div>
  )
}

// ── Logo infinito ─────────────────────────────────────────────────────────────
function InfiniteLogoCarousel({ brands }) {
  if (!brands.length) return null
  const doubled = [...brands, ...brands]
  return (
    <div className="gg-logo-carousel">
      <div className="gg-logo-carousel__track">
        {doubled.map((b, i) => (
          <div key={i} className="gg-logo-pill" style={{ '--lp': b.color }} title={b.name}>
            <div className="gg-logo-pill__icon">{b.logoInitials}</div>
            <span>{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function normalizeBrand(b) {
  return {
    id:           b._id || b.id,
    code:         b.code || '',
    name:         b.name,
    logoInitials: b.logoInitials || b.name?.[0] || '?',
    color:        b.color || '#F0A500',
    tagline:      b.tagline || '',
    website:      b.website || '#',
    tier:         b.tier || 'silver',
    active:       b.status === 'active',
  }
}

export default function Marcas() {
  const [tab,       setTab]       = useState('Todos')
  const [activeBen, setActiveBen] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [sent,      setSent]      = useState(false)
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const [apiBrands, setApiBrands] = useState(null)
  const [platStats, setPlatStats] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.allSettled([getPublicBrands(), getPlatformStats()])
      .then(([b, s]) => {
        if (!alive) return
        if (b.status === 'fulfilled' && Array.isArray(b.value)) setApiBrands(b.value)
        if (s.status === 'fulfilled') setPlatStats(s.value)
      })
    return () => { alive = false }
  }, [])

  // Solo marcas reales del servidor (antes, si fallaba, salían las de ejemplo
  // de data/sponsors.js, y "Torneos patrocinados" era siempre una lista fija).
  const allBrands = apiBrands ? apiBrands.map(normalizeBrand) : []
  const platinum  = allBrands.filter(b => b.tier === 'platinum')
  const gold      = allBrands.filter(b => b.tier === 'gold')
  const silver    = allBrands.filter(b => b.tier === 'silver')
  const filtered  = tab === 'Platino' ? platinum : tab === 'Oro' ? gold : tab === 'Plata' ? silver : allBrands

  const playerCount     = platStats?.playerCount     || 0
  const tournamentCount = platStats?.tournamentCount || 0
  const brandCount      = platStats?.brandCount      || allBrands.length

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      await submitApplication({
        companyName:  form.companyName,
        industry:     form.industry,
        tierInterest: form.tierInterest,
        website:      form.website,
        tagline:      form.tagline,
        contactName:  form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        message:      form.message,
      })
      setSent(true)
    } catch (err) {
      setError(err?.message || 'Error al enviar. Por favor inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const resetForm = () => { setForm(EMPTY_FORM); setSent(false); setError('') }

  return (
    <div className="gg-page gg-marcas">

      {/* ── HERO ── */}
      <div className="gg-marcas-hero">
        <div className="gg-marcas-hero__bg" />
        <div className="gg-marcas-hero__grid-lines" />
        <motion.div className="gg-marcas-hero__content"
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
          <Badge variant="pro">Patrocinadores · República Dominicana</Badge>
          <h1>Tu marca en el<br /><em>corazón del gaming</em></h1>
          <p>Conectá con la comunidad gamer más activa del país. Torneos, transmisiones y jugadores reales esperando tu marca.</p>

          <div className="gg-marcas-hero__stats">
            <AnimatedStat value={brandCount}      label="Marcas asociadas"     suffix="+" />
            <AnimatedStat value={tournamentCount} label="Torneos patrocinados" suffix="+" />
            <AnimatedStat value={playerCount}     label="Jugadores activos"    suffix="+" />
            <AnimatedStat value={98}              label="Satisfacción"         suffix="%" />
          </div>

          <div className="gg-marcas-hero__ctas">
            <button className="gg-btn gg-btn--primary gg-btn--lg" onClick={() => setShowModal(true)}>
              {Icon.star} Registrar mi marca
            </button>
            <Link to="/marca" className="gg-btn gg-btn--ghost gg-btn--lg">
              Ya soy socio · Mi panel
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ── LOGO CAROUSEL ── */}
      <section className="gg-marcas-carousel-section">
        <p className="gg-marcas-carousel-label">Confían en GlitchGang</p>
        <InfiniteLogoCarousel brands={allBrands} />
      </section>

      {/* ── BENEFICIOS CON MOCKUP ── */}
      <section className="gg-marcas-benefits">
        <div className="gg-marcas-benefits__head">
          <Badge variant="muted">¿Qué obtenés?</Badge>
          <h2>Tu logo donde importa</h2>
          <p>No explicamos lo que ofrecemos — te lo mostramos. Así luce tu marca dentro de la plataforma.</p>
        </div>

        <div className="gg-marcas-benefits__body">
          <div className="gg-marcas-benefits__tabs">
            {BENEFITS.map((b, i) => (
              <button
                key={b.id}
                className={`gg-marcas-ben-tab ${activeBen === i ? 'active' : ''}`}
                onClick={() => setActiveBen(i)}
              >
                <span className="gg-marcas-ben-tab__icon">{Icon[b.icon]}</span>
                <div>
                  <div className="gg-marcas-ben-tab__label">{b.label}</div>
                  <div className="gg-marcas-ben-tab__desc">{b.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="gg-marcas-benefits__preview">
            <AnimatePresence mode="wait">
              <motion.div key={activeBen}
                initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }} transition={{ duration: .22 }}
                className="gg-marcas-benefits__mockup">
                <BenefitMockup type={BENEFITS[activeBen].mockup} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section className="gg-marcas-pricing">
        <div className="gg-marcas-pricing__head">
          <Badge variant="pro">Planes & Precios</Badge>
          <h2>Elige tu nivel de exposición</h2>
          <p>Sin letra pequeña. Precios adaptados al mercado corporativo dominicano.</p>
        </div>
        <div className="gg-marcas-pricing__cards">
          {PRICING.map(tier => (
            <PriceCard key={tier.id} tier={tier} onCta={() => setShowModal(true)} />
          ))}
        </div>
        <p className="gg-marcas-pricing__note">
          Todos los planes requieren aprobación del equipo GlitchGang. Sin cobro hasta la confirmación.
        </p>
      </section>

      {/* ── SOCIOS PRINCIPALES ── */}
      {([...platinum, ...gold]).length > 0 && (
        <section className="gg-marcas-partners">
          <div className="gg-marcas-partners__text">
            <Badge variant="muted">Platino &amp; Oro</Badge>
            <h2>Nuestros socios<br />principales</h2>
            <p>Marcas de primer nivel con presencia en torneos, transmisiones y campañas exclusivas.</p>
            <div className="gg-marcas-partners__cta">
              <button className="gg-btn gg-btn--primary gg-btn--md" onClick={() => setShowModal(true)}>
                Quiero asociarme
              </button>
              <Link to="/marca" className="gg-btn gg-btn--ghost gg-btn--md">Ya soy socio</Link>
            </div>
          </div>
          <div className="gg-marcas-partners__logos">
            {[...platinum, ...gold].slice(0, 6).map((s, i) => (
              <motion.a key={s.id} href={safeHref(s.website)} target="_blank" rel="noopener noreferrer"
                className="gg-marcas-logo-pill" style={{ '--lp': s.color }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 + i * .06 }}>
                <div className="gg-marcas-logo-pill__icon">{s.logoInitials}</div>
                <span>{s.name}</span>
              </motion.a>
            ))}
          </div>
        </section>
      )}

      {/* ── TODAS LAS MARCAS ── */}
      {allBrands.length > 0 && (
        <section className="gg-marcas-all">
          <div className="gg-marcas-all__head">
            <h2>Nuestras Marcas</h2>
            <p>Todas las empresas que forman parte de la familia <GlitchGangText>GlitchGang</GlitchGangText>.</p>
            <div className="gg-marcas-tabs">
              {TABS.map(t => (
                <button key={t} className={`gg-marcas-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t}
                  {t === 'Platino' && platinum.length > 0 && <span className="gg-marcas-tab-count">{platinum.length}</span>}
                  {t === 'Oro'     && gold.length > 0     && <span className="gg-marcas-tab-count">{gold.length}</span>}
                  {t === 'Plata'   && silver.length > 0   && <span className="gg-marcas-tab-count">{silver.length}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="gg-marcas-grid">
            {filtered.length > 0
              ? filtered.map((s, i) => <BrandCard key={s.id} sponsor={s} delay={i * 0.04} />)
              : <p style={{ color: 'var(--text-dim)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem 0' }}>No hay marcas en esta categoría todavía.</p>
            }
          </div>
        </section>
      )}

      {/* ── CTA + PROCESO ── */}
      <section className="gg-marcas-cta-bottom" id="contacto">
        <div className="gg-marcas-cta-bottom__inner">
          <div className="gg-marcas-cta-bottom__left">
            <Badge variant="pro">¿Tu marca aquí?</Badge>
            <h2>Lleva tu marca al<br />centro del gaming</h2>
            <p>Conecta con jugadores activos, patrocina torneos y lanza campañas exclusivas para la comunidad gaming dominicana.</p>

            <div className="gg-marcas-timeline">
              {[
                { n: '1', label: 'Registras tu marca', sub: 'Formulario rápido, sin compromisos' },
                { n: '2', label: 'Revisamos en 48h', sub: 'Nuestro equipo evalúa tu propuesta' },
                { n: '3', label: '¡Panel desbloqueado!', sub: 'Acceso a estadísticas y gestión' },
              ].map((step, i) => (
                <motion.div key={i} className="gg-marcas-step"
                  initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * .12 }}>
                  <div className="gg-marcas-step__num">{step.n}</div>
                  {i < 2 && <div className="gg-marcas-step__line" />}
                  <div className="gg-marcas-step__info">
                    <b>{step.label}</b>
                    <small>{step.sub}</small>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="gg-marcas-trusted">
              <span>Confían en nosotros</span>
              <div className="gg-marcas-trusted__logos">
                {allBrands.slice(0, 5).map(s => (
                  <div key={s.id} className="gg-marcas-trusted__logo" style={{ background: s.color }} title={s.name}>
                    {s.logoInitials}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gg-marcas-cta-bottom__right">
            <div className="gg-marcas-cta-card">
              <div className="gg-marcas-cta-card__glow" />
              <div className="gg-marcas-cta-card__icon">{Icon.star}</div>
              <h3>Únete como socio oficial</h3>
              <p>Tu solicitud es revisada en menos de 48 horas. Una vez aprobada, tendrás acceso a tu panel con estadísticas en tiempo real.</p>
              <button className="gg-btn gg-btn--primary gg-btn--full gg-btn--lg" onClick={() => setShowModal(true)}>
                {Icon.user} Registrar mi marca
              </button>
              <p className="gg-marcas-form__note">Sin costo de registro. Sin compromisos hasta la aprobación.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="gg-marcas-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && !sending && setShowModal(false)}>
            <motion.div className="gg-marcas-modal"
              initial={{ opacity: 0, y: 30, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}>

              <div className="gg-marcas-modal__head">
                <div>
                  <h2>Registrar mi marca</h2>
                  <p>Completa el formulario y nuestro equipo revisará tu solicitud en 48 horas.</p>
                </div>
                <button className="gg-marcas-modal__close" onClick={() => { setShowModal(false); resetForm() }}>{Icon.x}</button>
              </div>

              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div key="ok" className="gg-marcas-modal__success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="gg-marcas-success__icon">{Icon.check}</div>
                    <h3>¡Solicitud enviada!</h3>
                    <p>Nos pondremos en contacto a <strong>{form.contactEmail}</strong> en menos de 48 horas hábiles.</p>
                    <button className="gg-btn gg-btn--ghost gg-btn--md" onClick={() => { resetForm(); setShowModal(false) }}>
                      Cerrar
                    </button>
                  </motion.div>
                ) : (
                  <motion.form key="form" onSubmit={handleSubmit} className="gg-marcas-modal__form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="gg-marcas-modal__section">Información de la empresa</div>
                    <div className="gg-marcas-form__row">
                      <div className="gg-marcas-field">
                        <label>Nombre de la empresa <span className="gg-marcas-field__req">*</span></label>
                        <input required value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Ej. Federacion Dominicana de Videojuegos, NPC Latino" />
                      </div>
                      <div className="gg-marcas-field">
                        <label>Industria <span className="gg-marcas-field__req">*</span></label>
                        <select required value={form.industry} onChange={e => set('industry', e.target.value)}>
                          <option value="">Selecciona una industria</option>
                          {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="gg-marcas-form__row">
                      <div className="gg-marcas-field">
                        <label>Sitio web</label>
                        <input type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://tuempresa.com" />
                      </div>
                      <div className="gg-marcas-field">
                        <label>Plan de interés</label>
                        <select value={form.tierInterest} onChange={e => set('tierInterest', e.target.value)}>
                          <option value="silver">Plata — Presencia básica</option>
                          <option value="gold">Oro — Campañas activas</option>
                          <option value="platinum">Platino — Patrocinador principal</option>
                        </select>
                      </div>
                    </div>
                    <div className="gg-marcas-field">
                      <label>Slogan / tagline</label>
                      <input value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Tu lema de marca (opcional)" />
                    </div>
                    <div className="gg-marcas-modal__section">Datos de contacto</div>
                    <div className="gg-marcas-form__row">
                      <div className="gg-marcas-field">
                        <label>Nombre de contacto <span className="gg-marcas-field__req">*</span></label>
                        <input required value={form.contactName} onChange={e => set('contactName', e.target.value)} placeholder="Tu nombre completo" />
                      </div>
                      <div className="gg-marcas-field">
                        <label>Correo electrónico <span className="gg-marcas-field__req">*</span></label>
                        <input required type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="hola@tuempresa.com" />
                      </div>
                    </div>
                    <div className="gg-marcas-field">
                      <label>Teléfono</label>
                      <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+1 000 000 0000" />
                    </div>
                    <div className="gg-marcas-field">
                      <label>Mensaje adicional</label>
                      <textarea value={form.message} onChange={e => set('message', e.target.value)}
                        placeholder="Cuéntanos sobre tu campaña, presupuesto estimado o cualquier detalle relevante…" rows={3} />
                    </div>
                    {error && <p className="gg-marcas-form__error">{error}</p>}
                    <div className="gg-marcas-modal__actions">
                      <button type="button" className="gg-btn gg-btn--ghost gg-btn--md" onClick={() => setShowModal(false)} disabled={sending}>
                        Cancelar
                      </button>
                      <button type="submit" className="gg-btn gg-btn--primary gg-btn--md" disabled={sending}>
                        {sending ? 'Enviando…' : 'Enviar solicitud'}
                      </button>
                    </div>
                    <p className="gg-marcas-form__note">Al enviar aceptas nuestra política de privacidad. Sin spam, prometido.</p>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


import { useEffect, useState } from 'react';
import { Bot, Radio, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react';
import styles from './LandingPage.module.css';

const FEATURES = [
  {
    icon: Trophy,
    title: 'Torneos en vivo',
    desc: 'Crea, activa y sigue tus torneos con check-in, reportes y brackets desde un solo panel.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles automáticos',
    desc: 'El rol de cada jugador se sincroniza solo entre tu cuenta de GlitchGang y tu servidor de Discord.',
  },
  {
    icon: Radio,
    title: 'Grabación de partidas',
    desc: 'Audio y screen share de cada partida oficial, con evidencia lista para el Centro de Resoluciones.',
  },
  {
    icon: Bot,
    title: 'Discord Monitor',
    desc: 'Gestiona canales, roles y voz en vivo de tu servidor sin salir del CRM.',
  },
];

const PLANS = [
  { name: 'GlitchGang Internal', price: '$0/mes', blurb: 'Uso interno, bot incluido sin costo.' },
  { name: 'Fee por Torneo', price: 'desde $25', blurb: 'Ideal para organizadores ocasionales.', highlight: true },
  { name: 'Comisión por Torneo', price: '12% por defecto', blurb: 'Para ligas y marcas de alto volumen.' },
];

export default function LandingPage({ auth }) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGlitching(true), 300);
    return () => clearTimeout(t);
  }, []);

  const loginHref = auth?.configured ? auth.loginUrl : '#';

  return (
    <div className={styles.page}>
      <div className={styles.scan} />
      <div className={styles.glow} />

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src="/GG.png" alt="" className={styles.brandLogo} />
          <span>GlitchGang</span>
        </div>
        <a
          className={styles.topbarLogin}
          href={loginHref}
          aria-disabled={!auth?.configured}
        >
          Entrar con Discord
        </a>
      </header>

      <main className={styles.hero}>
        <span className={styles.eyebrow}>
          <Sparkles size={13} /> Control Center
        </span>

        <h1
          className={`${styles.title} gg-glitch${glitching ? ' fire' : ''}`}
          data-text="GLITCHGANG"
          onAnimationEnd={() => setGlitching(false)}
        >
          GLITCHGANG
        </h1>

        <p className={styles.subtitle}>
          El panel de control para organizar torneos de esports por Discord — check-in,
          roles automáticos, grabación de partidas y resolución de disputas, todo
          sincronizado con tu cuenta de GlitchGang.
        </p>

        <div className={styles.ctaRow}>
          <a className={styles.ctaPrimary} href={loginHref} aria-disabled={!auth?.configured}>
            <Users size={16} /> Entrar con Discord (equipo GlitchGang)
          </a>
          <a className={styles.ctaSecondary} href="#planes">Ver planes</a>
        </div>

        {!auth?.configured && (
          <p className={styles.notice}>
            El login con Discord todavía no está configurado en este servidor.
          </p>
        )}

        <p className={styles.accessNote}>
          Acceso exclusivo para el equipo de GlitchGang. Si eres organizador, activa tu
          Discord desde Centro de Torneos en tu cuenta de GlitchGang.
        </p>
      </main>

      <section className={styles.features}>
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <article key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}><Icon size={18} /></div>
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
            </article>
          );
        })}
      </section>

      <section id="planes" className={styles.plansSection}>
        <div className={styles.plansHead}>
          <span className={styles.eyebrow}>Suscripción y pagos</span>
          <h2>Planes para organizadores</h2>
          <p>
            GlitchGang usa el bot gratis. Si administras torneos de terceros, el acceso
            se desbloquea por fee o por comisión — el cobro se coordina por PayPal.
          </p>
        </div>

        <div className={styles.plansGrid}>
          {PLANS.map((p) => (
            <div key={p.name} className={`${styles.planCard} ${p.highlight ? styles.planHighlight : ''}`}>
              <strong>{p.name}</strong>
              <span className={styles.planPrice}>{p.price}</span>
              <p>{p.blurb}</p>
            </div>
          ))}
        </div>

        <p className={styles.plansFootnote}>
          Entra con Discord y desde <b>Suscripción</b> dentro del CRM puedes coordinar tu
          plan de pago — el checkout automático todavía está en construcción.
        </p>

        <a className={styles.ctaPrimary} href={loginHref} aria-disabled={!auth?.configured}>
          <Users size={16} /> Entrar con Discord
        </a>
      </section>
    </div>
  );
}

import { motion } from 'framer-motion'
import { Icon } from '../../components/icons/Icons.jsx'
import GlitchText from '../../components/GlitchText/GlitchText.jsx'
import Logo from '../../components/Logo/Logo.jsx'
import './Socials.css'

const LINKS = [
  {
    id: 'discord',
    icon: Icon.discord,
    label: 'Discord',
    handle: '@GlitchGang',
    desc: 'Únete al servidor oficial · Torneos, soporte y comunidad activa',
    color: '#5865F2',
    bg: 'rgba(88,101,242,.1)',
    href: 'https://discord.gg/bZTsanNB3G',
    stat: '12.4K miembros',
  },
  {
    id: 'whatsapp',
    icon: Icon.whatsapp,
    label: 'WhatsApp',
    handle: 'Grupo oficial',
    desc: 'Canal de noticias, alertas de torneos y resultados en tiempo real',
    color: '#25D366',
    bg: 'rgba(37,211,102,.1)',
    href: 'https://wa.me/glitchgang',
    stat: '3.1K seguidores',
  },
  {
    id: 'youtube',
    icon: Icon.youtube,
    label: 'YouTube',
    handle: '@GlitchGangTV',
    desc: 'VODs de torneos, highlights, tutoriales y streams',
    color: '#FF0000',
    bg: 'rgba(255,0,0,.1)',
    href: 'https://youtube.com/@glitchgang',
    stat: '8.7K suscriptores',
  },
  {
    id: 'twitch',
    icon: Icon.twitch,
    label: 'Twitch',
    handle: '/GlitchGangTV',
    desc: 'Transmisiones en vivo de torneos y scrims',
    color: '#9146FF',
    bg: 'rgba(145,70,255,.1)',
    href: 'https://twitch.tv/glitchgang',
    stat: '5.2K seguidores',
  },
  {
    id: 'tiktok',
    icon: Icon.tiktok,
    label: 'TikTok',
    handle: '@GlitchGang',
    desc: 'Clips, momentos épicos y contenido detrás de cámaras',
    color: '#e0e0e0',
    bg: 'rgba(224,224,224,.08)',
    href: 'https://tiktok.com/@glitchgang',
    stat: '21K seguidores',
  },
  {
    id: 'instagram',
    icon: Icon.instagram,
    label: 'Instagram',
    handle: '@GlitchGang',
    desc: 'Fotos de torneos, diseños exclusivos y novedades',
    color: '#E1306C',
    bg: 'rgba(225,48,108,.1)',
    href: 'https://instagram.com/glitchgang',
    stat: '9.3K seguidores',
  },
]

export default function Socials() {
  return (
    <div className="gg-soc-page">

      {/* Hero */}
      <section className="gg-soc-hero">
        <div className="gg-soc-hero__grid" />
        <motion.div
          className="gg-soc-hero__inner"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .5 }}
        >
          <div className="gg-soc-hero__logo">
            <Logo size={36} />
          </div>
          <h1>GLITCH<GlitchText>GANG</GlitchText></h1>
          <p className="gg-soc-hero__sub">by Stephanie López Frías / Steliant</p>
          <p className="gg-soc-hero__desc">
            Síguenos en todas las redes y mantente al día con torneos, streams y la comunidad competitiva más activa.
          </p>
          <div className="gg-soc-hero__stats">
            <div><span>50K+</span><small>seguidores en total</small></div>
            <div><span>6</span><small>plataformas activas</small></div>
            <div><span>24/7</span><small>contenido en vivo</small></div>
          </div>
        </motion.div>
      </section>

      {/* Links */}
      <section className="gg-soc-links">
        {LINKS.map((l, i) => (
          <motion.a
            key={l.id}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="gg-soc-card"
            style={{ '--lc': l.color, '--lb': l.bg }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ x: 6 }}
          >
            <span className="gg-soc-card__icon">{l.icon}</span>
            <div className="gg-soc-card__body">
              <div className="gg-soc-card__top">
                <strong>{l.label}</strong>
                <span className="gg-soc-card__handle">{l.handle}</span>
              </div>
              <p>{l.desc}</p>
            </div>
            <div className="gg-soc-card__right">
              <span className="gg-soc-card__stat">{l.stat}</span>
              <span className="gg-soc-card__arr">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </span>
            </div>
          </motion.a>
        ))}
      </section>

    </div>
  )
}


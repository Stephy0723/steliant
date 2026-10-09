import { Link } from 'react-router-dom'
import Reveal from '../../components/Reveal/Reveal.jsx'
import SocialLinks from '../../components/SocialLinks/SocialLinks.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import Logo from '../../components/Logo/Logo.jsx'
import './Footer.css'

const ROUTES = {
  plat: ['/torneos', '/equipos', '/comunidad', '/ranking', '/universidad'],
  sup: ['/ayuda', '/ayuda#riot', '/ayuda', '/ayuda#reportar', '/ayuda#contacto'],
  legal: ['/terminos', '/privacidad', '/politica-pagos', '/terminos-organizador'],
}

export default function Footer() {
  const { lang } = useLang()
  const isEs = lang === 'es'
  const copy = isEs
    ? {
        tagline: 'La plataforma para gestionar tu carrera en esports: torneos, equipos y comunidad en un solo lugar.',
        plataforma: 'Plataforma',
        soporte: 'Soporte',
        legal: 'Legal',
        links_plat: ['Torneos', 'Equipos', 'Comunidad', 'Ranking', 'Universidad'],
        links_sup: ['Documentacion', 'Riot Review', 'Centro de ayuda', 'Reportar un bug', 'Contacto'],
        links_legal: ['Terminos y condiciones', 'Politica de privacidad', 'Politica de pagos', 'Terminos de organizador'],
        riot: 'STELIANT ESPORTS no esta respaldado por Riot Games y no refleja las opiniones de Riot Games ni de personas oficialmente involucradas con sus propiedades.',
        copy: 'Hecho con dedicacion',
        legalnote: 'Consulta los detalles en Terminos y condiciones y Politica de privacidad.',
      }
    : {
        tagline: 'The platform to manage your esports career: tournaments, teams, and community in one place.',
        plataforma: 'Platform',
        soporte: 'Support',
        legal: 'Legal',
        links_plat: ['Tournaments', 'Teams', 'Community', 'Ranking', 'University'],
        links_sup: ['Documentation', 'Riot Review', 'Help Center', 'Report a bug', 'Contact'],
        links_legal: ['Terms and conditions', 'Privacy policy', 'Payment policy', 'Organizer terms'],
        riot: 'STELIANT ESPORTS is not endorsed by Riot Games and does not reflect the views of Riot Games or anyone officially involved with its properties.',
        copy: 'Made with care',
        legalnote: 'See the details in Terms and conditions and Privacy policy.',
      }

  const zip = (labels = [], routes = []) => labels.map((label, i) => ({ label, to: routes[i] || '#' }))
  const cols = [
    { h: copy.plataforma, links: zip(copy.links_plat, ROUTES.plat) },
    { h: copy.soporte, links: zip(copy.links_sup, ROUTES.sup) },
    { h: copy.legal, links: zip(copy.links_legal, ROUTES.legal) },
  ]

  return (
    <footer className="gg-footer">
      <div className="gg-footer__glow" />
      <div className="gg-footer__grid" />

      <div className="gg-footer__inner">
        <Reveal className="gg-footer__brand">
          <div className="bx">
            <Logo size={44} withText />
            <div className="t"><small>by Steliant</small></div>
          </div>
          <p>{copy.tagline}</p>
          <SocialLinks />
        </Reveal>

        {cols.map((col, index) => (
          <Reveal key={col.h} delay={0.06 * (index + 1)} className="gg-fcol">
            <h4>{col.h}</h4>
            {col.links.map((link) => <Link key={link.label} to={link.to}>{link.label}</Link>)}
          </Reveal>
        ))}
      </div>

      <div className="gg-footer__legal">
        <p className="disc">{copy.riot}</p>
        <div className="gg-footer__bottom">
          <span className="by">(c) 2026 STELIANT ESPORTS - {copy.copy} <b>by Steliant</b></span>
          <span>{copy.legalnote}</span>
        </div>
      </div>
    </footer>
  )
}


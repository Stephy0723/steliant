import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { hideInBeta, hideInBetaSections, isBetaHidden } from '../../config/betaHidden.js'
import Logo from '../Logo/Logo.jsx'
import Button from '../Button/Button.jsx'
import { useScrolled } from '../../hooks/useScrolled.js'
import { useLang } from '../../i18n/LangContext.jsx'
import './Navbar.css'

export default function Navbar({ visible }) {
  const scrolled = useScrolled(40)
  const { lang, setLang, t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const isEs = lang === 'es'
  const langLabels = {
    es: { switchEs: 'Cambiar idioma a español', switchEn: 'Cambiar idioma a inglés' },
    en: { switchEs: 'Switch language to Spanish', switchEn: 'Switch language to English' },
  }

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 960) setOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    // Limpia locks antiguos si el usuario navego desde una build previa.
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  const navLinks = hideInBeta([
    { label: t.nav.plataforma || 'Plataforma', to: '/' },
    { label: t.nav.comunidad || 'Comunidad', to: '/comunidad' },
    { label: t.nav.ranking || 'Ranking', to: '/ranking' },
    { label: t.nav.precios || 'Planes', to: '/planes' },
  ], 'to')

  return (
    <>
      <motion.nav
        className={`gg-nav ${scrolled ? 'gg-nav--scrolled' : ''} ${open ? 'gg-nav--open' : ''}`}
        initial={{ opacity: 0, y: -18 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link to="/" className="gg-nav__logo" onClick={() => setOpen(false)}>
          <Logo size={28} withText />
        </Link>

        <div className="gg-nav__links">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `gg-navlink${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="gg-nav__actions">
          <span className="gg-langpill gg-langpill--nav" data-no-translate>
            <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')} aria-label={langLabels[lang].switchEs} title="Español">ES</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-label={langLabels[lang].switchEn} title="English">EN</button>
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            {t.nav.login || 'Entrar'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
            {t.nav.join || 'Unirse gratis'}
          </Button>
        </div>

        <button
          className={`gg-hamburger ${open ? 'open' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-label={open ? (t.side?.closeMenu || (isEs ? 'Cerrar menu' : 'Close menu')) : (t.side?.openMenu || (isEs ? 'Abrir menu' : 'Open menu'))}
          aria-expanded={open}
        >
          <span /><span /><span />
        </button>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            className="gg-mobile-menu"
            initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
            exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="gg-mobile-menu__inner">
              <nav className="gg-mobile-nav">
                {navLinks.map((link, i) => (
                  <motion.div key={link.to} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) => `gg-mobile-link${isActive ? ' active' : ''}`}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </NavLink>
                  </motion.div>
                ))}
              </nav>

              <motion.div className="gg-mobile-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Button variant="ghost" onClick={() => { navigate('/login'); setOpen(false) }} style={{ width: '100%' }}>
                  {t.nav.login || 'Entrar'}
                </Button>
                <Button variant="primary" onClick={() => { navigate('/register'); setOpen(false) }} style={{ width: '100%' }}>
                  {t.nav.join || 'Unirse gratis'}
                </Button>
                <div className="gg-mobile-lang" data-no-translate>
                  <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>ES Español</button>
                  <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN English</button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}


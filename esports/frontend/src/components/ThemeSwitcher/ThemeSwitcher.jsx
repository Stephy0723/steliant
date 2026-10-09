import { useState } from 'react'
import { useTheme } from '../../theme/ThemeContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { ACCENTS, BACKGROUNDS } from '../../theme/themeConfig.js'
import { Icon } from '../icons/Icons.jsx'
import './ThemeSwitcher.css'

export default function ThemeSwitcher({ inline = false }) {
  const { accent, setAccent, background, setBackground } = useTheme()
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const labels = lang === 'en'
    ? { accent: 'Accent', background: 'Background', title: 'Theme' }
    : { accent: 'Acento', background: 'Fondo', title: 'Tema' }

  const panel = (
    <div className="gg-themer__panel">
      <small>{labels.accent}</small>
      <div className="gg-themer__row">
        {Object.entries(ACCENTS).map(([name, { color }]) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            className={`gg-sw ${accent === name ? 'is-active' : ''}`}
            style={{ background: color }}
            onClick={() => setAccent(name)}
          />
        ))}
      </div>

      <small>{labels.background}</small>
      <div className="gg-themer__row">
        {Object.entries(BACKGROUNDS).map(([name, { bg }]) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            className={`gg-bgsw ${background === name ? 'is-active' : ''}`}
            style={{ background: bg }}
            onClick={() => setBackground(name)}
          />
        ))}
      </div>
    </div>
  )

  if (inline) {
    return <div className="gg-themer gg-themer--inline">{panel}</div>
  }

  return (
    <div className={`gg-themer ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="gg-themer__toggle"
        aria-label={labels.title}
        aria-expanded={open}
        title={labels.title}
        onClick={() => setOpen(value => !value)}
      >
        {Icon.palette}
      </button>
      {open && panel}
    </div>
  )
}


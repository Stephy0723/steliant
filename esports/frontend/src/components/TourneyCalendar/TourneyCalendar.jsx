/**
 * TourneyCalendar — mini calendario de torneos para el sidebar.
 * Marca los días con torneos y permite navegar entre meses.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../i18n/LangContext.jsx'
import './TourneyCalendar.css'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_ES   = ['L','M','M','J','V','S','D']
const DAYS_EN   = ['M','T','W','T','F','S','S']

// Days with tournaments (day numbers of current month, e.g. June)
// In production these come from API; here we use mock
const TOURNEY_DAYS = { 1: 2, 5: 1, 7: 1, 10: 1, 15: 3, 20: 1, 25: 2 }

export default function TourneyCalendar({ eventDays = TOURNEY_DAYS }) {
  const navigate = useNavigate()
  const { lang, t } = useLang()
  const isEs = lang === 'es'
  const MONTHS = isEs ? MONTHS_ES : MONTHS_EN
  const DAYS = isEs ? DAYS_ES : DAYS_EN
  const p = t.pages

  const today    = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1).getDay()   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Convert Sun-based index to Mon-based (0=Mon … 6=Sun)
  const offset = (firstDay + 6) % 7

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isToday = (d) =>
    d === today.getDate() &&
    month === today.getMonth() &&
    year  === today.getFullYear()

  const totalTourneys = Object.values(eventDays).reduce((a, b) => a + b, 0)

  return (
    <div className="tc-root">
      {/* Header */}
      <div className="tc-header">
        <div className="tc-header__icon">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="14" height="13" rx="2"/>
            <path d="M3 8h14M7 2v3M13 2v3"/>
          </svg>
        </div>
        <span className="tc-header__title">{p.calendar}</span>
        <button className="tc-header__btn" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }} title={isEs ? 'Hoy' : 'Today'}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="10" cy="10" r="7"/>
            <path d="M10 6v4l3 2"/>
          </svg>
        </button>
      </div>

      {/* Month nav */}
      <div className="tc-nav">
        <button className="tc-nav__arrow" onClick={prevMonth}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M13 16l-6-6 6-6"/>
          </svg>
        </button>
        <div className="tc-nav__month">
          <b>{MONTHS[month]}</b>
          <span>{year}</span>
        </div>
        <button className="tc-nav__arrow" onClick={nextMonth}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 4l6 6-6 6"/>
          </svg>
        </button>
      </div>

      {/* Torneos count */}
      <div className="tc-count">
        <span className="tc-count__dot" />
        {totalTourneys} {isEs ? 'TORNEOS' : 'TOURNAMENTS'}
      </div>

      {/* Grid */}
      <div className="tc-grid">
        {/* Day headers */}
        {DAYS.map((d, i) => (
          <div key={`h-${i}`} className="tc-day-hdr">{d}</div>
        ))}
        {/* Day cells */}
        {cells.map((d, i) => (
          <div
            key={i}
            className={[
              'tc-cell',
              d === null    ? 'empty'       : '',
              isToday(d)    ? 'today'       : '',
              d && eventDays[d] ? 'has-event' : '',
            ].join(' ')}
          >
            {d && (
              <>
                <span>{d}</span>
                {eventDays[d] && (
                  <span className="tc-cell__dot" />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Footer link */}
      <button className="tc-footer" onClick={() => navigate('/torneos')}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="14" height="13" rx="2"/>
          <path d="M3 8h14M7 2v3M13 2v3"/>
        </svg>
        {p.fullCalendar}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <path d="M4 10h12M10 4l6 6-6 6"/>
        </svg>
      </button>
    </div>
  )
}


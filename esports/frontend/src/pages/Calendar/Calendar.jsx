import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../components/icons/Icons.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { loadEvents, addEvent, removeEvent } from '../../lib/eventsStore.js'
import { api } from '../../lib/api.js'
import './Calendar.css'

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COLORS = ['#00E676', '#FF4655', '#7c3aed', '#F0A500', '#1E9DE3', '#E1306C']

function toDateKey(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDate(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return new Date(`${value}T12:00:00`)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function todayKey() {
  return toDateKey(new Date())
}

function fmtDate(key, isEs) {
  const date = parseDate(key)
  if (!date) return isEs ? 'Sin fecha' : 'No date'
  return date.toLocaleDateString(isEs ? 'es-DO' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShortDate(key, isEs) {
  const date = parseDate(key)
  if (!date) return '--'
  return date.toLocaleDateString(isEs ? 'es-DO' : 'en-US', { day: '2-digit', month: 'short' })
}

function fmtTime(value) {
  if (!value) return '--:--'
  if (/^\d{2}:\d{2}/.test(String(value))) return String(value).slice(0, 5)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
}

function normalizeTournament(item) {
  const date = parseDate(item.date || item.rawDate || item.startDate)
  const dateKey = toDateKey(date)
  if (!dateKey) return null
  const status = item.status || item.sourceStatus || 'upcoming'
  const normalizedStatus = {
    open: 'upcoming',
    registration_closed: 'upcoming',
    ongoing: 'live',
    live: 'live',
    finished: 'finished',
    cancelled: 'finished',
    draft: 'upcoming',
  }[status] || status

  return {
    id: `tor-${item._id || item.id || item.publicId || item.name}`,
    sourceId: item._id || item.id || item.publicId,
    type: 'tournament',
    title: item.title || item.name || 'Torneo',
    game: item.gameLabel || item.game || 'Competitivo',
    date: dateKey,
    time: item.time || fmtTime(item.date || item.rawDate),
    color: item.color || '#FF4655',
    status: normalizedStatus,
    rawStatus: status,
    description: item.description || item.rules || '',
    meta: item.prizePool || item.prize ? `Premio ${item.currency || '$'}${item.prizePool || item.prize}` : '',
    link: `/torneos/${item._id || item.id || item.publicId}`,
  }
}


function normalizeUserEvent(event) {
  const dateKey = toDateKey(event.date)
  if (!dateKey) return null
  return {
    id: event.id || `evt-${dateKey}-${event.title}`,
    type: 'event',
    title: event.title || 'Actividad',
    game: event.game || 'General',
    date: dateKey,
    time: event.time || '--:--',
    color: event.color || '#00E676',
    status: 'activity',
    description: event.desc || event.description || '',
    isPublic: event.isPublic !== false,
  }
}

function periodFor(event, nowKey) {
  if (event.date < nowKey) return 'past'
  if (event.date > nowKey) return 'future'
  return 'today'
}

export default function Calendar() {
  const { lang } = useLang()
  const isEs = lang !== 'en'
  const navigate = useNavigate()
  const now = todayKey()
  const today = parseDate(now) || new Date()
  const MONTHS = isEs ? MONTHS_ES : MONTHS_EN
  const WEEK = isEs ? WEEK_ES : WEEK_EN

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(now)
  const [period, setPeriod] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [apiTournaments, setApiTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [userEvents, setUserEvents] = useState(loadEvents)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    title: '',
    game: 'Valorant',
    date: now,
    time: '19:00',
    color: COLORS[0],
    desc: '',
    isPublic: true,
  })

  useEffect(() => {
    let alive = true
    setLoading(true)
    api('/tournaments?limit=80')
      .then(({ tournaments = [] }) => {
        if (!alive) return
        setApiTournaments(tournaments.map(normalizeTournament).filter(Boolean))
      })
      .catch(() => {
        if (!alive) return
        setApiTournaments([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [])

  // Solo torneos reales (antes, sin torneos salían los de data/tournaments.js).
  const tournamentItems = apiTournaments
  const activityItems = userEvents.map(normalizeUserEvent).filter(Boolean)
  const events = useMemo(() => [...tournamentItems, ...activityItems]
    .map(event => ({ ...event, period: periodFor(event, now) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), [tournamentItems, activityItems, now])

  const eventsByDate = useMemo(() => events.reduce((map, event) => {
    ;(map[event.date] ||= []).push(event)
    return map
  }, {}), [events])

  const selectedEvents = eventsByDate[selected] || []
  const filteredEvents = events.filter(event => {
    const matchesPeriod = period === 'all' || event.period === period
    const matchesType = typeFilter === 'all' || event.type === typeFilter
    const text = `${event.title} ${event.game} ${event.description}`.toLowerCase()
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase())
    return matchesPeriod && matchesType && matchesQuery
  })

  const stats = {
    past: events.filter(event => event.period === 'past').length,
    today: events.filter(event => event.period === 'today').length,
    future: events.filter(event => event.period === 'future').length,
    tournaments: events.filter(event => event.type === 'tournament').length,
  }

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (firstDay.getDay() + 6) % 7
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
  const keyFor = day => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const prevMonth = () => {
    setSelected('')
    if (month === 0) {
      setMonth(11)
      setYear(value => value - 1)
    } else {
      setMonth(value => value - 1)
    }
  }

  const nextMonth = () => {
    setSelected('')
    if (month === 11) {
      setMonth(0)
      setYear(value => value + 1)
    } else {
      setMonth(value => value + 1)
    }
  }

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelected(now)
    setPeriod('today')
  }

  // No hay backend de actividades: eventsStore.addEvent() es un stub que
  // devuelve [] (la actividad se "publicaba" y desaparecía). Hasta tenerlo,
  // el botón avisa en vez de abrir un formulario que no guarda nada.
  const openCreate = () => {
    setToast('Crear actividades en el calendario se habilitará en la próxima versión.')
    setTimeout(() => setToast(''), 3200)
  }

  const submit = event => {
    event.preventDefault()
    if (!form.title.trim() || !form.date) return
    setUserEvents(addEvent({
      title: form.title.trim(),
      game: form.game,
      date: form.date,
      time: form.time,
      color: form.color,
      desc: form.desc.trim(),
      isPublic: form.isPublic,
      organizer: 'Tú',
    }))
    setToast(form.isPublic ? 'Actividad publicada en el calendario.' : 'Actividad guardada como privada.')
    setShowForm(false)
    setForm({ title: '', game: 'Valorant', date: now, time: '19:00', color: COLORS[0], desc: '', isPublic: true })
    setTimeout(() => setToast(''), 3200)
  }

  const deleteEvent = id => {
    setUserEvents(removeEvent(id))
    setToast('Actividad eliminada del cronograma.')
    setTimeout(() => setToast(''), 2600)
  }

  return (
    <div className="gg-page gg-cal-page">
      <section className="gg-cal-hero">
        <div>
          <span className="gg-cal-hero__pre">{Icon.calendar} Cronograma competitivo</span>
          <h1>Calendario de actividades</h1>
          <p>Consulta torneos, eventos, scrims, directos y actividades de la comunidad en pasado, presente y futuro.</p>
        </div>
        <div className="gg-cal-hero__actions">
          <button className="gg-cal-btn" type="button" onClick={goToday}>{Icon.clock} Hoy</button>
          <button className="gg-cal-btn gg-cal-btn--primary" type="button" onClick={() => openCreate(selected)}>{Icon.plus} Crear actividad</button>
        </div>
      </section>

      <section className="gg-cal-stats">
        <button type="button" className={period === 'past' ? 'active' : ''} onClick={() => setPeriod('past')}><b>{stats.past}</b><span>Pasadas</span></button>
        <button type="button" className={period === 'today' ? 'active' : ''} onClick={() => setPeriod('today')}><b>{stats.today}</b><span>Hoy</span></button>
        <button type="button" className={period === 'future' ? 'active' : ''} onClick={() => setPeriod('future')}><b>{stats.future}</b><span>Futuras</span></button>
        <button type="button" className={period === 'all' ? 'active' : ''} onClick={() => setPeriod('all')}><b>{events.length}</b><span>Todo</span></button>
      </section>

      <div className="gg-cal-layout">
        <section className="gg-cal-main">
          <header className="gg-cal-bar">
            <div className="gg-cal-bar__nav">
              <button onClick={prevMonth} aria-label="Mes anterior"><span className="rot">{Icon.chevronRight}</span></button>
              <h2>{MONTHS[month]} <span>{year}</span></h2>
              <button onClick={nextMonth} aria-label="Mes siguiente">{Icon.chevronRight}</button>
            </div>
            <div className="gg-cal-legend">
              <span><i className="tor" /> Torneos</span>
              <span><i className="act" /> Actividades</span>
              {loading && <span>Cargando API...</span>}
            </div>
          </header>

          <div className="gg-cal-board">
            <div className="gg-cal-weekdays">
              {WEEK.map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="gg-cal-grid">
              {cells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="gg-cal-cell gg-cal-cell--empty" />
                const key = keyFor(day)
                const dayEvents = eventsByDate[key] || []
                return (
                  <button
                    key={key}
                    className={`gg-cal-cell${key === now ? ' today' : ''}${key === selected ? ' selected' : ''}${dayEvents.length ? ' has-events' : ''}`}
                    onClick={() => setSelected(key)}
                    onDoubleClick={() => openCreate(key)}
                  >
                    <span className="gg-cal-cell__num">{day}</span>
                    <span className="gg-cal-cell__events">
                      {dayEvents.slice(0, 3).map(item => (
                        <span key={item.id} className={`gg-cal-cap gg-cal-cap--${item.type}`} style={{ '--ec': item.color }} title={item.title}>
                          <i />{item.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && <span className="gg-cal-more">+{dayEvents.length - 3}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="gg-cal-aside">
          <div className="gg-cal-panel">
            <h3>{selected ? `Agenda del ${fmtDate(selected, isEs)}` : 'Selecciona una fecha'}</h3>
            <div className="gg-cal-list">
              {selectedEvents.length ? selectedEvents.map(item => (
                <CalendarItem key={item.id} item={item} isEs={isEs} navigate={navigate} onDelete={deleteEvent} />
              )) : (
                <EmptyState onCreate={() => openCreate(selected || now)} />
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="gg-cal-timeline">
        <div className="gg-cal-timeline__head">
          <div>
            <span>{Icon.bolt} Cronograma</span>
            <h2>Agenda competitiva</h2>
          </div>
          <div className="gg-cal-filters">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar actividad, juego o torneo" />
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
              <option value="all">Todo</option>
              <option value="tournament">Torneos</option>
              <option value="event">Actividades</option>
            </select>
          </div>
        </div>
        <div className="gg-cal-timeline__list">
          {filteredEvents.length ? filteredEvents.map(item => (
            <CalendarItem key={`${item.id}-timeline`} item={item} isEs={isEs} navigate={navigate} onDelete={deleteEvent} timeline />
          )) : (
            <div className="gg-cal-empty gg-cal-empty--wide">
              <span>{Icon.search}</span>
              <p>No hay actividades con ese filtro.</p>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {showForm && (
          <motion.div className="gg-cal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)}>
            <motion.form
              className="gg-cal-modal"
              onClick={event => event.stopPropagation()}
              onSubmit={submit}
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
            >
              <div className="gg-cal-modal__head">
                <div>
                  <span className="gg-cal-modal__pre">Nueva actividad</span>
                  <h3>Agregar al cronograma</h3>
                </div>
                <button type="button" className="gg-cal-modal__close" onClick={() => setShowForm(false)}>{Icon.x}</button>
              </div>

              <label className="gg-cal-field">
                <span>Título</span>
                <input value={form.title} onChange={event => setForm(value => ({ ...value, title: event.target.value }))} placeholder="Ej. Scrim abierto, final, stream, reunión" autoFocus />
              </label>

              <div className="gg-cal-field-row">
                <label className="gg-cal-field">
                  <span>Fecha</span>
                  <input type="date" value={form.date} onChange={event => setForm(value => ({ ...value, date: event.target.value }))} />
                </label>
                <label className="gg-cal-field">
                  <span>Hora</span>
                  <input type="time" value={form.time} onChange={event => setForm(value => ({ ...value, time: event.target.value }))} />
                </label>
              </div>

              <label className="gg-cal-field">
                <span>Juego / categoría</span>
                <select value={form.game} onChange={event => setForm(value => ({ ...value, game: event.target.value }))}>
                  <option>Valorant</option>
                  <option>League of Legends</option>
                  <option>CS2</option>
                  <option>Apex Legends</option>
                  <option>Rocket League</option>
                  <option>Mobile Legends</option>
                  <option>Comunidad</option>
                  <option>Otro</option>
                </select>
              </label>

              <label className="gg-cal-field">
                <span>Descripción</span>
                <textarea rows={3} value={form.desc} onChange={event => setForm(value => ({ ...value, desc: event.target.value }))} placeholder="Detalles, formato, premios, link o notas importantes" />
              </label>

              <div className="gg-cal-field">
                <span>Color</span>
                <div className="gg-cal-colors">
                  {COLORS.map(color => (
                    <button type="button" key={color} className={`gg-cal-color${form.color === color ? ' active' : ''}`} style={{ background: color }} onClick={() => setForm(value => ({ ...value, color }))} />
                  ))}
                </div>
              </div>

              <label className="gg-cal-public">
                <input type="checkbox" checked={form.isPublic} onChange={event => setForm(value => ({ ...value, isPublic: event.target.checked }))} />
                <div>
                  <b>Actividad pública</b>
                  <small>Visible en este calendario para el equipo y la comunidad local.</small>
                </div>
              </label>

              <button type="submit" className="gg-cal-submit">{Icon.check} Guardar actividad</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="gg-cal-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            {Icon.check} {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CalendarItem({ item, navigate, onDelete, timeline = false }) {
  const statusLabel = item.period === 'past' ? 'Pasado' : item.period === 'today' ? 'Hoy' : 'Futuro'
  return (
    <motion.article className={`gg-cal-item ${timeline ? 'gg-cal-item--timeline' : ''}`} style={{ '--ec': item.color }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="gg-cal-item__date">
        <b>{fmtShortDate(item.date, true)}</b>
        <span>{item.time}</span>
      </div>
      <div className="gg-cal-item__body">
        <div className="gg-cal-item__top">
          <b>{item.title}</b>
          <span className={`gg-cal-pill gg-cal-pill--${item.type}`}>{item.type === 'tournament' ? 'Torneo' : item.isPublic ? 'Actividad' : 'Privado'}</span>
        </div>
        <small>{item.game} · {statusLabel}{item.meta ? ` · ${item.meta}` : ''}</small>
        {item.description && <p className="gg-cal-item__desc">{item.description}</p>}
        <div className="gg-cal-item__actions">
          {item.type === 'tournament' ? (
            <button className="gg-cal-link" type="button" onClick={() => navigate(item.link)}>{Icon.trophy} Ver torneo</button>
          ) : (
            <button className="gg-cal-del" type="button" onClick={() => onDelete(item.id)}>{Icon.trash} Eliminar</button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

function EmptyState({ onCreate }) {
  return (
    <div className="gg-cal-empty">
      <span>{Icon.calendar}</span>
      <p>No hay actividades en esta fecha.</p>
      <button className="gg-cal-link" type="button" onClick={onCreate}>{Icon.plus} Crear actividad</button>
    </div>
  )
}


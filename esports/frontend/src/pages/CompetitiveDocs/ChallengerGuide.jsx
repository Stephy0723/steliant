import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import './ChallengerGuide.css'

const divisions = [
  ['Academia', 'Equipos nuevos o en formación. Pueden completar roster, crear identidad pública y participar en torneos abiertos, pero deben generar actividad antes de desbloquear retos competitivos.'],
  ['Amateur', 'Equipos activos con roster, página pública y disposición para competir. Pueden acumular puntos y retar equipos profesionales si cumplen elegibilidad.'],
  ['Semi-Pro', 'Equipos con historial, actividad constante y estructura competitiva más seria. Son candidatos naturales para subir a Profesional.'],
  ['Profesional', 'Equipos con estatus competitivo formal. Pueden activar Modo Retador y recibir desafíos de equipos Amateur o Semi-Pro.'],
  ['Elite', 'Equipos top por ranking, resultados, reputación y cumplimiento. Tienen máxima exposición y responsabilidad competitiva.'],
]

const ticketStates = [
  ['Pending', 'El reto fue creado y espera respuesta del equipo profesional.'],
  ['Accepted', 'El equipo profesional aceptó disputar el reto.'],
  ['Scheduled', 'El enfrentamiento tiene fecha y hora confirmadas.'],
  ['Played', 'La partida fue jugada y espera resultado final.'],
  ['Completed', 'El resultado fue confirmado y el ticket cuenta para el estándar mensual.'],
  ['Rejected', 'El equipo profesional rechazó el reto.'],
  ['Expired', 'El ticket venció por falta de respuesta o acción.'],
  ['Cancelled', 'El reto fue cancelado por causa válida o decisión administrativa.'],
]

const sanctions = [
  ['Primera falta', 'Advertencia formal, registro interno, pérdida de prioridad temporal y el ticket no cuenta como completado.'],
  ['Segunda falta', 'Prohibición de participar en 2 torneos, bloqueo temporal de retos y reducción de visibilidad competitiva.'],
  ['Reincidencia', 'Suspensión por periodo definido, pérdida de beneficios del Modo Retador y posible descenso de estado competitivo.'],
  ['Falta grave', 'Veto competitivo, bloqueo de torneos y retos, revisión administrativa y posible eliminación del ranking activo.'],
]

export default function ChallengerGuide() {
  const navigate = useNavigate()

  return (
    <main className="gg-challenger-doc">
      <nav className="gg-challenger-doc__nav">
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          {Icon.chevronRight} Volver
        </button>
        <Link to="/equipos">{Icon.users} Equipos</Link>
      </nav>

      <section className="gg-challenger-doc__hero">
        <span>{Icon.target} Documento competitivo</span>
        <h1>Modo Retador, divisiones y tickets</h1>
        <p>
          Esta guía explica cómo funciona el circuito competitivo de GlitchGang: quién puede retar, quién puede recibir retos,
          qué significan las divisiones, cómo cuentan los tickets mensuales y qué sanciones aplican cuando un equipo incumple.
        </p>
        <div className="gg-challenger-doc__hero-grid">
          <strong><b>7</b> tickets mensuales</strong>
          <strong><b>5</b> divisiones</strong>
          <strong><b>2</b> torneos de sanción base</strong>
          <strong><b>1</b> ranking por juego/región</strong>
        </div>
      </section>

      <section className="gg-challenger-doc__section">
        <div className="gg-challenger-doc__section-head">
          <span>01</span>
          <h2>Qué es el Modo Retador</h2>
        </div>
        <p>
          El Modo Retador es un circuito donde equipos Amateur y Semi-Pro pueden desafiar a equipos Profesionales o Elite.
          Su función es crear movilidad competitiva: los equipos nuevos pueden demostrar nivel contra rivales superiores, y
          los equipos profesionales deben defender su posición con actividad real.
        </p>
        <p>
          Activar este modo no es solo recibir más visibilidad. También implica aceptar responsabilidades: responder tickets,
          presentarse a los enfrentamientos aceptados, reportar resultados y cumplir un mínimo mensual de actividad.
        </p>
      </section>

      <section className="gg-challenger-doc__section">
        <div className="gg-challenger-doc__section-head">
          <span>02</span>
          <h2>Divisiones competitivas</h2>
        </div>
        <div className="gg-challenger-doc__cards">
          {divisions.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gg-challenger-doc__split">
        <article>
          <span>{Icon.send} Puede retar</span>
          <h2>Equipos retadores</h2>
          <p>
            Pueden retar los equipos Amateur, Semi-Pro, Profesional o Elite que tengan roster suficiente, estado activo,
            actividad competitiva y ninguna sanción bloqueante. Los equipos Academia deben completar actividad antes de
            desbloquear retos.
          </p>
        </article>
        <article>
          <span>{Icon.shield} Recibe retos</span>
          <h2>Equipos profesionales</h2>
          <p>
            Solo los equipos Profesional o Elite pueden recibir retos. Para hacerlo deben tener Modo Retador activo,
            mantenerse en buen estado competitivo y aceptar las obligaciones del circuito.
          </p>
        </article>
      </section>

      <section className="gg-challenger-doc__section gg-challenger-doc__highlight">
        <div className="gg-challenger-doc__section-head">
          <span>03</span>
          <h2>La regla de los 7 tickets</h2>
        </div>
        <p>
          Un equipo profesional debe completar al menos 7 tickets mensuales para mantener beneficios como prioridad en el
          directorio, banners rotativos, insignia de Retador y mayor exposición ante patrocinadores.
        </p>
        <p>
          Un ticket cuenta cuando fue aceptado, jugado, reportado y confirmado. No cuentan tickets pendientes, rechazados,
          expirados, cancelados sin causa válida o partidos donde un equipo no se presentó.
        </p>
      </section>

      <section className="gg-challenger-doc__section">
        <div className="gg-challenger-doc__section-head">
          <span>04</span>
          <h2>Estados del ticket</h2>
        </div>
        <div className="gg-challenger-doc__timeline">
          {ticketStates.map(([title, body]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gg-challenger-doc__section">
        <div className="gg-challenger-doc__section-head">
          <span>05</span>
          <h2>Sanciones por incumplimiento</h2>
        </div>
        <p>
          No presentarse a un reto aceptado es una falta grave. Afecta al rival, al calendario, a los organizadores y a la
          confianza del ecosistema. Por eso GlitchGang usa una escalera de consecuencias.
        </p>
        <div className="gg-challenger-doc__cards gg-challenger-doc__cards--sanctions">
          {sanctions.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gg-challenger-doc__section">
        <div className="gg-challenger-doc__section-head">
          <span>06</span>
          <h2>Cómo se refleja en la página del equipo</h2>
        </div>
        <p>
          La página pública del equipo debe mostrar división, puntos, ranking, roster, staff, patrocinadores, torneos e
          historial relevante. Los visitantes no deben ver botones internos de edición; si el usuario es dueño, debe tener un
          único acceso claro hacia su panel de equipo.
        </p>
        <p>
          Coach, manager, analista y patrocinadores no forman parte del roster de jugadores. Cada grupo tiene su propio espacio,
          con foto o logo, biografía, redes y datos públicos.
        </p>
      </section>

      <section className="gg-challenger-doc__cta">
        <h2>¿Quieres competir dentro del circuito?</h2>
        <p>Completa tu roster, publica tu equipo y revisa si ya puedes retar o recibir desafíos.</p>
        <div>
          <Link to="/mi-equipo/retador">{Icon.target} Ir a Modo Retador</Link>
          <Link to="/equipos">{Icon.users} Ver equipos</Link>
        </div>
      </section>
    </main>
  )
}


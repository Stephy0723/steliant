// Reportes de /report (Discord) de una partida, por equipo, con sus capturas.
// Lo usan el panel del capitán (MatchReport) y la pestaña Bracket del
// organizador. Las capturas viejas que no se copiaron a tiempo apuntan al CDN
// de Discord y pueden haber vencido: se avisa en vez de mostrar una imagen rota.
import { useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import { reportScreenshotLabel } from '../../../../shared/reportScreenshots.mjs'
import { AppealButton } from '../ResultsReview/ResultsReview.jsx'
import './DiscordReports.css'

const RESULT = { win: 'Victoria', lose: 'Derrota', draw: 'Empate' }
const hhmm = d => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// Capturas obligatorias que faltan y cuánto queda del plazo.
function Missing({ report }) {
  if (!report.missing?.length) return null
  const names = report.missing.map(reportScreenshotLabel).join(', ')
  return (
    <p className={`dr-missing ${report.deadlineClosed ? 'is-late' : ''}`}>
      {Icon.alert} Falta: {names}
      {report.deadlineClosed ? ' · plazo vencido, quedó registrado como falta' : report.deadlineAt ? ` · plazo hasta las ${hhmm(report.deadlineAt)}` : ''}
    </p>
  )
}

function Shot({ item, alt }) {
  const [broken, setBroken] = useState(false)
  const label = reportScreenshotLabel(item.key)
  if (broken) {
    return <div className="dr-shot dr-shot--gone"><span>{label}</span><em>La captura de Discord venció</em></div>
  }
  return (
    <a className="dr-shot" href={item.url} target="_blank" rel="noreferrer" title={item.name || label}>
      <img src={item.url} alt={`${alt} · ${label}`} loading="lazy" onError={() => setBroken(true)} />
      <span>{label}</span>
    </a>
  )
}

/** Estado de los reportes de ambos lados: coinciden, en disputa o falta uno. */
export function discordReportState(A = [], B = []) {
  const lastA = A[A.length - 1], lastB = B[B.length - 1]
  if (!lastA && !lastB) return 'none'
  if (!lastA || !lastB) return 'waiting_rival'
  if (lastA.disputed || lastB.disputed) return 'disputed'
  const consistent = (lastA.result === 'win' && lastB.result === 'lose') || (lastA.result === 'lose' && lastB.result === 'win') || (lastA.result === 'draw' && lastB.result === 'draw')
  return consistent ? 'agreed' : 'disputed'
}

// Estado de cada partida de la serie (ResultCase en el backend).
const CASE_STATE = {
  analyzing: { icon: '⏳', text: 'Analizando' },
  validated: { icon: '🟢', text: 'Validado' },
  pending_review: { icon: '⚪', text: 'Por confirmar' },
  arbitration: { icon: '🟠', text: 'En arbitraje' },
  rejected: { icon: '🔴', text: 'Rechazado' },
}
const SOURCE = { 'ai-validated': 'las capturas de los dos equipos coinciden', declarations: 'los dos equipos coinciden', arbiter: 'decisión del árbitro' }

export function CaseStates({ cases = [], onAppeal }) {
  if (!cases.length) return null
  return (
    <ul className="dr-cases">
      {cases.map(c => {
        const st = CASE_STATE[c.state] || CASE_STATE.analyzing
        return (
          <li key={c.id} className={`dr-case dr-case--${c.state}`}>
            <b>Partida {c.gameNumber}</b>
            <span>{st.icon} {st.text}</span>
            <small>
              {c.state === 'validated'
                ? `Gana ${c.winnerName}${SOURCE[c.source] ? ` · ${SOURCE[c.source]}` : ''}`
                : c.reasons.join(' · ')}
              {c.assignedName && c.state !== 'validated' ? ` · Lo revisa ${c.assignedName}` : ''}
              {c.appealed ? ' · Apelado' : ''}
            </small>
            {c.canAppeal && <AppealButton caseId={c.id} onDone={onAppeal} />}
          </li>
        )
      })}
    </ul>
  )
}

export default function DiscordReports({ a, b, A = [], B = [], mySide = null, cases = [], onAppeal }) {
  if (!A.length && !B.length) return null
  const sides = [['A', a, A], ['B', b, B]]
  if (mySide === 'B') sides.reverse()
  return (
    <>
    <CaseStates cases={cases} onAppeal={onAppeal} />
    <div className="dr">
      {sides.map(([side, name, list]) => (
        <div className="dr-side" key={side}>
          <span className="dr-side__name">{mySide === side ? `Tu equipo · ${name}` : name}</span>
          {list.length === 0 ? <em className="dr-empty">Sin /report todavía</em> : list.map(r => (
            <div className="dr-report" key={r.id}>
              <div className="dr-report__meta">
                {r.gameNumber ? <b>Partida {r.gameNumber}</b> : null}
                <span className={`dr-result dr-result--${r.result}`}>{RESULT[r.result] || r.result || '—'}</span>
                {r.disputed && <span className="dr-result dr-result--disputed">{Icon.alert} En disputa</span>}
                <small>{r.reporter ? `${r.reporter} · ` : ''}{r.reportedAt ? new Date(r.reportedAt).toLocaleString() : ''}</small>
              </div>
              <Missing report={r} />
              {r.evidence.length === 0
                ? <em className="dr-empty">Sin capturas</em>
                : <div className="dr-shots">{r.evidence.map((item, i) => <Shot key={`${item.url}-${i}`} item={item} alt={`Captura de ${name}`} />)}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
    </>
  )
}


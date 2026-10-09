import { motion } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import './Bracket.css'

function MatchCard({ match, themeColor }) {
  const isWinnerA = match.winner === match.teamA
  const isWinnerB = match.winner === match.teamB
  const isFinal   = match.isFinal

  return (
    <motion.div
      className={`gg-match ${isFinal ? 'gg-match--final' : ''}`}
      initial={{ opacity: 0, scale: .95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: .3 }}
      style={{ '--tc': themeColor || 'var(--accent)' }}
    >
      {isFinal && <div className="gg-match__crown">{Icon.crown}</div>}
      <div className={`gg-match__row ${isWinnerA ? 'winner' : ''}`}>
        <span className="gg-match__team">{match.teamA || 'TBD'}</span>
        <span className="gg-match__score">{match.teamA ? match.scoreA ?? '—' : '—'}</span>
      </div>
      <div className="gg-match__divider" />
      <div className={`gg-match__row ${isWinnerB ? 'winner' : ''}`}>
        <span className="gg-match__team">{match.teamB || 'TBD'}</span>
        <span className="gg-match__score">{match.teamB ? match.scoreB ?? '—' : '—'}</span>
      </div>
    </motion.div>
  )
}

// Un tramo entre dos rondas solo se conecta con la línea de bracket cuando la
// relación de partidas es real: 2→1 (fusión de un par) o 1→1 (p.ej. Final →
// Campeón). Cualquier otra relación (round robin, swiss, doble eliminación
// concatenada en una sola fila) simplemente no dibuja conector -- así nunca
// se sugiere una progresión que no existe.
function linkType(prevCount, nextCount) {
  if (!prevCount || !nextCount) return null
  if (prevCount === nextCount * 2) return 'pair'
  if (prevCount === nextCount) return 'direct'
  return null
}

export default function Bracket({ rounds = [], themeColor }) {
  if (!rounds.length) {
    return (
      <div className="gg-bracket-empty">
        <p>El bracket se generará cuando comience el torneo.</p>
      </div>
    )
  }

  const counts = rounds.map((r) => r.matches.length)

  return (
    <div className="gg-bracket-wrap">
      <div className="gg-bracket">
        {rounds.map((round, ri) => {
          const outType = linkType(counts[ri], counts[ri + 1])
          const inType = linkType(counts[ri - 1], counts[ri])
          const roundClass = [
            'gg-bracket__round',
            outType === 'pair' && 'gg-bracket__round--pairout',
            outType === 'direct' && 'gg-bracket__round--directout',
            inType && 'gg-bracket__round--linked',
          ].filter(Boolean).join(' ')
          return (
            <div key={round.name} className={roundClass}>
              <div className="gg-bracket__round-name">{round.name}</div>
              <div className="gg-bracket__matches">
                {round.matches.map((match) => (
                  <div className="gg-bracket__slot" key={match.id}>
                    <MatchCard match={match} themeColor={themeColor} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


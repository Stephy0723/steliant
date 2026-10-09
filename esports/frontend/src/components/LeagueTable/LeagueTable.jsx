import Badge from '../Badge/Badge.jsx'
import './LeagueTable.css'

/**
 * LeagueTable — standings table for a university league.
 * Props:
 *   league   — league object from university.js
 *   userUni  — acronym of the current user's university (to highlight row)
 */
export default function LeagueTable({ league, userUni }) {
  if (!league.standings || league.standings.length === 0) {
    return (
      <div className="gg-league-table__empty">
        <p>Las clasificaciones estarán disponibles cuando comience la competición.</p>
      </div>
    )
  }

  return (
    <div className="gg-league-table">
      <div className="gg-league-table__head">
        <div className="gg-league-table__meta">
          <div className="gg-league-table__game-dot" style={{ background: league.gameColor }} />
          <span>{league.game}</span>
          <Badge variant={league.status === 'live' ? 'live' : league.status === 'upcoming' ? 'pro' : 'muted'}>
            {league.status === 'live' ? '● EN VIVO' : league.status === 'upcoming' ? 'Próximo' : 'Finalizado'}
          </Badge>
          <span className="gg-league-table__prize">{league.prizePool}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Universidad</th>
            <th>PJ</th>
            <th>W</th>
            <th>L</th>
            <th>Dif.</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {league.standings.map((row) => {
            const isUser = row.uni === userUni
            const isTop3 = row.pos <= 3
            return (
              <tr key={row.pos} className={`${isUser ? 'mine' : ''} ${isTop3 ? `top${row.pos}` : ''}`}>
                <td className="gg-lt-pos">
                  <span className={`gg-lt-pos-badge pos${row.pos}`}>{row.pos}</span>
                </td>
                <td className="gg-lt-uni">
                  <span className={`gg-lt-dot ${isUser ? 'user-dot' : ''}`} />
                  <b>{row.uni}</b>
                  {isUser && <span className="gg-lt-you">Tú</span>}
                </td>
                <td>{row.played}</td>
                <td className="gg-lt-win">{row.wins}</td>
                <td className="gg-lt-loss">{row.losses}</td>
                <td className={`gg-lt-diff ${row.diff.startsWith('+') ? 'pos' : 'neg'}`}>{row.diff}</td>
                <td className="gg-lt-pts">{row.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


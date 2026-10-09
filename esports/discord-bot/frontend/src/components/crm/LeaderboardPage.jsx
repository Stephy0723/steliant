import { useEffect, useState } from 'react';
import { Crown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './Leaderboard.module.css';

async function fetchLeaderboard() {
  const res = await fetch('/leaderboard');
  if (!res.ok) throw new Error('Error al cargar leaderboard');
  return res.json();
}

function getTrend(entry, index, all) {
  if (index === 0) return 'up';
  const prev = all[index - 1];
  if (entry.wins > prev.wins) return 'up';
  if (entry.wins < prev.wins) return 'down';
  return 'same';
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Clasificación de Equipos</h2>
        </header>
        <p style={{ padding: '1rem', opacity: 0.6 }}>Cargando resultados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Clasificación de Equipos</h2>
        </header>
        <p style={{ padding: '1rem', color: 'var(--accent-red)' }}>{error}</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Clasificación de Equipos</h2>
          <p>Ranking basado en los reportes de partidas registradas en el sistema.</p>
        </header>
        <p style={{ padding: '1rem', opacity: 0.6 }}>
          Aún no hay partidas reportadas. El leaderboard se poblará automáticamente cuando los equipos reporten resultados con <code>/report</code>.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2>Clasificación de Equipos</h2>
        <p>Ranking basado en victorias de los reportes de partidas registrados en el sistema.</p>
      </header>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rango</th>
              <th>Equipo</th>
              <th>V / D / E</th>
              <th>Partidas</th>
              <th>Win Rate</th>
              <th>Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, index) => {
              const trend = getTrend(entry, index, rows);
              return (
                <tr key={entry.team} className={entry.rank <= 3 ? styles[`top${entry.rank}`] : ''}>
                  <td>
                    <div className={styles.rankBadge}>
                      {entry.rank === 1 && <Crown size={14} className={styles.crownGold} />}
                      #{entry.rank}
                    </div>
                  </td>
                  <td className={styles.playerName}>{entry.team}</td>
                  <td>{entry.wins} / {entry.losses} / {entry.draws}</td>
                  <td>{entry.total}</td>
                  <td>{entry.winrate}</td>
                  <td>
                    {trend === 'up' && <TrendingUp size={16} className={styles.trendUp} />}
                    {trend === 'down' && <TrendingDown size={16} className={styles.trendDown} />}
                    {trend === 'same' && <Minus size={16} className={styles.trendSame} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

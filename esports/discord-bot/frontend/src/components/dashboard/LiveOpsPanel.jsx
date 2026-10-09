import { Clock, Radio, Swords, Waves } from 'lucide-react';
import styles from './LiveOpsPanel.module.css';

function formatClock(iso) {
  if (!iso) return 'N/D';
  return new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function minutesLeft(deadlineIso) {
  if (!deadlineIso) return null;
  const ms = new Date(deadlineIso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 60000));
}

export default function LiveOpsPanel({ operations = [], activeMatches = [] }) {
  const checkins = operations.filter((o) => o.status === 'checking_in');
  const total = checkins.length + activeMatches.length;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <span className={styles.sectionLabel}>En Tiempo Real</span>
          <h3>Operaciones en curso</h3>
        </div>
        <span className={styles.count}>{total} activas</span>
      </div>

      {total === 0 ? (
        <div className={styles.empty}>
          <Waves size={20} />
          <p>Todo tranquilo — no hay check-ins ni partidas activas ahora mismo.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {checkins.map((op, i) => {
            const left = minutesLeft(op.checkinDeadlineAt);
            const present = op.attendance?.presentCount ?? 0;
            const totalPlayers = op.attendance?.totalCount ?? 0;
            return (
              <div key={op.id} className={styles.row} style={{ animationDelay: `${i * 40}ms` }}>
                <div className={`${styles.dot} ${styles.amber}`} />
                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    <strong>{op.teamName}</strong>
                    <span className={`${styles.badge} ${styles.amber}`}>Check-in</span>
                  </div>
                  <span className={styles.rowMeta}>
                    <Clock size={12} /> {present}/{totalPlayers} verificados
                    {left !== null && ` · ${left} min restantes`}
                  </span>
                </div>
              </div>
            );
          })}

          {activeMatches.map((m, i) => (
            <div key={m.id} className={styles.row} style={{ animationDelay: `${(checkins.length + i) * 40}ms` }}>
              <div className={`${styles.dot} ${styles.live}`} />
              <div className={styles.rowBody}>
                <div className={styles.rowTop}>
                  <strong>
                    <Swords size={12} style={{ marginRight: 4, verticalAlign: '-2px' }} />
                    {m.teamName}{m.rivalName ? ` vs ${m.rivalName}` : ''}
                  </strong>
                  <span className={`${styles.badge} ${styles.live}`}>
                    <Radio size={10} /> En vivo
                  </span>
                </div>
                <span className={styles.rowMeta}>Iniciada: {formatClock(m.startedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

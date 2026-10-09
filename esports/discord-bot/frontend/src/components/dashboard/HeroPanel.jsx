import styles from './HeroPanel.module.css';

export default function HeroPanel({ activeTournament, tournaments, auth, system, liveOpsCount = 0 }) {
  const tournamentName = activeTournament?.name || 'Sin torneo activo';
  const userLabel = auth?.user ? auth.user.globalName || auth.user.username : 'Staff';
  const totalTeams = tournaments.reduce((s, t) => s + t.teams.length, 0);
  const totalPlayers = tournaments.reduce(
    (s, t) => s + t.teams.reduce((st, team) => st + team.players.length, 0), 0
  );
  const discordOk = Boolean(system?.discordConfigured);

  return (
    <div className={styles.hero}>
      <div className={styles.scan} />

      <div className={styles.topRow}>
        <div className={styles.content}>
          <span className={styles.eyebrow}>Bienvenido, {userLabel}</span>
          <h2>Panel de control</h2>
          <p className={styles.lead}>
            Gestiona torneos, valida check-ins, controla partidas y cierra reportes desde un solo lugar.
          </p>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <span>Torneo activo</span>
            <strong className={styles.tournamentValue}>
              {activeTournament ? <span className={styles.liveDot} /> : null}
              {tournamentName}
            </strong>
          </div>
          <div className={styles.infoRow}>
            <span>Equipos</span>
            <strong>{totalTeams}</strong>
          </div>
          <div className={styles.infoRow}>
            <span>Operaciones activas</span>
            <strong className={liveOpsCount > 0 ? styles.hot : ''}>{liveOpsCount}</strong>
          </div>
          <div className={styles.infoRow}>
            <span>Discord</span>
            <strong className={discordOk ? styles.online : styles.warn}>
              {discordOk ? 'Conectado' : 'Sin configurar'}
            </strong>
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <strong>{tournaments.length}</strong>
          <span>Torneos</span>
        </div>
        <div className={styles.stat}>
          <strong>{totalTeams}</strong>
          <span>Equipos</span>
        </div>
        <div className={styles.stat}>
          <strong>{totalPlayers}</strong>
          <span>Jugadores</span>
        </div>
      </div>
    </div>
  );
}

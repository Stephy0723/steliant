import { useEffect, useRef, useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Trophy, Users } from 'lucide-react';
import styles from './AnalyticsPanel.module.css';

function useCountUp(target, duration = 900) {
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    if (!ref.current || counted.current) return;
    counted.current = true;

    const el = ref.current;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [target, duration]);

  return ref;
}

function CounterCard({ label, value, caption, icon: Icon, accent, suffix = '' }) {
  const ref = useCountUp(value);

  return (
    <div className={`${styles.counterCard} ${styles[accent] || ''}`}>
      <div className={styles.counterIcon}>
        <Icon size={16} />
      </div>
      <div className={styles.counterBody}>
        <div className={styles.counterValue}>
          <strong ref={ref}>0</strong>
          {suffix}
        </div>
        <span>{label}</span>
        {caption ? <small>{caption}</small> : null}
      </div>
    </div>
  );
}

function BarChart({ data, maxValue }) {
  return (
    <div className={styles.barChart}>
      {data.map((item) => (
        <div key={item.label} className={styles.bar}>
          <div className={styles.barLabel}>
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${maxValue ? (item.value / maxValue) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ percent }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 100 100" className={styles.donutSvg}>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="42"
          fill="none"
          stroke="url(#donutGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className={styles.donutArc}
        />
        <defs>
          <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-purple)" />
          </linearGradient>
        </defs>
      </svg>
      <div className={styles.donutLabel}>
        <strong>{Math.round(percent)}%</strong>
        <span>Completo</span>
      </div>
    </div>
  );
}

function statusOf(tournament) {
  const hasTeams = tournament.teams.length > 0;
  const hasPlayers = tournament.teams.some((t) => t.players.length > 0);
  if (hasTeams && hasPlayers) return 'live';
  if (hasTeams) return 'setup';
  return 'draft';
}

const STATUS_META = {
  live: { label: 'En vivo', hint: 'Tiene equipos con jugadores inscritos — listo para jugarse.' },
  setup: { label: 'En armado', hint: 'Tiene equipos creados pero todavía sin jugadores.' },
  draft: { label: 'Borrador', hint: 'Recién creado, sin equipos inscritos todavía.' },
};

export default function AnalyticsPanel({ tournaments }) {
  const stats = useMemo(() => {
    const totalTeams = tournaments.reduce((s, t) => s + t.teams.length, 0);
    const totalPlayers = tournaments.reduce(
      (s, t) => s + t.teams.reduce((st, team) => st + team.players.length, 0),
      0
    );
    const totalLeaders = tournaments.reduce(
      (s, t) => s + t.teams.reduce((st, team) => st + team.players.filter((p) => p.isLeader).length, 0),
      0
    );
    const teamsWithPlayers = tournaments.reduce(
      (s, t) => s + t.teams.filter((team) => team.players.length > 0).length,
      0
    );
    const completionRate = totalTeams > 0 ? Math.round((teamsWithPlayers / totalTeams) * 100) : 0;
    const avgPlayersPerTeam = totalTeams > 0 ? (totalPlayers / totalTeams).toFixed(1) : '0.0';

    const allTeams = tournaments.flatMap((t) => t.teams);
    const teamDistribution = [...allTeams]
      .sort((a, b) => b.players.length - a.players.length)
      .slice(0, 6)
      .map((team) => ({ label: team.name.length > 14 ? team.name.slice(0, 12) + '…' : team.name, value: team.players.length }));

    const maxTeamPlayers = Math.max(1, ...teamDistribution.map((t) => t.value));
    const topTeam = [...allTeams].sort((a, b) => b.players.length - a.players.length)[0];

    const byStatus = { live: 0, setup: 0, draft: 0 };
    tournaments.forEach((t) => { byStatus[statusOf(t)] += 1; });

    return {
      totalTeams, totalPlayers, totalLeaders, completionRate, avgPlayersPerTeam,
      teamDistribution, maxTeamPlayers, topTeam, byStatus, teamsWithPlayers,
    };
  }, [tournaments]);

  const statusTotal = tournaments.length || 1;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <span className={styles.sectionLabel}>Analytics</span>
          <h3>Analítica del sistema</h3>
        </div>
        <p>Salud del portafolio de torneos: cuántos están listos, cómo se reparte el roster y quién lidera.</p>
      </div>

      <div className={styles.counters}>
        <CounterCard label="Torneos" value={tournaments.length} icon={BarChart3} accent="blue" />
        <CounterCard label="Equipos" value={stats.totalTeams} icon={Users} accent="cyan" />
        <CounterCard label="Jugadores" value={stats.totalPlayers} icon={TrendingUp} accent="violet" />
        <CounterCard label="Líderes" value={stats.totalLeaders} icon={Trophy} accent="amber" />
        <CounterCard
          label="Roster completo"
          value={stats.completionRate}
          suffix="%"
          caption={`${stats.teamsWithPlayers} de ${stats.totalTeams || 0} equipos`}
          icon={PieChart}
          accent="green"
        />
      </div>

      <section className={styles.statusSection}>
        <div className={styles.statusHead}>
          <h4>Torneos por estado</h4>
          <p>De dónde a dónde va cada torneo: borrador → en armado → en vivo.</p>
        </div>

        <div className={styles.statusBar}>
          {['live', 'setup', 'draft'].map((key) => {
            const count = stats.byStatus[key];
            if (count === 0) return null;
            return (
              <div
                key={key}
                className={`${styles.statusSeg} ${styles[key]}`}
                style={{ flexGrow: count / statusTotal }}
                title={`${count} ${STATUS_META[key].label}`}
              />
            );
          })}
          {tournaments.length === 0 && <div className={styles.statusEmpty} />}
        </div>

        <div className={styles.statusLegend}>
          {['live', 'setup', 'draft'].map((key) => (
            <div key={key} className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles[key]}`} />
              <div>
                <strong>{STATUS_META[key].label}</strong>
                <span className={styles.legendCount}>{stats.byStatus[key]}</span>
                <p>{STATUS_META[key].hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.charts}>
        <section className={styles.chartCard}>
          <h4>Jugadores por equipo</h4>
          <p className={styles.chartHint}>Top 6 equipos con más roster inscrito en todos los torneos.</p>
          {stats.teamDistribution.length > 0 ? (
            <>
              <BarChart data={stats.teamDistribution} maxValue={stats.maxTeamPlayers} />
              {stats.topTeam && (
                <p className={styles.insight}>
                  <Trophy size={12} /> <b>{stats.topTeam.name}</b> lidera con {stats.topTeam.players.length} jugadores.
                </p>
              )}
            </>
          ) : (
            <p className={styles.muted}>Sin equipos registrados aún.</p>
          )}
        </section>

        <section className={styles.chartCard}>
          <h4>Completitud de roster</h4>
          <p className={styles.chartHint}>Equipos que ya tienen al menos un jugador cargado.</p>
          <DonutChart percent={stats.completionRate} />
          <p className={styles.insight}>
            {stats.teamsWithPlayers} de {stats.totalTeams} equipos listos para check-in.
          </p>
        </section>
      </div>
    </div>
  );
}

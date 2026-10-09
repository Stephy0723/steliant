import { Fragment, useMemo, useState } from 'react';
import { ArrowDownUp, ChevronDown, ChevronRight, Download, Search } from 'lucide-react';
import {
  aggregateTeams,
  downloadCsv,
  teamLeader,
  verifiedCount,
} from '../../lib/tournamentFormat';
import styles from './Crm.module.css';

const FLAG_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'missing-discord', label: 'Jugadores sin Discord' },
  { id: 'no-leader', label: 'Sin líder' },
  { id: 'multi', label: 'En varios torneos' },
  { id: 'empty', label: 'Sin jugadores' },
];

function matchesFlag(team, flag) {
  if (flag === 'missing-discord') return verifiedCount(team) < team.players.length;
  if (flag === 'no-leader') return !teamLeader(team);
  if (flag === 'multi') return team.tournaments.length > 1;
  if (flag === 'empty') return team.players.length === 0;
  return true;
}

const SORTS = {
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
  players: (a, b) => b.players.length - a.players.length,
  tournaments: (a, b) => b.tournaments.length - a.tournaments.length,
  verified: (a, b) => verifiedCount(b) / (b.players.length || 1) - verifiedCount(a) / (a.players.length || 1),
};

export default function TeamsPage({ tournaments, onOpenTournament }) {
  const teams = useMemo(() => aggregateTeams(tournaments), [tournaments]);
  const [query, setQuery] = useState('');
  const [tournamentId, setTournamentId] = useState('all');
  const [flag, setFlag] = useState('all');
  const [sort, setSort] = useState('name');
  const [openKey, setOpenKey] = useState('');

  const flagCounts = useMemo(() => {
    const c = {};
    for (const f of FLAG_FILTERS) c[f.id] = teams.filter((t) => matchesFlag(t, f.id)).length;
    return c;
  }, [teams]);

  const totals = useMemo(() => {
    const players = teams.reduce((t, team) => t + team.players.length, 0);
    const linked = teams.reduce((t, team) => t + verifiedCount(team), 0);
    return {
      teams: teams.length,
      players,
      linkedPct: players ? Math.round((linked / players) * 100) : 0,
      registrations: teams.reduce((t, team) => t + team.tournaments.length, 0),
    };
  }, [teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams
      .filter((team) => {
        if (tournamentId !== 'all' && !team.tournaments.some((t) => t.id === tournamentId)) return false;
        if (!matchesFlag(team, flag)) return false;
        if (!q) return true;
        const haystack = [team.name, team.tag, ...team.players.flatMap((p) => [p.name, p.discordUsername])]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(SORTS[sort]);
  }, [teams, query, tournamentId, flag, sort]);

  const exportCsv = () => {
    const rows = [];
    for (const team of filtered) {
      const torneos = team.tournaments.map((t) => t.name).join(' | ');
      if (!team.players.length) rows.push([team.name, team.tag, '', '', '', '', torneos]);
      for (const p of team.players) {
        rows.push([team.name, team.tag, p.name, p.isLeader ? 'Sí' : '', p.discordUsername || '', p.discordId || '', torneos]);
      }
    }
    downloadCsv('equipos-glitchgang.csv', ['Equipo', 'Tag', 'Jugador', 'Líder', 'Discord', 'Discord ID', 'Torneos'], rows);
  };

  const sortHeader = (key, label, numeric = false) => (
    <th className={numeric ? styles.num : undefined}>
      <button type="button" onClick={() => setSort(key)} aria-pressed={sort === key}>
        {label} {sort === key && <ArrowDownUp size={11} />}
      </button>
    </th>
  );

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <div>
          <h2>Equipos inscritos</h2>
          <p>Todos los equipos inscritos en los torneos de este servidor, con su roster, su líder y si cada jugador ya vinculó su Discord.</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.btn} onClick={exportCsv} disabled={!filtered.length}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.stat}><strong>{totals.teams}</strong><span>Equipos</span></div>
        <div className={styles.stat}><strong>{totals.players}</strong><span>Jugadores</span></div>
        <div className={styles.stat}><strong>{totals.registrations}</strong><span>Inscripciones</span></div>
        <div className={styles.stat}><strong>{totals.linkedPct}%</strong><span>Con Discord vinculado</span></div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar equipo, tag, jugador o usuario de Discord…" />
        </label>
        <select className={styles.select} value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} aria-label="Torneo">
          <option value="all">Todos los torneos</option>
          {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className={styles.chips}>
        {FLAG_FILTERS.map((f) => (
          <button key={f.id} type="button" className={flag === f.id ? styles.chipActive : styles.chip} onClick={() => setFlag(f.id)}>
            {f.label}<small>{flagCounts[f.id]}</small>
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className={styles.empty}>{teams.length ? 'Ningún equipo coincide con estos filtros.' : 'Todavía no hay equipos inscritos en ningún torneo.'}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {sortHeader('name', 'Equipo')}
                <th>Líder</th>
                {sortHeader('players', 'Jugadores', true)}
                {sortHeader('verified', 'Discord', true)}
                {sortHeader('tournaments', 'Torneos')}
              </tr>
            </thead>
            <tbody>
              {filtered.map((team) => {
                const leader = teamLeader(team);
                const linked = verifiedCount(team);
                const isOpen = openKey === team.key;
                return (
                  <Fragment key={team.key}>
                    <tr className={styles.rowClickable} onClick={() => setOpenKey(isOpen ? '' : team.key)}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <span className={styles.strong}>{team.name}</span>
                          {team.tag && <span className={styles.tag}>[{team.tag}]</span>}
                        </span>
                      </td>
                      <td>{leader ? leader.name : <span className={styles.muted}>Sin líder</span>}</td>
                      <td className={styles.num}>{team.players.length}</td>
                      <td className={styles.num}>
                        <span className={`${styles.badge} ${styles[linked === team.players.length && linked ? 'badge_green' : 'badge_amber']}`}>
                          {linked}/{team.players.length}
                        </span>
                      </td>
                      <td>
                        <div className={styles.pillList}>
                          {team.tournaments.map((t) => (
                            <span key={t.id} className={styles.pill}>{t.name}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className={styles.expandRow}>
                        <td colSpan={5}>
                          <ul className={styles.roster}>
                            {team.players.length ? team.players.map((p) => (
                              <li key={p.id || p.name}>
                                <span>
                                  {p.name}
                                  {p.isLeader && <span className={styles.tag}>líder</span>}
                                </span>
                                <span className={p.discordId ? styles.muted : `${styles.badge} ${styles.badge_amber}`}>
                                  {p.discordUsername ? `@${p.discordUsername}` : 'Sin Discord'}
                                </span>
                              </li>
                            )) : <li className={styles.muted}>Sin jugadores todavía.</li>}
                          </ul>
                          <div className={styles.pillList} style={{ marginTop: 12, alignItems: 'center' }}>
                            <span className={styles.muted}>Abrir torneo:</span>
                            {team.tournaments.map((t) => (
                              <button key={t.id} type="button" className={styles.linkBtn} onClick={() => onOpenTournament(t.id)}>
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

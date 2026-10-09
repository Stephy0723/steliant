import { useMemo, useState } from 'react';
import { CalendarDays, Gamepad2, LayoutGrid, List, Search, Trophy, Users } from 'lucide-react';
import {
  STATUS_FILTERS,
  countPlayers,
  formatDate,
  isRealTournament,
  provisionStatus,
  slotsInfo,
  tournamentStatus,
} from '../../lib/tournamentFormat';
import styles from './TournamentOverview.module.css';
import crm from './Crm.module.css';

const SORTS = {
  upcoming: { label: 'Fecha (próximos primero)', fn: byUpcoming },
  recent: { label: 'Fecha (recientes primero)', fn: (a, b) => dateValue(b, -Infinity) - dateValue(a, -Infinity) },
  name: { label: 'Nombre', fn: (a, b) => String(a.name).localeCompare(String(b.name)) },
  teams: { label: 'Más equipos', fn: (a, b) => (b.teams || []).length - (a.teams || []).length },
};

function dateValue(t, fallback) {
  const value = t.date ? Date.parse(t.date) : NaN;
  return Number.isNaN(value) ? fallback : value;
}

// Los que vienen primero (el mas cercano arriba), despues los ya pasados
// del mas reciente al mas viejo, y al final los que no tienen fecha.
function byUpcoming(a, b) {
  const now = Date.now();
  const da = dateValue(a, NaN);
  const db = dateValue(b, NaN);
  const rank = (d) => (Number.isNaN(d) ? 2 : d >= now ? 0 : 1);
  if (rank(da) !== rank(db)) return rank(da) - rank(db);
  if (rank(da) === 0) return da - db;
  if (rank(da) === 1) return db - da;
  return 0;
}

function SlotBar({ tournament, compact = false }) {
  const slots = slotsInfo(tournament);
  if (!slots.max) return compact ? null : <span className={crm.muted}>{slots.used} equipos</span>;
  return (
    <div className={crm.slots}>
      <span>{slots.used}/{slots.max} cupos</span>
      <div className={crm.slotBar}><i style={{ width: `${slots.pct}%` }} /></div>
    </div>
  );
}

export default function TournamentOverview({ tournaments, activeTournament, onSelect }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [game, setGame] = useState('all');
  const [sort, setSort] = useState('upcoming');
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('gg-crm-tournament-view') || 'grid'; } catch { return 'grid'; }
  });

  const changeView = (next) => {
    setView(next);
    try { localStorage.setItem('gg-crm-tournament-view', next); } catch { /* sin storage */ }
  };

  const games = useMemo(
    () => [...new Set(tournaments.map((t) => t.game).filter(Boolean))].sort(),
    [tournaments]
  );

  const statusCounts = useMemo(() => {
    const c = { all: tournaments.length };
    for (const t of tournaments) {
      const key = tournamentStatus(t).key;
      c[key] = (c[key] || 0) + 1;
    }
    return c;
  }, [tournaments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tournaments
      .filter((t) => {
        if (status !== 'all' && tournamentStatus(t).key !== status) return false;
        if (origin === 'real' && !isRealTournament(t)) return false;
        if (origin === 'local' && isRealTournament(t)) return false;
        if (game !== 'all' && t.game !== game) return false;
        if (!q) return true;
        const haystack = [t.name, t.game, t.tournamentCode, t.publicId, ...(t.teams || []).map((team) => team.name)]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(SORTS[sort].fn);
  }, [tournaments, query, status, origin, game, sort]);

  const hasLocal = tournaments.some((t) => !isRealTournament(t));

  return (
    <div className={crm.page}>
      <div className={crm.toolbar}>
        <label className={crm.search}>
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar torneo, código, juego o equipo…" />
        </label>
        {games.length > 1 && (
          <select className={crm.select} value={game} onChange={(e) => setGame(e.target.value)} aria-label="Juego">
            <option value="all">Todos los juegos</option>
            {games.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {hasLocal && (
          <select className={crm.select} value={origin} onChange={(e) => setOrigin(e.target.value)} aria-label="Origen">
            <option value="all">Plataforma y pruebas</option>
            <option value="real">Solo plataforma</option>
            <option value="local">Solo pruebas locales</option>
          </select>
        )}
        <select className={crm.select} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
          {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
        </select>
        <div className={crm.toggle} role="group" aria-label="Vista">
          <button type="button" aria-pressed={view === 'grid'} onClick={() => changeView('grid')} title="Tarjetas"><LayoutGrid size={15} /></button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => changeView('table')} title="Tabla"><List size={15} /></button>
        </div>
      </div>

      <div className={crm.chips}>
        {STATUS_FILTERS.filter((f) => f.id === 'all' || statusCounts[f.id]).map((f) => (
          <button key={f.id} type="button" className={status === f.id ? crm.chipActive : crm.chip} onClick={() => setStatus(f.id)}>
            {f.label}<small>{statusCounts[f.id] || 0}</small>
          </button>
        ))}
        {statusCounts.local ? (
          <button type="button" className={status === 'local' ? crm.chipActive : crm.chip} onClick={() => setStatus('local')}>
            Pruebas locales<small>{statusCounts.local}</small>
          </button>
        ) : null}
      </div>

      {!filtered.length ? (
        <div className={crm.empty}>
          {tournaments.length
            ? 'Ningún torneo coincide con estos filtros.'
            : 'No hay torneos con Discord activado en este servidor. Se activan desde el panel de organizador de la web.'}
        </div>
      ) : view === 'table' ? (
        <div className={crm.tableWrap}>
          <table className={crm.table}>
            <thead>
              <tr>
                <th>Torneo</th>
                <th>Juego</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Cupos</th>
                <th className={crm.num}>Jugadores</th>
                <th>Discord</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const st = tournamentStatus(t);
                const prov = provisionStatus(t);
                return (
                  <tr key={t.id} className={crm.rowClickable} onClick={() => onSelect(t.id)}>
                    <td>
                      <div className={crm.strong}>{t.name}{activeTournament?.id === t.id && <span className={crm.tag}>● activo</span>}</div>
                      <div className={crm.muted}>{t.tournamentCode || (isRealTournament(t) ? '' : 'Prueba local del CRM')}</div>
                    </td>
                    <td>{t.game || <span className={crm.muted}>—</span>}</td>
                    <td>{formatDate(t.date) || <span className={crm.muted}>—</span>}</td>
                    <td><span className={`${crm.badge} ${crm[`badge_${st.accent}`]}`}>{st.label}</span></td>
                    <td><SlotBar tournament={t} /></td>
                    <td className={crm.num}>{countPlayers(t)}</td>
                    <td>{prov ? <span className={`${crm.badge} ${crm[`badge_${prov.accent}`]}`}>{prov.label}</span> : <span className={crm.muted}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filtered.map((t) => {
            const isActive = activeTournament?.id === t.id;
            const st = tournamentStatus(t);
            const prov = provisionStatus(t);
            return (
              <article
                key={t.id}
                className={`${styles.tCard} ${isActive ? styles.tCardActive : ''}`}
                onClick={() => onSelect(t.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(t.id); }}
              >
                <div className={`${styles.tCardBanner} ${styles[`banner_${st.accent}`] || ''}`}>
                  <Trophy size={28} />
                  {isActive && (
                    <span className={styles.livePill}>
                      <span className={styles.liveDot} /> Activo
                    </span>
                  )}
                </div>

                <div className={styles.tCardBody}>
                  <div className={styles.tCardTitleRow}>
                    <h4>{t.name}</h4>
                  </div>
                  <div className={crm.pillList}>
                    <span className={`${crm.badge} ${crm[`badge_${st.accent}`]}`}>{st.label}</span>
                    {prov && <span className={`${crm.badge} ${crm[`badge_${prov.accent}`]}`}>{prov.label}</span>}
                  </div>
                  <span className={styles.tCardSource}>
                    {t.game ? <><Gamepad2 size={11} /> {t.game}</> : (isRealTournament(t) ? 'Plataforma GlitchGang' : 'Prueba local del CRM')}
                    {t.date && <> · <CalendarDays size={11} /> {formatDate(t.date)}</>}
                  </span>

                  <SlotBar tournament={t} compact />

                  <div className={styles.tCardStats}>
                    <span><Trophy size={12} /> {(t.teams || []).length} equipos</span>
                    <span><Users size={12} /> {countPlayers(t)} jugadores</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Mic, RefreshCw, Search } from 'lucide-react';
import { fetchRecordings } from '../../lib/api';
import {
  UPLOAD_FILTERS,
  formatBytes,
  formatDate,
  formatDuration,
  uploadStatus,
} from '../../lib/tournamentFormat';
import styles from './Crm.module.css';

export function useRecordings() {
  const [recordings, setRecordings] = useState([]);
  const [state, setState] = useState('loading'); // loading | ok | error
  const [error, setError] = useState('');
  const [backendError, setBackendError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    fetchRecordings()
      .then((data) => {
        setRecordings(Array.isArray(data?.recordings) ? data.recordings : []);
        setBackendError(data?.backendError || '');
        setState('ok');
      })
      .catch((err) => {
        setError(err.message || 'No se pudieron cargar las grabaciones.');
        setState('error');
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { recordings, state, error, backendError, reload: load };
}

function matchLabel(rec) {
  if (!rec.teamName) return '';
  const vs = rec.rivalName ? ` vs ${rec.rivalName}` : '';
  return `${rec.teamName}${vs}`;
}

function gameLabel(rec) {
  const parts = [];
  if (rec.bracketMatchId) parts.push(`Llave ${rec.bracketMatchId}`);
  if (rec.gameNumber) parts.push(`Juego ${rec.gameNumber}`);
  return parts.join(' · ');
}

export function RecordingsTable({ recordings, showTournament = true }) {
  const [openId, setOpenId] = useState('');
  const columns = showTournament ? 8 : 7;

  if (!recordings.length) {
    return <div className={styles.empty}>No hay grabaciones con estos filtros.</div>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fecha</th>
            {showTournament && <th>Torneo</th>}
            <th>Partida</th>
            <th>Canal</th>
            <th className={styles.num}>Duración</th>
            <th className={styles.num}>Jugadores</th>
            <th className={styles.num}>Tamaño</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {recordings.map((rec) => {
            const status = uploadStatus(rec);
            const isOpen = openId === rec.id;
            return (
              <Fragment key={rec.id}>
                <tr className={styles.rowClickable} onClick={() => setOpenId(isOpen ? '' : rec.id)}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      {formatDate(rec.startedAt, true)}
                    </span>
                  </td>
                  {showTournament && (
                    <td>{rec.tournamentName || <span className={styles.muted}>Sin torneo</span>}</td>
                  )}
                  <td>
                    <div className={styles.strong}>{matchLabel(rec) || <span className={styles.muted}>Partida no encontrada</span>}</div>
                    {gameLabel(rec) && <div className={styles.muted}>{gameLabel(rec)}</div>}
                  </td>
                  <td className={styles.muted}>#{rec.channelName || '—'}</td>
                  <td className={styles.num}>{formatDuration(rec.durationMs)}</td>
                  <td className={styles.num}>{rec.participants.length}</td>
                  <td className={styles.num}>{formatBytes(rec.fileSizeBytes)}</td>
                  <td><span className={`${styles.badge} ${styles[`badge_${status.accent}`]}`}>{status.label}</span></td>
                </tr>
                {isOpen && (
                  <tr className={styles.expandRow}>
                    <td colSpan={columns}>
                      <div className={styles.infoGrid} style={{ marginBottom: 12 }}>
                        <div className={styles.info}><span>ID de partida</span><code>{rec.matchId}</code></div>
                        <div className={styles.info}><span>Terminó</span><strong>{rec.status === 'recording' ? 'Sigue grabando' : formatDate(rec.stoppedAt, true) || '—'}</strong></div>
                        <div className={styles.info}><span>Guardada en la web</span><strong>{formatDate(rec.uploadedAt, true) || 'No'}</strong></div>
                        <div className={styles.info}><span>Pantalla compartida</span><strong>{rec.screenShareEvents} eventos</strong></div>
                        {rec.uploadAttempts > 0 && rec.uploadStatus !== 'uploaded' && (
                          <div className={styles.info}><span>Intentos de subida</span><strong>{rec.uploadAttempts}</strong></div>
                        )}
                      </div>
                      {rec.uploadError && <p className={styles.noticeWarn} style={{ margin: '0 0 12px' }}>Error de subida: {rec.uploadError}</p>}
                      <span className={styles.muted}>Jugadores grabados (una pista por jugador)</span>
                      <div className={styles.pillList} style={{ marginTop: 6 }}>
                        {rec.participants.length
                          ? rec.participants.map((p) => <span key={p.id} className={styles.pill}>{p.name}</span>)
                          : <span className={styles.muted}>Nadie habló en el canal.</span>}
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
  );
}

export default function RecordingsPage() {
  const { recordings, state, error, backendError, reload } = useRecordings();
  const [query, setQuery] = useState('');
  const [tournamentId, setTournamentId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const tournamentOptions = useMemo(() => {
    const map = new Map();
    for (const r of recordings) if (r.tournamentId) map.set(r.tournamentId, r.tournamentName);
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [recordings]);

  const counts = useMemo(() => {
    const c = { all: recordings.length };
    for (const r of recordings) {
      const key = uploadStatus(r).key;
      c[key] = (c[key] || 0) + 1;
    }
    return c;
  }, [recordings]);

  const totalMs = useMemo(() => recordings.reduce((t, r) => t + (r.durationMs || 0), 0), [recordings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recordings.filter((r) => {
      if (tournamentId !== 'all' && (r.tournamentId || 'none') !== tournamentId) return false;
      if (statusFilter !== 'all' && uploadStatus(r).key !== statusFilter) return false;
      if (!q) return true;
      const haystack = [r.teamName, r.rivalName, r.tournamentName, r.channelName, r.matchId, ...r.participants.map((p) => p.name)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [recordings, query, tournamentId, statusFilter]);

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <div>
          <h2>Grabaciones de voz</h2>
          <p>
            Todo lo que el bot grabó en los canales de voz al hacer <code>/start-match</code>, con su torneo y su partida.
            El audio se escucha en la web, en «Resultados por revisar», y solo lo abre el árbitro del caso. Si nadie
            reclama, se borra a los 30 días.
          </p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.btn} onClick={reload} disabled={state === 'loading'}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.stat}><strong>{counts.all || 0}</strong><span>Grabaciones</span></div>
        <div className={styles.stat}><strong>{counts.uploaded || 0}</strong><span>Guardadas en la web</span></div>
        <div className={styles.stat}><strong>{counts.recording || 0}</strong><span>Grabando ahora</span></div>
        <div className={styles.stat}><strong>{(counts.failed || 0) + (counts.pending || 0)}</strong><span>Subiendo o fallidas</span></div>
        <div className={styles.stat}><strong>{formatDuration(totalMs)}</strong><span>Audio total</span></div>
      </div>

      {backendError && (
        <p className={styles.noticeWarn}>
          No se pudo leer el backend ({backendError}), así que las grabaciones salen sin torneo ni equipo.
        </p>
      )}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar equipo, jugador, canal o ID…" />
        </label>
        <select className={styles.select} value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} aria-label="Torneo">
          <option value="all">Todos los torneos</option>
          {tournamentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          <option value="none">Sin torneo</option>
        </select>
      </div>

      <div className={styles.chips}>
        {UPLOAD_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={statusFilter === f.id ? styles.chipActive : styles.chip}
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}<small>{counts[f.id] || 0}</small>
          </button>
        ))}
      </div>

      {state === 'loading' && <div className={styles.empty}>Cargando grabaciones…</div>}
      {state === 'error' && <div className={styles.empty}><Mic size={16} /> {error}</div>}
      {state === 'ok' && <RecordingsTable recordings={filtered} />}
    </div>
  );
}

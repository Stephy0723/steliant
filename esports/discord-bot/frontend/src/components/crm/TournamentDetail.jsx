import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Crown, Download, ExternalLink, Mic, Pencil, RadioTower, RefreshCw, Search, Send, Shield, Swords, Trash2, Trophy, Users, X } from 'lucide-react';
import { fetchTournamentMatches, setMatchDispute } from '../../lib/api';
import {
  ROSTER_CSV_HEADER,
  downloadCsv,
  formatDate,
  formatLabel,
  formatMoney,
  isRealTournament,
  platformLabel,
  provisionStatus,
  registrationStatus,
  rosterCsvRows,
  slotsInfo,
  slugify,
  tournamentStatus,
} from '../../lib/tournamentFormat';
import { RecordingsTable, useRecordings } from './RecordingsPage';
import styles from './TournamentOverview.module.css';
import crm from './Crm.module.css';

function countPlayers(tournament) {
  return tournament.teams.reduce((total, team) => total + team.players.length, 0);
}

function countLeaders(tournament) {
  return tournament.teams.reduce(
    (total, team) => total + team.players.filter((player) => player.isLeader).length,
    0
  );
}

function getOperationStatus(status) {
  if (status === 'checking_in') return { label: 'Check-in abierto', accent: 'amber' };
  if (status === 'ready') return { label: 'Listo en sala', accent: 'green' };
  if (status === 'in_progress') return { label: 'Partida iniciada', accent: 'blue' };
  if (status === 'disqualified') return { label: 'Descalificado', accent: 'red' };
  if (status === 'completed') return { label: 'Completada', accent: 'green' };
  if (status === 'cancelled') return { label: 'Cancelada', accent: 'muted' };
  return { label: status || 'Sin estado', accent: 'muted' };
}

function getResultLabel(result) {
  if (result === 'win') return 'Reclama victoria';
  if (result === 'lose') return 'Reporta derrota';
  if (result === 'draw') return 'Reporta empate';
  return result || 'Sin resultado';
}

function formatFullClock(isoString) {
  if (!isoString) return 'N/D';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoString));
}

function voiceChannelUrl(match) {
  if (!match.guildId || !match.voiceChannelId) return '';
  return `https://discord.com/channels/${match.guildId}/${match.voiceChannelId}`;
}

function formatClock(isoString) {
  if (!isoString) return 'N/D';
  return new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit' }).format(new Date(isoString));
}

function formatWindow(ms) {
  const minutes = Math.round(Number(ms || 0) / 60000);
  if (minutes >= 1440) return '1 dia';
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hora(s)`;
  return `${minutes} min`;
}

function getIdentityLabel(player) {
  if (player?.identityStatus === 'verified' || player?.identityVerified) {
    return { label: 'Discord verificado', tone: 'verified' };
  }
  if (player?.identityStatus === 'username_only') {
    return { label: 'Solo username', tone: 'warning' };
  }
  if (player?.identityStatus === 'invalid') {
    return { label: 'Identidad inválida', tone: 'danger' };
  }
  return { label: 'Sin validar', tone: 'muted' };
}

function getIdentityValue(player) {
  if (player?.discordId) return `ID ${player.discordId}`;
  if (player?.discordUsername) return `@${player.discordUsername}`;
  return 'Sin identidad Discord';
}

function InlineEdit({ value, onSave, onCancel }) {
  const [text, setText] = useState(value);
  return (
    <div className={styles.inlineEdit}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(text);
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button type="button" onClick={() => onSave(text)} className={styles.inlineOk}><Check size={14} /></button>
      <button type="button" onClick={onCancel} className={styles.inlineCancel}><X size={14} /></button>
    </div>
  );
}

function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div className={styles.deleteConfirm}>
      <span>¿Eliminar este torneo?</span>
      <button type="button" onClick={onConfirm} className={styles.confirmYes}>Sí, eliminar</button>
      <button type="button" onClick={onCancel} className={styles.confirmNo}>Cancelar</button>
    </div>
  );
}

function MatchCard({ match, onToggleDispute, disputeBusy }) {
  const opStatus = getOperationStatus(match.status);
  const voiceUrl = voiceChannelUrl(match);
  const report = match.report;
  return (
    <article className={styles.operationCard}>
      <div className={styles.operationTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Swords size={14} />
          <strong>{match.teamName}</strong>
          {match.rivalName && <span style={{ opacity: 0.7 }}>vs {match.rivalName}</span>}
        </div>
        <span className={`${styles.statusBadge} ${styles[`badge_${opStatus.accent}`] || ''}`}>{opStatus.label}</span>
      </div>

      {match.attendance?.totalCount ? (
        <p className={styles.operationMeta}>
          {match.attendance.presentCount || 0}/{match.attendance.totalCount} jugadores verificados en check-in
        </p>
      ) : null}

      {voiceUrl ? (
        <a href={voiceUrl} target="_blank" rel="noreferrer" className={styles.voiceLink}>
          <Mic size={12} /> Abrir canal de voz
        </a>
      ) : (
        <p className={styles.operationMeta}>Sin canal de voz registrado.</p>
      )}

      {match.disqualificationReason ? (
        <p className={styles.operationMeta}>{match.disqualificationReason}</p>
      ) : null}

      {report ? (
        <div className={styles.reportBox}>
          <p className={styles.operationMeta}>
            <strong>{getResultLabel(match.result)}</strong> · reportado por {report.reporterUsername || 'N/D'} · {formatFullClock(report.createdAt)}
          </p>
          {report.evidenceUrl && (
            <a href={report.evidenceUrl} target="_blank" rel="noreferrer" className={styles.evidenceLink}>
              <ExternalLink size={12} /> Ver evidencia
            </a>
          )}
          <button
            type="button"
            className={report.disputed ? styles.disputeActiveBtn : styles.disputeBtn}
            disabled={disputeBusy}
            onClick={() => onToggleDispute(match, !report.disputed)}
          >
            <AlertTriangle size={12} /> {report.disputed ? 'Resolver disputa' : 'Marcar disputa'}
          </button>
        </div>
      ) : (
        <p className={styles.operationMeta}>Aun sin reporte de resultado.</p>
      )}

      <p className={styles.operationMeta}>
        Solicitado: {formatClock(match.requestedAt)}
        {match.startedAt && ` · Iniciada: ${formatClock(match.startedAt)}`}
        {match.completedAt && ` · Cerrada: ${formatFullClock(match.completedAt)}`}
      </p>
    </article>
  );
}

const MATCH_FILTERS = [
  { id: 'all', label: 'Todas', test: () => true },
  { id: 'checkin', label: 'Check-in', test: (m) => ['checking_in', 'ready'].includes(m.status) },
  { id: 'live', label: 'En juego', test: (m) => m.status === 'in_progress' },
  { id: 'completed', label: 'Completadas', test: (m) => m.status === 'completed' },
  { id: 'disputed', label: 'Disputadas', test: (m) => Boolean(m.report?.disputed) },
  { id: 'closed', label: 'Canceladas o DQ', test: (m) => ['cancelled', 'disqualified'].includes(m.status) },
];

function Info({ label, children }) {
  if (children === '' || children === null || children === undefined || children === false) return null;
  return (
    <div className={crm.info}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function TournamentInfo({ tournament }) {
  const slots = slotsInfo(tournament);
  const prov = provisionStatus(tournament);
  const regWindow = tournament.registrationWindow;
  const windowText = regWindow?.start || regWindow?.end
    ? `${formatDate(regWindow.start) || '¿?'} → ${formatDate(regWindow.end) || '¿?'}`
    : '';
  const entryFee = formatMoney(tournament.entryFee, tournament.currency)
    || (isRealTournament(tournament) && tournament.entryFee === 0 ? 'Gratis' : '');

  return (
    <div className={crm.infoGrid}>
      <Info label="Juego">{tournament.game}</Info>
      <Info label="Fecha y hora">{formatDate(tournament.date, true)}</Info>
      <Info label="Inscripciones">{windowText}</Info>
      <Info label="Cupos">{slots.max ? `${slots.used} de ${slots.max} (${slots.pct}%)` : `${slots.used} equipos`}</Info>
      <Info label="Formato">{formatLabel(tournament.format)}</Info>
      <Info label="Modalidad">{tournament.modality}</Info>
      <Info label="Plataforma">{platformLabel(tournament.platform)}</Info>
      <Info label="Región">{tournament.region}</Info>
      <Info label="Premio">{formatMoney(tournament.prizePool, tournament.currency)}</Info>
      <Info label="Costo de entrada">{entryFee}</Info>
      <Info label="Campeón">{tournament.winner}</Info>
      <Info label="Inscripción tardía">{tournament.lateRegistration ? 'Encendida' : ''}</Info>
      <Info label="Discord">{prov?.label}</Info>
      {tournament.tournamentCode && (
        <div className={crm.info}><span>Código</span><code>{tournament.tournamentCode}</code></div>
      )}
      {tournament.publicId && (
        <div className={crm.info}><span>ID público</span><code>{tournament.publicId}</code></div>
      )}
    </div>
  );
}

function RosterTab({ tournament }) {
  const [query, setQuery] = useState('');
  const teams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tournament.teams;
    return tournament.teams.filter((team) =>
      [team.name, team.tag, ...(team.players || []).flatMap((p) => [p.name, p.discordUsername])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [tournament.teams, query]);

  return (
    <div className={styles.operationsPanel}>
      <div className={crm.toolbar} style={{ marginBottom: 14 }}>
        <label className={crm.search}>
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar equipo o jugador…" />
        </label>
        <span className={crm.muted}>{teams.length} de {tournament.teams.length} equipos</span>
      </div>

      <div className={styles.teamGrid}>
        {teams.length ? (
          teams.map((team) => (
            <section key={`${tournament.id}-${team.id || team.name}`} className={styles.teamCard}>
              <div className={styles.teamHead}>
                <div className={styles.teamTitle}>
                  <Shield size={16} />
                  <strong>{team.name}</strong>
                  {team.tag && <span className={crm.tag}>[{team.tag}]</span>}
                  {registrationStatus(team) && (
                    <span className={`${crm.badge} ${crm[`badge_${registrationStatus(team).accent}`]}`}>{registrationStatus(team).label}</span>
                  )}
                </div>
                <span>{team.players.length} jugadores</span>
              </div>
              <ul className={styles.playerList}>
                {team.players.length ? (
                  team.players.map((player) => {
                    const identity = getIdentityLabel(player);
                    return (
                      <li key={`${team.name}-${player.id || player.name}-${player.discordId || player.discordUsername || 'no-id'}`}>
                        <div className={styles.playerInfo}>
                          <div className={styles.playerMain}>
                            <span>{player.name}</span>
                            <small>{getIdentityValue(player)}</small>
                          </div>
                          {player.isLeader ? <em>Líder</em> : null}
                        </div>
                        <span className={`${styles.identityBadge} ${styles[`identity_${identity.tone}`] || ''}`}>
                          {identity.label}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className={styles.emptyLine}>Sin jugadores aún</li>
                )}
              </ul>
            </section>
          ))
        ) : (
          <div className={styles.emptyLine}>
            <RadioTower size={16} />
            <span>{tournament.teams.length ? 'Ningún equipo coincide.' : 'Este torneo todavía no tiene equipos inscritos.'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordingsTab({ tournamentId }) {
  const { recordings, state, error, reload } = useRecordings();
  const mine = useMemo(() => recordings.filter((r) => r.tournamentId === tournamentId), [recordings, tournamentId]);

  return (
    <div className={styles.operationsPanel}>
      <div className={styles.operationsHead}>
        <span className={styles.sectionLabel}>Grabaciones</span>
        <strong>Audio de voz de las partidas de este torneo</strong>
        <button type="button" className={styles.iconBtn} title="Actualizar" onClick={reload} disabled={state === 'loading'}>
          <RefreshCw size={14} />
        </button>
      </div>
      <p className={crm.muted} style={{ margin: '0 0 12px' }}>
        Se escuchan en la web, en «Resultados por revisar», y solo las abre el árbitro del caso.
      </p>
      {state === 'loading' && <p className={styles.operationMeta}>Cargando grabaciones…</p>}
      {state === 'error' && <p className={styles.operationMeta}><Mic size={12} /> {error}</p>}
      {state === 'ok' && <RecordingsTable recordings={mine} showTournament={false} />}
    </div>
  );
}


export default function TournamentDetail({
  tournament,
  isActive,
  operations = [],
  activeMatches = [],
  auth,
  onBack,
  onActivateTournament,
  onDeleteTournament,
  onRenameTournament,
  onProvisionTournament,
  busyAction,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isReal = isRealTournament(tournament);
  const canWrite = Boolean(auth?.isAuthorized);
  const canManageLocal = canWrite && !isReal;
  const status = tournamentStatus(tournament);
  const prov = provisionStatus(tournament);
  const provisionBusy = busyAction === `provision:${tournament.id}`;

  const [tab, setTab] = useState('resumen');
  const [matches, setMatches] = useState([]);
  const [matchesState, setMatchesState] = useState('idle'); // idle | loading | ok | error
  const [matchesError, setMatchesError] = useState('');
  const [matchFilter, setMatchFilter] = useState('all');
  const [disputeBusyId, setDisputeBusyId] = useState('');

  const loadMatches = () => {
    if (!isReal) return;
    setMatchesState('loading');
    fetchTournamentMatches(tournament.id)
      .then((data) => {
        setMatches(Array.isArray(data?.matches) ? data.matches : []);
        setMatchesState('ok');
      })
      .catch((error) => {
        setMatchesError(error.message || 'No se pudo cargar las partidas.');
        setMatchesState('error');
      });
  };

  useEffect(() => {
    setTab('resumen');
    setMatches([]);
    setMatchesState('idle');
    setMatchFilter('all');
  }, [tournament.id]);

  // Las partidas se piden al abrir el torneo (no solo en su pestaña) para
  // que el resumen ya muestre cuantas hay y cuantas estan en disputa.
  useEffect(() => {
    if (matchesState === 'idle') loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id, matchesState]);

  const toggleDispute = (match, disputed) => {
    setDisputeBusyId(match.id);
    setMatchDispute(match.id, disputed)
      .then((data) => {
        setMatches((prev) => prev.map((m) => (m.id === match.id ? (data?.match || m) : m)));
      })
      .catch(() => {})
      .finally(() => setDisputeBusyId(''));
  };

  const exportRoster = () => {
    downloadCsv(
      `roster-${slugify(tournament.name)}.csv`,
      ROSTER_CSV_HEADER,
      rosterCsvRows(tournament.name, tournament.teams)
    );
  };

  const matchCounts = useMemo(() => {
    const c = {};
    for (const f of MATCH_FILTERS) c[f.id] = matches.filter(f.test).length;
    return c;
  }, [matches]);

  const visibleMatches = useMemo(
    () => matches.filter((MATCH_FILTERS.find((f) => f.id === matchFilter) || MATCH_FILTERS[0]).test),
    [matches, matchFilter]
  );

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'equipos', label: `Equipos (${tournament.teams.length})` },
    ...(isReal
      ? [
          { id: 'partidas', label: matchesState === 'ok' ? `Partidas (${matches.length})` : 'Partidas' },
          { id: 'grabaciones', label: 'Grabaciones' },
        ]
      : []),
  ];

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <ArrowLeft size={14} /> Volver a Torneos
      </button>

      <div className={styles.detailHead}>
        <div className={styles.cardTitle}>
          {isEditing ? (
            <InlineEdit
              value={tournament.name}
              onSave={(name) => { if (!canManageLocal) return; onRenameTournament(tournament.id, name); setIsEditing(false); }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <h3>{tournament.name}</h3>
              <span className={`${crm.badge} ${crm[`badge_${status.accent}`]}`}>{status.label}</span>
              {prov && <span className={`${crm.badge} ${crm[`badge_${prov.accent}`]}`}>{prov.label}</span>}
            </>
          )}
        </div>

        <div className={crm.headActions}>
          {isReal ? (
            <>
              {tournament.webUrl && (
                <a className={crm.btn} href={tournament.webUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Abrir en la web
                </a>
              )}
              <button
                type="button"
                className={crm.btn}
                onClick={() => onProvisionTournament(tournament.id)}
                disabled={!canWrite || provisionBusy}
                title="Vuelve a mandar el torneo al bot para crear o completar sus roles y canales"
              >
                <Send size={14} /> {provisionBusy ? 'Enviando…' : 'Reenviar a Discord'}
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.activateButton}
                type="button"
                onClick={() => onActivateTournament({ tournamentId: tournament.id })}
                disabled={!canManageLocal || busyAction === 'activate-tournament' || isActive}
              >
                {isActive ? '● Activo' : 'Activar'}
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => setIsEditing(true)} title="Renombrar" disabled={!canManageLocal}>
                <Pencil size={14} />
              </button>
              <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setIsDeleting(true)} title="Eliminar" disabled={!canManageLocal}>
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button type="button" className={crm.btn} onClick={exportRoster} disabled={!tournament.teams.length}>
            <Download size={14} /> Roster CSV
          </button>
        </div>
      </div>

      {isReal && (
        <p className={crm.muted} style={{ margin: '0 0 14px' }}>
          Nombre, fechas, cupos y estado se cambian desde el panel de organizador de la web. Desde aquí revisas
          todo, reenvías el torneo al bot y marcas disputas.
        </p>
      )}

      {isDeleting && (
        <DeleteConfirm
          onConfirm={() => { onDeleteTournament(tournament.id); setIsDeleting(false); onBack(); }}
          onCancel={() => setIsDeleting(false)}
        />
      )}

      <div className={styles.spotlightGrid}>
        <div><Trophy size={16} /><span>{tournament.teams.length} equipos</span></div>
        <div><Users size={16} /><span>{countPlayers(tournament)} jugadores</span></div>
        <div><Crown size={16} /><span>{countLeaders(tournament)} líderes</span></div>
        {matchesState === 'ok' && <div><Swords size={16} /><span>{matches.length} partidas</span></div>}
        {matchesState === 'ok' && matchCounts.disputed > 0 && (
          <div><AlertTriangle size={16} /><span>{matchCounts.disputed} en disputa</span></div>
        )}
      </div>

      <div className={styles.detailTabs}>
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? styles.detailTabActive : styles.detailTab} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'equipos' && <RosterTab tournament={tournament} />}

      {tab === 'grabaciones' && <RecordingsTab tournamentId={tournament.id} />}

      {tab === 'partidas' && (
        <div className={styles.operationsPanel}>
          <div className={styles.operationsHead}>
            <span className={styles.sectionLabel}>Partidas</span>
            <strong>Todas las operaciones de este torneo</strong>
            <button type="button" className={styles.iconBtn} title="Actualizar" onClick={loadMatches} disabled={matchesState === 'loading'}>
              <RefreshCw size={14} />
            </button>
          </div>
          {matchesState === 'ok' && matches.length > 0 && (
            <div className={crm.chips} style={{ marginBottom: 12 }}>
              {MATCH_FILTERS.map((f) => (
                <button key={f.id} type="button" className={matchFilter === f.id ? crm.chipActive : crm.chip} onClick={() => setMatchFilter(f.id)}>
                  {f.label}<small>{matchCounts[f.id]}</small>
                </button>
              ))}
            </div>
          )}
          {matchesState === 'loading' && <p className={styles.operationMeta}>Cargando partidas…</p>}
          {matchesState === 'error' && <p className={styles.operationMeta}>{matchesError}</p>}
          {matchesState === 'ok' && matches.length === 0 && (
            <div className={styles.operationEmpty}>Este torneo todavía no tiene partidas registradas.</div>
          )}
          {matchesState === 'ok' && matches.length > 0 && visibleMatches.length === 0 && (
            <div className={styles.operationEmpty}>No hay partidas con este filtro.</div>
          )}
          {matchesState === 'ok' && visibleMatches.length > 0 && (
            <div className={styles.operationsList}>
              {visibleMatches.map((match) => (
                <MatchCard key={match.id} match={match} onToggleDispute={toggleDispute} disputeBusy={disputeBusyId === match.id} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'resumen' && (
      <>
      <div className={styles.operationsPanel}>
        <div className={styles.operationsHead}>
          <span className={styles.sectionLabel}>Datos</span>
          <strong>Ficha del torneo</strong>
        </div>
        <TournamentInfo tournament={tournament} />
        {!isReal && (
          <p className={crm.muted} style={{ marginTop: 10 }}>Torneo de prueba creado en el CRM: no existe en la web.</p>
        )}
      </div>

      {isActive && operations.length > 0 && (
        <div className={styles.operationsPanel}>
          <div className={styles.operationsHead}>
            <span className={styles.sectionLabel}>Cronograma</span>
            <strong>Estado operativo del torneo</strong>
          </div>
          <div className={styles.operationsList}>
            {operations.map((operation) => {
              const opStatus = getOperationStatus(operation.status);
              return (
                <article key={operation.id} className={styles.operationCard}>
                  <div className={styles.operationTop}>
                    <strong>{operation.teamName}</strong>
                    <span className={`${styles.statusBadge} ${styles[`badge_${opStatus.accent}`] || ''}`}>{opStatus.label}</span>
                  </div>
                  <p className={styles.operationMeta}>
                    Solicitado: {formatClock(operation.requestedAt)} | Ventana: {formatWindow(operation.checkinWindowMs)}
                  </p>
                  <p className={styles.operationMeta}>Limite: {formatClock(operation.checkinDeadlineAt)}</p>
                  {operation.status === 'checking_in' ? (
                    <p className={styles.operationMeta}>
                      {operation.attendance?.presentCount || 0}/{operation.attendance?.totalCount || 0} jugadores verificados
                    </p>
                  ) : null}
                  {operation.status === 'ready' ? <p className={styles.operationMeta}>Equipo completo y esperando en sala.</p> : null}
                  {operation.status === 'disqualified' ? (
                    <p className={styles.operationMeta}>{operation.disqualificationReason || 'Descalificacion registrada.'}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {isActive && activeMatches.length > 0 && (
        <div className={styles.operationsPanel}>
          <div className={styles.operationsHead}>
            <span className={styles.sectionLabel}>En curso</span>
            <strong>Partidas activas ahora mismo</strong>
          </div>
          <div className={styles.operationsList}>
            {activeMatches.map((match) => (
              <article key={match.id} className={styles.operationCard}>
                <div className={styles.operationTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Swords size={14} />
                    <strong>{match.teamName}</strong>
                    {match.rivalName && <span style={{ opacity: 0.7 }}>vs {match.rivalName}</span>}
                  </div>
                  <span className={`${styles.statusBadge} ${styles.badge_blue}`}>Partida en curso</span>
                </div>
                <p className={styles.operationMeta}>Iniciada: {formatClock(match.startedAt)} | ID: <code>{match.id}</code></p>
              </article>
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

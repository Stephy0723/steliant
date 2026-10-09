import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  activateTournament,
  addPlayer,
  addTeam,
  createTournament,
  deleteTournament,
  fetchActivity,
  fetchBootstrap,
  importTournamentFile,
  loadDemo,
  renameTournament,
  provisionTournament,
} from '../lib/api';

const CRM_REFRESH_INTERVAL_MS = 15000;

function normalizeBootstrap(payload = {}) {
  return {
    tournaments: Array.isArray(payload.tournaments) ? payload.tournaments : [],
    activeTournament: payload.activeTournament || null,
    operations: Array.isArray(payload.operations) ? payload.operations : [],
    activeMatches: Array.isArray(payload.activeMatches) ? payload.activeMatches : [],
    auth: payload.auth || {},
    system: payload.system || {},
    notice: payload.notice || null,
  };
}

export function useDashboardState(initialPayload) {
  const [data, setData] = useState(() => normalizeBootstrap(initialPayload));
  const [status, setStatus] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [activityLog, setActivityLog] = useState([]);

  const refreshActivity = useCallback(async () => {
    try {
      const log = await fetchActivity();
      setActivityLog(Array.isArray(log) ? log : []);
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchBootstrap();
    setData(normalizeBootstrap(next));
    await refreshActivity();
  }, [refreshActivity]);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refresh().catch(() => {});
    }, CRM_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refresh]);

  const runAction = useCallback(async ({ loadingMessage, successMessage, actionKey, task }) => {
    setBusyAction(actionKey);
    setStatus({ tone: 'info', message: loadingMessage });

    try {
      const result = await task();
      await refresh();
      setStatus({ tone: 'success', message: successMessage });
      return result;
    } catch (error) {
      setStatus({ tone: 'error', message: error.message });
      throw error;
    } finally {
      setBusyAction('');
    }
  }, [refresh]);

  const handlers = useMemo(() => ({
    createTournament: (payload) =>
      runAction({
        loadingMessage: 'Creando torneo...',
        successMessage: 'Torneo creado correctamente.',
        actionKey: 'create-tournament',
        task: () => createTournament(payload),
      }),
    addTeam: (payload) =>
      runAction({
        loadingMessage: 'Agregando equipo...',
        successMessage: 'Equipo agregado correctamente.',
        actionKey: 'add-team',
        task: () => addTeam(payload),
      }),
    addPlayer: (payload) =>
      runAction({
        loadingMessage: 'Agregando jugador...',
        successMessage: 'Jugador agregado correctamente.',
        actionKey: 'add-player',
        task: () => addPlayer(payload),
      }),
    activateTournament: (payload) =>
      runAction({
        loadingMessage: 'Activando torneo...',
        successMessage: 'Torneo activo actualizado.',
        actionKey: 'activate-tournament',
        task: () => activateTournament(payload),
      }),
    deleteTournament: (tournamentId) =>
      runAction({
        loadingMessage: 'Eliminando torneo...',
        successMessage: 'Torneo eliminado correctamente.',
        actionKey: 'delete-tournament',
        task: () => deleteTournament(tournamentId),
      }),
    renameTournament: (tournamentId, name) =>
      runAction({
        loadingMessage: 'Renombrando torneo...',
        successMessage: 'Torneo renombrado correctamente.',
        actionKey: 'rename-tournament',
        task: () => renameTournament(tournamentId, name),
      }),
    loadDemo: () =>
      runAction({
        loadingMessage: 'Cargando torneo demo...',
        successMessage: 'Demo cargada correctamente.',
        actionKey: 'load-demo',
        task: () => loadDemo(),
      }),
    importFile: ({ file, makeActive }) =>
      runAction({
        loadingMessage: 'Importando archivo...',
        successMessage: 'Importacion completada.',
        actionKey: 'import-file',
        task: () => importTournamentFile({ file, makeActive }),
      }),
    provisionTournament: (tournamentId) =>
      runAction({
        loadingMessage: 'Enviando torneo al bot de Discord...',
        successMessage: 'El bot recibió el torneo y está creando roles y canales.',
        actionKey: `provision:${tournamentId}`,
        task: () => provisionTournament(tournamentId),
      }),
    clearStatus: () => setStatus(null),
    refresh,
  }), [refresh, runAction]);

  return {
    ...data,
    status,
    busyAction,
    activityLog,
    handlers,
  };
}

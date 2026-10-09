import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mic, Plus, Radio, Shield, ShieldAlert, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useDashboardState } from './hooks/useDashboardState';
import { NAV_ITEMS } from './lib/content';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LandingPage from './components/layout/LandingPage';
import HeroPanel from './components/dashboard/HeroPanel';
import MetricCard from './components/dashboard/MetricCard';
import LiveOpsPanel from './components/dashboard/LiveOpsPanel';
import AnalyticsPanel from './components/dashboard/AnalyticsPanel';
import TournamentOverview from './components/crm/TournamentOverview';
import TournamentDetail from './components/crm/TournamentDetail';
import ControlPanel from './components/crm/ControlPanel';
import ActivityLog from './components/crm/ActivityLog';
import SupportPanel from './components/shared/SupportPanel';
import ToastProvider, { useToast } from './components/shared/ToastProvider';
import CommandPalette from './components/shared/CommandPalette';
import DisputesPage from './components/crm/DisputesPage';
import LeaderboardPage from './components/crm/LeaderboardPage';
import UsersPage from './components/crm/UsersPage';
import TeamsPage from './components/crm/TeamsPage';
import RecordingsPage from './components/crm/RecordingsPage';
import styles from './App.module.css';

const METRIC_CONFIG = [
  { key: 'tournaments', label: 'Torneos', icon: Trophy, accent: 'blue' },
  { key: 'teams', label: 'Equipos', icon: Users, accent: 'cyan' },
  { key: 'players', label: 'Jugadores', icon: ShieldCheck, accent: 'violet' },
  { key: 'live', label: 'En vivo ahora', icon: Radio, accent: 'amber' },
  { key: 'leaders', label: 'Líderes', icon: Sparkles, accent: 'green' },
  { key: 'open', label: 'Inscripciones abiertas', icon: Trophy, accent: 'blue' },
];

function buildMetrics(tournaments, operations, activeMatches) {
  const teams = tournaments.reduce((t, tr) => t + tr.teams.length, 0);
  const players = tournaments.reduce(
    (t, tr) => t + tr.teams.reduce((s, team) => s + team.players.length, 0), 0
  );
  const leaders = tournaments.reduce(
    (t, tr) => t + tr.teams.reduce((s, team) => s + team.players.filter((p) => p.isLeader).length, 0), 0
  );
  const checkins = (operations || []).filter((o) => o.status === 'checking_in').length;
  const live = checkins + (activeMatches || []).length;
  const open = tournaments.filter((t) => t.status === 'open').length;
  return { tournaments: tournaments.length, teams, players, leaders, live, open };
}

/* ---------- Page views ---------- */

function OverviewPage({ tournaments, activeTournament, operations, activeMatches, auth, system, metrics, activityLog, onNavigate }) {
  return (
    <div className={styles.page}>
      <HeroPanel
        activeTournament={activeTournament}
        tournaments={tournaments}
        auth={auth}
        system={system}
        liveOpsCount={metrics.live}
      />

      <div className={styles.metricsRow}>
        {METRIC_CONFIG.map((item, i) => (
          <MetricCard key={item.key} label={item.label} value={metrics[item.key]} accent={item.accent} icon={item.icon} delay={i * 60} />
        ))}
      </div>

      <LiveOpsPanel operations={operations} activeMatches={activeMatches} />

      <div className={styles.overviewGrid}>
        <ActivityLog activities={activityLog} />
        <div className={styles.quickPanel}>
          <h3>Acceso rápido</h3>
          <div className={styles.quickActions}>
            <button className={styles.quickBtn} onClick={() => onNavigate('tournaments')}>
              <Trophy size={16} /> Gestionar torneos
            </button>
            <button className={styles.quickBtn} onClick={() => onNavigate('teams')}>
              <Shield size={16} /> Equipos inscritos
            </button>
            <button className={styles.quickBtn} onClick={() => onNavigate('recordings')}>
              <Mic size={16} /> Grabaciones de voz
            </button>
            <button className={styles.quickBtn} onClick={() => onNavigate('disputes')}>
              <ShieldAlert size={16} /> Resoluciones
            </button>
            <button className={styles.quickBtn} onClick={() => onNavigate('analytics')}>
              <ShieldCheck size={16} /> Ver analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function AnalyticsPage({ tournaments, activityLog }) {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2>Analytics</h2>
        <p>Métricas clave, distribución de equipos y actividad reciente del sistema.</p>
      </div>

      <AnalyticsPanel tournaments={tournaments} />

      <div className={styles.pageHeader} style={{ marginTop: 8 }}>
        <h3>Actividad reciente</h3>
      </div>
      <ActivityLog activities={activityLog} />
    </div>
  );
}

function TournamentsPage({ tournaments, activeTournament, operations, activeMatches, busyAction, handlers, auth, selectedId, setSelectedId }) {
  const [showCreate, setShowCreate] = useState(false);

  const selectedTournament = selectedId ? tournaments.find((t) => t.id === selectedId) : null;

  if (selectedTournament) {
    return (
      <div className={styles.page}>
        <TournamentDetail
          tournament={selectedTournament}
          isActive={activeTournament?.id === selectedTournament.id}
          operations={operations}
          activeMatches={activeMatches}
          auth={auth}
          onBack={() => setSelectedId(null)}
          onActivateTournament={handlers.activateTournament}
          onDeleteTournament={handlers.deleteTournament}
          onRenameTournament={handlers.renameTournament}
          onProvisionTournament={handlers.provisionTournament}
          busyAction={busyAction}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeaderRow}>
        <div className={styles.pageHeader}>
          <h2>Torneos</h2>
          <p>Los torneos con Discord activado en este servidor. Filtra por estado o juego y abre uno para ver su ficha, equipos, partidas y grabaciones.</p>
        </div>
        <button type="button" className={styles.createTournamentBtn} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? <X size={15} /> : <Plus size={15} />}
          {showCreate ? 'Cerrar' : 'Torneo de prueba'}
        </button>
      </div>

      {showCreate && (
        <ControlPanel
          tournaments={tournaments}
          activeTournament={activeTournament}
          auth={auth}
          busyAction={busyAction}
          handlers={handlers}
        />
      )}

      <TournamentOverview
        tournaments={tournaments}
        activeTournament={activeTournament}
        onSelect={setSelectedId}
      />
    </div>
  );
}

function SupportPage({ auth, system }) {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2>Soporte & Utilidades</h2>
        <p>Guías de uso, estado del sistema y recursos de ayuda.</p>
      </div>
      <SupportPanel auth={auth} system={system} />
    </div>
  );
}

/* ---------- Main app ---------- */

function AppContent({ initialData }) {
  const { theme, toggleTheme } = useTheme();
  const { tournaments, activeTournament, operations, activeMatches, auth, system, status, busyAction, activityLog, handlers } =
    useDashboardState(initialData);
  const addToast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);

  const openTournament = useCallback((id) => {
    setSelectedTournamentId(id);
    setActiveTab('tournaments');
  }, []);

  const navigate = useCallback((tab) => {
    if (tab === 'tournaments') setSelectedTournamentId(null);
    setActiveTab(tab);
  }, []);

  const metrics = useMemo(
    () => buildMetrics(tournaments, operations, activeMatches),
    [tournaments, operations, activeMatches]
  );

  // Fire toasts on status changes
  useEffect(() => {
    if (status && addToast) {
      addToast(status.message, status.tone === 'info' ? 'info' : status.tone, status.tone === 'info' ? 2000 : 4000);
    }
  }, [status, addToast]);

  // Ctrl+K shortcut
  useEffect(() => {
    function handleGlobalKeys(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const handlePaletteAction = useCallback((actionId) => {
    if (actionId === 'toggle-theme') toggleTheme();
    else if (actionId === 'load-demo') handlers.loadDemo();
    else if (actionId.startsWith('nav-')) navigate(actionId.replace('nav-', ''));
  }, [toggleTheme, handlers, navigate]);

  function renderActivePage() {
    switch (activeTab) {
      case 'home':
        return <OverviewPage tournaments={tournaments} activeTournament={activeTournament} operations={operations} activeMatches={activeMatches} auth={auth} system={system} metrics={metrics} activityLog={activityLog} onNavigate={navigate} />;
      case 'analytics':
        return <AnalyticsPage tournaments={tournaments} activityLog={activityLog} />;
      case 'tournaments':
        return <TournamentsPage tournaments={tournaments} activeTournament={activeTournament} operations={operations} activeMatches={activeMatches} busyAction={busyAction} handlers={handlers} auth={auth} selectedId={selectedTournamentId} setSelectedId={setSelectedTournamentId} />;
      case 'teams':
        return <TeamsPage tournaments={tournaments} onOpenTournament={openTournament} />;
      case 'recordings':
        return <RecordingsPage />;
      case 'usuarios':
        return <UsersPage />;
      case 'leaderboard':
        return <LeaderboardPage />;
      case 'disputes':
        return <DisputesPage />;
      case 'utilities':
        return <SupportPage auth={auth} system={system} />;
      default:
        return <OverviewPage tournaments={tournaments} activeTournament={activeTournament} operations={operations} activeMatches={activeMatches} auth={auth} system={system} metrics={metrics} activityLog={activityLog} onNavigate={navigate} />;
    }
  }

  if (!auth?.user) {
    return <LandingPage auth={auth} />;
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        navItems={NAV_ITEMS}
        activeTab={activeTab}
        onNavigate={navigate}
        activeTournament={activeTournament}
        auth={auth}
      />

      <main className={styles.mainPane}>
        <Header
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          theme={theme}
          onToggleTheme={toggleTheme}
          auth={auth}
          system={system}
          onOpenPalette={() => setPaletteOpen(true)}
          activeTab={activeTab}
          navItems={NAV_ITEMS}
        />

        <div className={styles.content}>
          {renderActivePage()}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handlePaletteAction}
        theme={theme}
        navItems={NAV_ITEMS}
      />
    </div>
  );
}

export default function App({ initialData }) {
  return (
    <ToastProvider>
      <AppContent initialData={initialData} />
    </ToastProvider>
  );
}

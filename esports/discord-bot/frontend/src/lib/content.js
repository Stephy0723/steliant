import {
  BarChart3,
  BellRing,
  Bot,
  ClipboardCheck,
  Command,
  Crown,
  FileImage,
  LayoutDashboard,
  Mic,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'home', label: 'Resumen', icon: LayoutDashboard },
  { id: 'tournaments', label: 'Torneos', icon: Trophy },
  { id: 'teams', label: 'Equipos', icon: Shield },
  { id: 'recordings', label: 'Grabaciones', icon: Mic },
  { id: 'disputes', label: 'Resoluciones', icon: ShieldAlert },
  { id: 'leaderboard', label: 'Clasificación', icon: Crown },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'utilities', label: 'Soporte', icon: Command },
];

export const QUICK_FLOWS = [
  {
    id: 'checkin-flow',
    title: '/checkin',
    description:
      'El bot entra al voice, detecta tu equipo y valida presentes, faltantes y no registrados.',
    icon: ClipboardCheck,
  },
  {
    id: 'match-flow',
    title: '/start-match',
    description:
      'Solo arranca cuando el roster del equipo esta completo y el estado del canal es valido.',
    icon: ShieldCheck,
  },
  {
    id: 'tournament-flow',
    title: '/torneo',
    description:
      'Muestra los equipos, participantes y el estado de verificacion segun el ultimo check-in.',
    icon: Trophy,
  },
  {
    id: 'report-flow',
    title: '/report',
    description:
      'Guarda el resultado final, la evidencia y el score. Si hay lider, solo esa cuenta puede reportar.',
    icon: FileImage,
  },
  {
    id: 'roles-flow',
    title: '/rol',
    description:
      'Configura los roles base del servidor; los roles de cada miembro se sincronizan automaticamente con su cuenta de GlitchGang, ya no se eligen a mano.',
    icon: Crown,
  },
];

export const UTILITY_ITEMS = [
  {
    title: 'Sistema online',
    description: 'Muestra el estado del panel, la autenticacion y el contexto del torneo activo.',
    icon: Bot,
  },
  {
    title: 'Acceso con Discord',
    description: 'La entrada con Discord queda integrada al panel para una experiencia mas producto.',
    icon: Users,
  },
];

export const SYSTEM_PILLS = [
  { id: 'panel', label: 'Control Center', icon: BellRing },
  { id: 'players', label: 'Roster Tracking', icon: Users },
  { id: 'leadership', label: 'Leader Lock', icon: Crown },
];

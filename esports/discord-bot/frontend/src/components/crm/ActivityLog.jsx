import { useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  FileImage,
  FileSpreadsheet,
  Play,
  Plus,
  Rocket,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Trash2,
  UserPlus,
  Pencil,
} from 'lucide-react';
import styles from './ActivityLog.module.css';

const ACTION_CONFIG = {
  'create-tournament': { icon: Swords, label: 'Torneo creado', accent: 'blue' },
  'delete-tournament': { icon: Trash2, label: 'Torneo eliminado', accent: 'red' },
  'rename-tournament': { icon: Pencil, label: 'Torneo renombrado', accent: 'amber' },
  'activate-tournament': { icon: Play, label: 'Torneo activado', accent: 'green' },
  'add-team': { icon: Rocket, label: 'Equipo agregado', accent: 'cyan' },
  'add-player': { icon: UserPlus, label: 'Jugador agregado', accent: 'violet' },
  'import': { icon: FileSpreadsheet, label: 'Importación', accent: 'blue' },
  'load-demo': { icon: Sparkles, label: 'Demo cargada', accent: 'green' },
  'checkin-started': { icon: ClipboardCheck, label: 'Check-in abierto', accent: 'amber' },
  'checkin-ready': { icon: ShieldCheck, label: 'Equipo listo', accent: 'green' },
  'checkin-disqualified': { icon: ShieldAlert, label: 'Descalificado', accent: 'red' },
  'start-match': { icon: Swords, label: 'Partida iniciada', accent: 'cyan' },
  'match-report': { icon: FileImage, label: 'Resultado reportado', accent: 'blue' },
  'create-api-partner': { icon: Rocket, label: 'Partner API creado', accent: 'cyan' },
  'update-api-partner': { icon: Pencil, label: 'Partner API actualizado', accent: 'amber' },
  'rotate-api-key': { icon: ShieldCheck, label: 'API key rotada', accent: 'green' },
  'sync-site-tournament': { icon: Sparkles, label: 'Sync desde GlitchGang', accent: 'green' },
  'sync-api-tournament': { icon: Rocket, label: 'Sync desde partner API', accent: 'cyan' },
};

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

export default function ActivityLog({ activities }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [activities]);

  if (!activities.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.sectionLabel}>Activity Feed</span>
          <h3>Registro de actividad</h3>
        </div>
        <div className={styles.empty}>
          <Plus size={20} />
          <p>Las acciones del CRM aparecerán aquí en tiempo real.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <span className={styles.sectionLabel}>Activity Feed</span>
          <h3>Registro de actividad</h3>
        </div>
        <span className={styles.count}>{activities.length} eventos</span>
      </div>

      <ul className={styles.list} ref={listRef}>
        {activities.map((entry, index) => {
          const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG['import'];
          const Icon = config.icon;

          return (
            <li
              key={entry.id}
              className={styles.item}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className={`${styles.iconWrap} ${styles[config.accent] || ''}`}>
                <Icon size={14} />
              </div>
              <div className={styles.body}>
                <div className={styles.top}>
                  <span className={`${styles.badge} ${styles[config.accent] || ''}`}>
                    {config.label}
                  </span>
                  <time className={styles.time}>{relativeTime(entry.timestamp)}</time>
                </div>
                <p className={styles.detail}>{entry.detail}</p>
                {entry.user !== 'Sistema' ? (
                  <span className={styles.user}>por @{entry.user}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

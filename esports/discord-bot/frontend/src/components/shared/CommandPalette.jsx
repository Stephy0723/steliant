import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command, Moon, Plus, Rocket, Search, Sparkles, Sun, Swords } from 'lucide-react';
import styles from './CommandPalette.module.css';

export default function CommandPalette({ open, onClose, onAction, theme, navItems }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const actions = useMemo(() => [
    { id: 'create-tournament', label: 'Crear torneo', icon: Swords, group: 'Acciones' },
    { id: 'load-demo', label: 'Cargar torneo demo', icon: Sparkles, group: 'Acciones' },
    { id: 'toggle-theme', label: theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', icon: theme === 'dark' ? Sun : Moon, group: 'Sistema' },
    ...navItems.map((item) => ({
      id: `nav-${item.id}`,
      label: `Ir a ${item.label}`,
      icon: item.icon,
      group: 'Navegación',
    })),
  ], [theme, navItems]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [query, actions]);

  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
    setQuery('');
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const execute = useCallback((action) => {
    if (!action) return;
    onAction(action.id);
    onClose();
  }, [onAction, onClose]);

  useEffect(() => {
    if (!open) return;

    function handleKey(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        execute(filtered[selected]);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, filtered, selected, execute, onClose]);

  if (!open) return null;

  const groups = {};
  filtered.forEach((a) => {
    if (!groups[a.group]) groups[a.group] = [];
    groups[a.group].push(a);
  });

  let flatIndex = 0;

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar acción..."
            className={styles.searchInput}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>

        <div className={styles.results}>
          {Object.entries(groups).map(([groupName, groupActions]) => (
            <div key={groupName} className={styles.group}>
              <span className={styles.groupLabel}>{groupName}</span>
              {groupActions.map((action) => {
                const Icon = action.icon;
                const idx = flatIndex++;
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={`${styles.action} ${idx === selected ? styles.actionSelected : ''}`}
                    onClick={() => execute(action)}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <Icon size={16} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {!filtered.length && (
            <p className={styles.empty}>Sin resultados para "{query}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

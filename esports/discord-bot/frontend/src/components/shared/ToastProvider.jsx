import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import styles from './ToastProvider.module.css';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

let nextToastId = 0;

export function useToast() {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++nextToastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
    timers.current[id] = setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className={styles.container} aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || Info;
          return (
            <div
              key={toast.id}
              className={`${styles.toast} ${styles[toast.type] || ''}`}
            >
              <Icon size={18} className={styles.icon} />
              <p className={styles.message}>{toast.message}</p>
              <button
                className={styles.close}
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Cerrar"
              >
                <X size={14} />
              </button>
              <span
                className={styles.progress}
                style={{ animationDuration: `${toast.duration}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

import { useEffect, useState } from 'react';
import { Check, ImageOff, ShieldAlert, X } from 'lucide-react';
import styles from './Disputes.module.css';

async function fetchReports() {
  const res = await fetch('/reports');
  if (!res.ok) throw new Error('Error al cargar reportes');
  return res.json();
}

async function setDisputed(reportId, disputed) {
  const res = await fetch(`/reports/${reportId}/dispute`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disputed }),
  });
  if (!res.ok) throw new Error('Error al actualizar disputa');
  return res.json();
}

function resultLabel(result) {
  if (result === 'win') return 'Reclaman Victoria';
  if (result === 'lose') return 'Reportan Derrota';
  if (result === 'draw') return 'Reportan Empate';
  return result;
}

function formatDate(iso) {
  if (!iso) return 'N/D';
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export default function DisputesPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    fetchReports()
      .then(setReports)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleDispute(report) {
    setBusy(report.id);
    try {
      const { report: updated } = await setDisputed(report.id, !report.disputed);
      setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Centro de Resoluciones</h2>
        </header>
        <p style={{ opacity: 0.6 }}>Cargando reportes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Centro de Resoluciones</h2>
        </header>
        <p style={{ color: 'var(--accent-red)' }}>{error}</p>
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Centro de Resoluciones</h2>
          <p>Gestiona los reportes y marca disputas cuando los resultados sean contradictorios.</p>
        </header>
        <p style={{ opacity: 0.6 }}>No hay reportes de partidas aún. Aparecerán aquí cuando los equipos usen <code>/report</code>.</p>
      </div>
    );
  }

  const disputed = reports.filter((r) => r.disputed);
  const normal = reports.filter((r) => !r.disputed);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2>Centro de Resoluciones</h2>
        <p>
          Revisa los reportes de partidas y márcalos como disputa si el resultado es cuestionable.
          {disputed.length > 0 && <strong> · {disputed.length} en disputa</strong>}
        </p>
      </header>

      {disputed.length > 0 && (
        <div>
          <p className={`${styles.groupLabel} ${styles.danger}`}>En disputa</p>
          <div className={styles.stack}>
            {disputed.map((report) => (
              <ReportCard key={report.id} report={report} onToggle={toggleDispute} busy={busy === report.id} />
            ))}
          </div>
        </div>
      )}

      {normal.length > 0 && (
        <div>
          {disputed.length > 0 && <p className={styles.groupLabel}>Otros reportes</p>}
          <div className={styles.stack}>
            {normal.map((report) => (
              <ReportCard key={report.id} report={report} onToggle={toggleDispute} busy={busy === report.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, onToggle, busy }) {
  const [evidenceFailed, setEvidenceFailed] = useState(false);

  return (
    <div className={styles.disputeCard}>
      <div className={styles.disputeHeader}>
        <div className={styles.matchInfo}>
          <ShieldAlert
            className={styles.warningIcon}
            size={18}
            style={{ color: report.disputed ? 'var(--accent-red)' : 'var(--text-muted)' }}
          />
          <div>
            <h3>{report.teamName} — {report.tournamentName}</h3>
            <span>
              Reportado por {report.reporter?.displayName || report.reporter?.username} · {formatDate(report.createdAt)}
              {report.matchId && ` · Match ${report.matchId}`}
            </span>
          </div>
        </div>
        {report.disputed
          ? <span className={styles.statusBadge}>En Disputa</span>
          : <span className={styles.claimBadge}>{resultLabel(report.result)}</span>
        }
      </div>

      {report.evidenceUrl && (
        <div className={styles.evidenceWrap}>
          {evidenceFailed ? (
            <div className={styles.screenshotMock}>
              <span className={styles.evidenceFallback}>
                <ImageOff size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                No se pudo cargar la evidencia
              </span>
            </div>
          ) : (
            <a href={report.evidenceUrl} target="_blank" rel="noreferrer">
              <div className={styles.screenshotMock}>
                <img src={report.evidenceUrl} alt="Evidencia" onError={() => setEvidenceFailed(true)} />
              </div>
            </a>
          )}
        </div>
      )}

      <div className={styles.disputeFooter}>
        <button
          className={report.disputed ? styles.btnApprove : styles.btnCancel}
          onClick={() => onToggle(report)}
          disabled={busy}
        >
          {report.disputed
            ? <><Check size={14} /> Marcar como resuelto</>
            : <><X size={14} /> Marcar como disputa</>
          }
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { CircleHelp, FileText, Info, ShieldAlert, UserRound } from 'lucide-react';
import { QUICK_FLOWS, UTILITY_ITEMS } from '../../lib/content';
import styles from './SupportPanel.module.css';

export default function SupportPanel({ auth, system }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.head}>
          <div>
            <span className={styles.sectionLabel}>Support & Ops</span>
            <h3>Comandos, ayuda y estado del sistema</h3>
          </div>
          <p>
            Todo lo necesario para entender cómo usar el bot y qué espera el sistema en cada fase
            del torneo.
          </p>
        </div>

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <FileText size={18} />
              <div>
                <h4>Flujo de uso</h4>
                <p>Guía rápida para staff, líderes y capitanes.</p>
              </div>
            </div>

            <div className={styles.flowList}>
              {QUICK_FLOWS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.id} className={styles.flowItem}>
                    <div className={styles.flowIcon}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <Info size={18} />
              <div>
                <h4>Capacidades del panel</h4>
                <p>El panel combina UX operativa y branding gaming.</p>
              </div>
            </div>

            <div className={styles.utilityList}>
              {UTILITY_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className={styles.utilityItem}>
                    <Icon size={18} />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <UserRound size={18} />
              <div>
                <h4>Autenticación</h4>
                <p>Discord funciona como puerta de entrada al Control Center.</p>
              </div>
            </div>

            {auth?.user ? (
              <div className={styles.authCard}>
                <img
                  className={styles.avatar}
                  src={auth.user.avatarUrl}
                  alt={auth.user.globalName || auth.user.username}
                />
                <div>
                  <strong>{auth.user.globalName || auth.user.username}</strong>
                  <p>@{auth.user.username}</p>
                </div>
                <a href={auth.logoutUrl}>Cerrar sesión</a>
              </div>
            ) : (
              <div className={styles.messageCard}>
                <p>
                  {auth?.configured
                    ? 'Puedes iniciar sesión con Discord desde la cabecera para una experiencia de acceso más producto.'
                    : 'Falta DISCORD_CLIENT_SECRET en .env para completar el login con Discord.'}
                </p>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <ShieldAlert size={18} />
              <div>
                <h4>Health del sistema</h4>
                <p>Lectura rápida del estado operativo local.</p>
              </div>
            </div>

            <div className={styles.systemList}>
              <div>
                <span>Estado</span>
                <strong>{system?.statusLabel || 'CRM online'}</strong>
              </div>
              <div>
                <span>Entorno</span>
                <strong>{system?.environment || 'Local control node'}</strong>
              </div>
              <div>
                <span>Endpoint</span>
                <strong>{system?.apiUrl || '/tournament'}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>

      <button className={styles.helpButton} type="button" onClick={() => setOpen(true)}>
        <CircleHelp size={18} />
        <span>?</span>
      </button>

      {open ? (
        <div className={styles.modalScrim} role="presentation" onClick={() => setOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHead}>
              <div>
                <span className={styles.sectionLabel}>Guía extendida</span>
                <h4>Cómo usar el Control Center sin perder contexto</h4>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className={styles.modalGrid}>
              <section>
                <strong>1. Estructura del CRM</strong>
                <p>
                  Primero existe el torneo. Dentro del torneo viven los equipos. Dentro de cada
                  equipo viven los jugadores. El líder se marca a nivel de jugador.
                </p>
              </section>

              <section>
                <strong>2. Check-in</strong>
                <p>
                  `/checkin` valida presencia en voice y compara conectados contra el roster del
                  torneo activo. Si faltan jugadores o hay nombres sin registrar, el sistema lo deja
                  claro antes de continuar.
                </p>
              </section>

              <section>
                <strong>3. Inicio de partida</strong>
                <p>
                  `/start-match` solo debería dispararse cuando el equipo ya completó el check-in y
                  el canal está listo. La intención del panel es darte contexto operativo antes del
                  arranque.
                </p>
              </section>

              <section>
                <strong>4. Cómo llenar /report</strong>
                <p>
                  Usa el comando con el resultado correspondiente, adjunta la captura del marcador y
                  completa el score cuando aplique. Si hay líder marcado con Discord ID, esa cuenta
                  es la autorizada para reportar.
                </p>
              </section>

              <section>
                <strong>5. Importación masiva</strong>
                <p>
                  Puedes subir `.xlsx`, `.xls` o `.csv`. La plantilla acepta encabezados amigables
                  como nombre del torneo, nombre del equipo, participante, Discord ID y capitán.
                </p>
              </section>

              <section>
                <strong>6. Login con Discord</strong>
                <p>
                  El login requiere `CLIENT_ID` y `DISCORD_CLIENT_SECRET`. Si quieres un redirect
                  personalizado, usa `CRM_DISCORD_REDIRECT_URI`. La sesión actual está pensada para uso
                  local del CRM.
                </p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

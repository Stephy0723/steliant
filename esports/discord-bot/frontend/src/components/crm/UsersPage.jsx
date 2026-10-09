import { useEffect, useState } from 'react';
import styles from './Users.module.css';

async function fetchUsers() {
  const res = await fetch('/users');
  if (!res.ok) throw new Error('Error al cargar usuarios');
  return res.json();
}

function formatDate(iso) {
  if (!iso) return 'N/D';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function sourceLabel(user) {
  return user.source?.type === 'discord-bot' ? 'Bot' : 'Web';
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Usuarios</h2>
        </header>
        <p style={{ padding: '1rem', opacity: 0.6 }}>Cargando usuarios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Usuarios</h2>
        </header>
        <p style={{ padding: '1rem', color: 'var(--accent-red)' }}>{error}</p>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h2>Usuarios</h2>
          <p>Cuentas de GlitchGang sincronizadas desde la web y desde el bot de Discord.</p>
        </header>
        <p style={{ padding: '1rem', opacity: 0.6 }}>
          Aún no hay usuarios sincronizados. Esta lista se llena sola cuando alguien se registra en
          la web o vincula su cuenta con <code>/vincular</code> en Discord.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2>Usuarios</h2>
        <p>Cuentas de GlitchGang sincronizadas desde la web y desde el bot de Discord.</p>
      </header>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Email</th>
              <th>Discord</th>
              <th>Origen</th>
              <th>Registrado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className={styles.userName}>{user.nick}</td>
                <td>{user.email || <span className={styles.muted}>N/D</span>}</td>
                <td>
                  {user.discord?.username ? (
                    `@${user.discord.username}`
                  ) : (
                    <span className={styles.muted}>Sin vincular</span>
                  )}
                </td>
                <td>
                  <span className={`${styles.sourceBadge} ${user.source?.type === 'discord-bot' ? styles.sourceBot : styles.sourceWeb}`}>
                    {sourceLabel(user)}
                  </span>
                </td>
                <td>{formatDate(user.registeredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

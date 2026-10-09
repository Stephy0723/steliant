import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { LogOut } from 'lucide-react';
import styles from './Sidebar.module.css';

export default function Sidebar({ navItems, activeTab, onNavigate, activeTournament, auth }) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGlitching(true), 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <aside className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.logo}>
          <img src="/GG.png" alt="" />
        </div>
        <div className={styles.brandText}>
          <span
            className={clsx(styles.brandName, 'gg-glitch', glitching && 'fire')}
            data-text="GlitchGang"
            onAnimationEnd={() => setGlitching(false)}
          >
            GlitchGang
          </span>
          <span className={styles.brandSub}>Control Center</span>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <span className={styles.navLabel}>Menu</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={clsx(styles.navItem, isActive && styles.navItemActive)}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={styles.bottom}>
        {activeTournament ? (
          <div className={styles.tournamentPill}>
            <span className={styles.liveDot} />
            <span className={styles.tournamentName}>{activeTournament.name}</span>
          </div>
        ) : null}

        {auth?.user ? (
          <div className={styles.userBlock}>
            <img className={styles.avatar} src={auth.user.avatarUrl} alt="" />
            <div className={styles.userInfo}>
              <span className={styles.userName}>{auth.user.globalName || auth.user.username}</span>
              <span className={styles.userHandle}>@{auth.user.username}</span>
            </div>
            <a href={auth.logoutUrl} className={styles.logoutBtn} title="Cerrar sesión">
              <LogOut size={16} />
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

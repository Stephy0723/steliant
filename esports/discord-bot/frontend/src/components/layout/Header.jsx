import { Command, LogIn, MoonStar, Search, SunMedium } from 'lucide-react';
import styles from './Header.module.css';

export default function Header({ searchTerm, onSearchChange, theme, onToggleTheme, auth, system, onOpenPalette, activeTab, navItems }) {
  const loggedUser = auth?.user;
  const currentPage = navItems?.find((n) => n.id === activeTab);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {currentPage ? (
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbLabel}>{currentPage.label}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.searchBox} onClick={onOpenPalette}>
        <Search size={16} />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar..."
          aria-label="Buscar"
          onClick={(e) => e.stopPropagation()}
        />
        <kbd className={styles.kbd}>
          <Command size={10} />K
        </kbd>
      </div>

      <div className={styles.actions}>
        <button className={styles.iconBtn} type="button" onClick={onToggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
          {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
        </button>

        {!loggedUser && (
          <a className={styles.loginBtn} href={auth?.configured ? auth.loginUrl : '#'}>
            <LogIn size={15} />
            <span>Discord</span>
          </a>
        )}
      </div>
    </header>
  );
}

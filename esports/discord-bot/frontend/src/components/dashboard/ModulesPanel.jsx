import styles from './ModulesPanel.module.css';

export default function ModulesPanel({ sectionLabel, title, description, cards }) {
  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <span className={styles.sectionLabel}>{sectionLabel}</span>
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
      </div>

      <div className={styles.grid}>
        {cards.length ? cards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.iconWrap}>
                  <Icon size={18} />
                </div>
                <span className={styles.eyebrow}>{card.eyebrow}</span>
              </div>

              <h4>{card.title}</h4>
              <p>{card.description}</p>

              <div className={styles.commandRow}>
                {card.commands.map((command) => (
                  <span key={command} className={styles.commandPill}>
                    {command}
                  </span>
                ))}
              </div>

              <ul className={styles.bullets}>
                {card.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          );
        }) : <div className={styles.emptyState}>No hay tarjetas visibles para esta búsqueda en esta sección.</div>}
      </div>
    </div>
  );
}

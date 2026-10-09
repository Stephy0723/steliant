import { useEffect, useRef } from 'react';
import styles from './MetricCard.module.css';

export default function MetricCard({ label, value, accent, icon: Icon, delay = 0 }) {
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    if (!ref.current || counted.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          animateValue(ref.current, value);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  function animateValue(el, target) {
    const duration = 800;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  return (
    <article className={`${styles.card} ${styles[accent] || ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={styles.iconWrap}>
        <Icon size={20} />
      </div>
      <div className={styles.body}>
        <strong ref={ref}>0</strong>
        <span>{label}</span>
      </div>
      <div className={styles.glow} aria-hidden="true" />
    </article>
  );
}

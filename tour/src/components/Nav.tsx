"use client";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { useLang, money } from "@/lib/i18n";
import { CITIES, IMG, ROUTES } from "@/lib/content";
import { Arrow, Img } from "./ui";
import { TLink } from "@/lib/transition";
import { isDark, lenis, prefersReduced, THEME_EVENT } from "@/lib/motion";

export const LINKS = [
  ["/destinos", "dest"], ["/horarios", "hours"], ["/vip", "vip"], ["/tracking", "track"],
  ["/paqueteria", "parcel"], ["/cafeteria", "cafe"], ["/promociones", "promo"],
] as const;
type VT = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

export function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="42" height="42" rx="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 28c6-12 18-12 24 0" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13 31h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx="22" cy="17" r="3" fill="var(--accent-2)" />
    </svg>
  );
}

export default function Nav() {
  const { t, lang, setLang } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const [clock, setClock] = useState("SDQ");
  const megaT = useRef(0);
  const links = useRef<HTMLElement>(null), ink = useRef<HTMLSpanElement>(null);
  const inkTo = (el: HTMLElement) => { const i = ink.current; if (!i) return; i.style.width = el.offsetWidth + "px"; i.style.transform = `translateX(${el.offsetLeft}px)`; i.style.opacity = "1"; };
  const placeInk = () => { const on = links.current?.querySelector<HTMLElement>(".is-active"); if (on) inkTo(on); else if (ink.current) ink.current.style.opacity = "0"; };
  useEffect(() => { const tick = () => setClock("SDQ · " + new Date().toTimeString().slice(0, 5)); tick(); const id = window.setInterval(tick, 10000); return () => clearInterval(id); }, []);
  useEffect(() => { setMega(false); document.body.classList.toggle("at-home", pathname === "/" || pathname === ""); requestAnimationFrame(placeInk); }, [pathname]);
  useEffect(() => {
    if (!mega || prefersReduced()) return;
    gsap.fromTo(".mega-card", { y: 40, opacity: 0, rotateX: -30 }, { y: 0, opacity: 1, rotateX: 0, stagger: 0.06, duration: 0.8, ease: "expo.out" });
    gsap.fromTo(".mega-routes > *", { x: 20, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.04, duration: 0.6, ease: "expo.out", delay: 0.15 });
  }, [mega]);
  const seg = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const move = () => {
      const on = seg.current?.querySelector<HTMLElement>(`[data-lang="${lang}"]`);
      if (on && pill.current) { pill.current.style.width = on.offsetWidth + "px"; pill.current.style.transform = `translateX(${on.offsetLeft - 3}px)`; }
    };
    move(); addEventListener("resize", move); document.fonts?.ready.then(move);
    return () => removeEventListener("resize", move);
  }, [lang]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    if (open) {
      lenis?.stop();
      if (!prefersReduced()) gsap.fromTo(".menu li", { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.9, ease: "expo.out", delay: 0.25 });
    } else lenis?.start();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [open]);

  const toggleTheme = (e: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement, next = isDark() ? "light" : "dark";
    const swap = () => { root.dataset.theme = next; try { localStorage.setItem("ts-theme", next); } catch { /* */ } dispatchEvent(new Event(THEME_EVENT)); };
    const doc = document as VT;
    if (!doc.startViewTransition || prefersReduced()) { swap(); return; }
    const r = e.currentTarget.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.startViewTransition(swap).ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 850, easing: "cubic-bezier(.19,1,.22,1)", pseudoElement: "::view-transition-new(root)" });
    }).catch(() => {});
  };
  const active = (href: string) => (pathname.startsWith(href) ? "is-active" : "");

  return (
    <>
      <div className="ticker" aria-hidden="true"><div className="ticker-track">{[0, 1].map((dup) => ROUTES.map((r, i) => (
        <span key={dup + "-" + i}><b>{t.x.ticker[0]}</b> {CITIES[r.from].name} → {CITIES[r.to].name} · {r.times[3]} · {t.x.ticker[1]} {String((i % 6) + 1).padStart(2, "0")} · <em className={i % 3 ? "" : "brd"}>{i % 3 ? t.x.ticker[2] : t.x.ticker[3]}</em></span>
      )))}</div></div>
      <header className="nav2" id="nav" onMouseLeave={() => { megaT.current = window.setTimeout(() => setMega(false), 220); }}>
        <div className="nav2-in">
          <TLink href="/" className="brand" label="Tour Steliant" aria-label="Tour Steliant">
            <Logo /><span><b>Tour Steliant</b><small>{clock}</small></span>
          </TLink>
          <nav className="nav2-links i18n" ref={links} aria-label="Principal" onMouseLeave={placeInk}>
            <button type="button" className="nl" aria-expanded={mega} onMouseEnter={(e) => { clearTimeout(megaT.current); setMega(true); inkTo(e.currentTarget); }} onClick={() => setMega(!mega)}>{t.x.explore}<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 4l4 4 4-4" /></svg></button>
            {LINKS.slice(0, 4).map(([h, k]) => <TLink key={h} href={h} label={t.nav[k]} className={`nl ${active(h)}`} onMouseEnter={(e) => inkTo(e.currentTarget)}>{t.nav[k]}</TLink>)}
            <span className="nl-ink" ref={ink} aria-hidden="true" />
          </nav>
          <div className="nav-tools">
            <div className="seg" ref={seg} role="group" aria-label="Idioma / Language">
              <span className="pill" ref={pill} />
              {(["es", "en"] as const).map((l) => <button key={l} type="button" data-lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
            </div>
            <button type="button" className="icon-btn theme-btn" onClick={toggleTheme} aria-label={t.nav.theme}>
              <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></svg>
              <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>
            </button>
            <TLink href="/reservas" label={t.nav.book} className="btn btn-accent nav-cta magnetic"><span className="i18n">{t.nav.book}</span><Arrow /></TLink>
            <button type="button" className="icon-btn burger" aria-label={t.nav.menu} aria-expanded={open} onClick={() => setOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 8h16M4 16h10" /></svg>
            </button>
          </div>
        </div>
        <div className={`mega${mega ? " is-open" : ""}`} onMouseEnter={() => clearTimeout(megaT.current)}>
          <div className="mega-in">
            <div className="mega-cards">{t.x.mega.map(([h, n, d, img]) => (
              <TLink key={h} href={h} label={n} className="mega-card" onNavigate={() => setMega(false)}><span className="mc-img"><Img src={IMG[img as keyof typeof IMG]} /></span><b>{n}</b><small>{d}</small></TLink>
            ))}</div>
            <div className="mega-routes"><p className="eyebrow">{t.x.megaRoutes}</p>{ROUTES.slice(0, 4).map((r) => (
              <TLink key={r.from + r.to} href={`/reservas?from=${r.from}&to=${r.to}`} label={t.nav.book} onNavigate={() => setMega(false)}><span>{r.from.toUpperCase()} → {r.to.toUpperCase()}</span><b>{CITIES[r.to].name}</b><em>{money(r.price)}</em></TLink>
            ))}</div>
          </div>
        </div>
      </header>
      <nav className={`menu${open ? " is-open" : ""}`} aria-label={t.nav.menu} aria-hidden={!open}>
        <button type="button" className="icon-btn menu-close" aria-label={t.nav.close} onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <ol>
          <li><TLink href="/" label={t.nav.home} onNavigate={() => setOpen(false)}><span>00</span>{t.nav.home}</TLink></li>
          {LINKS.map(([h, k], i) => <li key={h}><TLink href={h} label={t.nav[k]} onNavigate={() => setOpen(false)} className={active(h)}><span>0{i + 1}</span>{t.nav[k]}</TLink></li>)}
          <li><TLink href="/reservas" label={t.nav.book} onNavigate={() => setOpen(false)} className="menu-book"><span>→</span>{t.nav.book}</TLink></li>
        </ol>
      </nav>
    </>
  );
}

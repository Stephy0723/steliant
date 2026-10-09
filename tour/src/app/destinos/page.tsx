"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { useLang, money } from "@/lib/i18n";
import { CITIES, CITY_ORDER, IMG, ROUTES, type CityId, type Tag } from "@/lib/content";
import { TLink } from "@/lib/transition";
import { usePageMotion } from "@/lib/usePageMotion";
import { lenis, prefersReduced } from "@/lib/motion";
import { Arrow, Img, PageHeader } from "@/components/ui";

gsap.registerPlugin(Flip);
const FILTERS: ("all" | Tag)[] = ["all", "beach", "capital", "north", "city", "mountain"];

export default function Destinos() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | Tag>("all");
  const [open, setOpen] = useState<CityId | null>(null);
  const flipState = useRef<Flip.FlipState | null>(null);

  usePageMotion(page, [lang], () => {
    if (prefersReduced()) return;
    gsap.from(".dg-card", { y: 80, opacity: 0, stagger: 0.06, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".dg", start: "top 85%" } });
  });

  const choose = (f: "all" | Tag) => {
    if (f === filter) return;
    if (grid.current && !prefersReduced()) flipState.current = Flip.getState(grid.current.querySelectorAll(".dg-card"));
    setFilter(f);
  };
  useEffect(() => {
    if (!flipState.current || !grid.current) return;
    Flip.from(flipState.current, { duration: 0.8, ease: "expo.inOut", scale: true, absolute: true, stagger: 0.03,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.2 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.8, duration: 0.4 }) });
    flipState.current = null;
  }, [filter]);

  useEffect(() => {
    if (open) { lenis?.stop(); if (!prefersReduced()) gsap.fromTo(".drawer-in > *", { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.8, ease: "expo.out", delay: 0.3 }); }
    else lenis?.start();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    addEventListener("keydown", esc); return () => removeEventListener("keydown", esc);
  }, [open]);

  const list = CITY_ORDER.filter((c) => filter === "all" || CITIES[c].tag === filter);
  const c = open ? CITIES[open] : null;
  const routes = open ? ROUTES.filter((r) => r.to === open || r.from === open) : [];

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.dest.eyebrow} title={t.pages.dest.title} lede={t.pages.dest.lede} image={IMG.aerial} />
      <section className="sec">
        <div className="wrap">
          <div className="filters rv" role="group" aria-label={t.dest.filter}>
            {FILTERS.map((f) => (
              <button key={f} type="button" className={`fchip${filter === f ? " on" : ""}`} aria-pressed={filter === f} onClick={() => choose(f)}>
                {t.tags[f]}<sup>{f === "all" ? CITY_ORDER.length : CITY_ORDER.filter((k) => CITIES[k].tag === f).length}</sup>
              </button>
            ))}
          </div>
          <div className="dg" ref={grid}>
            {list.map((k, i) => {
              const city = CITIES[k];
              return (
                <button type="button" key={k} data-flip-id={k} className={`dg-card${i % 5 === 0 ? " wide" : ""}`} onClick={() => setOpen(k)} data-cursor={t.dest.details}>
                  <span className="dg-img"><Img src={city.img} alt={city.name} /></span>
                  <span className="dg-top"><span className="chip">{t.tags[city.tag]}</span><span className="dg-rate">★ {city.rating}</span></span>
                  <span className="dg-body">
                    <b>{city.name}</b>
                    <small>{t.cityDesc[k]}</small>
                    <span className="dg-meta"><span>{city.duration}</span><span>{city.trips} {t.common.trips}</span><span>{t.dest.from} <strong>{money(city.price)}</strong></span></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className={`drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="drawer-bg" onClick={() => setOpen(null)} />
        <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label={c?.name}>
          {c && open && (
            <>
              <div className="drawer-img"><Img src={c.img.replace("w=1200", "w=1600")} alt={c.name} /><button type="button" className="icon-btn drawer-close" onClick={() => setOpen(null)} aria-label={t.dest.close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
              <div className="drawer-in">
                <span className="chip">{t.tags[c.tag]}</span>
                <h2>{c.name}</h2>
                <p className="muted">{c.region} · {c.lat.toFixed(3)}°N {Math.abs(c.lng).toFixed(3)}°W</p>
                <p>{t.cityDesc[open]}</p>
                <div className="drawer-stats"><div><small>{t.dest.from}</small><b>{money(c.price)}</b></div><div><small>⏱</small><b>{c.duration}</b></div><div><small>{t.dest.rating}</small><b>★ {c.rating}</b></div></div>
                {routes.map((r) => (
                  <div className="drawer-route" key={r.from + r.to}>
                    <span>{CITIES[r.from].name} → {CITIES[r.to].name}</span>
                    <span className="times">{r.times.slice(0, 6).map((tm) => <i key={tm}>{tm}</i>)}</span>
                  </div>
                ))}
                <div className="drawer-cta">
                  <TLink href={`/reservas?from=${routes[0]?.from || "sdq"}&to=${routes[0]?.to || open}`} label={t.nav.book} className="btn btn-accent" onNavigate={() => setOpen(null)}><span>{t.common.book}</span><Arrow /></TLink>
                  <TLink href="/horarios" label={t.nav.hours} className="btn btn-ghost" onNavigate={() => setOpen(null)}><span>{t.common.seeHours}</span></TLink>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

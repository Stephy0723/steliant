"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useLang, money } from "@/lib/i18n";
import { CITIES, IMG, ROUTES } from "@/lib/content";
import { TLink } from "@/lib/transition";
import { usePageMotion } from "@/lib/usePageMotion";
import { prefersReduced } from "@/lib/motion";
import { PageHeader } from "@/components/ui";
import Flap from "@/components/Flap";

const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
// Deterministic seat count per departure (demo data).
const seatsFor = (ri: number, ti: number) => [3, 14, 0, 27, 8, 19, 2, 33, 11, 0, 22, 6, 17, 29][(ri * 5 + ti * 3) % 14];

export default function Horarios() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  const [ri, setRi] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("to");
    const idx = ROUTES.findIndex((r) => r.to === q); if (idx >= 0) setRi(idx);
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  usePageMotion(page, [lang]);
  useEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(".brow", { opacity: 0, x: -20 }, { opacity: 1, x: 0, stagger: 0.04, duration: 0.6, ease: "expo.out" });
  }, [ri]);

  const r = ROUTES[ri];
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const clock = now ? now.toTimeString().slice(0, 8) : "--:--:--";

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.hours.eyebrow} title={t.pages.hours.title} lede={t.pages.hours.lede} image={IMG.busRoad} />
      <section className="sec">
        <div className="wrap hours">
          <aside className="routes-list rv-group" aria-label={t.hours.choose}>
            {ROUTES.map((x, i) => (
              <button key={x.from + x.to} type="button" className={`rl${i === ri ? " on" : ""}`} onClick={() => setRi(i)} aria-pressed={i === ri}>
                <span className="rl-codes">{x.from.toUpperCase()} <i /> {x.to.toUpperCase()}</span>
                <b>{CITIES[x.from].name} → {CITIES[x.to].name}</b>
                <small>{x.duration} · {x.times.length} {t.common.trips} · {money(x.price)}</small>
              </button>
            ))}
          </aside>
          <div className="dboard rv">
            <div className="db-head">
              <div><small>{t.hours.route}</small><Flap text={`${CITIES[r.from].name} → ${CITIES[r.to].name}`} len={28} className="big" /></div>
              <div className="db-clock"><small>{t.hours.now}</small><span>{clock}</span></div>
            </div>
            <div className="db-cols"><span>{t.hours.depart}</span><span>{t.hours.status}</span><span>{t.hours.seats}</span><span>{t.hours.fare}</span><span /></div>
            <div className="db-rows">
              {r.times.map((tm, ti) => {
                const seats = seatsFor(ri, ti), diff = mins(tm) - nowMin;
                const status = diff < 0 ? t.hours.departed : diff <= 20 ? t.hours.boarding : seats === 0 ? t.hours.full : seats < 6 ? t.hours.few : t.hours.ok;
                const cls = diff < 0 ? "gone" : seats === 0 ? "full" : diff <= 20 ? "board" : seats < 6 ? "few" : "ok";
                const canBook = diff >= 0 && seats > 0;
                return (
                  <div key={tm} className={`brow ${cls}`}>
                    <Flap text={tm} len={5} delay={ti * 40} />
                    <Flap text={status} len={10} className="st" delay={ti * 40 + 120} />
                    <span className="seats"><i style={{ width: `${Math.min(100, (seats / 45) * 100)}%` }} />{seats}/45</span>
                    <span className="fare">{money(r.price)}{r.vip && <em>VIP</em>}</span>
                    {canBook ? <TLink href={`/reservas?from=${r.from}&to=${r.to}&time=${tm}`} label={t.nav.book} className="btn btn-accent bbtn">{t.common.book}</TLink> : <span className="bbtn-off">—</span>}
                  </div>
                );
              })}
            </div>
            <p className="db-foot">{r.vip ? t.hours.classVip : t.hours.classStd} · {r.duration}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

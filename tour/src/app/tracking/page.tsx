"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { useLang } from "@/lib/i18n";
import { CITIES, IMG } from "@/lib/content";
import { usePageMotion } from "@/lib/usePageMotion";
import { copyText, isDark, prefersReduced, THEME_EVENT, toast } from "@/lib/motion";
import { PageHeader } from "@/components/ui";
import { pos, type Bus } from "@/lib/bus";

const TrackMap = dynamic(() => import("@/components/TrackMap"), { ssr: false, loading: () => <div className="tmap tmap-loading" /> });
const START: Bus[] = [
  { id: "TS-2048", from: "sdq", to: "puj", p: 0.36, speed: 0.0022 },
  { id: "TS-3150", from: "sdq", to: "sti", p: 0.62, speed: 0.003 },
  { id: "TS-4417", from: "sti", to: "pop", p: 0.18, speed: 0.004 },
  { id: "TS-5203", from: "sdq", to: "sam", p: 0.48, speed: 0.0025 },
  { id: "TS-6081", from: "sdq", to: "rom", p: 0.8, speed: 0.0035 },
];

export default function Tracking() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  const [buses, setBuses] = useState(START);
  const [active, setActive] = useState(START[0].id);
  const [dark, setDark] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [q, setQ] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    setDark(isDark()); setNow(Date.now());
    const on = () => setDark(isDark()); addEventListener(THEME_EVENT, on);
    const id = window.setInterval(() => { setBuses((bs) => bs.map((b) => ({ ...b, p: b.p + b.speed > 1 ? 0 : b.p + b.speed }))); setNow(Date.now()); }, 1000);
    return () => { removeEventListener(THEME_EVENT, on); clearInterval(id); };
  }, []);
  usePageMotion(page, [lang], () => {
    if (prefersReduced()) return;
    gsap.from(".bus-card", { y: 30, opacity: 0, stagger: 0.07, duration: 1, ease: "expo.out", delay: 0.6 });
  });

  const pick = (id: string) => { setActive(id); const b = buses.find((x) => x.id === id); if (b) setFocus(pos(b)); };
  const search = (e: FormEvent) => { e.preventDefault(); const id = q.trim().toUpperCase(); if (buses.some((b) => b.id === id)) pick(id); else toast(t.track.notFound); };
  const eta = (b: Bus) => { if (!now) return "--:--"; const mins = Math.round(((1 - b.p) / b.speed) / 60 * 6); return new Date(now + mins * 60000).toTimeString().slice(0, 5); };

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.track.eyebrow} title={t.pages.track.title} lede={t.pages.track.lede} image={IMG.sdNight} />
      <section className="sec">
        <div className="wrap track">
          <div className="tmap-wrap rv">
            <TrackMap buses={buses} active={active} dark={dark} onPick={pick} focus={focus} />
            <div className="tlegend"><span><i className="lg-bus" />{t.track.legendBus}</span><span><i className="lg-route" />{t.track.legendRoute}</span><span><i className="lg-stop" />{t.track.legendStop}</span><span className="live-dot">{t.track.live}</span></div>
          </div>
          <aside className="tside">
            <form className="tsearch" onSubmit={search}>
              <label htmlFor="t-code" className="sf-label">{t.track.search}</label>
              <div><input id="t-code" value={q} onChange={(e) => setQ(e.target.value)} placeholder="TS-2048" /><button type="submit" className="btn btn-accent">{t.track.find}</button></div>
            </form>
            <p className="eyebrow">{t.track.buses}</p>
            {buses.map((b) => (
              <button type="button" key={b.id} className={`bus-card${b.id === active ? " on" : ""}`} onClick={() => pick(b.id)}>
                <span className="bc-top"><b>{b.id}</b><span className="live-dot">{Math.round(78 + Math.sin(b.p * 20) * 9)} km/h</span></span>
                <span className="bc-route">{CITIES[b.from].name} → {CITIES[b.to].name}</span>
                <span className="bc-bar"><i style={{ width: `${b.p * 100}%` }} /><em style={{ left: `${b.p * 100}%` }} /></span>
                <span className="bc-meta"><span>{t.track.progress} {Math.round(b.p * 100)}%</span><span>{t.track.eta} {eta(b)}</span></span>
              </button>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => copyText(`https://toursteliant.com/t/${active}`, t.track.shared)}>{t.track.share}</button>
          </aside>
        </div>
      </section>
    </div>
  );
}

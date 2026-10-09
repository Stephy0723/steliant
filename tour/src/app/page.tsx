"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang, money } from "@/lib/i18n";
import { CITIES, CITY_ORDER, IMG, ROUTES, type CityId } from "@/lib/content";
import { TLink } from "@/lib/transition";
import { usePageMotion } from "@/lib/usePageMotion";
import { prefersReduced } from "@/lib/motion";
import { Arrow, Eyebrow, Img, Split } from "@/components/ui";
import Cine from "@/components/Cine";
import TripCard from "@/components/TripCard";
import { firstLoad } from "@/components/Shell";

const SERV_IMG: Record<string, string> = { vip: IMG.interior, parcel: IMG.parcelHand, cafe: IMG.coffee, track: IMG.sdNight };
const SERV_HREF: Record<string, string> = { vip: "/vip", parcel: "/paqueteria", cafe: "/cafeteria", track: "/tracking" };

/* Equirectangular projection of the island's bounding box onto the SVG. */
const BOX = { minLng: -71.2, maxLng: -68.2, minLat: 18.2, maxLat: 20.0 };
const proj = (lat: number, lng: number) => ({ x: ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * 1000, y: ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * 600 });

export default function Home() {
  const { t, lang } = useLang();
  const router = useRouter();
  const page = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ from: "sdq" as CityId, to: "puj" as CityId, date: "", pax: 1 });

  useEffect(() => { setForm((f) => ({ ...f, date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) })); }, []);

  usePageMotion(page, [lang], (el) => {
    if (prefersReduced()) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const track = el.querySelector<HTMLElement>(".dtrack")!;
      const dist = () => track.scrollWidth - innerWidth + 32;
      gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: ".dpin", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, onUpdate: (s) => gsap.set(".dprog i", { scaleX: s.progress }) } });
      gsap.utils.toArray<HTMLElement>(".dcard img").forEach((img) => gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: "none", scrollTrigger: { trigger: ".dpin", start: "top top", end: () => "+=" + dist(), scrub: true } }));
    });
    gsap.from(".rmap .route", { strokeDashoffset: 1200, duration: 2.2, stagger: 0.12, ease: "power3.inOut", scrollTrigger: { trigger: ".rmap", start: "top 75%" } });
    gsap.from(".rmap .pin", { scale: 0, transformOrigin: "0px 0px", duration: 0.8, stagger: 0.08, ease: "back.out(2.5)", scrollTrigger: { trigger: ".rmap", start: "top 70%" } });
    gsap.from(".serv-panel", { clipPath: "inset(100% 0 0 0 round 18px)", stagger: 0.1, duration: 1.4, ease: "expo.inOut", scrollTrigger: { trigger: ".serv", start: "top 78%" } });
    el.querySelectorAll<HTMLElement>(".mo").forEach((f) => gsap.fromTo(f, { yPercent: +(f.dataset.speed || 0) }, { yPercent: -(f.dataset.speed || 0), ease: "none", scrollTrigger: { trigger: ".mosaic", start: "top bottom", end: "bottom top", scrub: true } }));
    gsap.from(".mo", { clipPath: "inset(50% 50% 50% 50% round 20px)", stagger: 0.06, duration: 1.4, ease: "expo.inOut", scrollTrigger: { trigger: ".mosaic", start: "top 75%" } });
    gsap.fromTo(".mo-text span:first-child", { xPercent: 30 }, { xPercent: -20, ease: "none", scrollTrigger: { trigger: ".mosaic", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.fromTo(".mo-text span:last-child", { xPercent: -30 }, { xPercent: 20, ease: "none", scrollTrigger: { trigger: ".mosaic", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from(".dcard", { y: 140, rotate: (i: number) => (i % 2 ? 4 : -4), opacity: 0, stagger: 0.07, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: ".dpin", start: "top 75%" } });
    gsap.from(".cta-ticket", { rotate: -12, y: 120, opacity: 0, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: ".cta-band", start: "top 70%" } });
    gsap.fromTo(".cta-band .cta-bg img", { yPercent: -12 }, { yPercent: 12, ease: "none", scrollTrigger: { trigger: ".cta-band", scrub: true } });
    const skew = gsap.quickTo(".marquee-track", "skewX", { duration: 0.5, ease: "power3" });
    ScrollTrigger.create({ onUpdate: (s) => skew(gsap.utils.clamp(-10, 10, s.getVelocity() / -250)) });
    return () => mm.revert();
  });

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ from: form.from, to: form.to, date: form.date, pax: String(form.pax) });
    router.push(`/reservas/?${q.toString()}`);
  };
  const sdq = proj(CITIES.sdq.lat, CITIES.sdq.lng);

  return (
    <div ref={page} className="i18n">
      <Cine delay={firstLoad.pending ? 1.7 : 0.6} />

      <div className="wrap search-wrap">
        <TripCard />
        <form className="search" onSubmit={search}>
          <div className="sf"><label htmlFor="s-from">{t.common.from}</label>
            <select id="s-from" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value as CityId })}>{CITY_ORDER.map((c) => <option key={c} value={c}>{CITIES[c].name}</option>)}</select></div>
          <button type="button" className="swap" aria-label="⇄" onClick={() => setForm({ ...form, from: form.to, to: form.from })}>⇄</button>
          <div className="sf"><label htmlFor="s-to">{t.common.to}</label>
            <select id="s-to" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value as CityId })}>{CITY_ORDER.map((c) => <option key={c} value={c}>{CITIES[c].name}</option>)}</select></div>
          <div className="sf"><label htmlFor="s-date">{t.common.date}</label><input id="s-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="sf"><span className="sf-label">{t.common.pax}</span>
            <div className="stepper"><button type="button" onClick={() => setForm({ ...form, pax: Math.max(1, form.pax - 1) })} aria-label="−">−</button><b>{form.pax}</b><button type="button" onClick={() => setForm({ ...form, pax: Math.min(6, form.pax + 1) })} aria-label="+">+</button></div></div>
          <button type="submit" className="btn btn-accent magnetic search-btn"><span>{t.common.search}</span><Arrow /></button>
        </form>
      </div>

      <div className="marquee" aria-hidden="true"><div className="marquee-track">
        {[...CITY_ORDER, ...CITY_ORDER, ...CITY_ORDER, ...CITY_ORDER].map((c, i) => <span key={i}><em>{c.toUpperCase()}</em>{CITIES[c].name}</span>)}
      </div></div>

      <section className="dpin">
        <div className="wrap sec-head">
          <Eyebrow>{t.home.destEyebrow}</Eyebrow>
          <div className="sec-title"><Split lines={t.home.destTitle} /></div>
        </div>
        <div className="dtrack">
          {CITY_ORDER.map((c, i) => {
            const city = CITIES[c];
            return (
              <TLink key={c} href="/destinos" label={city.name} className="dcard" data-cursor={t.nav.dest}>
                <span className="dcard-img"><Img src={city.img} alt={city.name} /></span>
                <span className="dcard-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="dcard-body">
                  <span className="chip">{t.tags[city.tag]}</span>
                  <b>{city.name}</b>
                  <small>{city.region} · {city.duration}</small>
                  <span className="dcard-price">{t.dest.from} <strong>{money(city.price)}</strong></span>
                </span>
              </TLink>
            );
          })}
          <div className="dcard-end"><p>{t.home.destAll}</p><TLink href="/destinos" label={t.nav.dest} className="btn btn-accent magnetic"><span>{t.nav.dest}</span><Arrow /></TLink></div>
        </div>
        <div className="wrap dprog"><i /></div>
      </section>

      <section className="sec serv">
        <div className="wrap sec-head">
          <Eyebrow>{t.home.servEyebrow}</Eyebrow>
          <div className="sec-title"><Split lines={t.home.servTitle} /></div>
        </div>
        <div className="wrap serv-row">
          {t.home.serv.map((s, i) => (
            <TLink key={s.k} href={SERV_HREF[s.k]} label={s.t} className="serv-panel" data-cursor={s.t}>
              <span className="serv-img"><Img src={SERV_IMG[s.k]} alt="" /></span>
              <span className="serv-num">0{i + 1}</span>
              <span className="serv-body"><b>{s.t}</b><small>{s.d}</small><Arrow /></span>
            </TLink>
          ))}
        </div>
      </section>

      <section className="mosaic" aria-hidden="true">
        <div className="mo-grid">
          {(["palms", "waterfall", "sdAerial", "group", "aerial2", "ter", "cabin"] as const).map((k, i) => (
            <figure key={k} className={`mo m${i}`} data-speed={[-14, 10, -6, 16, -10, 8, -18][i]}><Img src={IMG[k]} /></figure>
          ))}
        </div>
        <h2 className="mo-text"><span>{t.x.mosaic[0]}</span><span>{t.x.mosaic[1]}</span></h2>
      </section>

      <section className="sec routes">
        <div className="wrap routes-grid">
          <div>
            <Eyebrow>{t.home.mapEyebrow}</Eyebrow>
            <div className="sec-title"><Split lines={t.home.mapTitle} /></div>
            <p className="muted rv">{t.home.mapNote}</p>
            <div className="stats rv-group">
              {t.home.stats.map((s) => <div key={s.l}><strong data-count={s.v} data-suffix={s.s}>{s.v.toLocaleString("en-US")}{s.s}</strong><span>{s.l}</span></div>)}
            </div>
          </div>
          <div className="rmap-wrap">
            <svg className="rmap" viewBox="0 0 1000 600" role="img" aria-label={t.home.mapEyebrow}>
              <defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="var(--line)" /></pattern></defs>
              <rect width="1000" height="600" fill="url(#grid)" />
              {ROUTES.map((r, i) => {
                const a = proj(CITIES[r.from].lat, CITIES[r.from].lng), b = proj(CITIES[r.to].lat, CITIES[r.to].lng);
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.25;
                const dpath = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
                return (
                  <g key={r.from + r.to}>
                    <path className="route" d={dpath} strokeDasharray="1200" />
                    <circle r="5" className="bus-dot"><animateMotion dur={`${5 + i}s`} repeatCount="indefinite" path={dpath} /></circle>
                  </g>
                );
              })}
              <circle cx={sdq.x} cy={sdq.y} r="26" className="pulse" />
              {CITY_ORDER.map((c) => {
                const p = proj(CITIES[c].lat, CITIES[c].lng);
                const left = c === "pop" || c === "sti" || c === "jar";
                return (
                  <g key={c} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
                    <g className="pin">
                      <circle r={c === "sdq" ? 11 : 7} className={c === "sdq" ? "hub" : ""} />
                      <text x={left ? -16 : 16} y="5" textAnchor={left ? "end" : "start"}>{CITIES[c].name}</text>
                      <text x={left ? -16 : 16} y="24" textAnchor={left ? "end" : "start"} className="coord">{CITIES[c].lat.toFixed(2)}°N {Math.abs(CITIES[c].lng).toFixed(2)}°W</text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </section>

      <section className="sec quotes">
        <div className="wrap">
          <div className="sec-head"><Eyebrow>{t.home.quotesEyebrow}</Eyebrow><span className="sample">{t.common.sample}</span></div>
          <div className="q-grid rv-group">
            {t.home.quotes.map((q) => (
              <figure key={q.n} className="q-card" data-tilt="">
                <span className="q-mark" aria-hidden="true">“</span>
                <blockquote>{q.q}</blockquote>
                <figcaption><b>{q.n}</b><small>{q.r}</small></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-bg" aria-hidden="true"><Img src={IMG.sunset} /></div>
        <div className="wrap cta-in">
          <div>
            <Split lines={t.home.ctaTitle} />
            <p>{t.home.ctaText}</p>
            <TLink href="/reservas" label={t.nav.book} className="btn btn-accent magnetic"><span>{t.nav.book}</span><Arrow /></TLink>
          </div>
          <div className="cta-ticket" aria-hidden="true">
            <div className="tk-head"><span>TOUR STELIANT</span><span>VIP</span></div>
            <div className="tk-route"><b>SDQ</b><i /><b>PUJ</b></div>
            <div className="tk-meta"><span>07:30</span><span>{t.home.gate} 04</span><span>14A</span></div>
            <div className="tk-bar" />
          </div>
        </div>
      </section>
    </div>
  );
}

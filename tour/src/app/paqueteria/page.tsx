"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { gsap } from "gsap";
import { useLang, money } from "@/lib/i18n";
import { CITIES, CITY_ORDER, IMG, type CityId } from "@/lib/content";
import { usePageMotion } from "@/lib/usePageMotion";
import { prefersReduced, toast } from "@/lib/motion";
import { Arrow, Eyebrow, Img, PageHeader } from "@/components/ui";

const TYPE_ICON = [
  <path key="0" d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  <path key="1" d="M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9" />,
  <path key="2" d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v6M8 21h8" />,
  <path key="3" d="M12 2v20M4 6l16 12M20 6L4 18" />,
];
const TYPE_MULT = [1, 1.3, 1.6, 1.9];

export default function Paqueteria() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  const [type, setType] = useState(1);
  const [from, setFrom] = useState<CityId>("sdq");
  const [to, setTo] = useState<CityId>("sti");
  const [kg, setKg] = useState(3);
  const [tracked, setTracked] = useState(false);
  const est = Math.round((180 + kg * 35 + Math.abs(CITIES[to].lng - CITIES[from].lng) * 120) * TYPE_MULT[type] / 5) * 5;
  const hours = Math.max(3, Math.round(2 + Math.hypot(CITIES[to].lat - CITIES[from].lat, CITIES[to].lng - CITIES[from].lng) * 2.4));

  usePageMotion(page, [lang]);
  useEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(".tab-pane > *", { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.8, ease: "expo.out" });
    gsap.to(".tabs .ink", { xPercent: tab * 100, duration: 0.7, ease: "expo.inOut" });
  }, [tab]);
  useEffect(() => {
    if (!tracked || prefersReduced()) return;
    const tl = gsap.timeline();
    tl.fromTo(".tl-line i", { scaleY: 0 }, { scaleY: 0.55, duration: 1.6, ease: "power3.inOut" })
      .from(".tl-step", { x: -20, opacity: 0, stagger: 0.15, duration: 0.6, ease: "expo.out" }, 0.1);
  }, [tracked]);

  const send = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); toast(t.parcel.sent + "PQ-" + Math.floor(10000 + Math.random() * 89999)); e.currentTarget.reset(); };
  const track = (e: FormEvent) => { e.preventDefault(); setTracked(false); requestAnimationFrame(() => setTracked(true)); };

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.parcel.eyebrow} title={t.pages.parcel.title} lede={t.pages.parcel.lede} image={IMG.parcelVan} />
      <section className="sec">
        <div className="wrap parcel">
          <div className="tabs rv" role="tablist">
            <span className="ink" style={{ width: `${100 / 3}%` }} />
            {t.parcel.tabs.map((x, i) => <button key={x} type="button" role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>{x}</button>)}
          </div>
          <div className="tab-pane" key={tab}>
            {tab === 0 && (
              <div className="send-grid">
                <form className="send-form" onSubmit={send}>
                  <p className="sf-label" style={{ paddingLeft: 0 }}>{t.parcel.type}</p>
                  <div className="ptypes">{t.parcel.types.map((x, i) => (
                    <button key={x} type="button" className={`ptype${type === i ? " on" : ""}`} onClick={() => setType(i)} aria-pressed={type === i}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">{TYPE_ICON[i]}</svg>{x}
                    </button>))}</div>
                  <div className="bk-row2 two">
                    <div className="sf"><label htmlFor="pq-from">{t.common.from}</label><select id="pq-from" value={from} onChange={(e) => setFrom(e.target.value as CityId)}>{CITY_ORDER.map((c) => <option key={c} value={c}>{CITIES[c].name}</option>)}</select></div>
                    <div className="sf"><label htmlFor="pq-to">{t.common.to}</label><select id="pq-to" value={to} onChange={(e) => setTo(e.target.value as CityId)}>{CITY_ORDER.filter((c) => c !== from).map((c) => <option key={c} value={c}>{CITIES[c].name}</option>)}</select></div>
                    <div className="sf wide"><label htmlFor="pq-kg">{t.parcel.weight}: <b>{kg} kg</b></label><input id="pq-kg" type="range" min="1" max="30" value={kg} onChange={(e) => setKg(+e.target.value)} className="range" /></div>
                    <div className="sf"><label htmlFor="pq-s">{t.parcel.sender}</label><input id="pq-s" required /></div>
                    <div className="sf"><label htmlFor="pq-r">{t.parcel.receiver}</label><input id="pq-r" required /></div>
                    <div className="sf"><label htmlFor="pq-sp">{t.parcel.phone}</label><input id="pq-sp" type="tel" /></div>
                    <div className="sf"><label htmlFor="pq-c">{t.parcel.content}</label><input id="pq-c" /></div>
                  </div>
                  <button type="submit" className="btn btn-accent magnetic"><span>{t.parcel.send}</span><Arrow /></button>
                </form>
                <aside className="estimate">
                  <div className="est-img reveal-img"><Img src={type === 2 ? IMG.parcelFragile : IMG.parcelHand} /></div>
                  <p className="eyebrow">{t.parcel.estimate}</p>
                  <b className="est-price">{money(est)}</b>
                  <p className="muted">{CITIES[from].name} → {CITIES[to].name} · {kg} kg · {t.parcel.types[type]}</p>
                  <p>{t.parcel.eta}: <b>~{hours} h</b></p>
                </aside>
              </div>
            )}
            {tab === 1 && (
              <div className="track-grid">
                <form className="tsearch" onSubmit={track}>
                  <label htmlFor="pq-code" className="sf-label">{t.track.search}</label>
                  <div><input id="pq-code" defaultValue="PQ-58210" placeholder={t.parcel.trackPh} /><button type="submit" className="btn btn-accent">{t.parcel.trackBtn}</button></div>
                </form>
                {tracked && (
                  <div className="timeline">
                    <div className="tl-head"><b>PQ-58210</b><span className="chip">{t.parcel.status}</span></div>
                    <div className="tl-body">
                      <span className="tl-line"><i /></span>
                      {t.parcel.timeline.map((s, i) => <div key={s.l} className={`tl-step${i < 2 ? " done" : i === 2 ? " now" : ""}`}><span className="tl-dot" /><b>{s.l}</b><small>{s.t}</small></div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
            {tab === 2 && (
              <div className="plans">
                {t.parcel.plans.map((p, i) => (
                  <article key={p.n} className={`plan${i === 1 ? " hot" : ""}`} data-tilt="">
                    <span className="plan-n">0{i + 1}</span><h3>{p.n}</h3><p className="muted">{p.eta}</p>
                    <p className="plan-p"><b>{p.p}</b></p>
                    <ul>{p.f.map((f) => <li key={f}>{f}</li>)}</ul>
                    <button type="button" className={`btn ${i === 1 ? "btn-accent" : "btn-ghost"}`} onClick={() => { setTab(0); toast(p.n); }}><span>{t.parcel.choose}</span><Arrow /></button>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="pfeats rv-group">{t.parcel.feats.map((f, i) => <div key={f.t}><span>0{i + 1}</span><b>{f.t}</b><small>{f.d}</small></div>)}</div>
        </div>
      </section>
      <section className="parcel-band"><div className="pb-img reveal-img"><Img src={IMG.parcelHand} /></div><div className="wrap pb-copy"><Eyebrow>{t.pages.parcel.eyebrow}</Eyebrow><p>{t.pages.parcel.lede}</p></div></section>
    </div>
  );
}

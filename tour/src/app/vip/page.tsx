"use client";
import { useRef } from "react";
import { gsap } from "gsap";
import { useLang, money } from "@/lib/i18n";
import { IMG } from "@/lib/content";
import { TLink } from "@/lib/transition";
import { usePageMotion } from "@/lib/usePageMotion";
import { prefersReduced } from "@/lib/motion";
import { Arrow, Eyebrow, Img, PageHeader, Split } from "@/components/ui";

const AMEN_IMG = [IMG.interior, IMG.cabin, IMG.interior2, IMG.coffee];

export default function Vip() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  usePageMotion(page, [lang], (el) => {
    if (prefersReduced()) return;
    gsap.from(".plan", { y: 100, opacity: 0, rotateX: -18, transformOrigin: "50% 100%", stagger: 0.12, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: ".plans", start: "top 80%" } });
    gsap.from(".plan li", { x: -16, opacity: 0, stagger: 0.03, duration: 0.6, ease: "power3.out", scrollTrigger: { trigger: ".plans", start: "top 70%" } });
    // Amenities: images stack and swap as you scroll through the list (desktop).
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const imgs = el.querySelectorAll<HTMLElement>(".amen-stack figure");
      el.querySelectorAll<HTMLElement>(".amen-item").forEach((item, i) => {
        gsap.timeline({ scrollTrigger: { trigger: item, start: "top 60%", end: "bottom 60%", toggleActions: "play reverse play reverse", onToggle: (s) => item.classList.toggle("on", s.isActive) } })
          .fromTo(imgs[i], { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.9, ease: "expo.inOut" });
      });
      gsap.set(imgs[0], { clipPath: "inset(0% 0 0 0)" });
    });
    return () => mm.revert();
  });

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.vip.eyebrow} title={t.pages.vip.title} lede={t.pages.vip.lede} image={IMG.interior} />
      <section className="sec">
        <div className="wrap">
          <div className="sec-head"><Eyebrow>{t.vip.classesEyebrow}</Eyebrow><div className="sec-title"><Split lines={t.vip.classesTitle} /></div></div>
          <div className="plans">
            {t.vip.classes.map((c, i) => (
              <article key={c.n} className={`plan${i === 1 ? " hot" : ""}`} data-tilt="">
                {i === 1 && <span className="chip plan-tag">{t.vip.popular}</span>}
                <span className="plan-n">0{i + 1}</span>
                <h3>{c.n}</h3>
                <p className="plan-p"><b>{money(c.p)}</b> <small>{t.common.perTrip}</small></p>
                <ul>{c.f.map((f) => <li key={f}>{f}</li>)}</ul>
                <TLink href="/reservas" label={t.nav.book} className={`btn ${i === 1 ? "btn-accent" : "btn-ghost"}`}><span>{t.vip.pick}</span><Arrow /></TLink>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="sec amen" style={{ paddingTop: 0 }}>
        <div className="wrap amen-grid">
          <div className="amen-stack" aria-hidden="true">{AMEN_IMG.map((src, i) => <figure key={i}><Img src={src} /></figure>)}</div>
          <div>
            <div className="sec-head"><Eyebrow>{t.vip.amenEyebrow}</Eyebrow><div className="sec-title"><Split lines={t.vip.amenTitle} /></div></div>
            <div className="amen-list">
              {t.vip.amen.map((a, i) => (
                <div key={a.t} className="amen-item rv">
                  <span className="amen-n">0{i + 1}</span>
                  <div><h3>{a.t}</h3><p className="muted">{a.d}</p></div>
                  <span className="amen-thumb"><Img src={AMEN_IMG[i]} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="vip-gallery">
        <div className="vg-track rv-group">{[IMG.interior2, IMG.cabin, IMG.busRoad, IMG.heroRoad].map((src, i) => <figure key={i} className="reveal-img"><Img src={src} /></figure>)}</div>
      </section>
    </div>
  );
}

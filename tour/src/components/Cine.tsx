"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useLang, money } from "@/lib/i18n";
import { CITIES, ROUTES, type CityId } from "@/lib/content";
import { TLink } from "@/lib/transition";
import { prefersReduced } from "@/lib/motion";
import { Arrow, Eyebrow, Img, Split } from "./ui";
import Flap from "./Flap";

const SLIDES: CityId[] = ["puj", "sdq", "sam", "jar", "pop"];
const DUR = 6.5;

/** Cinematic hero: real destination photos with wipe transitions, mouse parallax, film grain and a route drawn over the image. */
export default function Cine({ delay }: { delay: number }) {
  const { t } = useLang();
  const root = useRef<HTMLElement>(null);
  const [slide, setSlide] = useState(0);
  const [dep, setDep] = useState(0);
  const cur = useRef(0);
  const bar = useRef<gsap.core.Tween | null>(null);

  const go = (n: number) => {
    const el = root.current; if (!el) return;
    const slides = el.querySelectorAll<HTMLElement>(".cs"), prev = slides[cur.current];
    const next = (n + SLIDES.length) % SLIDES.length; if (next === cur.current) return;
    const ns = slides[next]; cur.current = next; setSlide(next);
    if (prefersReduced()) { slides.forEach((s) => s.classList.toggle("on", s === ns)); return; }
    ns.classList.add("on"); ns.style.zIndex = "2"; prev.style.zIndex = "1";
    gsap.fromTo(ns, { clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)", duration: 1.4, ease: "expo.inOut", onComplete: () => { prev.classList.remove("on"); prev.style.zIndex = ""; } });
    gsap.fromTo(ns.querySelector(".cs-img"), { scale: 1.35, xPercent: 10 }, { scale: 1.08, xPercent: 0, duration: 2.2, ease: "expo.out" });
    gsap.to(prev.querySelector(".cs-img"), { xPercent: -14, duration: 1.4, ease: "expo.inOut" });
    run(next);
  };
  const run = (i: number) => {
    const bars = root.current?.querySelectorAll<HTMLElement>(".cine-bars i"); if (!bars) return;
    bars.forEach((b, k) => gsap.set(b, { scaleX: k < i ? 1 : 0 }));
    bar.current?.kill();
    bar.current = gsap.fromTo(bars[i], { scaleX: 0 }, { scaleX: 1, duration: DUR, ease: "none", onComplete: () => go(i + 1) });
  };

  useEffect(() => {
    const el = root.current!;
    const id = window.setInterval(() => setDep((d) => d + 1), 4200);
    if (prefersReduced()) return () => clearInterval(id);
    let mx = 0, my = 0;
    const move = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    addEventListener("pointermove", move, { passive: true });
    const path = el.querySelector<SVGPathElement>(".cine-route path")!, dot = el.querySelector<SVGCircleElement>(".cine-route circle")!;
    const len = path.getTotalLength(); let p = 0;
    const tick = () => {
      el.querySelectorAll<HTMLElement>(".cs.on .ph").forEach((im) => { im.style.transform = `translate(${mx * -26}px, ${my * -18}px) scale(1.06)`; });
      const copy = el.querySelector<HTMLElement>(".cine-copy"); if (copy) copy.style.translate = `${mx * 10}px ${my * 6}px`;
      p = (p + 0.0012) % 1; const pt = path.getPointAtLength(p * len); dot.setAttribute("cx", String(pt.x)); dot.setAttribute("cy", String(pt.y));
    };
    gsap.ticker.add(tick);
    const ctx = gsap.context(() => {
      gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 3, ease: "power2.inOut", delay });
      gsap.from(".cine .ch", { yPercent: 120, rotateX: -80, opacity: 0, transformOrigin: "50% 100%", stagger: 0.018, duration: 1.1, ease: "expo.out", delay });
      gsap.from(".cine .hero-in", { y: 30, opacity: 0, duration: 1.2, stagger: 0.1, ease: "expo.out", delay: delay + 0.35 });
      gsap.from(".cine-dest > *", { y: 40, opacity: 0, stagger: 0.08, duration: 1.2, ease: "expo.out", delay: delay + 0.5 });
      gsap.to(".cine-slides", { yPercent: 22, scale: 1.08, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".cine-copy", { yPercent: -30, opacity: 0, ease: "none", scrollTrigger: { trigger: el, start: "30% top", end: "bottom top", scrub: true } });
    }, el);
    const start = gsap.delayedCall(delay, () => run(0));
    return () => { clearInterval(id); removeEventListener("pointermove", move); gsap.ticker.remove(tick); start.kill(); bar.current?.kill(); ctx.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(".cd-name span", { yPercent: 110, rotate: 8, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, stagger: 0.03, duration: 1, ease: "expo.out" });
    gsap.fromTo(".cd-meta, .cd-num", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.2, ease: "expo.out" });
  }, [slide]);

  const c = CITIES[SLIDES[slide]];
  const r = ROUTES[dep % ROUTES.length];
  return (
    <section className="cine" ref={root}>
      <div className="cine-slides">
        {SLIDES.map((k, i) => <div key={k} className={`cs${i === 0 ? " on" : ""}`}><span className="cs-img"><Img src={CITIES[k].img.replace("w=1200", "w=2200")} alt={CITIES[k].name} eager={i === 0} /></span></div>)}
      </div>
      <div className="cine-shade" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <svg className="cine-route" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 760 C 260 640, 420 820, 700 690 S 1120 520, 1460 600" /><circle r="7" /></svg>
      <div className="wrap cine-copy">
        <Eyebrow className="hero-in">{t.home.eyebrow}</Eyebrow>
        <Split lines={t.home.title} as="h1" className="cine-title" />
        <p className="hero-lede hero-in">{t.home.lede}</p>
        <div className="hero-cta hero-in">
          <TLink href="/reservas" label={t.nav.book} className="btn btn-accent magnetic"><span>{t.nav.book}</span><Arrow /></TLink>
          <TLink href="/destinos" label={t.nav.dest} className="btn btn-glass magnetic"><span>{t.nav.dest}</span></TLink>
        </div>
      </div>
      <div className="cine-dest" aria-live="polite">
        <span className="cd-num">{String(slide + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}</span>
        <b className="cd-name">{[...c.name].map((ch, i) => <span key={slide + "-" + i}>{ch === " " ? " " : ch}</span>)}</b>
        <span className="cd-meta">{c.region} · {c.duration} · {t.dest.from} {money(c.price)}</span>
      </div>
      <div className="cine-bars">
        {SLIDES.map((k, i) => <button key={k} type="button" className={i === slide ? "on" : ""} onClick={() => go(i)} aria-label={CITIES[k].name}><i /><span>{CITIES[k].name}</span></button>)}
      </div>
      <div className="board hero-in" aria-live="polite">
        <div className="board-top"><span>{t.home.board}</span><span className="live-dot">LIVE</span></div>
        <div className="board-row"><Flap text={CITIES[r.to].name} len={13} className="big" /></div>
        <div className="board-meta">
          <div><small>{t.hours.depart}</small><Flap text={r.times[2]} len={5} /></div>
          <div><small>{t.home.gate}</small><Flap text={String((dep % 6) + 1).padStart(2, "0")} len={2} /></div>
          <div><small>{t.hours.status}</small><Flap text={dep % 3 === 0 ? t.home.boarding : t.home.onTime} len={9} className="ok" /></div>
        </div>
      </div>
    </section>
  );
}

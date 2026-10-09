"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useLang } from "@/lib/i18n";
import { IMG } from "@/lib/content";
import { usePageMotion } from "@/lib/usePageMotion";
import { copyText, prefersReduced, toast } from "@/lib/motion";
import { Eyebrow, Img, PageHeader, Split } from "@/components/ui";

const PIMG: Record<string, string> = { sunset: IMG.sunset, interior: IMG.interior2, group: IMG.group };

function useCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = () => { const d = new Date(); const day = d.getDay(); const add = (7 - day) % 7 || 7; const e = new Date(d); e.setDate(d.getDate() + add); e.setHours(23, 59, 59, 0); return e.getTime(); };
    const target = end();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick(); const id = window.setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return left;
}

export default function Promos() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  const left = useCountdown();
  usePageMotion(page, [lang], () => {
    if (prefersReduced()) return;
    gsap.from(".promo", { y: 120, opacity: 0, rotate: (i: number) => [-4, 3, -2][i], stagger: 0.12, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".promos", start: "top 80%" } });
    gsap.from(".promo-pct", { scale: 0.4, opacity: 0, stagger: 0.12, duration: 1.2, ease: "back.out(2)", scrollTrigger: { trigger: ".promos", start: "top 70%" } });
    gsap.from(".tier", { y: 60, opacity: 0, rotateY: -30, stagger: 0.12, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".tiers", start: "top 80%" } });
  });
  const parts = left == null ? ["--", "--", "--", "--"] : [Math.floor(left / 864e5), Math.floor(left / 36e5) % 24, Math.floor(left / 6e4) % 60, Math.floor(left / 1e3) % 60].map((n) => String(n).padStart(2, "0"));

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.promo.eyebrow} title={t.pages.promo.title} lede={t.pages.promo.lede} image={IMG.sunset}>
        <div className="countdown ph-in" aria-live="off"><small>{t.promo.ends}</small>{parts.map((p, i) => <span key={i}><b>{p}</b>{[t.promo.d, t.promo.h, t.promo.m, t.promo.s][i]}</span>)}</div>
      </PageHeader>
      <section className="sec">
        <div className="wrap promos">
          {t.promo.items.map((p) => (
            <article key={p.code} className="promo" data-tilt="">
              <span className="promo-img"><Img src={PIMG[p.img]} /></span>
              <span className="promo-pct">-{p.pct}<small>%</small></span>
              <div className="promo-body">
                <h3>{p.t}</h3><p>{p.d}</p>
                <button type="button" className="code" onClick={() => copyText(p.code, `${t.common.copied}: ${p.code}`)}><small>{t.promo.code}</small><b>{p.code}</b><span>{t.common.copy}</span></button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="sec club">
        <div className="wrap club-grid">
          <div>
            <div className="sec-head"><Eyebrow>{t.promo.clubEyebrow}</Eyebrow><div className="sec-title"><Split lines={t.promo.clubTitle} /></div></div>
            <p className="muted rv" style={{ maxWidth: "44ch" }}>{t.promo.clubText}</p>
            <button type="button" className="btn btn-accent magnetic rv" style={{ marginTop: "2rem" }} onClick={() => toast(t.promo.joined)}>{t.promo.join}</button>
          </div>
          <div className="tiers">
            {t.promo.tiers.map((x, i) => (
              <div key={x.n} className={`tier t${i}`} data-tilt=""><span className="tier-chip" /><b>{x.n}</b><small>{x.m} mi</small><span className="tier-no">•••• {4021 + i * 1117}</span></div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

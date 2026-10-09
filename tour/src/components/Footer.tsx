"use client";
import { useLayoutEffect, useRef, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { useLang } from "@/lib/i18n";
import { TLink } from "@/lib/transition";
import { prefersReduced, toast } from "@/lib/motion";
import { LINKS, Logo } from "./Nav";

export default function Footer() {
  const { t } = useLang();
  const pathname = usePathname();
  const giant = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(giant.current!.querySelectorAll("span"), { yPercent: 100 }, { yPercent: 0, stagger: 0.04, ease: "none", scrollTrigger: { trigger: "footer", start: "top bottom", end: "bottom bottom", scrub: 0.6 } });
    });
    return () => ctx.revert();
  }, [pathname]);
  const sub = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); toast(t.footer.subscribed); e.currentTarget.reset(); };
  const travel = LINKS.slice(0, 4), services = LINKS.slice(4);

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot-grid i18n">
          <div className="foot-brand">
            <Logo />
            <p>{t.footer.tag}</p>
            <form className="news" onSubmit={sub}>
              <label htmlFor="news-mail" className="eyebrow">{t.footer.news}</label>
              <div><input id="news-mail" type="email" required placeholder={t.footer.newsPh} /><button type="submit" className="btn btn-accent">{t.footer.subscribe}</button></div>
            </form>
          </div>
          <nav aria-label={t.footer.cols[0]}><p className="eyebrow">{t.footer.cols[0]}</p>{travel.map(([h, k]) => <TLink key={h} href={h} label={t.nav[k]}>{t.nav[k]}</TLink>)}<TLink href="/reservas" label={t.nav.book}>{t.nav.book}</TLink></nav>
          <nav aria-label={t.footer.cols[1]}><p className="eyebrow">{t.footer.cols[1]}</p>{services.map(([h, k]) => <TLink key={h} href={h} label={t.nav[k]}>{t.nav[k]}</TLink>)}</nav>
          <div className="foot-contact"><p className="eyebrow">Contacto</p><span>+1 (809) 555-0170</span><span>viajes@toursteliant.com</span><span>Terminal Steliant · Av. 27 de Febrero, SD</span></div>
        </div>
        <div className="giant" ref={giant} aria-hidden="true">{"TOUR STELIANT".split("").map((c, i) => <span key={i}>{c === " " ? " " : c}</span>)}</div>
        <div className="foot-bottom"><span>© 2026 Tour Steliant</span><span className="i18n">{t.footer.credit}</span></div>
      </div>
    </footer>
  );
}

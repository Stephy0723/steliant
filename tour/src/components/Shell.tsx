"use client";
import { useEffect, type ReactNode } from "react";
import { gsap } from "gsap";
import { LangProvider } from "@/lib/i18n";
import { initGlobal, prefersReduced } from "@/lib/motion";
import Nav from "./Nav";
import Footer from "./Footer";
import TicketFab from "./TicketFab";

export const firstLoad = { pending: true };

function runLoader() {
  const el = document.getElementById("loader"); if (!el) { firstLoad.pending = false; return; }
  el.style.animation = "none";
  if (prefersReduced()) { el.style.display = "none"; firstLoad.pending = false; return; }
  const letters = el.querySelectorAll(".ld-word b");
  const tl = gsap.timeline({ onComplete: () => { firstLoad.pending = false; } });
  letters.forEach((b, i) => {
    const final = b.textContent || "";
    const o = { n: 0 };
    tl.to(o, { n: 8, duration: 0.5, ease: "none", onUpdate: () => { b.textContent = Math.floor(o.n) >= 8 ? final : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; } }, i * 0.05);
  });
  tl.to(el.querySelector(".ld-road i"), { scaleX: 1, duration: 1.1, ease: "power3.inOut" }, 0)
    .to(el.querySelector(".ld-bus"), { x: () => (el.querySelector(".ld-road") as HTMLElement).offsetWidth - 28, duration: 1.1, ease: "power3.inOut" }, 0)
    .to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.95, ease: "expo.inOut" }, 1.35)
    .set(el, { display: "none" });
}

export default function Shell({ children }: { children: ReactNode }) {
  useEffect(() => { initGlobal(); runLoader(); }, []);
  return (
    <LangProvider>
      <div id="loader" aria-hidden="true">
        <div className="ld-word">{"TOUR STELIANT".split("").map((c, i) => <b key={i}>{c === " " ? " " : c}</b>)}</div>
        <div className="ld-road"><i /><span className="ld-bus" /></div>
        <p className="ld-cap">SDQ → PUJ · 07:30</p>
      </div>
      <div className="cursor" aria-hidden="true" />
      <div className="scroll-prog" aria-hidden="true"><i /></div>
      <div id="curtain" aria-hidden="true"><i /><i /><span /></div>
      <Nav />
      <main>{children}</main>
      <Footer />
      <TicketFab />
      <div className="toast" id="toast" role="status" aria-live="polite" />
      <div className="demo-badge"><a href="/">← STELIANT</a><span>Tour Steliant · Muestra</span></div>
    </LangProvider>
  );
}

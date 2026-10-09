"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { gsap } from "gsap";
import { useLang, money } from "@/lib/i18n";
import { CITIES, type CityId } from "@/lib/content";
import { lenis, prefersReduced, toast } from "@/lib/motion";
import { seatName, type Trip } from "@/lib/trip";
import { Img } from "./ui";
import { Pass } from "./Ticket";

type Props = { open: boolean; onClose: () => void; from: CityId; to: CityId; date: string; time: string; seats: number[]; price: number; pax: number; draft: Trip; onPaid: () => void };
type Method = "card" | "apple" | "google";
const brandOf = (n: string) => (/^4/.test(n) ? "VISA" : /^5[1-5]|^2[2-7]/.test(n) ? "MASTERCARD" : /^3[47]/.test(n) ? "AMEX" : "");

/** Checkout modal: holographic card, wallets, processing → approved → printed ticket. */
export default function Checkout({ open, onClose, from, to, date, time, seats, price, pax, draft, onPaid }: Props) {
  const { t } = useLang();
  const P = t.x.pay, B = t.book;
  const [method, setMethod] = useState<Method>("card");
  const [card, setCard] = useState({ num: "", holder: "", exp: "", cvc: "" });
  const [flip, setFlip] = useState(false);
  const [state, setState] = useState<"idle" | "processing" | "done" | "printing">("idle");
  const holo = useRef<HTMLDivElement>(null);
  const methods = useRef<HTMLDivElement>(null);
  const fee = Math.round(price * pax * 0.03), total = price * pax + fee;
  const brand = brandOf(card.num.replace(/\s/g, ""));
  const valid = { num: card.num.replace(/\s/g, "").length >= 15, holder: card.holder.trim().length > 2, exp: /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp), cvc: card.cvc.length >= 3 };

  useEffect(() => {
    if (!open) { lenis?.start(); return; }
    lenis?.stop(); setState("idle");
    if (!prefersReduced()) {
      gsap.fromTo(".co-panel", { y: 80, rotateX: 12, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 1, ease: "expo.out" });
      gsap.from(".co-sum > *, .co-main > *", { y: 24, opacity: 0, stagger: 0.04, duration: 0.8, ease: "expo.out", delay: 0.15 });
      gsap.fromTo(".holo", { rotateY: -40, rotateX: 18 }, { rotateY: 0, rotateX: 0, duration: 1.6, ease: "elastic.out(1,.6)", delay: 0.2 });
    }
  }, [open]);
  useEffect(() => {
    const on = methods.current?.querySelector<HTMLElement>(".on"), ink = methods.current?.querySelector<HTMLElement>(".co-ink");
    if (on && ink) gsap.to(ink, { x: on.offsetLeft - 4, width: on.offsetWidth, duration: 0.5, ease: "expo.out" });
  }, [method, open]);
  useEffect(() => { if (brand && !prefersReduced()) gsap.fromTo(".hb", { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(2)" }); }, [brand]);
  useEffect(() => { if (state === "printing" && !prefersReduced()) gsap.fromTo(".pr-paper", { yPercent: -100 }, { yPercent: 0, duration: 2, ease: "steps(14)" }); }, [state]);

  const tilt = (e: MouseEvent<HTMLDivElement>) => {
    const h = holo.current; if (!h) return;
    const r = h.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    h.style.setProperty("--rx", `${(0.5 - py) * 16}deg`); h.style.setProperty("--ry", `${(px - 0.5) * 22}deg`); h.style.setProperty("--gx", px * 100 + "%"); h.style.setProperty("--gy", py * 100 + "%");
  };
  const set = (k: keyof typeof card, v: string) => {
    if (k === "num") v = v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
    if (k === "exp") { const d = v.replace(/\D/g, "").slice(0, 4); v = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; }
    if (k === "cvc") v = v.replace(/\D/g, "").slice(0, 4);
    if (k === "holder") v = v.toUpperCase();
    setCard((c) => ({ ...c, [k]: v }));
  };
  const pay = () => {
    if (method === "card" && !Object.values(valid).every(Boolean)) { toast(B.needCard); gsap.fromTo(".fl-grid", { x: -10 }, { x: 0, duration: 0.5, ease: "elastic.out(1,.3)" }); return; }
    setState("processing");
    setTimeout(() => { setState("done"); setTimeout(() => { setState("printing"); setTimeout(() => { onPaid(); setCard({ num: "", holder: "", exp: "", cvc: "" }); }, 2600); }, 900); }, 1800);
  };
  const busy = state !== "idle";

  return (
    <div className={`co${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="co-bg" onClick={() => !busy && onClose()} />
      {open && (
        <div className="co-panel" role="dialog" aria-modal="true" aria-labelledby="coTitle">
          <button type="button" className="icon-btn co-close" onClick={() => !busy && onClose()} aria-label={t.nav.close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          <aside className="co-sum">
            <div className="co-pic"><Img src={CITIES[to].img} alt="" /><div><small>{B.ticket}</small><b>{CITIES[from].name} → {CITIES[to].name}</b></div></div>
            <dl>
              <div><dt>{t.common.date}</dt><dd>{date}</dd></div>
              <div><dt>{B.time}</dt><dd>{time}</dd></div>
              <div><dt>{B.seat}</dt><dd>{seats.map(seatName).join(", ")}</dd></div>
              <div><dt>{P.subtotal}</dt><dd>{money(price * pax)}</dd></div>
              <div><dt>{P.fee}</dt><dd>{money(fee)}</dd></div>
            </dl>
            <div className="co-total"><span>{B.total}</span><b>{money(total)}</b></div>
            <p className="co-secure"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>{P.secure}</p>
          </aside>
          <div className="co-main">
            <h3 id="coTitle">{P.payTitle}</h3>
            <div className="co-methods" role="tablist" ref={methods}>
              {(["card", "apple", "google"] as Method[]).map((m) => <button key={m} type="button" role="tab" aria-selected={method === m} className={method === m ? "on" : ""} onClick={() => !busy && setMethod(m)}>{m === "card" ? P.card : m === "apple" ? " Pay" : "G Pay"}</button>)}
              <span className="co-ink" />
            </div>
            {method === "card" ? (
              <>
                <div className={`holo${flip ? " flip" : ""}`} ref={holo} data-brand={brand} onMouseMove={tilt} onMouseLeave={() => { holo.current?.style.setProperty("--rx", "0deg"); holo.current?.style.setProperty("--ry", "0deg"); }}>
                  <div className="holo-in">
                    <div className="hf"><span className="cc-chip" /><span className="hb">{brand || "STELIANT"}</span><span className="hn">{card.num || "•••• •••• •••• ••••"}</span><span className="hr"><span>{card.holder || B.holder}</span><span>{card.exp || "MM/AA"}</span></span></div>
                    <div className="hk"><span className="cc-stripe" /><span className="cc-cvc">{card.cvc || "•••"}</span></div>
                  </div>
                </div>
                <div className="fl-grid">
                  {([["num", B.card, "wide", "numeric"], ["holder", B.holder, "wide", "text"], ["exp", B.exp, "", "numeric"], ["cvc", B.cvc, "", "numeric"]] as const).map(([k, label, w, mode]) => (
                    <div key={k} className={`fl ${w}${valid[k] ? " valid" : ""}`}>
                      <input id={`co-${k}`} inputMode={mode} placeholder=" " autoComplete="off" value={card[k]} onChange={(e) => set(k, e.target.value)} onFocus={() => k === "cvc" && setFlip(true)} onBlur={() => k === "cvc" && setFlip(false)} disabled={busy} />
                      <label htmlFor={`co-${k}`}>{label}</label><i className="ok" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="wallet"><div className="wallet-phone"><span className="wp-notch" /><b>{method === "apple" ? " Pay" : "G Pay"}</b><span className="wp-amt">{money(total)}</span><span className="wp-face" /></div></div>
            )}
            <button type="button" className={`paybtn ${method}${state === "processing" ? " processing" : ""}${state === "done" || state === "printing" ? " done" : ""}`} onClick={pay} disabled={busy}>
              <span className="pb-label">{state === "processing" ? P.processing : state !== "idle" ? P.approved : method === "card" ? `${B.pay} ${money(total)}` : `${P.payWith} ${method === "apple" ? " Pay" : "G Pay"}`}</span>
              <svg className="pb-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" /></svg>
              <svg className="pb-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </button>
            <p className="demo-note">{t.common.demo}</p>
            {state === "printing" && <div className="printer"><div className="pr-slot" /><div className="pr-paper"><Pass trip={draft} i={0} /></div><p>{P.printing}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}

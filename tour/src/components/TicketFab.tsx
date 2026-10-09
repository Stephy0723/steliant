"use client";
import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { useLang } from "@/lib/i18n";
import { lenis, prefersReduced } from "@/lib/motion";
import { loadTrip, TRIP_EVENT, type Trip } from "@/lib/trip";
import { Pass } from "./Ticket";

export const OPEN_TICKET = "ts-open-ticket";

/** Floating "My ticket" button + side drawer with the boarding passes. */
export default function TicketFab() {
  const { t } = useLang();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTrip(loadTrip());
    const onTrip = (e: Event) => {
      setTrip(loadTrip());
      if ((e as CustomEvent).detail?.fresh && !prefersReduced()) setTimeout(() => gsap.fromTo(".fab", { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, duration: 1.2, ease: "elastic.out(1,.5)" }), 1500);
    };
    const onOpen = () => setOpen(true);
    addEventListener(TRIP_EVENT, onTrip); addEventListener(OPEN_TICKET, onOpen);
    return () => { removeEventListener(TRIP_EVENT, onTrip); removeEventListener(OPEN_TICKET, onOpen); };
  }, []);
  useEffect(() => {
    if (open) { lenis?.stop(); if (!prefersReduced()) gsap.fromTo(".tdrawer .pass", { y: 80, rotate: -4, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, stagger: 0.12, duration: 1, ease: "expo.out", delay: 0.25 }); }
    else lenis?.start();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", esc); return () => removeEventListener("keydown", esc);
  }, [open]);

  if (!trip) return null;
  return (
    <>
      <button type="button" className="fab" onClick={() => setOpen(true)} aria-label={t.x.pay.myTicket}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M9 6v12" strokeDasharray="2 2" /></svg>
        <span className="fab-label">{t.x.pay.myTicket}</span><em>{trip.people.length}</em>
      </button>
      <div className={`tdrawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="tdrawer-bg" onClick={() => setOpen(false)} />
        <aside className="tdrawer-panel" role="dialog" aria-modal="true" aria-label={t.x.pay.myTicket}>
          <div className="td-head"><b>{t.x.pay.myTicket}</b><button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t.nav.close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
          <div className="td-body">{open && trip.people.map((_, i) => <Pass key={i} trip={trip} i={i} />)}</div>
        </aside>
      </div>
    </>
  );
}

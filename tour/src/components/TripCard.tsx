"use client";
import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { useLang } from "@/lib/i18n";
import { CITIES } from "@/lib/content";
import { prefersReduced } from "@/lib/motion";
import { departAt, loadTrip, seatName, TRIP_EVENT, type Trip } from "@/lib/trip";
import { QR } from "./Ticket";
import { Img } from "./ui";
import { OPEN_TICKET } from "./TicketFab";

/** "Your next trip" card shown on the home page after a booking. */
export default function TripCard() {
  const { t } = useLang();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tr = loadTrip(); setTrip(tr); setNow(Date.now());
    if (tr && sessionStorage.getItem("ts-fresh") && !prefersReduced()) {
      sessionStorage.removeItem("ts-fresh");
      requestAnimationFrame(() => gsap.fromTo(".trip", { y: 60, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: "expo.out", delay: 1 }));
    }
    const on = () => setTrip(loadTrip());
    addEventListener(TRIP_EVENT, on);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { removeEventListener(TRIP_EVENT, on); clearInterval(id); };
  }, []);
  if (!trip) return null;
  const T2 = t.x.trip;
  let s = Math.max(0, Math.floor((departAt(trip).getTime() - now) / 1000));
  const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  return (
    <div className="trip">
      <div className="trip-pic"><Img src={CITIES[trip.to].img} alt={CITIES[trip.to].name} /></div>
      <div className="trip-main">
        <p className="eyebrow">{T2.title}</p>
        <div className="trip-route"><b>{trip.from.toUpperCase()}</b><i><span className="trip-bus" /></i><b>{trip.to.toUpperCase()}</b></div>
        <p className="trip-names">{CITIES[trip.from].name} → {CITIES[trip.to].name} · {trip.date} · {trip.time}</p>
      </div>
      <div className="trip-meta">
        <div><small>{T2.seat}</small><b>{trip.seats.map(seatName).join(", ")}</b></div>
        <div><small>{T2.gate}</small><b>{trip.gate}</b></div>
        <div className="trip-cd"><small>{T2.leaves}</small><b>{now ? `${d}${T2.d} ${String(h).padStart(2, "0")}${T2.h} ${String(m).padStart(2, "0")}${T2.m} ${String(s).padStart(2, "0")}${T2.s}` : "—"}</b></div>
      </div>
      <div className="trip-qr"><QR code={`${trip.code}-0`} /></div>
      <button type="button" className="btn btn-accent" onClick={() => dispatchEvent(new Event(OPEN_TICKET))}>{T2.see}</button>
    </div>
  );
}

"use client";
import { useLang } from "@/lib/i18n";
import { CITIES } from "@/lib/content";
import { seatName, type Trip } from "@/lib/trip";

function rand(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
export function QR({ code }: { code: string }) {
  const N = 25, cells: [number, number][] = [];
  const r = rand([...code].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1);
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!finder(x, y) && r() > 0.52) cells.push([x, y]);
  const F = ({ x, y }: { x: number; y: number }) => (<g><rect x={x} y={y} width="7" height="7" fill="currentColor" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#f6efe2" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" /></g>);
  return (<svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="qr" aria-label="QR">{cells.map(([x, y]) => <rect key={x + "-" + y} x={x} y={y} width="1" height="1" fill="currentColor" />)}<F x={0} y={0} /><F x={N - 7} y={0} /><F x={0} y={N - 7} /></svg>);
}

export function Pass({ trip, i }: { trip: Trip; i: number }) {
  const { t } = useLang();
  const [h, m] = trip.time.split(":").map(Number), d = h * 60 + m - 20;
  const boardBy = `${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
  const p = trip.people[i];
  return (
    <article className="pass">
      <div className="pass-main">
        <div className="pass-head"><span>TOUR STELIANT</span><span>{t.book.ticket}</span></div>
        <div className="pass-route"><div><b>{trip.from.toUpperCase()}</b><small>{CITIES[trip.from].name}</small></div><i /><div><b>{trip.to.toUpperCase()}</b><small>{CITIES[trip.to].name}</small></div></div>
        <div className="pass-grid">
          <div><small>{t.book.passenger}</small><b>{p?.name || "—"}</b></div>
          <div><small>{t.common.date}</small><b>{trip.date}</b></div>
          <div><small>{t.hours.depart}</small><b>{trip.time}</b></div>
          <div><small>{t.book.gate}</small><b>{trip.gate}</b></div>
          <div><small>{t.book.seat}</small><b>{trip.seats[i] ? seatName(trip.seats[i]) : "—"}</b></div>
          <div><small>{t.book.boardBy}</small><b>{boardBy}</b></div>
        </div>
      </div>
      <div className="pass-stub"><QR code={`${trip.code}-${i}`} /><span>{trip.code}-{i + 1}</span></div>
    </article>
  );
}

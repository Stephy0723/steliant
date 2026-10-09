"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useLang, money } from "@/lib/i18n";
import { CITIES, CITY_ORDER, IMG, ROUTES, type CityId } from "@/lib/content";
import { usePageMotion } from "@/lib/usePageMotion";
import { lenis, prefersReduced, toast } from "@/lib/motion";
import { Arrow, Img, PageHeader } from "@/components/ui";
import { useRouter } from "next/navigation";
import Checkout from "@/components/Checkout";
import { saveTrip, seatName, type Trip } from "@/lib/trip";

const ROWS = 10; // 10 rows of 2+2, plus a back row of 5 = 45 seats
const OCCUPIED = new Set([3, 7, 12, 15, 18, 22, 28, 31, 35, 38, 42]);
export default function Reservas() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState<CityId>("sdq");
  const [to, setTo] = useState<CityId>("puj");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pax, setPax] = useState(1);
  const [seats, setSeats] = useState<number[]>([]);
  const [people, setPeople] = useState<{ name: string; doc: string }[]>([{ name: "", doc: "" }]);
  const [coOpen, setCoOpen] = useState(false);
  const router = useRouter();
  const [code, setCode] = useState("TS-0000");

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const f = q.get("from") as CityId | null, tt = q.get("to") as CityId | null;
    if (f && CITIES[f]) setFrom(f); if (tt && CITIES[tt]) setTo(tt);
    if (q.get("pax")) setPax(Math.min(6, Math.max(1, +q.get("pax")!)));
    if (q.get("time")) setTime(q.get("time")!);
    setDate(q.get("date") || new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    setCode("TS-" + String(Math.floor(1000 + Math.random() * 9000)));
  }, []);
  useEffect(() => { setPeople((p) => Array.from({ length: pax }, (_, i) => p[i] || { name: "", doc: "" })); setSeats((s) => s.slice(0, pax)); }, [pax]);

  const route = useMemo(() => ROUTES.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from)), [from, to]);
  const price = route?.price ?? (CITIES[to].price);
  const times = route?.times ?? ["07:00", "10:00", "13:00", "16:00", "19:00"];
  useEffect(() => { if (!times.includes(time)) setTime(times[Math.min(2, times.length - 1)]); }, [times, time]);
  const vip = route?.vip ?? false;

  usePageMotion(page, [lang]);
  useEffect(() => {
    if (!pane.current || prefersReduced()) return;
    gsap.fromTo(pane.current.children, { x: 60, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.06, duration: 0.8, ease: "expo.out" });
    gsap.to(".bk-progress i", { scaleX: step / 3, duration: 0.9, ease: "expo.inOut" });
    gsap.to(".bk-bus", { left: `${(step / 3) * 100}%`, duration: 0.9, ease: "expo.inOut" });
  }, [step]);

  const go = (n: number) => {
    if (n > step) {
      if (step === 1 && seats.length !== pax) { toast(t.book.needSeats.replace("{n}", String(pax))); return; }
      if (step === 2 && people.some((p) => !p.name.trim() || !p.doc.trim())) { toast(t.book.needData); return; }
    }
    setStep(n);
    if (n === 3) setTimeout(() => setCoOpen(true), 450);
    const el = document.querySelector(".bk");
    if (el) lenis ? lenis.scrollTo(el as HTMLElement, { offset: -100 }) : el.scrollIntoView({ behavior: "smooth" });
  };
  const toggleSeat = (n: number) => {
    if (OCCUPIED.has(n)) return;
    setSeats((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length < pax ? [...s, n] : [...s.slice(1), n]));
  };
  const fee = Math.round(price * pax * 0.03);
  const draft: Trip = { from, to, date, time, seats, people, code, gate: String(((times.indexOf(time) + 3) % 8) + 1).padStart(2, "0") };
  const onPaid = () => {
    saveTrip(draft);
    try { sessionStorage.setItem("ts-fresh", "1"); } catch { /* */ }
    setCoOpen(false); setSeats([]); setStep(0); setCode("TS-" + String(Math.floor(1000 + Math.random() * 9000)));
    toast(t.x.pay.ready);
    router.push("/");
  };
  const total = price * pax;
  const gate = String(((times.indexOf(time) + 3) % 8) + 1).padStart(2, "0");

  const seatBtn = (n: number) => {
    const taken = OCCUPIED.has(n), mine = seats.includes(n), isVip = vip && n <= 12;
    return (
      <button key={n} type="button" className={`seat${taken ? " taken" : ""}${mine ? " mine" : ""}${isVip ? " vip" : ""}`} disabled={taken} aria-pressed={mine} aria-label={`${t.book.seat} ${seatName(n)}`} onClick={() => toggleSeat(n)}>
        <span>{seatName(n)}</span>
      </button>
    );
  };

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.book.eyebrow} title={t.pages.book.title} lede={t.pages.book.lede} image={IMG.interior2} />
      <section className="sec">
        <div className="wrap bk">
          <div className="bk-steps">
            <div className="bk-track"><div className="bk-progress"><i /></div><span className="bk-bus" aria-hidden="true" /></div>
            <ol>{t.book.steps.slice(0, 4).map((s, i) => <li key={s} className={i === step ? "on" : i < step ? "done" : ""}><button type="button" disabled={i > step} onClick={() => go(i)}><b>0{i + 1}</b>{s}</button></li>)}</ol>
          </div>

          <div className="bk-grid">
            <div className="bk-pane" ref={pane} key={step}>
              {step === 0 && (<>
                <div className="bk-route-pics"><span><Img src={CITIES[from].img} alt="" /><b>{CITIES[from].name}</b></span><i /><span><Img src={CITIES[to].img} alt="" /><b>{CITIES[to].name}</b></span></div>
                <div className="bk-row2">
                  <div className="sf"><label htmlFor="b-from">{t.common.from}</label><select id="b-from" value={from} onChange={(e) => setFrom(e.target.value as CityId)}>{CITY_ORDER.map((c) => <option key={c} value={c}>{CITIES[c].name}</option>)}</select></div>
                  <div className="sf"><label htmlFor="b-to">{t.common.to}</label><select id="b-to" value={to} onChange={(e) => setTo(e.target.value as CityId)}>{CITY_ORDER.filter((c) => c !== from).map((c) => <option key={c} value={c}>{CITIES[c].name}</option>)}</select></div>
                  <div className="sf"><label htmlFor="b-date">{t.common.date}</label><input id="b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div className="sf"><span className="sf-label">{t.common.pax}</span><div className="stepper"><button type="button" onClick={() => setPax(Math.max(1, pax - 1))}>−</button><b>{pax}</b><button type="button" onClick={() => setPax(Math.min(6, pax + 1))}>+</button></div></div>
                </div>
                <div><p className="sf-label" style={{ paddingLeft: 0 }}>{t.book.time}</p>
                  <div className="time-chips">{times.map((tm) => <button key={tm} type="button" className={`tchip${tm === time ? " on" : ""}`} onClick={() => setTime(tm)}>{tm}</button>)}</div></div>
                <div className="bk-nav"><span /><button type="button" className="btn btn-accent magnetic" onClick={() => go(1)}><span>{t.common.next}</span><Arrow /></button></div>
              </>)}

              {step === 1 && (<>
                <div className="seat-head"><h3>{t.book.chooseSeats}</h3><span className="muted">{45 - OCCUPIED.size - seats.length} {t.book.seatsLeft}</span></div>
                <div className="legend"><span><i className="l-free" />{t.book.legend.free}</span><span><i className="l-taken" />{t.book.legend.taken}</span><span><i className="l-mine" />{t.book.legend.mine}</span>{vip && <span><i className="l-vip" />{t.book.legend.vip}</span>}</div>
                <div className="coach" aria-label={t.book.chooseSeats}>
                  <div className="coach-front"><span className="wheel" aria-hidden="true" />{t.book.driver}<span className="door">{t.book.door}</span></div>
                  <div className="coach-rows">
                    {Array.from({ length: ROWS }, (_, r) => (
                      <div className="crow" key={r}>{seatBtn(r * 4 + 1)}{seatBtn(r * 4 + 2)}<span className="aisle">{r + 1}</span>{seatBtn(r * 4 + 3)}{seatBtn(r * 4 + 4)}</div>
                    ))}
                    <div className="crow back">{[41, 42, 43, 44, 45].map(seatBtn)}</div>
                  </div>
                </div>
                <div className="bk-nav"><button type="button" className="btn btn-ghost" onClick={() => go(0)}>{t.common.back}</button><button type="button" className="btn btn-accent magnetic" onClick={() => go(2)}><span>{t.common.next}</span><Arrow /></button></div>
              </>)}

              {step === 2 && (<>
                {people.map((p, i) => (
                  <fieldset className="pax" key={i}>
                    <legend>{t.book.passenger} {i + 1} · {t.book.seat} {seats[i] ? seatName(seats[i]) : "—"}</legend>
                    <div className="bk-row2 two">
                      <div className="sf"><label htmlFor={`p-n${i}`}>{t.book.name}</label><input id={`p-n${i}`} value={p.name} onChange={(e) => setPeople(people.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} autoComplete="name" /></div>
                      <div className="sf"><label htmlFor={`p-d${i}`}>{t.book.doc}</label><input id={`p-d${i}`} value={p.doc} onChange={(e) => setPeople(people.map((x, k) => (k === i ? { ...x, doc: e.target.value } : x)))} /></div>
                    </div>
                  </fieldset>
                ))}
                <div className="bk-row2 two">
                  <div className="sf"><label htmlFor="p-mail">{t.book.email}</label><input id="p-mail" type="email" autoComplete="email" /></div>
                  <div className="sf"><label htmlFor="p-tel">{t.book.phone}</label><input id="p-tel" type="tel" autoComplete="tel" /></div>
                </div>
                <div className="bk-nav"><button type="button" className="btn btn-ghost" onClick={() => go(1)}>{t.common.back}</button><button type="button" className="btn btn-accent magnetic" onClick={() => go(3)}><span>{t.common.next}</span><Arrow /></button></div>
              </>)}

              {step === 3 && (<>
                <div className="pay-intro">
                  <h3>{t.x.pay.payTitle}</h3>
                  <p className="muted">{t.x.pay.secure}</p>
                  <div className="pay-lines">
                    <div><span>{money(price)} × {pax}</span><b>{money(price * pax)}</b></div>
                    <div><span>{t.x.pay.fee}</span><b>{money(fee)}</b></div>
                    <div className="tot"><span>{t.book.total}</span><b>{money(price * pax + fee)}</b></div>
                  </div>
                </div>
                <div className="bk-nav"><button type="button" className="btn btn-ghost" onClick={() => go(2)}>{t.common.back}</button><button type="button" className="btn btn-accent magnetic" onClick={() => setCoOpen(true)}><span>{t.x.pay.goPay}</span><Arrow /></button></div>
              </>)}
            </div>

            <aside className="bk-sum">
              <div className="sum-pic"><Img src={CITIES[to].img} alt="" /><span>{CITIES[to].region}</span></div>
              <p className="eyebrow">{t.book.ticket}</p>
              <div className="sum-route"><b>{CITIES[from].name}</b><i /><b>{CITIES[to].name}</b></div>
              <dl>
                <div><dt>{t.common.date}</dt><dd>{date || "—"}</dd></div>
                <div><dt>{t.book.time}</dt><dd>{time}</dd></div>
                <div><dt>{t.common.pax}</dt><dd>{pax}</dd></div>
                <div><dt>{t.book.selected}</dt><dd>{seats.length ? seats.map(seatName).join(", ") : "—"}</dd></div>
                <div><dt>{t.hours.fare}</dt><dd>{money(price)} × {pax}</dd></div>
              </dl>
              <div className="sum-total"><span>{t.book.total}</span><b>{money(total + (step >= 3 ? fee : 0))}</b></div>
            </aside>
          </div>
        </div>
      </section>
      <Checkout open={coOpen} onClose={() => setCoOpen(false)} from={from} to={to} date={date} time={time} seats={seats} price={price} pax={pax} draft={draft} onPaid={onPaid} />
    </div>
  );
}

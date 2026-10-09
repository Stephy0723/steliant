"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { useLang, money } from "@/lib/i18n";
import { CAFE, CAFE_CATS, IMG } from "@/lib/content";
import { usePageMotion } from "@/lib/usePageMotion";
import { prefersReduced, toast } from "@/lib/motion";
import { Arrow, Img, PageHeader } from "@/components/ui";

gsap.registerPlugin(Flip);
type Cat = "all" | keyof typeof CAFE_CATS;
const CATS: Cat[] = ["all", "drinks", "bites", "snacks", "sweets"];

export default function Cafeteria() {
  const { t, lang } = useLang();
  const page = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState<Cat>("all");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [seat, setSeat] = useState("14A");
  const state = useRef<Flip.FlipState | null>(null);

  usePageMotion(page, [lang], () => {
    if (prefersReduced()) return;
    gsap.from(".cat-card", { y: 80, opacity: 0, stagger: 0.08, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".cat-row", start: "top 85%" } });
  });
  const choose = (c: Cat) => { if (list.current && !prefersReduced()) state.current = Flip.getState(list.current.querySelectorAll(".mi")); setCat(c); };
  useEffect(() => {
    if (!state.current) return;
    Flip.from(state.current, { duration: 0.7, ease: "expo.inOut", absolute: true, onEnter: (e) => gsap.fromTo(e, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }), onLeave: (e) => gsap.to(e, { opacity: 0, duration: 0.3 }) });
    state.current = null;
  }, [cat]);

  const add = (id: number, d: number, ev?: React.MouseEvent) => {
    setCart((c) => { const n = Math.max(0, (c[id] || 0) + d); const x = { ...c, [id]: n }; if (!n) delete x[id]; return x; });
    if (d > 0 && ev && !prefersReduced()) {
      // Flying dot from the button to the cart.
      const dot = document.createElement("span"); dot.className = "fly-dot"; document.body.appendChild(dot);
      const cartEl = document.querySelector(".cart-head")!.getBoundingClientRect();
      gsap.fromTo(dot, { x: ev.clientX, y: ev.clientY }, { x: cartEl.left + 40, y: cartEl.top + 20, duration: 0.8, ease: "power2.in", onComplete: () => dot.remove() });
      gsap.fromTo(".cart-count", { scale: 1.6 }, { scale: 1, duration: 0.5, delay: 0.75, ease: "back.out(3)" });
    }
  };
  const items = CAFE.filter((i) => cat === "all" || i.cat === cat);
  const lines = CAFE.filter((i) => cart[i.id]);
  const count = lines.reduce((s, i) => s + cart[i.id], 0), total = lines.reduce((s, i) => s + cart[i.id] * i.price, 0);

  return (
    <div ref={page} className="i18n">
      <PageHeader eyebrow={t.pages.cafe.eyebrow} title={t.pages.cafe.title} lede={t.pages.cafe.lede} image={IMG.coffee} />
      <section className="sec">
        <div className="wrap">
          <div className="cat-row">
            {(Object.keys(CAFE_CATS) as (keyof typeof CAFE_CATS)[]).map((k) => (
              <button type="button" key={k} className={`cat-card${cat === k ? " on" : ""}`} onClick={() => choose(cat === k ? "all" : k)} data-cursor={t.cafe.cats[k]}>
                <Img src={CAFE_CATS[k]} /><span>{t.cafe.cats[k]}</span>
              </button>
            ))}
          </div>
          <div className="cafe-grid">
            <div>
              <div className="filters">{CATS.map((c) => <button key={c} type="button" className={`fchip${cat === c ? " on" : ""}`} onClick={() => choose(c)}>{t.cafe.cats[c]}</button>)}</div>
              <div className="menu-list" ref={list}>
                {items.map((i) => {
                  const [name, desc] = t.cafe.items[i.id];
                  return (
                    <div className="mi" key={i.id} data-flip-id={String(i.id)}>
                      <div className="mi-txt"><b>{name}{i.popular && <span className="chip">{t.cafe.popular}</span>}</b><small>{desc}</small></div>
                      <span className="mi-dots" aria-hidden="true" />
                      <span className="mi-price">{money(i.price)}</span>
                      <div className="mi-qty">
                        {cart[i.id] ? <><button type="button" onClick={() => add(i.id, -1)} aria-label="−">−</button><b>{cart[i.id]}</b></> : null}
                        <button type="button" className="mi-add" onClick={(e) => add(i.id, 1, e)} aria-label={`${t.cafe.add} ${name}`}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="cart">
              <div className="cart-head"><b>{t.cafe.cart}</b><span className="cart-count">{count}</span></div>
              {lines.length === 0 ? <p className="muted cart-empty">{t.cafe.empty}</p> : (
                <ul>{lines.map((i) => <li key={i.id}><span>{cart[i.id]}× {t.cafe.items[i.id][0]}</span><span>{money(cart[i.id] * i.price)}</span></li>)}</ul>
              )}
              <div className="sf"><label htmlFor="cf-seat">{t.cafe.seat}</label><input id="cf-seat" value={seat} onChange={(e) => setSeat(e.target.value.toUpperCase().slice(0, 3))} /></div>
              <div className="sum-total"><span>Total</span><b>{money(total)}</b></div>
              <button type="button" className="btn btn-accent magnetic" disabled={!count} onClick={() => { toast(`${t.cafe.ordered} · ${t.cafe.seat} ${seat}`); setCart({}); }}><span>{t.cafe.order}</span><Arrow /></button>
              <div className="cart-feats">{t.cafe.feats.map((f) => <span key={f.t}><b>{f.t}</b>{f.d}</span>)}</div>
            </aside>
          </div>
        </div>
      </section>
      <section className="cafe-strip">{[IMG.cafeLatte, IMG.cafePlantain, IMG.cafeDrink, IMG.cafeCake, IMG.cafePlate].map((s, i) => <figure key={i} className="reveal-img"><Img src={s} /></figure>)}</section>
    </div>
  );
}

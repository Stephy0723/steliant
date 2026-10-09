"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export const prefersReduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export let lenis: Lenis | null = null;
export const THEME_EVENT = "ts-theme";
export const isDark = () => {
  const r = document.documentElement;
  return r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

let tt = 0;
export function toast(msg: string) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg; t.classList.add("is-on");
  clearTimeout(tt); tt = window.setTimeout(() => t.classList.remove("is-on"), 3400);
}
export function copyText(v: string, done: string) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(v).then(() => toast(done)).catch(() => toast(v));
  else toast(v);
}

export function countUp(el: HTMLElement) {
  const end = +(el.dataset.count || 0), suf = el.dataset.suffix || "";
  if (prefersReduced()) { el.textContent = end.toLocaleString("en-US") + suf; return; }
  const o = { v: 0 };
  gsap.to(o, { v: end, duration: 2.2, ease: "power3.out", onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("en-US") + suf; } });
}

let started = false;
export function initGlobal() {
  if (started) return; started = true;
  const reduce = prefersReduced();
  if (!reduce) {
    lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis?.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  let last = 0;
  const onScroll = () => {
    const nav = document.getElementById("nav"); if (!nav) return;
    const y = scrollY;
    nav.classList.toggle("compact", y > 60); document.body.classList.toggle("scrolled", y > 60);
    if (y > 700 && y > last + 4 && !document.body.classList.contains("menu-open")) nav.classList.add("is-hidden");
    if (y < last - 4) nav.classList.remove("is-hidden");
    last = y;
    const h = document.documentElement.scrollHeight - innerHeight, bar = document.querySelector<HTMLElement>(".scroll-prog i");
    if (bar) bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  };
  addEventListener("scroll", onScroll, { passive: true });

  if (reduce || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  document.body.classList.add("has-cursor");
  const c = document.querySelector<HTMLElement>(".cursor");
  if (!c) return;
  let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
  addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    const m = (e.target as HTMLElement).closest<HTMLElement>(".magnetic");
    if (m) { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(mx - r.left - r.width / 2) * 0.22}px,${(my - r.top - r.height / 2) * 0.32}px)`; }
    const tilt = (e.target as HTMLElement).closest<HTMLElement>("[data-tilt]");
    if (tilt) {
      const r = tilt.getBoundingClientRect(), px = (mx - r.left) / r.width, py = (my - r.top) / r.height;
      tilt.style.setProperty("--mx", px * 100 + "%"); tilt.style.setProperty("--my", py * 100 + "%");
      tilt.style.transform = `perspective(1000px) rotateY(${(px - 0.5) * 8}deg) rotateX(${(0.5 - py) * 8}deg)`;
    }
  });
  document.addEventListener("mouseout", (e) => {
    const from = e.target as HTMLElement, to = e.relatedTarget as Node | null;
    for (const sel of [".magnetic", "[data-tilt]"]) {
      const el = from.closest<HTMLElement>(sel);
      if (el && !el.contains(to)) { el.style.transition = "transform .7s cubic-bezier(.19,1,.22,1)"; el.style.transform = ""; setTimeout(() => (el.style.transition = ""), 700); }
    }
  });
  document.addEventListener("mouseover", (e) => {
    const tg = e.target as HTMLElement;
    const v = tg.closest<HTMLElement>("[data-cursor]"), h = tg.closest("a,button,select,input,textarea,label");
    c.classList.toggle("is-view", !!v); c.dataset.label = v?.dataset.cursor || ""; c.classList.toggle("is-hover", !v && !!h);
  });
  const loop = () => { cx += (mx - cx) * 0.18; cy += (my - cy) * 0.18; c.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(loop); };
  loop();
}

export const charIn = (els: gsap.TweenTarget, extra: gsap.TweenVars = {}) =>
  gsap.from(els, { yPercent: 120, rotateX: -80, opacity: 0, transformOrigin: "50% 100%", stagger: 0.018, duration: 1.1, ease: "expo.out", ...extra });

/** Shared scroll reveals. Call inside a gsap.context scoped to the page root. */
export function reveals(scope: HTMLElement) {
  const q = gsap.utils.selector(scope);
  if (prefersReduced()) { q("[data-count]").forEach((el: HTMLElement) => countUp(el)); return; }

  q(".page-head").forEach((h: HTMLElement) => {
    const img = h.querySelector(".ph-bg img");
    if (img) {
      gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 2.2, ease: "expo.out" });
      gsap.to(img, { yPercent: 16, ease: "none", scrollTrigger: { trigger: h, start: "top top", end: "bottom top", scrub: true } });
    }
    charIn(h.querySelectorAll(".ch"), { delay: 0.5 });
    gsap.fromTo(h.querySelector(".ph-bg"), { clipPath: "inset(12% 8% 12% 8% round 24px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 1.8, ease: "expo.inOut" });
    gsap.from(h.querySelectorAll(".ph-in"), { y: 24, opacity: 0, duration: 1.1, stagger: 0.08, ease: "expo.out", delay: 0.6 });
  });
  q(".sec-title, .cta-in").forEach((t: HTMLElement) => { const ch = t.querySelectorAll(".ch"); if (ch.length) charIn(ch, { scrollTrigger: { trigger: t, start: "top 88%" } }); });
  q(".eyebrow").forEach((e: HTMLElement) => { if (!e.closest(".page-head") && !e.closest(".hero")) gsap.from(e, { x: -24, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: e, start: "top 92%" } }); });
  q(".rv").forEach((el: HTMLElement) => gsap.from(el, { y: 50, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } }));
  q(".rv-group").forEach((g: HTMLElement) => gsap.from(g.children, { y: 60, opacity: 0, duration: 1.1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: g, start: "top 86%" } }));
  q(".reveal-img").forEach((f: HTMLElement) => {
    const img = f.querySelector("img");
    gsap.fromTo(f, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.5, ease: "expo.inOut", scrollTrigger: { trigger: f, start: "top 88%" } });
    if (img) {
      gsap.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 2, ease: "expo.out", scrollTrigger: { trigger: f, start: "top 88%" } });
      gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: "none", scrollTrigger: { trigger: f, scrub: true } });
    }
  });
  q("[data-count]").forEach((el: HTMLElement) => ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: () => countUp(el) }));
}

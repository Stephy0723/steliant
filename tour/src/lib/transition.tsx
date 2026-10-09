"use client";
import { useRouter, usePathname } from "next/navigation";
import { gsap } from "gsap";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { lenis, prefersReduced } from "./motion";

/* Route change choreography: cover() wipes the curtain in, the route changes, and
   app/template.tsx calls reveal() when the new page mounts. */
let covered = false, busy = false;
const curtain = () => document.getElementById("curtain");

function cover(label: string) {
  return new Promise<void>((res) => {
    const c = curtain();
    if (!c || prefersReduced()) return res();
    busy = true;
    const span = c.querySelector("span");
    if (span) span.textContent = label;
    gsap.timeline({ onComplete: () => { covered = true; res(); } })
      .set(c, { visibility: "visible" })
      .fromTo(c.querySelectorAll("i"), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.6, stagger: 0.07, ease: "expo.inOut" })
      .fromTo(span, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }, 0.3);
  });
}

export function reveal() {
  lenis?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
  const c = curtain();
  if (!c || !covered) { busy = false; return; }
  covered = false;
  gsap.timeline({ onComplete: () => { busy = false; gsap.set(c, { visibility: "hidden" }); } })
    .to(c.querySelector("span"), { opacity: 0, x: 40, duration: 0.35, ease: "expo.in" }, 0.1)
    .to([...c.querySelectorAll("i")].reverse(), { scaleX: 0, transformOrigin: "100% 50%", duration: 0.7, stagger: 0.07, ease: "expo.inOut" }, 0.2);
}

type Props = { href: string; label?: string; children: ReactNode; onNavigate?: () => void } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;
const BASE = process.env.NEXT_PUBLIC_BASE ?? "";
const slash = (h: string) => { const [p, q] = h.split("?"); return (p.endsWith("/") ? p : p + "/") + (q ? "?" + q : ""); };

/** Link that plays the curtain before navigating. */
export function TLink({ href, label, children, onNavigate, ...rest }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate?.();
    const path = href.split("?")[0].replace(/\/$/, "") || "/";
    if (path === (pathname.replace(/\/$/, "") || "/") && !href.includes("?")) { lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (busy) return;
    await cover(label || "Tour Steliant");
    router.push(slash(href));
  };
  return <a href={BASE + slash(href)} onClick={onClick} {...rest}>{children}</a>;
}

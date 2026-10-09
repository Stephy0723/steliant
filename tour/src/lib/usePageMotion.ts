"use client";
import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reveals } from "./motion";

export function usePageMotion(ref: RefObject<HTMLElement | null>, deps: unknown[], extra?: (el: HTMLElement) => void | (() => void)) {
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let cleanup: void | (() => void);
    const ctx = gsap.context(() => { reveals(el); cleanup = extra?.(el); }, el);
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => { cancelAnimationFrame(id); cleanup?.(); ctx.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

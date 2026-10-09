"use client";
import { useEffect, useRef } from "react";

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ0123456789:·-→";

/** Split-flap display (terminal departure board). Each cell flips through characters until it lands. */
export default function Flap({ text, len, className = "", delay = 0 }: { text: string; len?: number; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<string>("");
  const target = (len ? text.toUpperCase().padEnd(len, " ").slice(0, len) : text.toUpperCase());

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cells = () => [...el.querySelectorAll<HTMLElement>("i")];
    // Make sure we have the right number of cells.
    while (el.children.length < target.length) el.appendChild(document.createElement("i"));
    while (el.children.length > target.length) el.lastChild?.remove();
    const timers: number[] = [];
    cells().forEach((c, i) => {
      const final = target[i] === " " ? " " : target[i];
      const from = shown.current[i] || " ";
      if (reduce || from === target[i]) { c.textContent = final; return; }
      let n = 0; const steps = 4 + Math.floor(Math.random() * 6);
      const start = window.setTimeout(() => {
        const id = window.setInterval(() => {
          n++;
          c.classList.remove("flip"); void c.offsetWidth; c.classList.add("flip");
          if (n >= steps) { c.textContent = final; clearInterval(id); }
          else c.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
        }, 55);
        timers.push(id);
      }, delay + i * 28);
      timers.push(start);
    });
    shown.current = target;
    return () => {
      timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
      cells().forEach((c, i) => { c.textContent = target[i] === " " ? "\u00a0" : target[i]; });
    };
  }, [target, delay]);

  return <span className={`flap ${className}`} ref={ref} aria-label={text} />;
}

"use client";
import type { ReactNode } from "react";

/** Title split into lines → words → characters; the last line is set in the accent italic. */
export function Split({ lines, as: Tag = "h2", className = "" }: { lines: string[]; as?: "h1" | "h2"; className?: string }) {
  return (
    <Tag className={`chars ${className}`}>
      {lines.map((l, i) => (
        <span key={i} className={`ln${i === lines.length - 1 ? " accent" : ""}`}>
          {l.split(" ").map((w, k) => (
            <span key={k}><span className="wd">{[...w].map((c, j) => <span key={j} className="ch">{c}</span>)}</span>{k < l.split(" ").length - 1 ? " " : ""}</span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
export const Img = ({ src, alt = "", eager = false, className = "" }: { src: string; alt?: string; eager?: boolean; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img className={`ph ${className}`} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={(e) => e.currentTarget.classList.add("broken")} />
);
export const Eyebrow = ({ children, className = "" }: { children: ReactNode; className?: string }) => <p className={`eyebrow ${className}`}>{children}</p>;
export const Arrow = () => (
  <svg className="arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 8h12M9 3l5 5-5 5" /></svg>
);

export function PageHeader({ eyebrow, title, lede, image, children }: { eyebrow: string; title: string[]; lede: string; image: string; children?: ReactNode }) {
  return (
    <section className="page-head">
      <div className="ph-bg" aria-hidden="true"><Img src={image} eager /></div>
      <div className="wrap ph-content">
        <Eyebrow className="ph-in">{eyebrow}</Eyebrow>
        <Split lines={title} as="h1" />
        <p className="ph-lede ph-in">{lede}</p>
        {children}
      </div>
      <div className="ph-ticket ph-in" aria-hidden="true"><span>TS</span><span>RD</span></div>
    </section>
  );
}

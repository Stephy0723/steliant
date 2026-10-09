"use client";
import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reveal } from "@/lib/transition";

export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    reveal();
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, []);
  return <div className="page">{children}</div>;
}

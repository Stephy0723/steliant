"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { T, type Lang, type Dict } from "./content";

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: "es", t: T.es, setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>("es");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("ts-lang"); } catch { /* storage unavailable */ }
    const l = saved === "en" || saved === "es" ? saved : navigator.language?.startsWith("en") ? "en" : "es";
    if (l !== "es") set(l);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    if (l === lang) return;
    document.body.classList.add("swapping");
    window.setTimeout(() => {
      set(l);
      try { localStorage.setItem("ts-lang", l); } catch { /* storage unavailable */ }
      requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("swapping")));
    }, 220);
  }, [lang]);
  return <LangCtx.Provider value={{ lang, t: T[lang], setLang }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
export const money = (n: number) => "RD$" + n.toLocaleString("en-US");

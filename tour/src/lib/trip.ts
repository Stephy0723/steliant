"use client";
import type { CityId } from "./content";

export type Trip = { from: CityId; to: CityId; date: string; time: string; seats: number[]; people: { name: string; doc: string }[]; code: string; gate: string };
export const TRIP_EVENT = "ts-trip";
export const seatName = (n: number) => (n > 40 ? `11${"ABCDE"[n - 41]}` : `${Math.ceil(n / 4)}${"ABCD"[(n - 1) % 4]}`);

export function loadTrip(): Trip | null {
  try { return JSON.parse(localStorage.getItem("ts-trip") || "null"); } catch { return null; }
}
export function saveTrip(t: Trip) {
  try { localStorage.setItem("ts-trip", JSON.stringify(t)); } catch { /* storage unavailable */ }
  dispatchEvent(new CustomEvent(TRIP_EVENT, { detail: { fresh: true } }));
}
export function departAt(t: Trip) { const [h, m] = t.time.split(":").map(Number); const d = new Date(t.date + "T00:00:00"); d.setHours(h, m, 0, 0); return d; }

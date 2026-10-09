import { CITIES, type CityId } from "./content";

export type Bus = { id: string; from: CityId; to: CityId; p: number; speed: number };
/** Position along a gently arced line between two terminals. */
export const pos = (b: Pick<Bus, "from" | "to" | "p">): [number, number] => {
  const a = CITIES[b.from], c = CITIES[b.to], t = b.p;
  return [a.lat + (c.lat - a.lat) * t + Math.sin(Math.PI * t) * 0.12, a.lng + (c.lng - a.lng) * t];
};

(() => {
"use strict";
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasG = typeof gsap !== "undefined";
if (hasG) gsap.registerPlugin(ScrollTrigger);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const usd = (n) => "US$" + Math.round(n).toLocaleString("en-US");
const rd = (n) => "RD$" + Math.round(n).toLocaleString("en-US");
const U = (id, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;
const pic = (src, cls = "ph", alt = "") => `<img class="${cls}" src="${src}" alt="${alt}" loading="lazy" decoding="async" onerror="this.classList.add('broken')">`;
const IMG = {
  villa: U("1613490493576-7fde63acd811", 2200), pool: U("1600596542815-ffad4c1539a9", 2200), modern: U("1600585154340-be6161a56a0c", 2000), house: U("1512917774080-9991f1c4c750", 2000),
  home2: U("1580587771525-78b9dba3b914", 1800), lux: U("1605276374104-dee2a0ed3cd6", 1800), white: U("1487958449943-2429e8be8625", 1800), glass: U("1486406146926-c627a92ad1ab", 1800),
  facade: U("1545324418-cc1a3fa10c00", 1800), tower: U("1460317442991-0ec209397118", 1800), office: U("1497366216548-37526070297c", 1800), resort: U("1566073771259-6a8506099945", 1800),
  room: U("1582719478250-c89cae4dc85b", 1600), living: U("1600210492486-724fe5c67fb0", 1800), interior: U("1600607687939-ce8a6c25118c", 1800), kitchen: U("1600566753190-17f0baa2a6c3", 1800),
  inter2: U("1618221195710-dd6b41faaea6", 1600), bed: U("1616594039964-ae9021a400a0", 1600), site: U("1503387762-592deb58ef4e", 1800), crane: U("1504307651254-35680f356dfd", 1800),
  crew: U("1541888946425-d81bb19240f5", 1800), eng: U("1581094794329-c8112a89af12", 1600), plans: U("1503174971373-b1f69850bded", 1600), house3: U("1564013799919-ab600027ffc6", 1800),
};
const PROJECTS = [
  { id: "casa-arrecife", cat: "res", loc: "Cap Cana", year: 2025, area: 1240, floors: 2, img: IMG.pool, before: IMG.site, gal: [IMG.pool, IMG.living, IMG.kitchen, IMG.bed],
    es: ["Casa Arrecife", "Villa frente al mar con voladizos de concreto visto, piscina infinita y fachadas de vidrio que abren la casa al Caribe."], en: ["Arrecife House", "Oceanfront villa with exposed-concrete cantilevers, an infinity pool and glass façades that open the home to the Caribbean."] },
  { id: "torre-onix", cat: "res", loc: "Santo Domingo", year: 2026, area: 18600, floors: 18, img: IMG.tower, before: IMG.crane, gal: [IMG.tower, IMG.interior, IMG.inter2, IMG.kitchen],
    es: ["Torre Ónix", "18 niveles de apartamentos de lujo con amenidades en azotea, lobby a doble altura y fachada de aluminio arquitectónico."], en: ["Ónix Tower", "18 levels of luxury apartments with rooftop amenities, a double-height lobby and an architectural aluminum façade."] },
  { id: "corporativo-meridian", cat: "corp", loc: "Santo Domingo", year: 2024, area: 9400, floors: 12, img: IMG.glass, before: IMG.crew, gal: [IMG.glass, IMG.office, IMG.white, IMG.facade],
    es: ["Corporativo Meridian", "Torre de oficinas clase A con muro cortina de alto desempeño y certificación de eficiencia energética."], en: ["Meridian Corporate", "Class-A office tower with a high-performance curtain wall and energy-efficiency certification."] },
  { id: "resort-bahia", cat: "hotel", loc: "Punta Cana", year: 2025, area: 32000, floors: 5, img: IMG.resort, before: IMG.site, gal: [IMG.resort, IMG.room, IMG.pool, IMG.living],
    es: ["Resort Bahía Blanca", "Complejo hotelero de 240 habitaciones con piscinas en cascada, spa y centro de convenciones."], en: ["Bahía Blanca Resort", "240-room resort with cascading pools, spa and convention center."] },
  { id: "villa-montana", cat: "res", loc: "Jarabacoa", year: 2024, area: 860, floors: 2, img: IMG.modern, before: IMG.crew, gal: [IMG.modern, IMG.inter2, IMG.bed, IMG.kitchen],
    es: ["Villa Montaña", "Residencia de montaña en piedra, madera y acero, con vistas de 270° al valle."], en: ["Mountain Villa", "Mountain residence in stone, wood and steel with 270° valley views."] },
  { id: "plaza-atlantica", cat: "com", loc: "Santiago", year: 2023, area: 14800, floors: 3, img: IMG.facade, before: IMG.crane, gal: [IMG.facade, IMG.white, IMG.office, IMG.glass],
    es: ["Plaza Atlántica", "Centro comercial de tres niveles con 86 locales, food hall y estacionamiento soterrado."], en: ["Atlántica Plaza", "Three-level shopping center with 86 stores, a food hall and underground parking."] },
  { id: "residencia-lago", cat: "res", loc: "Las Terrenas", year: 2026, area: 640, floors: 2, img: IMG.house, before: IMG.site, gal: [IMG.house, IMG.living, IMG.interior, IMG.bed],
    es: ["Residencia del Lago", "Casa contemporánea de líneas puras con patio interior, techos verdes y domótica completa."], en: ["Lake Residence", "Contemporary home with pure lines, an inner courtyard, green roofs and full home automation."] },
  { id: "galeria-lux", cat: "com", loc: "Santo Domingo", year: 2025, area: 3200, floors: 4, img: IMG.white, before: IMG.crew, gal: [IMG.white, IMG.inter2, IMG.office, IMG.facade],
    es: ["Galería Lux", "Edificio de showrooms y boutiques con fachada escultórica de concreto blanco."], en: ["Lux Gallery", "Showroom and boutique building with a sculptural white-concrete façade."] },
];
/* Torre Ónix: unidades en venta */
const TYPES = { A: { m2: 86, beds: 1, baths: 1.5, park: 1 }, B: { m2: 124, beds: 2, baths: 2.5, park: 2 }, C: { m2: 168, beds: 3, baths: 3.5, park: 2 }, PH: { m2: 310, beds: 4, baths: 4.5, park: 3 } };
const FLOORS = 18, PRICE_M2 = 2650; // US$ por m², referencia de lujo en Santo Domingo
const unitType = (f, u) => (f >= 17 ? "PH" : ["A", "B", "C", "B"][u]);
const unitStatus = (f, u) => { if (f >= 17 && u > 1) return "none"; const h = (f * 7 + u * 13 + f * u) % 10; return h < 3 ? "sold" : h < 4 ? "held" : "free"; };
const unitPrice = (f, u) => TYPES[unitType(f, u)].m2 * PRICE_M2 * (1 + (f - 1) * 0.012);
const FINISH = { std: 38000, pre: 55000, lux: 82000 }; // RD$ por m² (estructura + terminación, 2026)
const EXTRAS = { pool: 1800000, smart: 950000, solar: 1200000, lift: 2600000 };

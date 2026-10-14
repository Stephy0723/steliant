(() => {
"use strict";
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasG = typeof gsap !== "undefined";
if (hasG) gsap.registerPlugin(ScrollTrigger);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rd = (n) => "RD$" + Math.round(n).toLocaleString("en-US");
const U = (id, w = 900) => (id.startsWith("data:") ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`);
const pic = (src, alt = "", cls = "") => `<img${cls ? ` class="${cls}"` : ""} src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.classList.add('broken')">`;
const HERO = { a: "1441986300917-64674bd600d8", b: "1483985988355-763728e1935b", c: "1445205170230-053b83016050" };
const CATS = [
  { id: "bolsos", img: "1584917865442-de89df76afd3", es: "Bolsos", en: "Bags" },
  { id: "calzado", img: "1542291026-7eec264c27ff", es: "Calzado", en: "Shoes" },
  { id: "relojes", img: "1523275335684-37898b6baf30", es: "Relojes", en: "Watches" },
  { id: "gafas", img: "1572635196237-14b3f281503f", es: "Gafas", en: "Eyewear" },
  { id: "belleza", img: "1541643600914-78b084683601", es: "Belleza", en: "Beauty" },
  { id: "accesorios", img: "1526170375885-4d8ecf77b99f", es: "Accesorios", en: "Accessories" },
];
/* stock: número total o tallas {talla: unidades} */
const SEED = [
  { id: "p01", cat: "bolsos", price: 6900, old: 8200, imgs: ["1584917865442-de89df76afd3", "1548036328-c9fa89d128fa"], stock: 7, sku: "BL-210", es: ["Bolso Alma de cuero", "Cuero vacuno curtido al vegetal, herrajes dorados y correa ajustable."], en: ["Alma leather bag", "Vegetable-tanned cowhide, gold hardware and adjustable strap."], new: true, views: 812 },
  { id: "p02", cat: "bolsos", price: 4650, imgs: ["1548036328-c9fa89d128fa", "1584917865442-de89df76afd3"], stock: 2, sku: "BL-118", es: ["Tote Marina", "Lona encerada y asas de cuero, cabe una laptop de 14”."], en: ["Marina tote", "Waxed canvas and leather handles, fits a 14” laptop."], views: 433 },
  { id: "p03", cat: "bolsos", price: 3950, imgs: ["1553062407-98eeb64c6a62", "1548036328-c9fa89d128fa"], stock: 0, sku: "BL-305", es: ["Mochila Urbana", "Impermeable, bolsillo acolchado y cierre antirrobo."], en: ["Urban backpack", "Water-resistant, padded sleeve and anti-theft zipper."], views: 690 },
  { id: "p04", cat: "calzado", price: 5450, imgs: ["1542291026-7eec264c27ff", "1460353581641-37baddab0fa2"], stock: { 38: 2, 39: 0, 40: 4, 41: 3, 42: 1, 43: 0 }, sku: "CZ-401", es: ["Tenis Pulse Rojo", "Malla transpirable y suela de espuma reactiva."], en: ["Pulse red sneakers", "Breathable mesh and responsive foam sole."], new: true, views: 1204 },
  { id: "p05", cat: "calzado", price: 6200, imgs: ["1549298916-b41d501d3772", "1595950653106-6c9ebd614d3a"], stock: { 39: 1, 40: 2, 41: 0, 42: 2, 43: 1 }, sku: "CZ-415", es: ["Tenis Studio Blanco", "Cuero liso, plantilla de memoria y costuras reforzadas."], en: ["Studio white sneakers", "Smooth leather, memory insole and reinforced stitching."], views: 876 },
  { id: "p06", cat: "calzado", price: 4800, old: 5600, imgs: ["1460353581641-37baddab0fa2", "1542291026-7eec264c27ff"], stock: { 37: 0, 38: 0, 39: 0, 40: 0 }, sku: "CZ-322", es: ["Runner Neón", "Ligeros para correr y para el día a día."], en: ["Neon runner", "Light enough for running and everyday wear."], views: 512 },
  { id: "p07", cat: "relojes", price: 12900, imgs: ["1523275335684-37898b6baf30", "1524805444758-089113d48a6d"], stock: 4, sku: "RL-090", es: ["Reloj Minimal 40", "Caja de acero, cristal de zafiro y correa de cuero italiano."], en: ["Minimal 40 watch", "Steel case, sapphire crystal and Italian leather strap."], views: 980 },
  { id: "p08", cat: "relojes", price: 15800, imgs: ["1524805444758-089113d48a6d", "1523275335684-37898b6baf30"], stock: 1, sku: "RL-112", es: ["Reloj Clásico Oro", "Movimiento automático y reserva de marcha de 40 h."], en: ["Classic gold watch", "Automatic movement with 40 h power reserve."], new: true, views: 655 },
  { id: "p09", cat: "gafas", price: 3250, imgs: ["1572635196237-14b3f281503f", "1511499767150-a48a237f0083"], stock: 12, sku: "GF-031", es: ["Gafas Sol Habana", "Lentes polarizados UV400 y montura de acetato."], en: ["Habana sunglasses", "UV400 polarized lenses and acetate frame."], views: 744 },
  { id: "p10", cat: "gafas", price: 2890, imgs: ["1511499767150-a48a237f0083", "1572635196237-14b3f281503f"], stock: 6, sku: "GF-044", es: ["Gafas Redondas Metal", "Montura ultraligera y plaquetas de silicona."], en: ["Round metal glasses", "Ultra-light frame and silicone nose pads."], views: 301 },
  { id: "p11", cat: "belleza", price: 4800, imgs: ["1541643600914-78b084683601", "1596462502278-27bfdc403348"], stock: 9, sku: "BZ-201", es: ["Perfume Noir 50 ml", "Notas de vainilla, ámbar y madera de cedro."], en: ["Noir perfume 50 ml", "Notes of vanilla, amber and cedarwood."], views: 1102 },
  { id: "p12", cat: "belleza", price: 2350, imgs: ["1556228578-8c89e6adf883", "1596462502278-27bfdc403348"], stock: 3, sku: "BZ-118", es: ["Set Skincare Glow", "Limpiador, sérum y crema hidratante."], en: ["Glow skincare set", "Cleanser, serum and moisturizer."], views: 590 },
  { id: "p13", cat: "belleza", price: 1650, imgs: ["1596462502278-27bfdc403348", "1556228578-8c89e6adf883"], stock: 0, sku: "BZ-077", es: ["Paleta Nude", "12 tonos mate y satinados de larga duración."], en: ["Nude palette", "12 long-lasting matte and satin shades."], views: 377 },
  { id: "p14", cat: "accesorios", price: 7950, imgs: ["1526170375885-4d8ecf77b99f", "1505740420928-5e560c06d30e"], stock: 5, sku: "AC-501", es: ["Cámara Instantánea", "Fotos al instante con flash automático y espejo selfie."], en: ["Instant camera", "Instant prints with auto flash and selfie mirror."], new: true, views: 840 },
  { id: "p15", cat: "accesorios", price: 6450, imgs: ["1505740420928-5e560c06d30e", "1526170375885-4d8ecf77b99f"], stock: 8, sku: "AC-512", es: ["Audífonos Studio", "Cancelación de ruido y 30 h de batería."], en: ["Studio headphones", "Noise cancelling and 30 h battery."], views: 1320 },
  { id: "p16", cat: "accesorios", price: 1450, imgs: ["1521369909029-2afed882baee", "1551028719-00167b16eac5"], stock: 15, sku: "AC-120", es: ["Gorra Lino", "Lino lavado con cierre de hebilla."], en: ["Linen cap", "Washed linen with buckle closure."], views: 210 },
];
let PRODUCTS = (() => { try { const s = JSON.parse(store.get("vt-products") || "null"); if (Array.isArray(s) && s.length) return s; } catch (e) {} return JSON.parse(JSON.stringify(SEED)); })();
const saveProducts = () => { if (!store.set("vt-products", JSON.stringify(PRODUCTS))) store.set("vt-products", JSON.stringify(PRODUCTS.map((p) => ({ ...p, imgs: p.imgs.filter((i) => !i.startsWith("data:")).length ? p.imgs.filter((i) => !i.startsWith("data:")) : p.imgs })))); };
const stockOf = (p) => (typeof p.stock === "number" ? p.stock : Object.values(p.stock).reduce((a, b) => a + b, 0));
const level = (p) => { const s = stockOf(p); return s === 0 ? "out" : s <= 3 ? "low" : "ok"; };
const byId = (id) => PRODUCTS.find((p) => p.id === id);

/* datos de ejemplo del panel */
const NAMES = ["Laura Peña", "Carlos Méndez", "Ana Rodríguez", "José Almonte", "María Fernández", "Luis Castillo", "Paola Jiménez", "Diego Batista", "Carla Núñez", "Rafael Guzmán", "Sofía Reyes", "Andrés Polanco", "Valeria Cruz", "Miguel Santana"];
const CITIES = ["Santo Domingo", "Santiago", "La Romana", "Punta Cana", "San Cristóbal", "Puerto Plata", "La Vega"];
const CARRIERS = ["Mensajería propia", "Courier nacional", "Retiro en tienda"];
const rnd = (() => { let s = 7; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
const CUSTOMERS = NAMES.map((n, i) => ({ id: "c" + (i + 1), name: n, city: CITIES[i % CITIES.length], phone: "809-555-" + String(1000 + i * 37).slice(-4), email: n.toLowerCase().split(" ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "") + "@correo.com", since: 2023 + (i % 3), img: ["1494790108377-be9c29b29330", "1507003211169-0a1dd7228f2d", "1438761681033-6461ffad8d80", "1500648767791-00dcc994a43e", "1544005313-94ddf0286df2", "1506794778202-cad84cf45f1d", "1517841905240-472988babdf9"][i % 7] }));
const ORDER_ST = ["paid", "prep", "ship", "done"];
const ORDERS = Array.from({ length: 84 }, (_, i) => {
  const c = CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)]; const n = 1 + Math.floor(rnd() * 3); const items = [];
  for (let k = 0; k < n; k++) { const p = SEED[Math.floor(rnd() * SEED.length)]; items.push({ id: p.id, qty: 1 + Math.floor(rnd() * 2), price: p.price }); }
  const day = Math.floor(i * 0.72 + rnd() * 0.6); const d = new Date(); d.setHours(10 + Math.floor(rnd() * 9), Math.floor(rnd() * 60), 0, 0); d.setDate(d.getDate() - day);
  const st = day > 6 ? "done" : day > 3 ? ORDER_ST[2 + Math.floor(rnd() * 2)] : ORDER_ST[Math.floor(rnd() * 3)];
  const total = items.reduce((a, it) => a + it.qty * it.price, 0);
  return { id: "V-" + (2480 - i), cust: c.id, items, total, date: d.toISOString(), status: st, carrier: CARRIERS[Math.floor(rnd() * 3)], track: "TRK" + String(Math.floor(rnd() * 900000) + 100000), pay: ["Tarjeta", "Transferencia", "Efectivo"][Math.floor(rnd() * 3)] };
});
let EXTRA_ORDERS = (() => { try { return JSON.parse(store.get("vt-orders") || "[]"); } catch (e) { return []; } })();
let SHIP_OVR = (() => { try { return JSON.parse(store.get("vt-ship") || "{}"); } catch (e) { return {}; } })();
const allOrders = () => [...EXTRA_ORDERS, ...ORDERS].map((o) => (SHIP_OVR[o.id] ? { ...o, status: SHIP_OVR[o.id] } : o));

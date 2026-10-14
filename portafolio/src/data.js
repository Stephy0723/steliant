(() => {
"use strict";
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasG = typeof gsap !== "undefined";
if (hasG) gsap.registerPlugin(ScrollTrigger);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const usd = (n) => { const v = n / USD_RATE; return "US$" + (v >= 100 ? Math.round(v / 5) * 5 : Math.round(v)).toLocaleString("en-US"); }; // RD$ → US$ redondeado
const money = (n) => (lang === "en" ? usd(n) : "RD$" + Math.round(n).toLocaleString("en-US"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ===== Configuración editable ===== */
const CONTACT = { whatsapp: "", email: "", city: "Santo Domingo, RD" }; // ← coloca tu número (solo dígitos, ej. 18095551234) y tu correo
const DEMO_BASE = "demos/"; // las demos viven en el mismo sitio del portafolio
const USD_RATE = 63; // RD$ por cada US$: los precios en inglés se muestran en dólares con esta tasa
const GH = "https://github.com/Stephy0723/";
const BRANCH = "/tree/steliant-exhibicion-completa";

/* ===== Proyectos ===== */
const PROJECTS = [
  { id: "ecommerce", name: "Steliant Nova", repo: "ecommerce-electrocables", branch: true, demo: "steliant-ecommerce", pkg: "shop", cat: "shop", pal: ["#7a5cff", "#22d3ee", "#ff4ecd"], stack: ["React", "Vite", "GSAP"],
    es: ["Tienda de tecnología futurista con efecto vidrio: catálogo con filtros, carrito, checkout con tarjeta 3D, seguimiento de pedido y panel de ventas.", ["Catálogo con filtros animados", "Checkout con tarjeta 3D", "Seguimiento de pedido", "Panel de ventas e inventario"]],
    en: ["Futuristic glass tech store: filtered catalog, cart, 3D card checkout, order tracking and sales dashboard.", ["Animated catalog filters", "3D card checkout", "Order tracking", "Sales & inventory dashboard"]] },
  { id: "reservas", name: "Steliant Reservas", repo: "sistema-reservas", branch: true, demo: "steliant-reservas", pkg: "crm", cat: "crm", pal: ["#ff5f45", "#f2a93b", "#139c86"], stack: ["Vite", "GSAP", "Bot"],
    es: ["Software de reservas para barberías, salones y spas: página web por nicho, bot que agenda por WhatsApp e Instagram y panel por plan.", ["Configurador de marca en vivo", "3 demos de página web", "Bot que agenda de verdad", "Paneles Solo, Equipo y Studio"]],
    en: ["Booking software for barbershops, salons and spas: niche website, a bot that books on WhatsApp and Instagram, and a dashboard per plan.", ["Live brand configurator", "3 website demos", "A bot that really books", "Solo, Team and Studio dashboards"]] },
  { id: "tour", name: "Tour Steliant", repo: "tours-rd", branch: true, demo: "tour-steliant", pkg: "web", cat: "web", pal: ["#d9412a", "#13839c", "#f4e9d2"], stack: ["Next.js", "GSAP", "Leaflet"],
    es: ["Agencia de tours y transporte: hero cinematográfico, horarios tipo aeropuerto, reserva de asientos, pago y boleto con QR.", ["Hero cinematográfico", "Tablero de salidas", "Selección de asientos", "Boleto con QR"]],
    en: ["Tours & transport agency: cinematic hero, airport-style departures, seat booking, payment and QR ticket.", ["Cinematic hero", "Departures board", "Seat selection", "QR ticket"]] },
  { id: "onix", name: "Steliant Ónix", repo: "onix-constructora", branch: false, demo: "steliant-onix", pkg: "web", cat: "web", pal: ["#8c8274", "#121110", "#c9a86a"], stack: ["HTML", "GSAP", "SVG"],
    es: ["Constructora de lujo: plano interactivo de una torre en venta, separación de unidades con pago, cotizador de obra y portafolio de proyectos.", ["Plano de 18 pisos por unidad", "Separación con tarjeta 3D", "Cotizador de construcción", "Antes y después de cada obra"]],
    en: ["Luxury builder: interactive plan of a tower for sale, unit holds with payment, build estimator and project portfolio.", ["18-floor plan by unit", "3D card unit hold", "Construction estimator", "Before/after for every build"]] },
  { id: "firma", name: "Steliant Firma", repo: "firma-legal", branch: true, demo: "steliant-firma", pkg: "web", cat: "web", pal: ["#b08a4a", "#14213d", "#e9e2d0"], stack: ["React", "Vite", "GSAP"],
    es: ["Sitio de firma de abogados: áreas de práctica, equipo, casos y contacto con un estilo editorial y elegante.", ["Áreas de práctica", "Perfiles del equipo", "Diseño editorial", "Formulario de consulta"]],
    en: ["Law firm website: practice areas, team, cases and contact in an elegant editorial style.", ["Practice areas", "Team profiles", "Editorial design", "Consultation form"]] },
  { id: "salud", name: "Steliant Salud", repo: "hospital-system", branch: true, demo: "steliant-salud", pkg: "system", cat: "system", pal: ["#2b7cff", "#16c1a8", "#e6f2ff"], stack: ["React", "Node", "SQL"],
    es: ["Sistema hospitalario: citas, pacientes, historial clínico y paneles por rol para recepción, médicos y administración.", ["Gestión de citas", "Historial clínico", "Paneles por rol", "Reportes"]],
    en: ["Hospital system: appointments, patients, medical records and role-based dashboards for front desk, doctors and admin.", ["Appointment management", "Medical records", "Role dashboards", "Reports"]] },
  { id: "esports", name: "Steliant Esports", repo: "glitchgang", branch: true, demo: "steliant-esports", pkg: "system", cat: "system", pal: ["#ff2e63", "#08d9d6", "#252a34"], stack: ["React", "Node", "Bot"],
    es: ["Plataforma de esports: equipos, jugadores y torneos con brackets, pensada para comunidades gamer.", ["Torneos y brackets", "Equipos y jugadores", "Estética gamer", "Módulos listos para servidor"]],
    en: ["Esports platform: teams, players and tournaments with brackets, built for gaming communities.", ["Tournaments & brackets", "Teams & players", "Gamer aesthetic", "Server-ready modules"]] },
  { id: "larimar", name: "Steliant Larimar", repo: "larimar", branch: false, demo: "steliant-larimar", pkg: "web", cat: "web", pal: ["#3ec1d3", "#0b3c5d", "#f2f7f9"], stack: ["Next.js", "React", "TypeScript"],
    es: ["Tienda de joyería larimar: catálogo por colección, detalle de productos, carrito y checkout de demostración.", ["Catálogo de joyería", "Colecciones y categorías", "Carrito de compra", "Checkout de demostración"]],
    en: ["Larimar jewellery store: collection catalog, product details, cart and demonstration checkout.", ["Jewellery catalog", "Collections and categories", "Shopping cart", "Demo checkout"]] },
  { id: "larimarcrm", name: "Steliant Larimar CRM", repo: "larimar-prestamos", branch: false, demo: "steliant-larimar-crm", pkg: "system", cat: "crm", pal: ["#0b3c5d", "#3ec1d3", "#f4b942"], stack: ["Next.js", "React", "TypeScript"],
    es: ["CRM de préstamos: clientes, solicitudes, cuotas, cobros, mora y reportes para la cartera.", ["Clientes y solicitudes", "Plan de cuotas", "Cobros y mora", "Reportes de cartera"]],
    en: ["Loans CRM: clients, applications, installments, collections, delinquency and portfolio reports.", ["Clients & applications", "Installment plans", "Collections & delinquency", "Portfolio reports"]] },
  { id: "coral", name: "Coral Stays", repo: "coral-stays-crm", branch: false, demo: "coral-stays", pkg: "web", cat: "web", pal: ["#078ea1", "#d9f5ee", "#123b45"], stack: ["HTML", "JavaScript", "Cloudflare"],
    es: ["Alojamientos caribeños con galerías, buscador, mapas, asesor de propiedad y solicitud de estancia. Demo con datos de referencia.", ["Galerías de alojamientos", "Buscador y filtros", "Mapas y asesor", "Solicitud de estancia"]],
    en: ["Caribbean stays with galleries, search, maps, property advisor and stay requests. Demo with reference data.", ["Property galleries", "Search and filters", "Maps and advisor", "Stay request"]] },
  { id: "brasa", name: "BRASA Atelier", repo: "coral-stays-crm", github: "https://github.com/Stephy0723/coral-stays-crm/tree/brasa-atelier", branch: false, demo: "brasa-atelier", pkg: "web", cat: "web", pal: ["#b69a70", "#201d1a", "#f3eee5"], stack: ["HTML", "CSS", "JavaScript"],
    es: ["Restaurante con carta filtrable, carrito y total en RD$, ambientes con selección de mesa, reservas y tema claro/oscuro. Solicitudes de demostración.", ["Carta, buscador y precios", "Pedidos y cantidades", "Ambientes y mesas", "Español/inglés y temas"]],
    en: ["Restaurant with searchable menu, cart and RD$ totals, spaces and table selection, bookings and light/dark themes. Demonstration requests.", ["Menu, search and prices", "Orders and quantities", "Spaces and tables", "Spanish/English and themes"]] },
  { id: "slabogados", name: "SL Abogados", repo: "steliant", github: "https://github.com/Stephy0723/steliant/tree/main/sl-abogados", branch: false, demo: "sl-abogados", pkg: "crm", cat: "crm", pal: ["#1e4a41", "#946c2e", "#f1f2ee"], stack: ["HTML", "JavaScript", "CRM"], langs: 1,
    es: ["Despacho de abogados con 21 áreas y más de 120 servicios con honorarios, plazos y procesos, catálogo de inmuebles, equipo con licencias y CRM con inicio de sesión.", ["Servicios con precio y proceso", "Inmuebles en alquiler y venta", "Agenda de consultas", "CRM con roles y editor de contenido"]],
    en: ["Law firm with 21 practice areas and 120+ services with fees, timelines and processes, property listings, team credentials and a CRM with login.", ["Services with fees and process", "Rentals and sales listings", "Consultation booking", "Role-based CRM and content editor"]] },
];
const MIRROR = { "sistema-reservas": "reservas", "tours-rd": "tour", glitchgang: "esports", "onix-constructora": "onix" }; // repos privados → copia limpia pública
const ghUrl = (p) => p.github || (MIRROR[p.repo] ? GH + "steliant/tree/main/" + MIRROR[p.repo] : GH + p.repo + (p.branch ? BRANCH : ""));
const LIVE = ["steliant-onix", "steliant-ecommerce", "steliant-reservas", "tour-steliant", "steliant-firma", "steliant-salud", "steliant-esports", "steliant-larimar", "steliant-larimar-crm", "coral-stays", "brasa-atelier", "sl-abogados"];
const demoUrl = (p) => (LIVE.includes(p.demo) ? DEMO_BASE + p.demo + "/" : null);

/* ===== Precios (RD$; en inglés se convierten a US$ con USD_RATE) ===== */
const PKGS = {
  web: { once: 45000, monthly: 5900, months: 12, hours: "40–60 h" },
  shop: { once: 95000, monthly: 11900, months: 12, hours: "90–130 h" },
  crm: { once: 125000, monthly: 14900, months: 12, hours: "120–170 h" },
  system: { once: 180000, monthly: 19900, months: 12, hours: "170–260 h" },
};
const EXTRAS = [{ id: "bot", price: 35000 }, { id: "pay", price: 15000 }, { id: "admin", price: 25000 }, { id: "lang", price: 8000 }, { id: "pwa", price: 30000 }];
const TERMS = [{ m: 6, fee: 0 }, { m: 12, fee: 0.08 }, { m: 18, fee: 0.14 }];
const HOSTING = 1500; // hosting + dominio + SSL + respaldo, por mes
const r100 = (n) => Math.ceil(n / 100) * 100;
Object.values(PKGS).forEach((p) => (p.monthly = r100((p.once * 1.08) / 12 + HOSTING))); // 12 meses, sin inicial, hosting incluido


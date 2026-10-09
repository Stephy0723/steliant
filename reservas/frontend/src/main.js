import "./setup.js";
import "./style.css";
(() => {
"use strict";
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasG = typeof gsap !== "undefined";
if (hasG) gsap.registerPlugin(ScrollTrigger);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const money = (n) => "RD$" + Math.round(n).toLocaleString("en-US");
const U = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;
const pic = (src, cls = "ph", alt = "") => `<img class="${cls}" src="${src}" alt="${alt}" loading="lazy" decoding="async" onerror="this.classList.add('broken')">`;
const IMG = {
  salon: U("1560066984-138dadb4c035", 2000), barber: U("1503951914875-452162b0f3f1", 1600), barber2: U("1585747860715-2ba37e788b70", 1600),
  hair: U("1522337360788-8b13dee7a37e", 1600), spa: U("1544161515-4ab6ce6db874", 1600), stones: U("1540555700478-4be289fbecef", 1600),
  nails: U("1604654894610-df63bc536371", 1400), makeup: U("1487412947147-5cebf100ffc2", 1400), facial: U("1570172619644-dfd03ed5d881", 1400),
  tattoo: U("1598371839696-5c5bb00bdc28", 1400), phone: U("1512941937669-90a1b58e7e9c", 1400), chair: U("1621605815971-fbc98d665033", 1600),
};
const BIZ = [
  { id: "barber", es: "Barberías", en: "Barbershops", img: IMG.barber, n: 1240 },
  { id: "salon", es: "Salones", en: "Hair salons", img: IMG.hair, n: 980 },
  { id: "spa", es: "Spa y masajes", en: "Spa & massage", img: IMG.spa, n: 410 },
  { id: "nails", es: "Uñas", en: "Nails", img: IMG.nails, n: 620 },
  { id: "beauty", es: "Estética", en: "Aesthetics", img: IMG.facial, n: 530 },
  { id: "tattoo", es: "Tattoo", en: "Tattoo", img: IMG.tattoo, n: 190 },
];
const S = (id, biz, min, price, img, es, en) => ({ id, biz, min, price, img, es, en });
const SERVICES = [
  S("s1", "barber", 45, 700, IMG.barber, ["Corte Pro", "Corte con lavado y acabado a navaja."], ["Pro Cut", "Cut with wash and razor finish."]),
  S("s2", "barber", 30, 450, IMG.barber2, ["Barba ritual", "Toalla caliente, perfilado y aceites."], ["Beard ritual", "Hot towel, shaping and oils."]),
  S("s3", "barber", 75, 1100, IMG.chair, ["Corte + barba", "El combo completo de la casa."], ["Cut + beard", "The full house combo."]),
  S("s4", "salon", 90, 2200, IMG.hair, ["Color Studio", "Color global con diagnóstico."], ["Color Studio", "Full color with diagnosis."]),
  S("s5", "salon", 150, 3500, IMG.salon, ["Balayage", "Iluminación a mano alzada."], ["Balayage", "Hand-painted highlights."]),
  S("s6", "salon", 45, 900, IMG.hair, ["Blower y peinado", "Brushing con acabado de salón."], ["Blowout & style", "Salon-finish blowout."]),
  S("s7", "spa", 60, 2400, IMG.spa, ["Masaje relajante", "Aromaterapia y presión media."], ["Relaxing massage", "Aromatherapy, medium pressure."]),
  S("s8", "spa", 90, 3200, IMG.stones, ["Piedras calientes", "Basalto y aceites tibios."], ["Hot stones", "Basalt stones and warm oils."]),
  S("s9", "nails", 60, 1800, IMG.nails, ["Uñas gel", "Esmaltado semipermanente."], ["Gel nails", "Semi-permanent polish."]),
  S("s10", "nails", 40, 950, IMG.nails, ["Manicure spa", "Exfoliación e hidratación."], ["Spa manicure", "Scrub and hydration."]),
  S("s11", "beauty", 60, 2600, IMG.facial, ["Limpieza facial", "Limpieza profunda e hidratación."], ["Facial cleanse", "Deep cleanse and hydration."]),
  S("s12", "beauty", 75, 3000, IMG.makeup, ["Maquillaje social", "Para eventos, con pestañas."], ["Event makeup", "For events, lashes included."]),
  S("s14", "spa", 50, 1900, IMG.facial, ["Facial hidratante", "Ácido hialurónico y masaje facial."], ["Hydrating facial", "Hyaluronic acid and facial massage."]),
  S("s13", "tattoo", 120, 6500, IMG.tattoo, ["Sesión tattoo", "Diseño mediano a color o línea."], ["Tattoo session", "Medium piece, color or line."]),
];
const P = (id, name, img, es, en, rating, biz) => ({ id, name, img: U(img, 600), es, en, rating, biz });
const PROS = [
  P("p1", "Adrián L.", "1507003211169-0a1dd7228f2d", "Barbero senior", "Senior barber", 4.9, ["barber", "tattoo"]),
  P("p2", "Paola M.", "1494790108377-be9c29b29330", "Estilista", "Stylist", 4.8, ["salon", "beauty"]),
  P("p3", "Camila T.", "1438761681033-6461ffad8d80", "Colorista", "Colorist", 5.0, ["salon", "nails"]),
  P("p4", "Luis H.", "1500648767791-00dcc994a43e", "Barbero", "Barber", 4.7, ["barber"]),
  P("p5", "María S.", "1534528741775-53994a69daeb", "Nail artist", "Nail artist", 4.9, ["nails", "beauty"]),
  P("p6", "Diego R.", "1506794778202-cad84cf45f1d", "Terapeuta", "Therapist", 4.8, ["spa", "tattoo"]),
  P("p7", "Elena V.", "1544005313-94ddf0286df2", "Terapeuta", "Therapist", 4.9, ["spa"]),
];
const PLANS = [
  { id: "com", price: 0, fee: true },
  { id: "solo", price: 1490 },
  { id: "team", price: 2990, featured: true },
  { id: "studio", price: 5490 },
];
const ADDONS = [{ id: "wa", price: 790 }, { id: "ai", price: 990 }, { id: "domain", price: 450 }, { id: "app", price: 1490 }, { id: "branch", price: 1200 }];
const NICHES = ["barber", "salon", "spa"];
const NICHE = {
  barber: { hero: IMG.barber, hero2: IMG.barber2, gal: [IMG.barber, IMG.chair, IMG.barber2], color: "#c9a24a" },
  salon: { hero: IMG.hair, hero2: IMG.salon, gal: [IMG.salon, IMG.hair, IMG.makeup], color: "#d4697a" },
  spa: { hero: IMG.spa, hero2: IMG.stones, gal: [IMG.stones, IMG.spa, IMG.facial], color: "#6f9a7c" },
};
const COLORS = ["#ff5f45", "#c9a24a", "#6f9a7c", "#7a5cff", "#d4697a"];
const T = {
  es: {
    nav: { home: "Inicio", demos: "Demos", bots: "Bots", panels: "Paneles", plans: "Planes", cta: "Empieza gratis", my: "Mi cita" },
    niche: { barber: "Barbería", salon: "Salón", spa: "Spa" },
    home: {
      kick: "Software de reservas, bots y CRM", title: ["Tu negocio", "reservando solo."], lede: "Página web con reservas, bot que agenda por WhatsApp e Instagram y un panel para manejar tu equipo y tus ventas. Todo listo en 15 minutos.",
      cta1: "Ver mi demo", cta2: "Ver planes",
      cfg: "Créalo en vivo", cfgName: "Nombre de tu negocio", cfgNiche: "Tipo de negocio", cfgColor: "Color de marca", cfgHint: "Escribe y mira cómo cambia tu página →",
      stats: [[3900, "+", "Negocios activos"], [1.2, "M", "Citas gestionadas"], [68, "%", "Menos ausencias"], [62, "%", "Citas agendadas por el bot"]],
      getKick: "Lo que te llevas", getTitle: ["Tres herramientas,", "un solo sistema"],
      get: [["Tu página web", "Una web con tu marca donde tus clientes reservan y pagan su depósito 24/7.", "Ver las demos"], ["Tu bot", "Responde y agenda por WhatsApp, Instagram y tu web mientras tú trabajas.", "Probar el bot"], ["Tu panel", "Agenda, clientes, equipo, comisiones y reportes en tiempo real.", "Ver los paneles"]],
      beforeKick: "Antes y después", beforeTitle: ["Del caos", "al control"], before: "Sin Steliant", after: "Con Steliant",
      chaos: [["Cliente 1", "¿Tienes hueco hoy???"], ["Cliente 2", "Voy tarde 15 min 🙏"], ["Cliente 3", "Cuánto cuesta el color?"], ["Cliente 4", "Al final no puedo ir"], ["Cliente 5", "Hola?? 😤"], ["Cliente 6", "Mañana a las 3?"]],
      order: ["47 mensajes respondidos por el bot", "12 citas confirmadas con depósito", "0 ausencias esta semana", "Comisiones calculadas solas"],
      quotesKick: "Clientes", quotes: [["Pasé de contestar mensajes toda la noche a dormir tranquila. La agenda se llena sola.", "Paola M.", "Estudio de color"], ["Con el depósito las ausencias bajaron casi a cero. Se pagó solo el primer mes.", "Adrián L.", "Barbería de 4 sillas"], ["El panel de comisiones nos ahorró un día completo de cuentas cada quincena.", "Diego R.", "Spa urbano"]],
      ctaTitle: ["¿Listo para", "llenar tu agenda?"], ctaText: "Empieza gratis con el plan Comisión. Sin tarjeta y sin contratos.",
    },
    demos: { kick: "Demos en vivo", title: ["Así se verá", "tu página"], lede: "Tres estilos diseñados para cada tipo de negocio. Navega y haz una reserva real de prueba.", desktop: "Escritorio", mobile: "Móvil", use: "Usar este estilo" },
    site: {
      book: "Reservar", services: "Servicios", team: "Equipo", reviews: "Reseñas", visit: "Visítanos", from: "Desde", min: "min",
      hero: { barber: ["Cortes con", "carácter."], salon: ["Tu mejor versión,", "a tu ritmo."], spa: ["Respira.", "Aquí todo es calma."] },
      sub: { barber: "Barbería clásica con técnica moderna. Reserva tu silla en segundos.", salon: "Color, corte y peinado de autor con diagnóstico personalizado.", spa: "Masajes, faciales y rituales para desconectar de verdad." },
      address: "Av. Winston Churchill 95, Santo Domingo", hours: "Lun–Sáb · 9:00–19:00",
      steps: ["Servicio", "Profesional", "Día y hora", "Tus datos"], any: "Cualquiera", next: "Continuar", back: "Atrás", confirm: "Confirmar y pagar depósito", name: "Nombre", phone: "WhatsApp",
      deposit: "Depósito", total: "Total", needSvc: "Elige un servicio.", needSlot: "Elige día y hora.", needData: "Completa nombre y WhatsApp.",
      revs: [["Excelente servicio, puntuales y súper profesionales.", "María G."], ["Reservé por el bot en un minuto. Volveré seguro.", "Carlos P."], ["El mejor ambiente de la ciudad.", "Lucía R."]],
    },
    bots: {
      kick: "Bots con IA", title: ["Tu mejor empleado", "no duerme nunca."], lede: "Responde al instante, entiende lo que el cliente quiere, ofrece horarios, cobra el depósito y deja la cita en tu panel. Escríbele: es real.",
      ph: "Escribe un mensaje…", online: "en línea · responde al instante", chips: ["Quiero una cita mañana", "¿Cuánto cuesta?", "¿Qué horario tienen?", "¿Dónde están?"],
      stats: [[2.8, " s", "Tiempo de respuesta"], [1284, "", "Mensajes respondidos hoy"], [62, "%", "Citas que agenda el bot"], [24, "/7", "Siempre disponible"]],
      flowKick: "Cómo trabaja", flow: [["Recibe", "WhatsApp, Instagram o tu web"], ["Entiende", "Servicio, día y preferencias"], ["Agenda", "Ofrece huecos reales"], ["Cobra", "Envía el link del depósito"], ["Recuerda", "24 h y 2 h antes"]],
      booked: "¡Nueva cita agendada por el bot!", see: "Ver en el panel",
      r: { hi: "¡Hola! 👋 Soy el asistente de {b}. Puedo agendarte una cita, darte precios u horarios. ¿Qué necesitas?", price: "Estos son nuestros precios:", hours: "Abrimos de lunes a sábado de 9:00 AM a 7:00 PM. 🕘", where: "Estamos en Av. Winston Churchill 95, Santo Domingo. 📍", which: "¡Claro! ¿Qué servicio te gustaría?", slots: "Para {s} {d} tengo estos horarios:", today: "hoy", tomorrow: "mañana", name: "Perfecto, {t}. ¿A nombre de quién la reservo?", done: "¡Listo, {n}! ✅ {s} {d} a las {t}. Te envié el link del depósito y te recordaré 2 h antes.", fallback: "Puedo ayudarte a reservar, darte precios, horarios o la ubicación. 😊", thanks: "¡Con gusto! Aquí estoy para lo que necesites. 💛" },
    },
    panels: {
      kick: "Paneles por plan", title: ["El panel que", "te llevas"], lede: "Cada plan incluye su panel. Cámbialo arriba y navega por todas sus secciones.",
      choose: "Elegir este plan", locked: "Disponible en", search: "Buscar cliente, cita…",
      nav: { agenda: "Agenda", clients: "Clientes", team: "Equipo", comm: "Comisiones", bot: "Bot", reports: "Reportes", branches: "Sucursales" },
      today: "Hoy", new: "Nueva cita", visits: "Visitas", spent: "Gastado", last: "Última visita", tag: "Etiqueta", vip: "VIP", newc: "Nuevo", regular: "Frecuente",
      occ: "Ocupación", appts: "Citas hoy", earned: "Generado", rate: "Comisión", payout: "A pagar", close: "Cerrar quincena", closed: "Quincena cerrada · pagos enviados (demo)",
      convs: "Conversaciones", botStats: ["Mensajes hoy", "Citas del bot", "Respuesta media"], revenue: "Ingresos · 12 semanas", top: "Servicios más vendidos", kpis: ["Ingresos del mes", "Citas", "Ticket promedio", "Clientes nuevos"],
      branches: ["Piantini", "Naco", "Santiago"], branchTxt: "sucursal", compare: "Comparativa de sucursales", fromBot: "por bot", fromWeb: "por web", you: "Tú",
    },
    plans: {
      kick: "Planes", title: ["Precios claros,", "sin sorpresas"], lede: "Empieza gratis por comisión o elige un plan fijo. Cancela cuando quieras.",
      monthly: "Mensual", yearly: "Anual −20 %", per: "/mes", free: "Gratis", fee: "5 % por cita", popular: "Más popular", choose: "Elegir plan", preview: "Ver su panel",
      list: { com: ["Comisión", "Para empezar sin mensualidad."], solo: ["Solo", "Independientes que quieren verse pro."], team: ["Equipo", "Barberías y salones en crecimiento."], studio: ["Studio", "Varias cabinas o sucursales."] },
      rows: [["Página web de reservas", 1, 1, 1, 1], ["Depósitos online", 0, 1, 1, 1], ["Recordatorios WhatsApp", 0, 1, 1, 1], ["Bot de WhatsApp e Instagram", 0, 0, 1, 1], ["Profesionales", "1", "1", "8", "∞"], ["Comisiones automáticas", 0, 0, 1, 1], ["Reportes", 0, "Básicos", "Completos", "Ejecutivos"], ["Multi-sucursal", 0, 0, 0, 1], ["Soporte", "Correo", "Chat", "Chat", "Prioritario"]],
      addKick: "Complementos", addons: { wa: "Bot de WhatsApp", ai: "Asistente IA", domain: "Dominio propio", app: "App con tu marca", branch: "Sucursal extra" }, total: "Total estimado",
      faq: [["¿Cuánto tarda configurarlo?", "Menos de 15 minutos: agregas servicios, precios y horarios y tu página queda lista."], ["¿Mis clientes necesitan cuenta?", "No. Entran a tu enlace, eligen y reservan, sin contraseñas."], ["¿El bot funciona con mi WhatsApp?", "Sí, se conecta a tu número de WhatsApp Business y a tu Instagram."], ["¿Puedo cancelar?", "Cuando quieras, sin penalidades. Tus datos se guardan 30 días."]],
    },
    onb: { title: "Configura tu negocio", steps: ["Tu negocio", "Servicios", "Horario"], svc: "Elige los servicios que ofreces", open: "Abre", closeAt: "Cierra", team: "Profesionales", finish: "Crear mi panel", creating: ["Creando tu página web…", "Conectando el bot…", "Preparando tu panel…", "¡Todo listo!"], done: "¡Bienvenida a tu panel, {b}!" },
    co: { title: "Pago seguro", titlePlan: "Activar plan", card2: "Tarjeta", transfer: "Transferencia", local: "En el local", card: "Número de tarjeta", holder: "Titular", exp: "Vence", cvc: "CVC", pay: "Pagar", processing: "Procesando pago…", approved: "Pago aprobado", transferTxt: "Te enviamos los datos bancarios por WhatsApp.", localTxt: "Tu cita queda reservada; pagas al llegar.", needCard: "Completa la tarjeta (cualquier número de prueba sirve).", secure: "Demostración: no se cobra nada.", done: "¡Cita confirmada! La tienes en “Mi cita”.", ticket: "Cita confirmada", ticketSub: "Te enviamos la confirmación por WhatsApp.", deposit: "Depósito para confirmar", rest: "Pagas en el local", total: "Total del servicio", sum: "Resumen" },
    appt: { title: "Tu próxima cita", in: "Faltan", steps: ["Confirmada", "Recordatorio", "En sala", "Completada"], add: "Agregar al calendario", added: "Añadida a tu calendario (demo)", panel: "Verla en el panel", code: "Código", with: "con" },
    myplan: { title: "Tu plan", open: "Abrir mi panel" },
    footer: { tag: "Reservas, bots y CRM para negocios que trabajan con citas.", credit: "Plantilla diseñada por Steliant · Vista previa", contact: "Contacto" },
    c: { sample: "Contenido de ejemplo" },
  },
  en: {
    nav: { home: "Home", demos: "Demos", bots: "Bots", panels: "Dashboards", plans: "Pricing", cta: "Start free", my: "My booking" },
    niche: { barber: "Barbershop", salon: "Salon", spa: "Spa" },
    home: {
      kick: "Booking software, bots and CRM", title: ["Your business,", "booking itself."], lede: "A website with bookings, a bot that books on WhatsApp and Instagram, and a dashboard to run your team and sales. Ready in 15 minutes.",
      cta1: "See my demo", cta2: "See pricing",
      cfg: "Build it live", cfgName: "Your business name", cfgNiche: "Business type", cfgColor: "Brand color", cfgHint: "Type and watch your page change →",
      stats: [[3900, "+", "Active businesses"], [1.2, "M", "Bookings handled"], [68, "%", "Fewer no-shows"], [62, "%", "Bookings made by the bot"]],
      getKick: "What you get", getTitle: ["Three tools,", "one system"],
      get: [["Your website", "A branded site where clients book and pay their deposit 24/7.", "See the demos"], ["Your bot", "Answers and books on WhatsApp, Instagram and your site while you work.", "Try the bot"], ["Your dashboard", "Calendar, clients, team, commissions and live reports.", "See the dashboards"]],
      beforeKick: "Before and after", beforeTitle: ["From chaos", "to control"], before: "Without Steliant", after: "With Steliant",
      chaos: [["Client 1", "Any slot today???"], ["Client 2", "Running 15 min late 🙏"], ["Client 3", "How much is color?"], ["Client 4", "Actually I can't make it"], ["Client 5", "Hello?? 😤"], ["Client 6", "Tomorrow at 3?"]],
      order: ["47 messages answered by the bot", "12 bookings confirmed with deposit", "0 no-shows this week", "Commissions calculated automatically"],
      quotesKick: "Customers", quotes: [["I went from answering messages all night to sleeping well. The calendar fills itself.", "Paola M.", "Color studio"], ["With deposits, no-shows dropped to almost zero. It paid for itself the first month.", "Adrián L.", "4-chair barbershop"], ["The commissions dashboard saved us a full day of math every payroll.", "Diego R.", "Urban spa"]],
      ctaTitle: ["Ready to", "fill your calendar?"], ctaText: "Start free on the Commission plan. No card, no contracts.",
    },
    demos: { kick: "Live demos", title: ["This is how", "your page looks"], lede: "Three styles designed for each kind of business. Browse it and make a real test booking.", desktop: "Desktop", mobile: "Mobile", use: "Use this style" },
    site: {
      book: "Book", services: "Services", team: "Team", reviews: "Reviews", visit: "Visit us", from: "From", min: "min",
      hero: { barber: ["Cuts with", "character."], salon: ["Your best self,", "at your pace."], spa: ["Breathe.", "Everything here is calm."] },
      sub: { barber: "Classic barbering with modern technique. Book your chair in seconds.", salon: "Signature color, cut and styling with a personal diagnosis.", spa: "Massages, facials and rituals to truly unwind." },
      address: "95 Winston Churchill Ave, Santo Domingo", hours: "Mon–Sat · 9:00–19:00",
      steps: ["Service", "Professional", "Day & time", "Your details"], any: "Anyone", next: "Continue", back: "Back", confirm: "Confirm & pay deposit", name: "Name", phone: "WhatsApp",
      deposit: "Deposit", total: "Total", needSvc: "Pick a service.", needSlot: "Pick a day and time.", needData: "Fill in name and WhatsApp.",
      revs: [["Excellent service, on time and super professional.", "María G."], ["Booked through the bot in a minute. I'll be back.", "Carlos P."], ["The best vibe in town.", "Lucía R."]],
    },
    bots: {
      kick: "AI bots", title: ["Your best employee", "never sleeps."], lede: "It answers instantly, understands what the client wants, offers times, collects the deposit and drops the booking in your dashboard. Text it: it's real.",
      ph: "Type a message…", online: "online · replies instantly", chips: ["I want a booking tomorrow", "How much is it?", "What are your hours?", "Where are you?"],
      stats: [[2.8, " s", "Response time"], [1284, "", "Messages answered today"], [62, "%", "Bookings made by the bot"], [24, "/7", "Always available"]],
      flowKick: "How it works", flow: [["Receives", "WhatsApp, Instagram or your site"], ["Understands", "Service, day and preferences"], ["Books", "Offers real free slots"], ["Collects", "Sends the deposit link"], ["Reminds", "24 h and 2 h before"]],
      booked: "New booking made by the bot!", see: "See in dashboard",
      r: { hi: "Hi! 👋 I'm {b}'s assistant. I can book you in, share prices or hours. What do you need?", price: "Here are our prices:", hours: "We're open Monday to Saturday, 9:00 AM to 7:00 PM. 🕘", where: "We're at 95 Winston Churchill Ave, Santo Domingo. 📍", which: "Sure! Which service would you like?", slots: "For {s} {d} I have these times:", today: "today", tomorrow: "tomorrow", name: "Great, {t}. What name should I book it under?", done: "Done, {n}! ✅ {s} {d} at {t}. I sent you the deposit link and I'll remind you 2 h before.", fallback: "I can help you book, share prices, hours or our location. 😊", thanks: "My pleasure! I'm here whenever you need. 💛" },
    },
    panels: {
      kick: "Dashboards by plan", title: ["The dashboard", "you get"], lede: "Every plan includes its dashboard. Switch it above and browse every section.",
      choose: "Choose this plan", locked: "Available on", search: "Search client, booking…",
      nav: { agenda: "Calendar", clients: "Clients", team: "Team", comm: "Commissions", bot: "Bot", reports: "Reports", branches: "Locations" },
      today: "Today", new: "New booking", visits: "Visits", spent: "Spent", last: "Last visit", tag: "Tag", vip: "VIP", newc: "New", regular: "Regular",
      occ: "Occupancy", appts: "Bookings today", earned: "Generated", rate: "Commission", payout: "To pay", close: "Close payroll", closed: "Payroll closed · payouts sent (demo)",
      convs: "Conversations", botStats: ["Messages today", "Bot bookings", "Avg. response"], revenue: "Revenue · 12 weeks", top: "Top services", kpis: ["Monthly revenue", "Bookings", "Average ticket", "New clients"],
      branches: ["Piantini", "Naco", "Santiago"], branchTxt: "location", compare: "Location comparison", fromBot: "via bot", fromWeb: "via web", you: "You",
    },
    plans: {
      kick: "Pricing", title: ["Clear prices,", "no surprises"], lede: "Start free on commission or pick a flat plan. Cancel anytime.",
      monthly: "Monthly", yearly: "Yearly −20%", per: "/mo", free: "Free", fee: "5% per booking", popular: "Most popular", choose: "Choose plan", preview: "See its dashboard",
      list: { com: ["Commission", "Start with no monthly fee."], solo: ["Solo", "Independents who want to look pro."], team: ["Team", "Growing barbershops and salons."], studio: ["Studio", "Several rooms or locations."] },
      rows: [["Booking website", 1, 1, 1, 1], ["Online deposits", 0, 1, 1, 1], ["WhatsApp reminders", 0, 1, 1, 1], ["WhatsApp & Instagram bot", 0, 0, 1, 1], ["Professionals", "1", "1", "8", "∞"], ["Automatic commissions", 0, 0, 1, 1], ["Reports", 0, "Basic", "Full", "Executive"], ["Multi-location", 0, 0, 0, 1], ["Support", "Email", "Chat", "Chat", "Priority"]],
      addKick: "Add-ons", addons: { wa: "WhatsApp bot", ai: "AI assistant", domain: "Custom domain", app: "Branded app", branch: "Extra location" }, total: "Estimated total",
      faq: [["How long does setup take?", "Under 15 minutes: add services, prices and hours and your page is live."], ["Do my clients need an account?", "No. They open your link, pick and book, no passwords."], ["Does the bot work with my WhatsApp?", "Yes, it connects to your WhatsApp Business number and Instagram."], ["Can I cancel?", "Anytime, no penalties. Your data is kept for 30 days."]],
    },
    onb: { title: "Set up your business", steps: ["Your business", "Services", "Hours"], svc: "Pick the services you offer", open: "Opens", closeAt: "Closes", team: "Professionals", finish: "Create my dashboard", creating: ["Creating your website…", "Connecting the bot…", "Preparing your dashboard…", "All set!"], done: "Welcome to your dashboard, {b}!" },
    co: { title: "Secure payment", titlePlan: "Activate plan", card2: "Card", transfer: "Transfer", local: "At the venue", card: "Card number", holder: "Cardholder", exp: "Expires", cvc: "CVC", pay: "Pay", processing: "Processing payment…", approved: "Payment approved", transferTxt: "We'll send the bank details via WhatsApp.", localTxt: "Your slot is held; pay when you arrive.", needCard: "Fill in the card (any test number works).", secure: "Demo: nothing is charged.", done: "Booking confirmed! Find it in “My booking”.", ticket: "Booking confirmed", ticketSub: "We sent the confirmation via WhatsApp.", deposit: "Deposit to confirm", rest: "Pay at the venue", total: "Service total", sum: "Summary" },
    appt: { title: "Your next booking", in: "Starts in", steps: ["Confirmed", "Reminder", "Checked in", "Done"], add: "Add to calendar", added: "Added to your calendar (demo)", panel: "See it in the dashboard", code: "Code", with: "with" },
    myplan: { title: "Your plan", open: "Open my dashboard" },
    footer: { tag: "Bookings, bots and CRM for businesses that work by appointment.", credit: "Template designed by Steliant · Preview", contact: "Contact" },
    c: { sample: "Sample content" },
  },
};
let lang = store.get("sr-lang") || ((navigator.language || "es").startsWith("en") ? "en" : "es");
const t = () => T[lang];
const get = (p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), t());
const L = (o) => o[lang] || o.es;
const sName = (s) => (lang === "en" ? s.en : s.es)[0], sDesc = (s) => (lang === "en" ? s.en : s.es)[1];
const role = (p) => (lang === "en" ? p.en : p.es);
const loc = () => (lang === "en" ? "en-US" : "es-DO");
const fill = (s, o) => s.replace(/\{(\w)\}/g, (_, k) => o[k] ?? "");
/* ---------- State ---------- */
const load = (k, d) => { try { return JSON.parse(store.get(k)) ?? d; } catch (e) { return d; } };
const save = (k, v) => store.set(k, JSON.stringify(v));
let biz = load("sr-biz", { name: "Estudio Aurora", niche: "barber", color: null });
let appt = load("sr-appt", null), myPlan = load("sr-plan", null), books = load("sr-books", []);
let current = "inicio", dev = "desk", sstep = 0, coMode = "appt", pay = "card", bill = "m", selPlan = "team", addons = ["wa"];
let panelPlan = myPlan ? (myPlan.id === "com" ? "solo" : myPlan.id) : "team", panelSec = "agenda", panelDay = 0, chan = "wa";
let bk = { svc: null, pro: "any", day: 0, time: null, name: "", phone: "" };
let cardD = { num: "", holder: "", exp: "", cvc: "" };
const VIEWS = [["inicio", "home"], ["demos", "demos"], ["bots", "bots"], ["paneles", "panels"], ["planes", "plans"]];
const svcById = (id) => SERVICES.find((s) => s.id === id), proById = (id) => PROS.find((p) => p.id === id);
const nicheSvcs = (n = biz.niche) => SERVICES.filter((s) => s.biz === n);
const nichePros = (n = biz.niche) => PROS.filter((p) => p.biz.includes(n));
const acc = () => biz.color || NICHE[biz.niche].color;
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${pad(mm)} ${h >= 12 ? "PM" : "AM"}`; };
const DAYS = (() => { const out = [], d0 = new Date(); d0.setHours(0, 0, 0, 0); for (let i = 0; i < 16; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); if (d.getDay() !== 0) out.push(d); } return out.slice(0, 10); })();
const SLOTS = []; for (let m = 9 * 60; m <= 18 * 60 + 30; m += 30) SLOTS.push(m);
const taken = (di, m, pro) => { const h = (di * 31 + (m / 30) * 5 + (pro || "x").charCodeAt(1) * 13) % 7; return h === 0 || h === 3 || (di === 0 && m < new Date().getHours() * 60 + 60); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = () => (biz.name || "tu-negocio").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tu-negocio";
let tt; const toast = (m) => { const e = $("#toast"); e.textContent = m; e.classList.add("is-on"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("is-on"), 3400); };
const chars = (lines) => lines.map((l, i) => `<span class="ln${i === lines.length - 1 ? " accent" : ""}">${l.split(" ").map((w) => `<span class="wd">${[...w].map((c) => `<span class="ch">${c}</span>`).join("")}</span>`).join(" ")}</span>`).join("");
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  web: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  chat: '<path d="M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8z"/><path d="M8 9h8M8 12.5h5"/>',
  grid: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.6"/>',
  cal: '<path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M4 10h16M9 2v4M15 2v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2A5 5 0 0 1 21.5 19"/>',
  team: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="4"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10.5 20a1.7 1.7 0 0 0 3 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
  drop: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l7-7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1"/>',
  wa: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1 2 1"/>',
};
const ico = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const NICON = { barber: "scissors", salon: "drop", spa: "leaf" };
function qr(seed) { let s = seed, r = () => (s = (s * 16807) % 2147483647) / 2147483647, cells = ""; const N = 21; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const f = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13); if (f) { const lx = x > 13 ? x - 14 : x, ly = y > 13 ? y - 14 : y; if (lx === 0 || ly === 0 || lx === 6 || ly === 6 || (lx > 1 && lx < 5 && ly > 1 && ly < 5)) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`; } else if (r() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`; } return `<svg viewBox="-1 -1 23 23" class="qr">${cells}</svg>`; }

/* ---------- Static ---------- */
function renderStatic() {
  document.documentElement.lang = lang;
  $$("[data-t]").forEach((el) => { const v = get(el.dataset.t); if (typeof v === "string") el.textContent = v; });
  $$("[data-split]").forEach((el) => (el.innerHTML = chars(get(el.dataset.split))));
  $("#dock").innerHTML = `<span class="dock-blob" aria-hidden="true"></span>` + VIEWS.map(([id, k]) => `<a href="#${id}" class="dk" data-view="${id}">${ico(["home", "web", "chat", "grid", "tag"][VIEWS.findIndex((v) => v[0] === id)])}<span>${t().nav[k]}</span></a>`).join("");
  $("#footNav").innerHTML = `<p class="kick"><span>Steliant</span></p>` + VIEWS.map(([id, k]) => `<a href="#${id}">${t().nav[k]}</a>`).join("");
  $("#giant").innerHTML = "Reservas".split("").map((c) => `<span>${c}</span>`).join("");
  $("#heroStats").innerHTML = t().home.stats.map(([v, s, l]) => `<div class="stat"><strong data-count="${v}" data-suffix="${s}">${v.toLocaleString("en-US")}${s}</strong><span>${l}</span></div>`).join("");
  $("#getGrid").innerHTML = t().home.get.map(([a, b, c], i) => `<a href="#${["demos", "bots", "paneles"][i]}" class="get glass g${i}" data-tilt><div class="get-vis">${getVis(i)}</div><span class="get-n">0${i + 1}</span><b>${a}</b><p>${b}</p><span class="get-go">${c} <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h12M9 3l5 5-5 5"/></svg></span></a>`).join("");
  $("#baChaos").innerHTML = t().home.chaos.map(([n, m], i) => `<div class="cm" style="--i:${i}"><span class="cm-a">${n.slice(-1)}</span><div><b>${n}</b><small>${m}</small></div><em>${["9:12", "9:14", "9:15", "9:21", "9:22", "9:30"][i]}</em></div>`).join("") + `<span class="badge-47">47</span>`;
  $("#baOrder").innerHTML = t().home.order.map((x, i) => `<div class="om" style="--i:${i}"><span>${ico("check")}</span>${x}</div>`).join("");
  $("#qGrid").innerHTML = t().home.quotes.map(([q, n, r], i) => `<figure class="q-card glass" data-tilt><span class="q-stars">★★★★★</span><blockquote>${q}</blockquote><figcaption><span class="q-ava">${pic(PROS[[1, 0, 5][i]].img)}</span><span><b>${n}</b><small>${r}</small></span></figcaption></figure>`).join("");
  $$("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  renderCfg(); renderMini(); renderDemos(); renderBot(); renderPanels(); renderPlans(); renderAppt(); renderPlanCard(); movePill(); markActive();
}
function getVis(i) {
  if (i === 0) return `<div class="gv-web"><i></i><i></i><i></i><b></b><span></span><span></span></div>`;
  if (i === 1) return `<div class="gv-bot"><span class="in">${lang === "en" ? "Slot tomorrow?" : "¿Hueco mañana?"}</span><span class="out">${lang === "en" ? "3:30 PM free ✅" : "3:30 PM libre ✅"}</span><span class="in">👍</span></div>`;
  return `<div class="gv-panel">${[60, 85, 45, 95, 70, 80, 55].map((h) => `<i style="--h:${h}%"></i>`).join("")}</div>`;
}
function movePill() { const on = $(`[data-lang="${lang}"]`), p = $("#seg .pill"); if (!on) return; p.style.width = on.offsetWidth + "px"; p.style.transform = `translateX(${on.offsetLeft - 3}px)`; }

/* ---------- Configurator + mini preview ---------- */
function renderCfg() {
  const H = t().home;
  $("#cfg").innerHTML = `<p class="cfg-t">${ico("grid")} ${H.cfg}</p>
    <div class="fl wide${biz.name.trim().length > 1 ? " valid" : ""}"><input id="cfgName" placeholder=" " value="${esc(biz.name)}" maxlength="28" autocomplete="off"><label for="cfgName">${H.cfgName}</label><i class="ok"></i></div>
    <div class="cfg-row"><small>${H.cfgNiche}</small><div class="cfg-niche">${NICHES.map((n) => `<button type="button" data-niche="${n}" class="${biz.niche === n ? "on" : ""}">${ico(NICON[n])}${t().niche[n]}</button>`).join("")}</div></div>
    <div class="cfg-row"><small>${H.cfgColor}</small><div class="cfg-colors"><button type="button" data-color="" class="sw-auto${!biz.color ? " on" : ""}" aria-label="Auto">A</button>${COLORS.map((c) => `<button type="button" data-color="${c}" style="--c:${c}" class="${biz.color === c ? "on" : ""}" aria-label="${c}"></button>`).join("")}</div></div>
    <div class="hero-cta"><a href="#demos" class="btn btn-accent magnetic">${H.cta1}<svg class="arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8h12M9 3l5 5-5 5"/></svg></a><a href="#planes" class="btn btn-glass magnetic">${H.cta2}</a></div>`;
}
function renderMini() {
  const n = biz.niche, S = t().site, el = $("#mini");
  $("#miniUrl").textContent = `steliant.link/${slug()}`;
  el.className = `mini site s-${n}`; el.style.setProperty("--sa", acc());
  el.innerHTML = `<div class="m-nav"><span class="s-logo">${esc((biz.name || "A")[0])}</span><b class="m-name">${esc(biz.name || "Tu negocio")}</b><span class="m-btn">${S.book}</span></div>
    <div class="m-hero">${pic(NICHE[n].hero)}<div><h3>${S.hero[n].join(" ")}</h3><span class="m-btn">${S.book} →</span></div></div>
    <div class="m-svcs">${nicheSvcs(n).slice(0, 3).map((s) => `<div><span>${pic(s.img)}</span><b>${sName(s)}</b><em>${money(s.price)}</em></div>`).join("")}</div>`;
}
document.addEventListener("input", (e) => {
  if (e.target.id !== "cfgName") return; biz.name = e.target.value; save("sr-biz", biz); e.target.parentElement.classList.toggle("valid", biz.name.trim().length > 1);
  $(".m-name").textContent = biz.name || "Tu negocio"; $(".mini .s-logo").textContent = (biz.name || "A")[0]; $("#miniUrl").textContent = `steliant.link/${slug()}`;
  hasG && gsap.fromTo(".m-name", { color: acc() }, { color: "inherit", duration: 0.8 });
});
document.addEventListener("click", (e) => {
  const n = e.target.closest("[data-niche]"); if (n) { biz.niche = n.dataset.niche; save("sr-biz", biz); $$("[data-niche]").forEach((b) => b.classList.toggle("on", b.dataset.niche === biz.niche)); bk.svc = null; sstep = 0;
    if (hasG && !reduce) gsap.to("#mini", { opacity: 0, y: 14, scale: 0.97, duration: 0.25, onComplete: () => { renderMini(); renderDemos(); gsap.fromTo("#mini", { opacity: 0, y: -14, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "expo.out" }); gsap.from(".m-svcs > div", { x: 30, opacity: 0, stagger: 0.07, duration: 0.7, ease: "expo.out", delay: 0.1 }); } }); else { renderMini(); renderDemos(); }
    if (current === "bots") resetChat(); return; }
  const c = e.target.closest("[data-color]"); if (c) { biz.color = c.dataset.color || null; save("sr-biz", biz); $$("[data-color]").forEach((b) => b.classList.toggle("on", b === c)); $("#mini").style.setProperty("--sa", acc()); $("#site").style.setProperty("--sa", acc()); hasG && gsap.fromTo(".m-hero .m-btn", { scale: 1.15 }, { scale: 1, duration: 0.6, ease: "elastic.out(1,.4)" }); }
});

/* ---------- Demo sites ---------- */
function renderDemos() {
  $("#nicheTabs").innerHTML = NICHES.map((n) => `<button type="button" data-niche="${n}" class="${biz.niche === n ? "on" : ""}">${ico(NICON[n])}${t().niche[n]}</button>`).join("");
  $("#demoUrl").textContent = `steliant.link/${slug()}`;
  const n = biz.niche, S = t().site, site = $("#site");
  site.className = `site s-${n}`; site.style.setProperty("--sa", acc());
  site.innerHTML = `<header class="s-nav"><span class="s-logo">${esc((biz.name || "A")[0])}</span><b>${esc(biz.name || "Tu negocio")}</b><nav><a data-sgo="sSvc">${S.services}</a><a data-sgo="sTeam">${S.team}</a><a data-sgo="sRev">${S.reviews}</a></nav><button type="button" class="s-btn" data-sgo="sBook">${S.book}</button></header>
    <section class="s-hero"><div class="s-hero-img">${pic(NICHE[n].hero)}</div><div class="s-hero-txt"><span class="s-tag">★ 4.9 · ${t().niche[n]}</span><h2>${S.hero[n].map((l, i) => `<span${i ? ' class="s-acc"' : ""}>${l}</span>`).join(" ")}</h2><p>${S.sub[n]}</p><div class="s-ctas"><button type="button" class="s-btn" data-sgo="sBook">${S.book}</button><button type="button" class="s-btn ghost" data-sgo="sSvc">${S.services}</button></div></div></section>
    <section class="s-sec" id="sSvc"><h3>${S.services}</h3><div class="s-svcs">${nicheSvcs(n).map((s) => `<article class="s-svc"><span class="s-svc-img">${pic(s.img)}</span><div><b>${sName(s)}</b><small>${sDesc(s)}</small><p><em>${s.min} ${S.min}</em><strong>${money(s.price)}</strong></p></div><button type="button" class="s-btn sm" data-spick="${s.id}">${S.book}</button></article>`).join("")}</div></section>
    <section class="s-sec s-gal">${NICHE[n].gal.map((g) => `<span>${pic(g)}</span>`).join("")}</section>
    <section class="s-sec" id="sTeam"><h3>${S.team}</h3><div class="s-team">${nichePros(n).map((p) => `<div class="s-pro"><span>${pic(p.img)}</span><b>${p.name}</b><small>${role(p)} · ★ ${p.rating.toFixed(1)}</small></div>`).join("")}</div></section>
    <section class="s-sec s-bookwrap" id="sBook"><h3>${S.book}</h3><div class="s-book" id="sBookIn"></div></section>
    <section class="s-sec" id="sRev"><h3>${S.reviews}</h3><div class="s-revs">${S.revs.map(([q, a]) => `<blockquote><span>★★★★★</span>${q}<cite>— ${a}</cite></blockquote>`).join("")}</div></section>
    <footer class="s-foot"><div><b>${esc(biz.name || "Tu negocio")}</b><small>${S.address}</small><small>${S.hours}</small></div><div class="s-map"><i></i></div><small class="s-pw">Powered by Steliant Reservas</small></footer>`;
  renderSiteBook();
}
function renderSiteBook() {
  const S = t().site, n = biz.niche, box = $("#sBookIn"); if (!box) return;
  const s = svcById(bk.svc), steps = `<div class="sb-steps">${S.steps.map((x, i) => `<span class="${i === sstep ? "on" : i < sstep ? "done" : ""}">${i < sstep ? "✓" : i + 1}<em>${x}</em></span>`).join("")}</div>`;
  let h = "";
  if (sstep === 0) h = `<div class="sb-opts">${nicheSvcs(n).map((x) => `<button type="button" class="sb-opt${bk.svc === x.id ? " on" : ""}" data-ssvc="${x.id}"><b>${sName(x)}</b><small>${x.min} ${S.min} · ${money(x.price)}</small></button>`).join("")}</div>`;
  else if (sstep === 1) h = `<div class="sb-opts pros"><button type="button" class="sb-opt${bk.pro === "any" ? " on" : ""}" data-spro="any"><span class="sb-any">✦</span><b>${S.any}</b></button>${nichePros(n).map((p) => `<button type="button" class="sb-opt${bk.pro === p.id ? " on" : ""}" data-spro="${p.id}"><span class="sb-ava">${pic(p.img)}</span><b>${p.name}</b><small>${role(p)}</small></button>`).join("")}</div>`;
  else if (sstep === 2) h = `<div class="sb-days">${DAYS.map((d, i) => `<button type="button" class="${i === bk.day ? "on" : ""}" data-sday="${i}"><small>${d.toLocaleDateString(loc(), { weekday: "short" }).replace(".", "")}</small><b>${d.getDate()}</b></button>`).join("")}</div><div class="sb-times">${SLOTS.map((m) => `<button type="button" data-stime="${m}" class="${bk.time === m ? "on" : ""}" ${taken(bk.day, m, bk.pro) ? "disabled" : ""}>${fmtTime(m)}</button>`).join("")}</div>`;
  else h = `<div class="sb-form"><div class="fl"><input id="sb-name" data-sbk="name" placeholder=" " value="${esc(bk.name)}" autocomplete="off"><label for="sb-name">${S.name}</label><i class="ok"></i></div><div class="fl"><input id="sb-phone" data-sbk="phone" placeholder=" " value="${esc(bk.phone)}" inputmode="tel" autocomplete="off"><label for="sb-phone">${S.phone}</label><i class="ok"></i></div></div>`;
  const sum = s ? `<div class="sb-sum"><span>${pic(s.img)}</span><div><b>${sName(s)}</b><small>${bk.time != null ? `${DAYS[bk.day].toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" })} · ${fmtTime(bk.time)}` : `${s.min} ${S.min}`}</small></div><em>${S.deposit} <strong>${money(Math.round(s.price * 0.3))}</strong></em></div>` : "";
  box.innerHTML = steps + `<div class="sb-body">${h}</div>` + sum + `<div class="sb-foot"><button type="button" class="s-btn ghost" data-sback ${sstep === 0 ? "disabled" : ""}>${S.back}</button><button type="button" class="s-btn" data-snext>${sstep === 3 ? S.confirm : S.next}</button></div>`;
}
function sbGo(n) { const dir = n > sstep ? 1 : -1; sstep = n; renderSiteBook(); hasG && !reduce && gsap.fromTo(".sb-body", { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "expo.out" }); }
function siteScrollTo(id) { const sc = $("#siteScroll"), el = $("#" + id); if (!sc || !el) return; sc.scrollTo({ top: el.offsetTop - 70, behavior: "smooth" }); }
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-sgo]"); if (g) return siteScrollTo(g.dataset.sgo);
  const sp = e.target.closest("[data-spick]"); if (sp) { bk.svc = sp.dataset.spick; sstep = 1; renderSiteBook(); siteScrollTo("sBook"); return; }
  const sv = e.target.closest("[data-ssvc]"); if (sv) { bk.svc = sv.dataset.ssvc; renderSiteBook(); return; }
  const pr = e.target.closest("[data-spro]"); if (pr) { bk.pro = pr.dataset.spro; bk.time = null; renderSiteBook(); return; }
  const dy = e.target.closest("[data-sday]"); if (dy) { bk.day = +dy.dataset.sday; bk.time = null; renderSiteBook(); hasG && !reduce && gsap.from(".sb-times button", { scale: 0.85, opacity: 0, stagger: 0.012, duration: 0.4, ease: "back.out(2)" }); return; }
  const tm = e.target.closest("[data-stime]"); if (tm) { bk.time = +tm.dataset.stime; renderSiteBook(); return; }
  if (e.target.closest("[data-sback]") && sstep > 0) return sbGo(sstep - 1);
  if (e.target.closest("[data-snext]")) {
    const S = t().site, shake = () => hasG && gsap.fromTo("#sBookIn", { x: -10 }, { x: 0, duration: 0.6, ease: "elastic.out(1,.3)" });
    if (sstep === 0 && !bk.svc) { toast(S.needSvc); return shake(); }
    if (sstep === 2 && bk.time == null) { toast(S.needSlot); return shake(); }
    if (sstep === 3) { if (bk.name.trim().length < 2 || bk.phone.trim().length < 7) { toast(S.needData); return shake(); } return openCo("appt"); }
    return sbGo(sstep + 1);
  }
  const d = e.target.closest("[data-dev]"); if (d) { dev = d.dataset.dev; $$("[data-dev]").forEach((b) => b.classList.toggle("on", b === d)); const br = $("#demoBrowser"); if (hasG && !reduce) { const st = br.getBoundingClientRect().width; br.classList.toggle("mob", dev === "mob"); gsap.from(br, { width: st, duration: 0.9, ease: "expo.inOut", clearProps: "width" }); } else br.classList.toggle("mob", dev === "mob"); }
});
document.addEventListener("input", (e) => { const k = e.target.dataset.sbk; if (!k) return; bk[k] = e.target.value; e.target.parentElement.classList.toggle("valid", bk[k].trim().length > 1); });

/* ---------- Checkout ---------- */
const brandOf = (n) => (/^4/.test(n) ? "VISA" : /^5[1-5]|^2[2-7]/.test(n) ? "MASTERCARD" : /^3[47]/.test(n) ? "AMEX" : "");
const planPrice = (id) => Math.round(PLANS.find((x) => x.id === id).price * (bill === "y" ? 0.8 : 1));
const addonsSum = () => addons.reduce((s, a) => s + ADDONS.find((x) => x.id === a).price, 0);
const coAmount = () => (coMode === "appt" ? Math.round(svcById(bk.svc).price * 0.3) : planPrice(selPlan) + addonsSum());
function renderCo() {
  const C = t().co, PL = t().plans;
  if (coMode === "appt") {
    const s = svcById(bk.svc), p = bk.pro === "any" ? null : proById(bk.pro);
    $("#coSum").innerHTML = `<div class="cs-img">${pic(s.img)}<span>${esc(biz.name)}</span></div><h4>${sName(s)}</h4><p class="cs-meta">${p ? p.name : t().site.any} · ${DAYS[bk.day].toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" })} · ${fmtTime(bk.time)}</p>
      <dl><div><dt>${C.total}</dt><dd>${money(s.price)}</dd></div><div><dt>${C.rest}</dt><dd>${money(s.price - coAmount())}</dd></div></dl><div class="cs-total"><span>${C.deposit}</span><b>${money(coAmount())}</b></div><p class="cs-sec">🔒 ${C.secure}</p>`;
  } else {
    const n = PL.list[selPlan][0];
    $("#coSum").innerHTML = `<div class="cs-plan"><span>${n}</span></div><h4>${n}</h4><p class="cs-meta">${bill === "y" ? PL.yearly : PL.monthly}</p>
      <dl><div><dt>${n}</dt><dd>${planPrice(selPlan) ? money(planPrice(selPlan)) : PL.free}</dd></div>${addons.map((a) => `<div><dt>${PL.addons[a]}</dt><dd>${money(ADDONS.find((x) => x.id === a).price)}</dd></div>`).join("")}</dl><div class="cs-total"><span>${PL.total}</span><b>${money(coAmount())}${PL.per}</b></div><p class="cs-sec">🔒 ${C.secure}</p>`;
  }
  const br = brandOf(cardD.num.replace(/\s/g, "")), methods = [["card", C.card2], ["transfer", C.transfer]].concat(coMode === "appt" ? [["local", C.local]] : []);
  $("#coMain").innerHTML = `<h3>${coMode === "appt" ? C.title : C.titlePlan}</h3>
    <div class="co-methods" style="--n:${methods.length}">${methods.map(([k, l]) => `<button type="button" class="${pay === k ? "on" : ""}" data-pay="${k}">${l}</button>`).join("")}<span class="co-ink"></span></div>
    ${pay === "card" ? `<div class="holo" id="holo" data-brand="${br}"><div class="holo-in"><div class="hf"><span class="cc-chip"></span><span class="hbr" id="hBrand">${br || "STELIANT"}</span><span class="hn" id="hNum">${cardD.num || "•••• •••• •••• ••••"}</span><span class="hr"><span id="hHolder">${cardD.holder || C.holder}</span><span id="hExp">${cardD.exp || "MM/AA"}</span></span></div><div class="hk"><span class="cc-stripe"></span><span class="cc-cvc" id="hCvc">${cardD.cvc || "•••"}</span></div></div></div>
      <div class="fl-grid">${[["num", C.card, "wide"], ["holder", C.holder, "wide"], ["exp", C.exp, ""], ["cvc", C.cvc, ""]].map(([k, l, w]) => `<div class="fl ${w}"><input id="cc-${k}" data-cc="${k}" inputmode="${k === "holder" ? "text" : "numeric"}" placeholder=" " value="${cardD[k]}" autocomplete="off"><label for="cc-${k}">${l}</label><i class="ok"></i></div>`).join("")}</div>`
    : `<div class="alt-pay glass"><span>${pay === "transfer" ? "🏦" : "📍"}</span><p>${pay === "transfer" ? C.transferTxt : C.localTxt}</p></div>`}
    <button type="button" class="paybtn" id="payBtn"><span class="pb-label">${C.pay} ${money(coAmount())}</span><svg class="pb-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/></svg><svg class="pb-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
    <div class="ticket" id="ticket" hidden></div>`;
  markCard();
  if (hasG && !reduce) { const on = $(".co-methods .on"), ink = $(".co-ink"); if (on && ink) gsap.to(ink, { x: on.offsetLeft - 4, width: on.offsetWidth, duration: 0.5, ease: "expo.out" }); gsap.from("#coMain > *", { y: 20, opacity: 0, stagger: 0.05, duration: 0.6, ease: "expo.out" }); }
}
function markCard() { const v = { num: cardD.num.replace(/\s/g, "").length >= 15, holder: cardD.holder.trim().length > 2, exp: /^(0[1-9]|1[0-2])\/\d{2}$/.test(cardD.exp), cvc: cardD.cvc.length >= 3 }; Object.entries(v).forEach(([k, ok]) => { const el = $(`[data-cc="${k}"]`); if (el) el.parentElement.classList.toggle("valid", ok); }); return Object.values(v).every(Boolean); }
function openCo(mode) { coMode = mode; if (mode === "plan" && pay === "local") pay = "card"; renderCo(); $("#co").classList.add("is-open"); document.body.classList.add("lock"); if (hasG && !reduce) { gsap.fromTo(".co-panel", { y: 80, rotateX: 14, opacity: 0, scale: 0.96 }, { y: 0, rotateX: 0, opacity: 1, scale: 1, duration: 1.1, ease: "expo.out" }); pay === "card" && gsap.fromTo("#holo", { rotateY: -50 }, { rotateY: 0, duration: 1.5, ease: "elastic.out(1,.6)", delay: 0.2 }); } }
function closeCo() { $("#co").classList.remove("is-open"); document.body.classList.remove("lock"); }
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-co-close]") && !$("#co").classList.contains("busy")) return closeCo();
  const pm = e.target.closest("[data-pay]"); if (pm) { pay = pm.dataset.pay; renderCo(); return; }
  if (e.target.closest("#payBtn")) payNow();
});
document.addEventListener("input", (e) => {
  const c = e.target.dataset.cc; if (!c) return; let v = e.target.value;
  if (c === "num") v = v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  if (c === "exp") { const d = v.replace(/\D/g, "").slice(0, 4); v = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; }
  if (c === "cvc") v = v.replace(/\D/g, "").slice(0, 4); if (c === "holder") v = v.toUpperCase();
  e.target.value = v; cardD[c] = v;
  const m = { num: ["#hNum", "•••• •••• •••• ••••"], holder: ["#hHolder", t().co.holder], exp: ["#hExp", "MM/AA"], cvc: ["#hCvc", "•••"] }; const el = $(m[c][0]); if (el) el.textContent = v || m[c][1];
  if (c === "num") { const br = brandOf(v.replace(/\s/g, "")), hb = $("#hBrand"); if (hb && hb.textContent !== (br || "STELIANT")) { hb.textContent = br || "STELIANT"; $("#holo").dataset.brand = br; hasG && gsap.fromTo(hb, { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(2)" }); } }
  markCard();
});
document.addEventListener("focusin", (e) => { if (e.target.dataset.cc === "cvc") $("#holo")?.classList.add("flip"); });
document.addEventListener("focusout", (e) => { if (e.target.dataset.cc === "cvc") $("#holo")?.classList.remove("flip"); });
document.addEventListener("mousemove", (e) => { const h = e.target.closest("#holo"); if (!h) return; const r = h.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; h.style.setProperty("--rx", `${(0.5 - py) * 16}deg`); h.style.setProperty("--ry", `${(px - 0.5) * 22}deg`); h.style.setProperty("--gx", px * 100 + "%"); h.style.setProperty("--gy", py * 100 + "%"); });
function payNow() {
  const C = t().co;
  if (pay === "card" && !markCard()) { toast(C.needCard); hasG && gsap.fromTo(".fl-grid", { x: -10 }, { x: 0, duration: 0.5, ease: "elastic.out(1,.3)" }); return; }
  const btn = $("#payBtn"), co = $("#co"); co.classList.add("busy"); btn.classList.add("processing"); btn.querySelector(".pb-label").textContent = C.processing;
  setTimeout(() => {
    btn.classList.remove("processing"); btn.classList.add("done"); btn.querySelector(".pb-label").textContent = C.approved;
    if (coMode === "plan") { setTimeout(() => { co.classList.remove("busy"); cardD = { num: "", holder: "", exp: "", cvc: "" }; startOnboarding(); }, 1000); return; }
    const code = "SR-" + Math.floor(1000 + Math.random() * 8999), s = svcById(bk.svc), proId = bk.pro === "any" ? nichePros()[0].id : bk.pro;
    const at = new Date(DAYS[bk.day]); at.setHours(Math.floor(bk.time / 60), bk.time % 60, 0, 0);
    appt = { code, svc: s.id, pro: proId, at: at.getTime(), name: bk.name, biz: biz.name };
    setTimeout(() => {
      const tk = $("#ticket"); tk.hidden = false;
      tk.innerHTML = `<div class="tk-l"><span class="tk-ok">✓</span><b>${C.ticket}</b><small>${C.ticketSub}</small><p>${sName(s)} · ${proById(proId).name}<br>${at.toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(bk.time)}</p><em>${t().appt.code} ${code}</em></div><div class="tk-r">${qr(code.charCodeAt(3) * 977)}</div>`;
      if (hasG && !reduce) { gsap.fromTo(tk, { clipPath: "inset(0 0 100% 0 round 22px)", y: 20 }, { clipPath: "inset(0 0 0% 0 round 22px)", y: 0, duration: 1, ease: "expo.out" }); gsap.from(".qr rect", { scale: 0, transformOrigin: "center", stagger: { each: 0.002, from: "random" }, duration: 0.4 }); gsap.fromTo(".tk-ok", { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.9, ease: "elastic.out(1,.5)", delay: 0.3 }); }
      tk.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => {
        save("sr-appt", appt); books.push({ name: bk.name, svc: s.id, pro: proId, at: appt.at, src: "web" }); save("sr-books", books);
        co.classList.remove("busy"); closeCo(); cardD = { num: "", holder: "", exp: "", cvc: "" }; bk = { ...bk, svc: null, time: null }; sstep = 0; renderSiteBook(); renderPanels();
        go("inicio");
        setTimeout(() => { renderAppt(); toast(C.done); showFab(true); const c = $("#apptCard"); scrollTo({ top: c.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" }); hasG && !reduce && gsap.fromTo(c, { y: 60, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: "expo.out", delay: 0.3 }); }, 1500);
      }, 3400);
    }, 900);
  }, 1800);
}

/* ---------- Home cards ---------- */
function renderAppt() {
  const el = $("#apptCard"); if (!appt) { el.hidden = true; $("#fab").hidden = true; return; }
  const A = t().appt, s = svcById(appt.svc), p = proById(appt.pro), at = new Date(appt.at), left = appt.at - Date.now(), st = left < 0 ? 3 : left < 7200000 ? 2 : 1;
  el.hidden = false;
  el.innerHTML = `<div class="ac-img">${pic(s.img)}<span class="ac-code">${A.code} ${appt.code}</span></div>
    <div class="ac-main"><p class="kick"><span>${A.title} · ${esc(appt.biz || biz.name)}</span></p><h3>${sName(s)}</h3><p class="ac-meta"><span class="ac-pro">${pic(p.img)}</span>${A.with} <b>${p.name}</b> · ${at.toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(at.getHours() * 60 + at.getMinutes())}</p>
      <div class="ac-track">${A.steps.map((x, i) => `<span class="${i < st ? "done" : i === st ? "now" : ""}"><i></i>${x}</span>`).join("")}</div>
      <div class="ac-actions"><button type="button" class="btn btn-accent btn-sm" data-cal>${A.add}</button><a href="#paneles" class="btn btn-ghost btn-sm" data-psec="agenda">${A.panel}</a></div></div>
    <div class="ac-count"><small>${A.in}</small><div id="acCount"></div><svg viewBox="0 0 120 120" class="ac-ring"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" class="ac-arc" id="acArc"/></svg></div>`;
  tickAppt(); showFab(false);
}
function tickAppt() { if (!appt) return; const el = $("#acCount"); if (!el) return; const s = Math.max(0, Math.floor((appt.at - Date.now()) / 1000)); el.innerHTML = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n, i) => `<span><b>${pad(n)}</b>${["d", "h", "m", "s"][i]}</span>`).join(""); const arc = $("#acArc"); if (arc) arc.style.strokeDashoffset = 327 * (1 - Math.min(1, s / (14 * 86400))); }
setInterval(tickAppt, 1000);
function renderPlanCard() {
  const el = $("#planCard"); if (!myPlan) { el.hidden = true; return; } el.hidden = false;
  el.innerHTML = `<span class="pc-ico">${ico("grid")}</span><div><small>${t().myplan.title}</small><b>${t().plans.list[myPlan.id][0]} · ${esc(myPlan.biz || biz.name)}</b></div><a href="#paneles" class="btn btn-accent btn-sm" data-pplan="${myPlan.id === "com" ? "solo" : myPlan.id}">${t().myplan.open}</a>`;
}
function showFab(b) { const f = $("#fab"); if (!appt) return; f.hidden = false; if (b && hasG && !reduce) gsap.fromTo(f, { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, duration: 1.2, ease: "elastic.out(1,.5)" }); }
$("#fab").addEventListener("click", () => { const doit = () => { const c = $("#apptCard"); scrollTo({ top: c.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" }); hasG && gsap.fromTo(c, { boxShadow: "0 0 0 0 rgba(255,106,77,.7)" }, { boxShadow: "0 0 0 22px rgba(255,106,77,0)", duration: 1.2, repeat: 1 }); }; if (current !== "inicio") { go("inicio"); setTimeout(doit, 1500); } else doit(); });
document.addEventListener("click", (e) => { if (e.target.closest("[data-cal]")) toast(t().appt.added); });

/* ---------- Before / after ---------- */
$("#baSwitch").addEventListener("click", () => {
  const sw = $("#baSwitch"), on = sw.getAttribute("aria-pressed") !== "true"; sw.setAttribute("aria-pressed", on); $("#baStage").classList.toggle("ordered", on);
  if (!hasG || reduce) return;
  if (on) { gsap.to(".cm", { y: 40, x: () => gsap.utils.random(-60, 60), rotate: () => gsap.utils.random(-25, 25), opacity: 0, stagger: 0.04, duration: 0.6, ease: "power3.in" }); gsap.fromTo(".om", { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: "expo.out", delay: 0.4 }); gsap.to(".badge-47", { scale: 0, duration: 0.4 }); }
  else { gsap.to(".om", { opacity: 0, y: -20, duration: 0.3 }); gsap.fromTo(".cm", { y: -60, opacity: 0, rotate: () => gsap.utils.random(-8, 8) }, { y: 0, x: 0, opacity: 1, rotate: (i) => [-3, 2, -1, 3, -2, 1][i], stagger: 0.08, duration: 0.8, ease: "bounce.out", delay: 0.2 }); gsap.fromTo(".badge-47", { scale: 0 }, { scale: 1, duration: 0.6, ease: "back.out(3)", delay: 0.6 }); }
});
/* ---------- Bot ---------- */
let bs = { wait: null, svc: null, day: 0, time: null }, chatBusy = false;
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const SVC_KEYS = { s1: ["corte", "cut", "pelo"], s2: ["barba", "beard"], s3: ["combo", "completo"], s4: ["color", "tinte"], s5: ["balayage", "mechas", "highlights"], s6: ["blower", "peinado", "blowout"], s7: ["masaje", "massage", "relaj"], s8: ["piedras", "stones"], s14: ["facial"] };
function renderBot() {
  const B = t().bots;
  $("#botStats").innerHTML = B.stats.map(([v, s, l]) => `<div><strong data-count="${v}" data-suffix="${s}">${v}${s}</strong><span>${l}</span></div>`).join("");
  $("#flow").innerHTML = `<div class="flow-line"><i></i><b></b></div>` + B.flow.map(([a, b], i) => `<div class="fn" style="--i:${i}"><span class="fn-ico">${ico(["chat", "bot", "cal", "money", "bell"][i])}</span><b>${a}</b><small>${b}</small></div>`).join("");
  $("#chatIn").placeholder = B.ph;
  skinPhone(); resetChat();
}
function skinPhone() {
  const p = $("#phone"); p.className = `phone chan-${chan}`; p.style.setProperty("--sa", acc());
  $("#phName").textContent = biz.name || "Tu negocio"; $("#phAva").textContent = (biz.name || "A")[0]; $("#phIco").innerHTML = ico(chan === "ig" ? "ig" : chan === "wa" ? "wa" : "web");
}
let chatFor = ""; function resetChat() { chatFor = biz.name + biz.niche + lang; bs = { wait: null, svc: null, day: 0, time: null }; $("#chatBody").innerHTML = ""; botSay(fill(t().bots.r.hi, { b: biz.name || "Steliant" }), t().bots.chips, 300); }
function addMsg(dir, html) { const body = $("#chatBody"), m = document.createElement("div"); m.className = `msg ${dir}`; const d = new Date(); m.innerHTML = `${html}<small>${pad(d.getHours())}:${pad(d.getMinutes())}${dir === "out" ? " ✓✓" : ""}</small>`; body.appendChild(m); body.scrollTop = body.scrollHeight; hasG && !reduce && gsap.from(m, { y: 14, scale: 0.9, opacity: 0, duration: 0.45, ease: "back.out(2)", transformOrigin: dir === "in" ? "100% 100%" : "0 100%" }); return m; }
function botSay(html, chips = [], delay = 900) {
  chatBusy = true; $("#chatChips").innerHTML = ""; const body = $("#chatBody"), ty = document.createElement("div"); ty.className = "msg out typing-m"; ty.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
  setTimeout(() => { body.appendChild(ty); body.scrollTop = body.scrollHeight; }, 250);
  setTimeout(() => { ty.remove(); addMsg("out", html); $("#chatChips").innerHTML = chips.map((c) => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join(""); hasG && !reduce && gsap.from("#chatChips button", { y: 10, opacity: 0, stagger: 0.05, duration: 0.4 }); chatBusy = false; }, 250 + delay);
}
function userSay(txt) { if (chatBusy || !txt.trim()) return; addMsg("in", esc(txt)); botReply(txt); }
function freeSlots(day, pro) { return SLOTS.filter((m) => !taken(day, m, pro) && m >= 10 * 60).slice(day === 0 ? 0 : 2, (day === 0 ? 0 : 2) + 3); }
function botReply(raw) {
  const B = t().bots, R = B.r, x = norm(raw), svcs = nicheSvcs();
  if (bs.wait === "time") { const m = SLOTS.find((s) => norm(fmtTime(s)) === x.trim() || x.includes(norm(fmtTime(s)).split(" ")[0])); if (m != null) { bs.time = m; bs.wait = "name"; return botSay(fill(R.name, { t: fmtTime(m) })); } }
  if (bs.wait === "name") { const n = raw.trim().slice(0, 24); bs.wait = null; return confirmBot(n); }
  if (bs.wait === "svc") { const s = svcs.find((s) => norm(raw).includes(norm(sName(s)))) || svcs.find((s) => (SVC_KEYS[s.id] || []).some((k) => x.includes(k))); if (s) { bs.svc = s.id; return offerSlots(); } }
  if (/(hola|buenas|hey|hi|hello)/.test(x) && x.length < 14) return botSay(fill(R.hi, { b: biz.name }), B.chips);
  if (/(gracias|thank)/.test(x)) return botSay(R.thanks, [B.chips[0]]);
  if (/(precio|cuanto|cuesta|cost|price|much)/.test(x)) return botSay(`${R.price}<br>${svcs.map((s) => `• ${sName(s)} — <b>${money(s.price)}</b>`).join("<br>")}`, [B.chips[0]]);
  if (/(horario|hora|abren|open|hours|cierran)/.test(x) && !/(cita|reserv|book)/.test(x)) return botSay(R.hours, [B.chips[0]]);
  if (/(donde|ubic|direcc|where|address|location)/.test(x)) return botSay(R.where, [B.chips[0]]);
  const s = svcs.find((s) => (SVC_KEYS[s.id] || []).some((k) => x.includes(k)));
  if (/(cita|reserv|agend|turno|hueco|book|appointment|slot|quiero|want)/.test(x) || s) {
    bs.day = /(manana|tomorrow)/.test(x) ? 1 : 0; if (bs.day === 0 && new Date().getHours() >= 17) bs.day = 1;
    if (s) { bs.svc = s.id; return offerSlots(); }
    bs.wait = "svc"; return botSay(R.which, svcs.map(sName));
  }
  botSay(R.fallback, B.chips);
}
function offerSlots() { const R = t().bots.r, pro = nichePros()[0].id, sl = freeSlots(bs.day, pro); bs.wait = "time"; botSay(fill(R.slots, { s: `<b>${sName(svcById(bs.svc))}</b>`, d: bs.day ? R.tomorrow : R.today }), sl.map(fmtTime)); }
function confirmBot(name) {
  const R = t().bots.r, s = svcById(bs.svc), pro = nichePros()[0], at = new Date(DAYS[bs.day]); at.setHours(Math.floor(bs.time / 60), bs.time % 60, 0, 0);
  botSay(`${fill(R.done, { n: esc(name), s: `<b>${sName(s)}</b>`, d: bs.day ? R.tomorrow : R.today, t: fmtTime(bs.time) })}<span class="pay-link">💳 steliant.link/${slug()}/pago · ${money(Math.round(s.price * 0.3))}</span>`, [t().bots.chips[1]], 1300);
  books.push({ name, svc: s.id, pro: pro.id, at: at.getTime(), src: "bot" }); save("sr-books", books); renderPanels();
  setTimeout(() => showBotPop(name, s, pro, at), 1900); bs = { wait: null, svc: null, day: 0, time: null };
}
function showBotPop(name, s, pro, at) {
  const p = $("#botPop"), B = t().bots; p.hidden = false;
  p.innerHTML = `<span class="bp-ico">${ico("bot")}</span><div><b>${B.booked}</b><small>${esc(name)} · ${sName(s)} · ${pro.name} · ${at.toLocaleDateString(loc(), { weekday: "short", day: "numeric" })} ${fmtTime(at.getHours() * 60 + at.getMinutes())}</small></div><a href="#paneles" class="btn btn-accent btn-sm" data-psec="agenda" data-pday="${DAYS.findIndex((d) => d.toDateString() === new Date(at).toDateString())}">${B.see}</a><button type="button" class="bp-x" aria-label="Cerrar">×</button>`;
  hasG && !reduce ? gsap.fromTo(p, { y: 80, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "back.out(1.6)" }) : null;
  hasG && !reduce && gsap.fromTo(".bp-ico", { rotate: -30, scale: 0.5 }, { rotate: 0, scale: 1, duration: 1, ease: "elastic.out(1,.4)", delay: 0.2 });
  clearTimeout(p._t); p._t = setTimeout(() => (p.hidden = true), 12000);
}
$("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#chatIn"); userSay(i.value); i.value = ""; });
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-chip]"); if (c) return userSay(c.dataset.chip);
  const ch = e.target.closest("[data-chan]"); if (ch) { chan = ch.dataset.chan; $$("[data-chan]").forEach((b) => b.classList.toggle("on", b === ch)); if (hasG && !reduce) gsap.to("#phone", { rotateY: 90, duration: 0.3, ease: "power2.in", onComplete: () => { skinPhone(); gsap.fromTo("#phone", { rotateY: -90 }, { rotateY: 0, duration: 0.7, ease: "back.out(1.4)" }); } }); else skinPhone(); return; }
  if (e.target.closest(".bp-x")) $("#botPop").hidden = true;
  if (e.target.closest("#botPop a")) $("#botPop").hidden = true;
});
const INC = [["Carla", { es: "¿Precio de uñas gel?", en: "Gel nails price?" }], ["Iván", { es: "Hueco hoy 5pm?", en: "Slot today 5pm?" }], ["Sara", { es: "Quiero balayage 😍", en: "I want balayage 😍" }], ["Leo", { es: "¿Abren domingo?", en: "Open on Sunday?" }], ["Mía", { es: "Reservar facial", en: "Book a facial" }], ["Tony", { es: "Corte + barba mañana", en: "Cut + beard tomorrow" }]];
let incI = 0;
setInterval(() => {
  if (current !== "bots" || document.hidden || reduce || !hasG) return; const box = $("#incoming"); if (!box) return;
  const [n, m] = INC[incI++ % INC.length], el = document.createElement("div"); el.className = "inc"; el.innerHTML = `<span>${n[0]}</span><div><b>${n}</b><small>${L(m)}</small></div><em>✓ bot</em>`;
  const side = incI % 2 ? 1 : -1; el.style.left = side > 0 ? "auto" : "0"; el.style.right = side > 0 ? "0" : "auto"; box.appendChild(el);
  gsap.fromTo(el, { y: 380, opacity: 0, scale: 0.8 }, { y: 20, opacity: 1, scale: 1, duration: 1.2, ease: "expo.out" });
  gsap.to(el, { y: -60, opacity: 0, duration: 1, delay: 3.2, ease: "power2.in", onComplete: () => el.remove() });
}, 2200);

/* ---------- Panels ---------- */
const PLAN_SECS = { solo: ["agenda", "clients", "reports"], team: ["agenda", "clients", "team", "comm", "bot", "reports"], studio: ["agenda", "clients", "team", "comm", "bot", "reports", "branches"] };
const ALL_SECS = ["agenda", "clients", "team", "comm", "bot", "reports", "branches"];
const SEC_ICO = { agenda: "cal", clients: "users", team: "team", comm: "money", bot: "bot", reports: "chart", branches: "pin" };
const CLIENTS = [["Laura Pérez", "809-555-0101", 12, 14400, "vip"], ["Miguel Díaz", "829-555-0112", 8, 4200, "regular"], ["Rosa Mateo", "809-555-0133", 5, 9800, "regular"], ["José Tejada", "849-555-0144", 15, 16500, "vip"], ["Ana García", "809-555-0155", 3, 7100, "regular"], ["Pedro Ruiz", "829-555-0166", 1, 700, "newc"], ["María Santos", "809-555-0177", 9, 11200, "vip"], ["Karla Vidal", "849-555-0188", 2, 2400, "newc"]];
const BASE = { p1: [[9, 1, "Pedro R.", "s1"], [10.5, 1.25, "José T.", "s3"], [14, 0.75, "Luis C.", "s1"], [16, 1, "Iván P.", "s3"]], p4: [[9.5, 0.5, "Tony M.", "s2"], [11, 1, "Leo S.", "s1"], [15, 1.25, "Raúl D.", "s3"]], p2: [[9.5, 1.5, "Ana G.", "s4"], [12, 2.5, "Sara L.", "s5"], [16.5, 0.75, "Eva M.", "s6"]], p3: [[10, 1.5, "Laura P.", "s4"], [13, 1, "Rosa M.", "s9"], [15, 2.5, "Nuria F.", "s5"]], p6: [[9, 1, "Karla V.", "s7"], [11, 1.5, "Mía R.", "s8"], [15, 1, "Lía S.", "s7"]], p7: [[10, 0.8, "Carla D.", "s14"], [13.5, 1, "Ana B.", "s7"]] };
const panelPros = () => (panelPlan === "solo" ? [nichePros()[0]] : nichePros().concat(PROS.filter((p) => !p.biz.includes(biz.niche))).slice(0, 4));
function renderPanels() {
  const PL = t().plans, P = t().panels;
  $("#planSwitch").innerHTML = ["solo", "team", "studio"].map((id) => `<button type="button" class="ps${panelPlan === id ? " on" : ""}" data-pplan="${id}"><b>${PL.list[id][0]}</b><small>${PL.list[id][1]}</small><em>${money(planPrice(id))}${PL.per}</em></button>`).join("");
  if (!PLAN_SECS[panelPlan].includes(panelSec) && !ALL_SECS.includes(panelSec)) panelSec = "agenda";
  const notif = books.length + 3;
  $("#appShell").innerHTML = `<aside class="ap-side"><div class="ap-biz"><span class="s-logo" style="--sa:${acc()}">${esc((biz.name || "A")[0])}</span><div><b>${esc(biz.name || "Tu negocio")}</b><small>${PL.list[panelPlan][0]}</small></div></div>
      <nav class="ap-nav">${ALL_SECS.map((s) => { const ok = PLAN_SECS[panelPlan].includes(s); return `<button type="button" class="${panelSec === s ? "on" : ""}${ok ? "" : " locked"}" data-psec="${s}">${ico(SEC_ICO[s])}<span>${P.nav[s]}</span>${ok ? (s === "bot" && books.some((b) => b.src === "bot") ? `<em>${books.filter((b) => b.src === "bot").length}</em>` : "") : ico("lock")}</button>`; }).join("")}<i class="ap-ink"></i></nav>
      <a href="#planes" class="ap-up">${P.choose} →</a></aside>
    <section class="ap-main"><header class="ap-top"><h3>${P.nav[panelSec]}</h3><label class="ap-search">${ico("search")}<input id="apSearch" placeholder="${P.search}" autocomplete="off"></label><button type="button" class="ap-bell" data-psec="bot">${ico("bell")}<em>${notif}</em></button><span class="ap-me">${pic(PROS[1].img)}</span></header><div class="ap-body" id="apBody"></div></section>`;
  renderSec(false);
}
function renderSec(anim = true) {
  const P = t().panels, body = $("#apBody"); if (!body) return;
  $$(".ap-nav button").forEach((b) => b.classList.toggle("on", b.dataset.psec === panelSec));
  $(".ap-top h3").textContent = P.nav[panelSec];
  const ink = $(".ap-ink"), on = $(".ap-nav .on"); if (ink && on) { ink.style.transform = `translateY(${on.offsetTop}px)`; ink.style.height = on.offsetHeight + "px"; }
  if (!PLAN_SECS[panelPlan].includes(panelSec)) { const need = ["team", "studio"].find((p) => PLAN_SECS[p].includes(panelSec)); body.innerHTML = `<div class="locked-box"><span>${ico("lock")}</span><b>${P.nav[panelSec]}</b><p>${P.locked} <strong>${t().plans.list[need][0]}</strong></p><button type="button" class="btn btn-accent btn-sm" data-pplan="${need}">${t().plans.list[need][0]} →</button></div>`; anim && hasG && !reduce && gsap.from(".locked-box", { scale: 0.9, opacity: 0, duration: 0.6, ease: "back.out(2)" }); return; }
  body.innerHTML = ({ agenda: secAgenda, clients: secClients, team: secTeam, comm: secComm, bot: secBot, reports: secReports, branches: secBranches })[panelSec]();
  if (!anim || !hasG || reduce) return;
  gsap.from("#apBody > *", { y: 24, opacity: 0, stagger: 0.06, duration: 0.6, ease: "expo.out" });
  if (panelSec === "agenda") gsap.from(".cal-b", { scaleY: 0, transformOrigin: "top", stagger: 0.012, duration: 0.6, ease: "expo.out", delay: 0.1 });
  if (panelSec === "reports" || panelSec === "branches") { const l = $(".line-chart .line"); if (l) { const n = l.getTotalLength(); gsap.fromTo(l, { strokeDasharray: n, strokeDashoffset: n }, { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut" }); } gsap.from(".hb i, .brc-bar i", { scaleX: 0, transformOrigin: "left", stagger: 0.06, duration: 1, ease: "expo.out", delay: 0.3 }); $$("#apBody [data-count]").forEach(countUp); }
  if (panelSec === "team") gsap.from(".oc-arc", { strokeDashoffset: 113, stagger: 0.1, duration: 1.3, ease: "expo.out" });
  if (panelSec === "bot") gsap.from(".bbars i", { scaleY: 0, transformOrigin: "bottom", stagger: 0.03, duration: 0.8, ease: "expo.out" });
}
function dayBooks(di) { const ds = DAYS[di].toDateString(); return books.filter((b) => new Date(b.at).toDateString() === ds); }
function secAgenda() {
  const P = t().panels, pros = panelPros(), extra = dayBooks(panelDay);
  const cols = pros.map((p) => { let bl = (BASE[p.id] || BASE.p1).map((b) => [...b]); if (panelDay % 2) bl = bl.map((b) => [b[0] + 0.5, b[1], b[2], b[3]]); extra.filter((b) => b.pro === p.id || (panelPlan === "solo" && pros[0].id === p.id && !pros.some((x) => x.id === b.pro))).forEach((b) => { const d = new Date(b.at), h = d.getHours() + d.getMinutes() / 60, len = svcById(b.svc).min / 60; bl = bl.filter((x) => x[0] + x[1] <= h || x[0] >= h + len); bl.push([h, len, b.name, b.svc, b.src]); }); return [p, bl]; });
  const now = new Date(), nowH = now.getHours() + now.getMinutes() / 60;
  return `<div class="cal-days">${DAYS.slice(0, 7).map((d, i) => `<button type="button" class="${i === panelDay ? "on" : ""}" data-pday="${i}"><small>${d.toLocaleDateString(loc(), { weekday: "short" }).replace(".", "")}</small><b>${d.getDate()}</b>${dayBooks(i).length ? `<i>${dayBooks(i).length}</i>` : ""}</button>`).join("")}<span class="cal-legend"><span><i class="lg-bot"></i>${P.fromBot}</span><span><i class="lg-web"></i>${P.fromWeb}</span></span></div>
    <div class="cal" style="--c:${cols.length}"><div class="cal-hours">${Array.from({ length: 10 }, (_, k) => `<span>${fmtTime((9 + k) * 60).replace(":00", "")}</span>`).join("")}</div>${cols.map(([p, bl]) => `<div class="cal-col"><div class="cal-pro"><span>${pic(p.img)}</span><b>${p.name}</b></div><div class="cal-track">${bl.map(([s, d, c, sv, src]) => `<div class="cal-b${src ? " src-" + src : ""}" style="--s:${((s - 9) / 10) * 100}%;--d:${(d / 10) * 100}%" data-cb="${esc(c)}|${sv}|${src || ""}|${s}"><b>${src === "bot" ? "🤖 " : src === "web" ? "🌐 " : ""}${esc(c)}</b><small>${fmtTime(Math.round(s * 60))} · ${sName(svcById(sv))}</small></div>`).join("")}${panelDay === 0 && nowH > 9 && nowH < 19 ? `<i class="cal-now" style="--n:${((nowH - 9) / 10) * 100}%"></i>` : ""}</div></div>`).join("")}</div>
    <div class="cal-detail" id="calDetail" hidden></div>`;
}
function secClients() {
  const P = t().panels, extra = books.slice().reverse().map((b) => [b.name, "—", 1, svcById(b.svc).price, "newc", b.src]);
  return `<table class="tbl" id="cliTbl"><thead><tr><th></th><th>${t().site.name}</th><th>WhatsApp</th><th>${P.visits}</th><th>${P.spent}</th><th>${P.tag}</th></tr></thead><tbody>${extra.concat(CLIENTS).map(([n, ph, v, sp, tg, src]) => `<tr data-q="${esc(norm(n))}"><td><span class="av">${esc(n[0])}</span></td><td><b>${esc(n)}</b>${src ? `<small class="src">${src === "bot" ? "🤖 bot" : "🌐 web"}</small>` : ""}</td><td>${ph}</td><td>${v}</td><td>${money(sp)}</td><td><span class="tg ${tg}">${P[tg]}</span></td></tr>`).join("")}</tbody></table>`;
}
function secTeam() {
  const P = t().panels;
  return `<div class="team-grid">${panelPros().concat(panelPlan === "studio" ? PROS.slice(4, 6) : []).map((p, i) => { const o = [92, 84, 76, 61, 88, 70][i]; return `<div class="tm glass"><span class="tm-img">${pic(p.img)}</span><b>${p.name}</b><small>${role(p)} · ★ ${p.rating.toFixed(1)}</small><svg viewBox="0 0 44 44" class="oc-ring"><circle cx="22" cy="22" r="18"/><circle cx="22" cy="22" r="18" class="oc-arc" style="--p:${o}"/></svg><em>${o}% ${P.occ}</em><dl><div><dt>${P.appts}</dt><dd>${[6, 5, 4, 3, 5, 4][i]}</dd></div><div><dt>${P.earned}</dt><dd>${money([52800, 61900, 58400, 39700, 44100, 36500][i])}</dd></div></dl></div>`; }).join("")}</div>`;
}
function secComm() {
  const P = t().panels, rows = panelPros().map((p, i) => [p, [46, 38, 31, 42][i], [52800, 61900, 58400, 39700][i]]), tot = rows.reduce((s, r) => s + r[2] * 0.4, 0);
  return `<table class="tbl comm"><thead><tr><th>${t().site.team}</th><th>${t().site.services}</th><th>${P.earned}</th><th>${P.rate}</th><th>${P.payout}</th><th></th></tr></thead><tbody>${rows.map(([p, n, g]) => `<tr><td><span class="av">${pic(p.img)}</span><b>${p.name}</b></td><td>${n}</td><td>${money(g)}</td><td>40%</td><td><b class="acc">${money(g * 0.4)}</b></td><td class="paid-ck">${ico("check")}</td></tr>`).join("")}</tbody></table>
    <div class="comm-foot"><span>${P.payout}: <b>${money(tot)}</b></span><button type="button" class="btn btn-accent btn-sm" id="closePay">${P.close}</button></div>`;
}
function secBot() {
  const P = t().panels, bb = books.filter((b) => b.src === "bot").reverse(), convs = bb.map((b) => [b.name, `${sName(svcById(b.svc))} ✅`, "ahora", true]).concat([["Karla V.", lang === "en" ? "Booked gel nails Fri 4:00 ✅" : "Agendó uñas gel vie 4:00 ✅", "12 min"], ["Iván P.", lang === "en" ? "Do you open on Sunday?" : "¿Abren el domingo?", "18 min"], ["Sara L.", lang === "en" ? "Paid deposit RD$1,050 💳" : "Pagó depósito RD$1,050 💳", "34 min"], ["Leo S.", lang === "en" ? "Price for cut + beard?" : "¿Precio corte + barba?", "1 h"]]);
  return `<div class="bot-kpis">${P.botStats.map((l, i) => `<div class="glass"><small>${l}</small><b>${[1284 + bb.length * 4, 38 + bb.length, "2.8 s"][i]}</b></div>`).join("")}</div>
    <div class="bot-split"><div class="convs">${convs.map(([n, m, w, me]) => `<div class="cv${me ? " me" : ""}"><span class="av wa">${esc(n[0])}</span><span><b>${esc(n)}</b><small>${m}</small></span><em>${w}</em></div>`).join("")}</div>
    <div class="glass bchart"><small>${lang === "en" ? "Messages per hour" : "Mensajes por hora"}</small><div class="bbars">${[12, 18, 26, 34, 40, 38, 30, 44, 52, 48, 36, 22].map((h, i) => `<i style="--h:${h * 1.7}%"><em>${9 + i}</em></i>`).join("")}</div></div></div>`;
}
function lineChart(vals, label) { const W = 640, H = 200, mx = Math.max(...vals) * 1.15, xs = (i) => 30 + (i / (vals.length - 1)) * (W - 50), ys = (v) => H - 22 - (v / mx) * (H - 40), path = vals.map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(" "); return `<svg viewBox="0 0 ${W} ${H}" class="line-chart"><defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".3"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${[0, 1, 2, 3].map((k) => `<line x1="30" x2="${W - 20}" y1="${18 + k * 46}" y2="${18 + k * 46}" class="grid-l"/>`).join("")}<path d="${path} L${xs(vals.length - 1)} ${H - 22} L${xs(0)} ${H - 22} Z" fill="url(#lg)"/><path d="${path}" class="line"/>${vals.map((v, i) => `<circle cx="${xs(i)}" cy="${ys(v)}" r="${i === vals.length - 1 ? 6 : 3}" class="pt${i === vals.length - 1 ? " last" : ""}"/>`).join("")}<text x="${xs(vals.length - 1) - 10}" y="${ys(vals[vals.length - 1]) - 12}" text-anchor="end" class="val">${label}</text></svg>`; }
function secReports() {
  const P = t().panels, k = panelPlan === "solo" ? [[86400, "RD$"], [94, ""], [920, "RD$"], [21, ""]] : [[412000, "RD$"], [486, ""], [1840, "RD$"], [96, ""]];
  const top = nicheSvcs().concat(SERVICES.filter((s) => s.biz !== biz.niche)).slice(0, 5);
  return `<div class="kpis">${P.kpis.map((l, i) => `<div class="kpi glass"><small>${l}</small><b>${k[i][1]}<span data-count="${k[i][0]}">${k[i][0].toLocaleString("en-US")}</span></b><em>▲ ${[18, 12, 6, 22][i]}%</em></div>`).join("")}</div>
    <div class="rep-grid"><div class="glass chart-box"><small>${P.revenue}</small>${lineChart([88, 96, 92, 104, 118, 112, 126, 131, 128, 142, 158, 184].map((v) => (panelPlan === "solo" ? v / 4.5 : v)), panelPlan === "solo" ? "RD$40.9K" : "RD$184.6K")}</div>
    <div class="glass"><small>${P.top}</small><div class="hb">${top.map((s, i) => `<div><span>${sName(s)}</span><i style="--w:${[38, 24, 17, 12, 9][i] * 2.4}%"></i><em>${[38, 24, 17, 12, 9][i]}%</em></div>`).join("")}</div></div></div>`;
}
function secBranches() {
  const P = t().panels, data = [[184600, 92, 214], [142300, 84, 176], [98400, 71, 128]];
  return `<div class="br-grid">${P.branches.map((n, i) => `<div class="br glass"><span class="br-img">${pic([IMG.salon, IMG.barber2, IMG.stones][i])}</span><b>${n}</b><small>${P.branchTxt} ${i + 1}</small><dl><div><dt>${P.kpis[0]}</dt><dd>${money(data[i][0])}</dd></div><div><dt>${P.occ}</dt><dd>${data[i][1]}%</dd></div><div><dt>${P.kpis[1]}</dt><dd>${data[i][2]}</dd></div></dl></div>`).join("")}</div>
    <div class="glass br-cmp"><small>${P.compare}</small>${P.branches.map((n, i) => `<div class="brc-bar"><span>${n}</span><i style="--w:${(data[i][0] / 184600) * 100}%"></i><em>${money(data[i][0])}</em></div>`).join("")}</div>`;
}
document.addEventListener("click", (e) => {
  const pp = e.target.closest("[data-pplan]"); if (pp) { panelPlan = pp.dataset.pplan; if (!PLAN_SECS[panelPlan].includes(panelSec)) panelSec = "agenda"; renderPanels(); if (current === "paneles" && hasG && !reduce) { gsap.from(".ap-main", { opacity: 0, x: 30, duration: 0.6, ease: "expo.out" }); gsap.from(".ap-nav button", { x: -20, opacity: 0, stagger: 0.04, duration: 0.5, ease: "expo.out" }); } }
  const ps = e.target.closest("[data-psec]"); if (ps) { panelSec = ps.dataset.psec; if (ps.dataset.pday) panelDay = Math.max(0, +ps.dataset.pday); if (current === "paneles") renderSec(); else renderPanels(); }
  const pd = e.target.closest("[data-pday]"); if (pd && !ps) { panelDay = +pd.dataset.pday; renderSec(); }
  const cb = e.target.closest("[data-cb]"); if (cb) { const [n, sv, src, s] = cb.dataset.cb.split("|"), d = $("#calDetail"), sx = svcById(sv); d.hidden = false; d.innerHTML = `<span class="cd-img">${pic(sx.img)}</span><div><b>${n}</b><small>${sName(sx)} · ${fmtTime(Math.round(+s * 60))} · ${money(sx.price)}</small>${src ? `<em class="src">${src === "bot" ? "🤖 " + t().panels.fromBot : "🌐 " + t().panels.fromWeb}</em>` : ""}</div><button type="button" class="btn btn-accent btn-sm" data-arrive>${lang === "en" ? "Check in" : "Marcar llegada"}</button>`; hasG && gsap.fromTo(d, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out" }); $$(".cal-b").forEach((x) => x.classList.toggle("sel", x === cb)); }
  if (e.target.closest("[data-arrive]")) { toast(lang === "en" ? "Client checked in ✓" : "Cliente en sala ✓"); $(".cal-b.sel")?.classList.add("arrived"); }
  if (e.target.closest("#closePay")) { const b = $("#closePay"); b.disabled = true; $$(".paid-ck").forEach((c, i) => setTimeout(() => c.classList.add("on"), 250 * i)); setTimeout(() => toast(t().panels.closed), 250 * $$(".paid-ck").length + 300); }
});
document.addEventListener("input", (e) => { if (e.target.id !== "apSearch") return; const q = norm(e.target.value); if (panelSec !== "clients" && q) { panelSec = "clients"; renderSec(); $("#apSearch").value = e.target.value; $("#apSearch").focus(); } $$("#cliTbl tbody tr").forEach((r) => (r.hidden = q && !r.dataset.q.includes(q))); });

/* ---------- Plans ---------- */
function renderPlans() {
  const PL = t().plans;
  $("#planGrid").innerHTML = PLANS.map((p) => { const [n, cap] = PL.list[p.id], pr = planPrice(p.id); return `<article class="plan glass${p.featured ? " feat" : ""}${selPlan === p.id ? " sel" : ""}" data-plan="${p.id}" data-tilt>${p.featured ? `<span class="plan-badge">${PL.popular}</span>` : ""}<b class="plan-n">${n}</b><p class="plan-cap">${cap}</p><div class="plan-price">${p.fee ? `<strong>${PL.free}</strong><small>${PL.fee}</small>` : `<strong data-price="${pr}">${money(pr)}</strong><small>${PL.per}</small>`}</div><button type="button" class="btn ${p.featured ? "btn-accent" : "btn-ghost"}" data-choose="${p.id}">${PL.choose}</button><a href="#paneles" class="plan-prev" data-pplan="${p.id === "com" ? "solo" : p.id}" data-psec="agenda">${ico("grid")} ${PL.preview}</a></article>`; }).join("");
  $("#cmp").innerHTML = `<table><thead><tr><th></th>${PLANS.map((p) => `<th class="${p.featured ? "feat" : ""}">${PL.list[p.id][0]}</th>`).join("")}</tr></thead><tbody>${PL.rows.map(([l, ...v]) => `<tr><td>${l}</td>${v.map((x, i) => `<td class="${PLANS[i].featured ? "feat" : ""}">${x === 1 ? `<span class="yes">${ico("check")}</span>` : x === 0 ? '<span class="no">—</span>' : x}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  $("#addList").innerHTML = ADDONS.map((a) => `<label class="add${addons.includes(a.id) ? " on" : ""}"><input type="checkbox" data-addon="${a.id}" ${addons.includes(a.id) ? "checked" : ""}><span class="sw"><i></i></span><b>${PL.addons[a.id]}</b><em>+${money(a.price)}</em></label>`).join("");
  $("#faqList").innerHTML = PL.faq.map(([q, a]) => `<details class="qa glass"><summary>${q}<i></i></summary><p>${a}</p></details>`).join("");
  updTotal(false);
}
function updTotal(anim) { const PL = t().plans, total = planPrice(selPlan) + addonsSum(), el = $("#addTotal"); if (!el) return; if (!anim || !hasG || reduce) { el.textContent = money(total) + PL.per; return; } const o = { v: parseInt(el.textContent.replace(/\D/g, "")) || 0 }; gsap.to(o, { v: total, duration: 0.8, ease: "power3.out", onUpdate: () => (el.textContent = money(o.v) + PL.per) }); }
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-bill]"); if (b) { bill = b.dataset.bill; $$("[data-bill]").forEach((x) => x.classList.toggle("on", x === b)); const pill = $("#bill .pill"); pill.style.width = b.offsetWidth + "px"; pill.style.transform = `translateX(${b.offsetLeft - 4}px)`;
    $$("[data-price]").forEach((el) => { const id = el.closest("[data-plan]").dataset.plan, to = planPrice(id), o = { v: +el.dataset.price }; el.dataset.price = to; hasG ? gsap.to(o, { v: to, duration: 0.9, ease: "power3.out", onUpdate: () => (el.textContent = money(o.v)) }) : (el.textContent = money(to)); }); updTotal(true); return; }
  const ch = e.target.closest("[data-choose]"); if (ch) { selPlan = ch.dataset.choose; $$(".plan").forEach((x) => x.classList.toggle("sel", x.dataset.plan === selPlan)); return openCo("plan"); }
  const pl = e.target.closest("[data-plan]"); if (pl && !e.target.closest("a")) { selPlan = pl.dataset.plan; $$(".plan").forEach((x) => x.classList.toggle("sel", x === pl)); updTotal(true); }
});
document.addEventListener("change", (e) => { const a = e.target.dataset.addon; if (!a) return; addons = e.target.checked ? [...addons, a] : addons.filter((x) => x !== a); e.target.closest(".add").classList.toggle("on", e.target.checked); updTotal(true); });

/* ---------- Onboarding ---------- */
let ob = { step: 0, svcs: [], open: 9, close: 19, team: 3 };
function startOnboarding() { ob = { step: 0, svcs: nicheSvcs().map((s) => s.id), open: 9, close: 19, team: selPlan === "solo" || selPlan === "com" ? 1 : 3 }; renderOb(); }
function renderOb() {
  const O = t().onb, H = t().home;
  $("#coSum").innerHTML = `<div class="ob-prev site s-${biz.niche}" style="--sa:${acc()}"><span class="s-logo">${esc((biz.name || "A")[0])}</span><b>${esc(biz.name || "Tu negocio")}</b><small>steliant.link/${slug()}</small><div class="ob-svcs">${ob.svcs.map((id) => `<span>${sName(svcById(id))}</span>`).join("")}</div><em>${fmtTime(ob.open * 60)} – ${fmtTime(ob.close * 60)} · ${ob.team} ${O.team.toLowerCase()}</em></div><ol class="ob-steps">${O.steps.map((s, i) => `<li class="${i === ob.step ? "on" : i < ob.step ? "done" : ""}"><span>${i < ob.step ? "✓" : i + 1}</span>${s}</li>`).join("")}</ol>`;
  let h = "";
  if (ob.step === 0) h = `<div class="fl wide${biz.name.trim().length > 1 ? " valid" : ""}"><input id="obName" placeholder=" " value="${esc(biz.name)}" autocomplete="off"><label for="obName">${H.cfgName}</label><i class="ok"></i></div><div class="cfg-niche">${NICHES.map((n) => `<button type="button" data-obn="${n}" class="${biz.niche === n ? "on" : ""}">${ico(NICON[n])}${t().niche[n]}</button>`).join("")}</div>`;
  else if (ob.step === 1) h = `<p class="ob-q">${O.svc}</p><div class="ob-grid">${nicheSvcs().map((s) => `<button type="button" class="ob-svc${ob.svcs.includes(s.id) ? " on" : ""}" data-obs="${s.id}"><span>${pic(s.img)}</span><b>${sName(s)}</b><small>${money(s.price)}</small><i>${ico("check")}</i></button>`).join("")}</div>`;
  else h = `<div class="ob-hours">${[["open", O.open, 7, 12], ["close", O.closeAt, 16, 22]].map(([k, l, a, b]) => `<label><small>${l}</small><input type="range" min="${a}" max="${b}" value="${ob[k]}" data-obh="${k}"><b>${fmtTime(ob[k] * 60)}</b></label>`).join("")}<div class="ob-team"><small>${O.team}</small><div class="stepper"><button type="button" data-obt="-1">−</button><b>${ob.team}</b><button type="button" data-obt="1">+</button></div></div></div>`;
  $("#coMain").innerHTML = `<h3>${O.title}</h3><div class="ob-body">${h}</div><div class="ob-foot"><button type="button" class="btn btn-ghost" data-obb ${ob.step ? "" : "disabled"}>${t().site.back}</button><button type="button" class="btn btn-accent" data-obnext>${ob.step === 2 ? O.finish : t().site.next}</button></div><div class="ob-build" id="obBuild" hidden></div>`;
  hasG && !reduce && gsap.from(".ob-body > *", { y: 20, opacity: 0, stagger: 0.05, duration: 0.6, ease: "expo.out" });
}
document.addEventListener("click", (e) => {
  const n = e.target.closest("[data-obn]"); if (n) { biz.niche = n.dataset.obn; save("sr-biz", biz); ob.svcs = nicheSvcs().map((s) => s.id); renderOb(); return; }
  const s = e.target.closest("[data-obs]"); if (s) { const id = s.dataset.obs; ob.svcs = ob.svcs.includes(id) ? ob.svcs.filter((x) => x !== id) : [...ob.svcs, id]; renderOb(); return; }
  const tm = e.target.closest("[data-obt]"); if (tm) { ob.team = Math.max(1, Math.min(selPlan === "studio" ? 20 : 8, ob.team + +tm.dataset.obt)); renderOb(); return; }
  if (e.target.closest("[data-obb]")) { ob.step--; renderOb(); return; }
  if (e.target.closest("[data-obnext]")) { if (ob.step < 2) { ob.step++; renderOb(); return; } finishOb(); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "obName") { biz.name = e.target.value; save("sr-biz", biz); const b = $(".ob-prev b"); if (b) b.textContent = biz.name || "Tu negocio"; const l = $(".ob-prev .s-logo"); if (l) l.textContent = (biz.name || "A")[0]; e.target.parentElement.classList.toggle("valid", biz.name.trim().length > 1); }
  const h = e.target.dataset.obh; if (h) { ob[h] = +e.target.value; e.target.nextElementSibling.textContent = fmtTime(ob[h] * 60); const em = $(".ob-prev em"); if (em) em.textContent = `${fmtTime(ob.open * 60)} – ${fmtTime(ob.close * 60)} · ${ob.team} ${t().onb.team.toLowerCase()}`; }
});
function finishOb() {
  const O = t().onb, box = $("#obBuild"); $(".ob-body").hidden = true; $(".ob-foot").hidden = true; box.hidden = false; $("#co").classList.add("busy");
  box.innerHTML = O.creating.map((x, i) => `<div class="obb" style="--i:${i}"><span class="obb-ck">${ico("check")}</span>${x}</div>`).join("") + `<div class="obb-bar"><i></i></div>`;
  const rows = $$(".obb"); rows.forEach((r, i) => setTimeout(() => r.classList.add("on"), 600 * i + 300));
  hasG && gsap.fromTo(".obb-bar i", { scaleX: 0 }, { scaleX: 1, duration: 2.6, ease: "power2.inOut" });
  setTimeout(() => {
    myPlan = { id: selPlan, bill, addons: [...addons], biz: biz.name, at: Date.now() }; save("sr-plan", myPlan);
    panelPlan = selPlan === "com" ? "solo" : selPlan; panelSec = "agenda"; $("#co").classList.remove("busy"); closeCo();
    renderAll(); go("paneles"); setTimeout(() => toast(fill(O.done, { b: biz.name })), 1500);
  }, 600 * O.creating.length + 700);
}
function renderAll() { renderCfg(); renderMini(); renderDemos(); skinPhone(); renderPanels(); renderPlanCard(); }
/* ---------- Theme + language ---------- */
const root = document.documentElement;
const savedT = store.get("sr-theme"); if (savedT) root.dataset.theme = savedT;
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
$("#themeBtn").addEventListener("click", (e) => {
  const next = isDark() ? "light" : "dark", swap = () => { root.dataset.theme = next; store.set("sr-theme", next); };
  if (!document.startViewTransition || reduce) return swap();
  const r = e.currentTarget.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(swap).ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 850, easing: "cubic-bezier(.19,1,.22,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
});
$$("[data-lang]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.lang === lang) return; lang = b.dataset.lang; store.set("sr-lang", lang); document.body.classList.add("swapping"); setTimeout(() => { renderStatic(); document.body.classList.remove("swapping"); buildMotion(false); }, 230); }));

/* ---------- Dock + views ---------- */
function markActive() {
  $$("[data-view]").forEach((a) => a.classList.toggle("is-active", a.dataset.view === current));
  const on = $(".dock .is-active"), blob = $(".dock-blob"); if (!on || !blob) return;
  blob.style.width = on.offsetWidth + "px"; blob.style.transform = `translateX(${on.offsetLeft}px)`;
}
const dock = $("#dock");
if (!reduce && matchMedia("(hover:hover) and (pointer:fine)").matches) {
  dock.addEventListener("mousemove", (e) => $$(".dk").forEach((d) => { const r = d.getBoundingClientRect(), dist = Math.abs(e.clientX - (r.left + r.width / 2)); d.style.setProperty("--z", (1 + Math.max(0, 1 - dist / 160) * 0.22).toFixed(3)); }));
  dock.addEventListener("mouseleave", () => $$(".dk").forEach((d) => d.style.setProperty("--z", 1)));
}
function showView(id, animate) {
  if (!VIEWS.some(([v]) => v === id)) id = "inicio";
  const swap = () => {
    $$(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + id));
    current = id; document.body.dataset.view = id; markActive(); scrollTo(0, 0);
    if (id === "inicio") { renderAppt(); renderPlanCard(); }
    if (id === "paneles") renderPanels();
    if (id === "bots") { skinPhone(); if (!$("#chatBody").children.length || chatFor !== biz.name + biz.niche + lang) resetChat(); }
    if (id === "demos") renderDemos();
    buildMotion(true);
  };
  if (!animate || !hasG || reduce) return swap();
  const c = $("#curtain"), sw = c.querySelector(".sweep"), span = sw.querySelector("span"), k = VIEWS.find(([v]) => v === id); span.textContent = t().nav[k[1]];
  gsap.timeline().set(c, { visibility: "visible" })
    .fromTo(sw, { xPercent: -110 }, { xPercent: 0, duration: 0.75, ease: "expo.inOut" })
    .fromTo(span, { y: 60, opacity: 0, skewX: 14 }, { y: 0, opacity: 1, skewX: 14, duration: 0.6, ease: "expo.out" }, 0.4)
    .add(swap)
    .to(span, { y: -40, opacity: 0, duration: 0.35, ease: "power2.in" }, "+=0.1")
    .to(sw, { xPercent: 110, duration: 0.8, ease: "expo.inOut" }, "-=0.15")
    .set(c, { visibility: "hidden" }).set(sw, { xPercent: -110 });
}
function go(id) { try { history.pushState(null, "", "#" + id); } catch (e) {} showView(id, true); }
document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#"]'); if (!a) return; const id = a.getAttribute("href").slice(1); if (!id) return; e.preventDefault(); go(id); });
addEventListener("popstate", () => showView(location.hash.slice(1), true));
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#co").classList.contains("busy")) closeCo(); });
addEventListener("resize", () => { markActive(); movePill(); });

/* ---------- Scroll, cursor ---------- */
addEventListener("scroll", () => { const y = scrollY; $("#top").classList.toggle("glassy", y > 30); const h = document.documentElement.scrollHeight - innerHeight; $(".scroll-prog i").style.transform = `scaleX(${h > 0 ? y / h : 0})`; }, { passive: true });
if (!reduce && matchMedia("(hover:hover) and (pointer:fine)").matches) {
  document.body.classList.add("has-cursor");
  const c = $(".cursor"); let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
  addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    const m = e.target.closest(".magnetic"); if (m) { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(mx - r.left - r.width / 2) * 0.2}px,${(my - r.top - r.height / 2) * 0.3}px)`; }
    const tl = e.target.closest("[data-tilt]"); if (tl) { const r = tl.getBoundingClientRect(), px = (mx - r.left) / r.width, py = (my - r.top) / r.height; tl.style.setProperty("--mx", px * 100 + "%"); tl.style.setProperty("--my", py * 100 + "%"); tl.style.transform = `perspective(1000px) rotateY(${(px - 0.5) * 6}deg) rotateX(${(0.5 - py) * 6}deg)`; }
    if (current === "inicio") { const b = $("#miniBrowser"); if (b) b.style.transform = `perspective(1400px) rotateY(${-6 + (mx / innerWidth - 0.5) * 8}deg) rotateX(${3 - (my / innerHeight - 0.5) * 6}deg)`; }
  });
  document.addEventListener("mouseout", (e) => { [".magnetic", "[data-tilt]"].forEach((s) => { const el = e.target.closest(s); if (el && !el.contains(e.relatedTarget)) { el.style.transition = "transform .7s cubic-bezier(.19,1,.22,1)"; el.style.transform = ""; setTimeout(() => (el.style.transition = ""), 700); } }); });
  document.addEventListener("mouseover", (e) => { const h = e.target.closest("a,button,select,input,label,summary,[data-cb]"); c.classList.toggle("is-hover", !!h); });
  (function loop() { cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2; c.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(loop); })();
}

/* ---------- Motion ---------- */
let firstPaint = true;
function countUp(el) { const end = +el.dataset.count, s = el.dataset.suffix || "", dec = end % 1 ? 1 : 0; if (!hasG || reduce) return; const o = { v: 0 }; gsap.to(o, { v: end, duration: 2, ease: "power3.out", onUpdate: () => (el.textContent = o.v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + s) }); }
const charIn = (els, extra = {}) => gsap.from(els, { yPercent: 120, rotateX: -80, opacity: 0, transformOrigin: "50% 100%", stagger: 0.018, duration: 1.1, ease: "expo.out", ...extra });
function buildMotion(entering) {
  if (!hasG || reduce) return;
  ScrollTrigger.getAll().forEach((s) => s.kill());
  const view = $(".view.on"); if (!view) return; const q = (s) => view.querySelectorAll(s), d0 = firstPaint ? 1.7 : 0.55;
  if (entering) { const h1 = view.querySelector(".vhead h1, .bot-copy h1"); if (h1) { charIn(h1.querySelectorAll(".ch"), { delay: d0 }); gsap.from(view.querySelectorAll(".vhead .kick, .vhead .vlede, .bot-copy .kick, .bot-copy .vlede, .chan, .bstats"), { y: 30, opacity: 0, stagger: 0.08, duration: 1.1, ease: "expo.out", delay: d0 + 0.2 }); } }
  q(".sec-head .chars, .cta-in .chars").forEach((h) => charIn(h.querySelectorAll(".ch"), { scrollTrigger: { trigger: h, start: "top 88%" } }));
  q(".rv-group").forEach((g) => gsap.from(g.children, { y: 60, opacity: 0, duration: 1.1, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: g, start: "top 86%" } }));
  q(".kick").forEach((k) => { if (!k.closest(".vhead, .bot-copy, .hero")) gsap.from(k, { x: -30, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: k, start: "top 92%" } }); });
  if (view.id === "v-inicio") {
    if (entering) { charIn(".hero-title .ch", { delay: d0 }); gsap.from(".hero-in", { y: 40, opacity: 0, duration: 1.2, stagger: 0.1, ease: "expo.out", delay: d0 + 0.3 }); gsap.from("#miniBrowser", { y: 120, rotateX: 30, opacity: 0, duration: 1.6, ease: "expo.out", delay: d0 + 0.1 }); gsap.from(".m-svcs > div", { x: 40, opacity: 0, stagger: 0.1, duration: 0.9, ease: "expo.out", delay: d0 + 0.8 }); gsap.from(".cfg-hint", { opacity: 0, x: -20, duration: 1, delay: d0 + 1.2 }); gsap.from(".stat", { y: 40, opacity: 0, stagger: 0.08, duration: 1, ease: "expo.out", delay: d0 + 0.6, onStart: () => $$(".stats [data-count]").forEach(countUp) }); }
    gsap.from(".get", { y: 100, opacity: 0, rotateX: 14, stagger: 0.12, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: "#getGrid", start: "top 82%" } });
    gsap.from(".ba-stage", { y: 80, opacity: 0, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: ".ba-stage", start: "top 85%" } });
    gsap.from(".cm", { y: -50, opacity: 0, rotate: () => gsap.utils.random(-10, 10), stagger: 0.1, duration: 0.9, ease: "bounce.out", scrollTrigger: { trigger: ".ba-stage", start: "top 75%" } });
    ScrollTrigger.create({ trigger: ".ba-stage", start: "top 55%", once: true, onEnter: () => setTimeout(() => { if ($("#baSwitch").getAttribute("aria-pressed") !== "true" && current === "inicio") $("#baSwitch").click(); }, 1800) });
    gsap.from(".cta-in", { scale: 0.9, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".cta-in", start: "top 85%" } });
  }
  if (view.id === "v-demos") { gsap.from(".demo-bar", { y: 30, opacity: 0, duration: 1, ease: "expo.out", delay: entering ? d0 + 0.3 : 0 }); gsap.from("#demoBrowser", { y: 120, opacity: 0, scale: 0.94, duration: 1.4, ease: "expo.out", delay: entering ? d0 + 0.4 : 0 }); }
  if (view.id === "v-bots") {
    if (entering) { gsap.from("#phone", { y: 140, rotate: 8, opacity: 0, duration: 1.5, ease: "expo.out", delay: d0 + 0.2 }); gsap.from(".halo", { scale: 0.4, opacity: 0, duration: 2, ease: "expo.out", delay: d0 }); ScrollTrigger.create({ trigger: ".bstats", start: "top 95%", once: true, onEnter: () => $$(".bstats [data-count]").forEach(countUp) }); }
    gsap.from(".fn", { y: 60, opacity: 0, stagger: 0.12, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: "#flow", start: "top 85%" } });
    gsap.fromTo(".flow-line i", { scaleX: 0 }, { scaleX: 1, duration: 1.8, ease: "power2.inOut", scrollTrigger: { trigger: "#flow", start: "top 85%" } });
  }
  if (view.id === "v-paneles") { gsap.fromTo(".ps", { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 1, ease: "expo.out", delay: entering ? d0 + 0.3 : 0, clearProps: "transform" }); gsap.fromTo("#appShell", { y: 100, opacity: 0, rotateX: 10 }, { y: 0, opacity: 1, rotateX: 0, duration: 1.4, ease: "expo.out", delay: entering ? d0 + 0.45 : 0, clearProps: "transform" }); setTimeout(() => renderSec(true), entering ? (d0 + 0.6) * 1000 : 0); }
  if (view.id === "v-planes") {
    gsap.fromTo(".plan", { y: 90, opacity: 0, rotateY: -12 }, { y: 0, opacity: 1, rotateY: 0, stagger: 0.1, duration: 1.2, ease: "expo.out", delay: entering ? d0 + 0.3 : 0, clearProps: "transform" });
    gsap.from("#cmp tr", { x: -30, opacity: 0, stagger: 0.04, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: "#cmp", start: "top 85%" } });
    gsap.from(".add", { x: 40, opacity: 0, stagger: 0.06, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".addons", start: "top 85%" } });
    requestAnimationFrame(() => { const b = $(".bill .on"), pill = $("#bill .pill"); if (b) { pill.style.width = b.offsetWidth + "px"; pill.style.transform = `translateX(${b.offsetLeft - 4}px)`; } });
  }
  gsap.fromTo("#giant span", { yPercent: 110, rotate: 8 }, { yPercent: 0, rotate: 0, stagger: 0.05, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: 0.6 } });
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

/* ---------- Boot ---------- */
renderStatic();
showView(location.hash.slice(1), false);
const ld = $("#loader");
if (!hasG || reduce) { ld.style.display = "none"; firstPaint = false; }
else {
  ld.style.animation = "none";
  gsap.timeline({ onComplete: () => (firstPaint = false) })
    .from(".ld-stack i", { y: 40, opacity: 0, rotate: (i) => [-8, 4, 10][i], stagger: 0.12, duration: 0.7, ease: "back.out(2)" })
    .from(".ld-word", { y: 20, opacity: 0, duration: 0.6, ease: "expo.out" }, 0.25)
    .fromTo(".ld-bar i", { scaleX: 0 }, { scaleX: 1, duration: 1, ease: "power2.inOut" }, 0.2)
    .to(ld, { clipPath: "inset(0 0 100% 0 round 0 0 40px 40px)", duration: 0.95, ease: "expo.inOut" }, 1.35).set(ld, { display: "none" });
}
})();

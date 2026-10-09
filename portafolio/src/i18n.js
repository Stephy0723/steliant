const T = {
  es: {
    nav: { home: "Inicio", work: "Proyectos", pricing: "Precios", process: "Proceso", contact: "Contacto", menu: "Menú", quote: "Cotizar", my: "Mi cotización" },
    home: {
      kick: "Steliant · Innovative Software Solutions", title: ["Software que", "vende por ti."], lede: "Diseño y desarrollo webs, tiendas, sistemas de reservas, CRMs y bots para negocios en República Dominicana. Proyectos reales, listos para adaptar a tu marca.",
      cta1: "Ver proyectos", cta2: "Cotizar mi proyecto",
      stats: [[10, "", "Proyectos en exhibición"], [6, "", "Industrias"], [2, "", "Idiomas por proyecto"], [100, "%", "Responsive"]],
      featKick: "Destacados", featTitle: ["Lo que puedo", "construir para ti"], all: "Ver los 10 proyectos",
      whyKick: "Por qué Steliant", why: [["Diseño premium", "Animación, modo claro/oscuro y dos idiomas en cada proyecto."], ["Listo para vender", "Flujos completos: reservas, pagos, paneles y bots."], ["Precios claros", "Pago único o mensualidades, sin sorpresas."], ["Soporte local", "Hosting, dominio y cambios incluidos en el plan."]],
      ctaTitle: ["¿Tienes una idea?", "Hagámosla real."], ctaText: "Cuéntame tu negocio y te envío una propuesta con precio cerrado en 24 horas.",
    },
    work: { kick: "Portafolio", title: ["Diez proyectos,", "listos para ti"], lede: "Cada proyecto tiene demo en vivo y su código en GitHub. Filtra por tipo y abre el que te interese.", filters: { all: "Todos", web: "Webs", shop: "E-commerce", crm: "Reservas y CRM", system: "Sistemas" }, demo: "Ver demo", code: "GitHub", details: "Detalles", from: "Desde", or: "o", per: "/mes", months: "meses", branchOn: "Rama steliant-exhibicion-completa", branchOff: "Código en el portafolio", features: "Incluye", stack: "Tecnologías", priv: "Repositorio privado: pide acceso" },
    pricing: {
      kick: "Precios", title: ["Precios reales,", "pagos cómodos"], lede: "Un proyecto profesional tiene costos reales: horas de diseño y desarrollo, servidor, dominio y soporte. Puedes pagarlo de una vez o en mensualidades.",
      once: "Pago único", monthly: "Mensual", perMonth: "/mes", x12: "× 12 meses · incluye hosting y soporte", plusHost: "+ hosting desde RD$1,500/mes", popular: "Más pedido",
      pkgs: { web: ["Web profesional", "Firma, Legal, Tour, Larimar", ["Hasta 6 secciones", "Modo claro/oscuro y ES/EN", "Formulario y WhatsApp", "SEO básico"]], shop: ["Tienda en línea", "Steliant Nova", ["Catálogo y carrito", "Checkout y pedidos", "Panel de ventas", "Pasarela de pago*"]], crm: ["Reservas y CRM", "Steliant Reservas, Larimar CRM", ["Página de reservas", "Panel por roles", "Recordatorios", "Bot opcional"]], system: ["Sistema a medida", "Salud, Nexo, Esports", ["Módulos a medida", "Usuarios y permisos", "Reportes", "Base de datos propia"]] },
      costKick: "¿De dónde sale el precio?", costs: [["Diseño y desarrollo", "Horas de trabajo según el alcance (RD$1,100–1,400/h)."], ["Servidor y base de datos", "VPS con respaldo diario: RD$1,200–3,000/mes."], ["Dominio y SSL", "Dominio .com o .do y certificado: ~RD$1,500/año."], ["WhatsApp Business API", "Meta cobra por conversación (aprox. US$0.01–0.06)."], ["Mantenimiento", "Actualizaciones, seguridad y cambios menores."]],
      calcKick: "Cotizador", calcTitle: ["Arma tu proyecto", "y mira el precio"], base: "Tipo de proyecto", extras: "Extras", term: "Forma de pago", upfront: "Pago único", total: "Total del proyecto", monthlyFee: "Mensualidad", initial: "Inicial", hosting: "Hosting y soporte", feeNote: "Financiamiento", noFee: "sin interés", ask: "Solicitar esta cotización",
      extrasL: { bot: "Bot de WhatsApp con IA", pay: "Pasarela de pagos", admin: "Panel administrativo", lang: "Segundo idioma", pwa: "App instalable (PWA)" },
      note: "Precios de referencia en pesos dominicanos, sin ITBIS. El precio final se confirma con la propuesta.",
    },
    process: { kick: "Proceso", title: ["De la idea", "al lanzamiento"], lede: "Un proceso claro, con entregas que puedes ver desde la primera semana.",
      steps: [["Llamada inicial", "Entiendo tu negocio, tus clientes y lo que quieres lograr.", "Día 1"], ["Propuesta y precio", "Alcance, tiempos y precio cerrado por escrito.", "24–48 h"], ["Diseño", "Vista previa navegable para que apruebes antes de programar.", "Semana 1–2"], ["Desarrollo", "Construcción por etapas, con avances que puedes probar.", "Semana 2–6"], ["Lanzamiento y soporte", "Publicación, capacitación y soporte mensual.", "Continuo"]],
      faqKick: "Preguntas frecuentes", faq: [["¿Puedo pagar en cuotas?", "Sí. Puedes pagar en 6 meses sin interés, o en 12 y 18 meses con un pequeño financiamiento. No pido inicial."], ["¿El dominio y el hosting son míos?", "Sí. Todo queda a tu nombre; yo lo administro mientras tengas el plan."], ["¿Cuánto tarda un proyecto?", "Una web de 2 a 3 semanas; tiendas y sistemas de 4 a 10 semanas según el alcance."], ["¿Qué pasa después de los 12 meses?", "Pasas a un plan de mantenimiento desde RD$1,500/mes con hosting, respaldo y soporte."]] },
    contact: { kick: "Contacto", title: ["Hablemos de", "tu proyecto"], lede: "Respondo en menos de 24 horas.", name: "Nombre", biz: "Negocio", phone: "WhatsApp", type: "Tipo de proyecto", msg: "Cuéntame qué necesitas", send: "Enviar solicitud", wa: "Escribir por WhatsApp", sent: "¡Solicitud enviada! Te contacto pronto.", need: "Completa nombre y WhatsApp.", where: "Ubicación", hours: "Lun–Sáb · 9:00–19:00" },
    quote: { title: "Tu cotización", sent: "Enviada", items: "Incluye", open: "Ver en el cotizador", clear: "Borrar", plan: "en" },
    footer: { tag: "Innovative Software Solutions", credit: "Diseñado y desarrollado por Steliant" },
  },
  en: {
    nav: { home: "Home", work: "Projects", pricing: "Pricing", process: "Process", contact: "Contact", menu: "Menu", quote: "Get a quote", my: "My quote" },
    home: {
      kick: "Steliant · Innovative Software Solutions", title: ["Software that", "sells for you."], lede: "I design and build websites, stores, booking systems, CRMs and bots for businesses in the Dominican Republic. Real projects, ready to adapt to your brand.",
      cta1: "See projects", cta2: "Quote my project",
      stats: [[10, "", "Showcase projects"], [6, "", "Industries"], [2, "", "Languages per project"], [100, "%", "Responsive"]],
      featKick: "Featured", featTitle: ["What I can", "build for you"], all: "See all 10 projects",
      whyKick: "Why Steliant", why: [["Premium design", "Motion, light/dark mode and two languages in every project."], ["Ready to sell", "Complete flows: bookings, payments, dashboards and bots."], ["Clear pricing", "One-time payment or monthly plans, no surprises."], ["Local support", "Hosting, domain and changes included in the plan."]],
      ctaTitle: ["Got an idea?", "Let's make it real."], ctaText: "Tell me about your business and I'll send a fixed-price proposal within 24 hours.",
    },
    work: { kick: "Portfolio", title: ["Ten projects,", "ready for you"], lede: "Every project has a live demo and its code on GitHub. Filter by type and open the one you like.", filters: { all: "All", web: "Websites", shop: "E-commerce", crm: "Booking & CRM", system: "Systems" }, demo: "Live demo", code: "GitHub", details: "Details", from: "From", or: "or", per: "/mo", months: "months", branchOn: "Branch steliant-exhibicion-completa", branchOff: "Code in the portfolio", features: "Includes", stack: "Stack", priv: "Private repository: ask for access" },
    pricing: {
      kick: "Pricing", title: ["Real prices,", "easy payments"], lede: "A professional project has real costs: design and development hours, server, domain and support. Pay once or in monthly installments.",
      once: "One-time", monthly: "Monthly", perMonth: "/mo", x12: "× 12 months · hosting & support included", plusHost: "+ hosting from RD$1,500/mo", popular: "Most requested",
      pkgs: { web: ["Professional website", "Firma, Legal, Tour, Larimar", ["Up to 6 sections", "Light/dark mode and ES/EN", "Form and WhatsApp", "Basic SEO"]], shop: ["Online store", "Steliant Nova", ["Catalog and cart", "Checkout and orders", "Sales dashboard", "Payment gateway*"]], crm: ["Booking & CRM", "Steliant Reservas, Larimar CRM", ["Booking page", "Role-based dashboard", "Reminders", "Optional bot"]], system: ["Custom system", "Salud, Nexo, Esports", ["Custom modules", "Users and permissions", "Reports", "Own database"]] },
      costKick: "Where does the price come from?", costs: [["Design & development", "Work hours based on scope (RD$1,100–1,400/h)."], ["Server & database", "VPS with daily backup: RD$1,200–3,000/mo."], ["Domain & SSL", ".com or .do domain and certificate: ~RD$1,500/yr."], ["WhatsApp Business API", "Meta charges per conversation (about US$0.01–0.06)."], ["Maintenance", "Updates, security and minor changes."]],
      calcKick: "Quote builder", calcTitle: ["Build your project", "and see the price"], base: "Project type", extras: "Extras", term: "Payment", upfront: "One-time", total: "Project total", monthlyFee: "Monthly payment", initial: "Down payment", hosting: "Hosting & support", feeNote: "Financing", noFee: "interest-free", ask: "Request this quote",
      extrasL: { bot: "AI WhatsApp bot", pay: "Payment gateway", admin: "Admin dashboard", lang: "Second language", pwa: "Installable app (PWA)" },
      note: "Reference prices in Dominican pesos, before tax. Final price confirmed in the proposal.",
    },
    process: { kick: "Process", title: ["From idea", "to launch"], lede: "A clear process, with deliverables you can see from week one.",
      steps: [["Kick-off call", "I learn about your business, your clients and your goals.", "Day 1"], ["Proposal & price", "Scope, timeline and fixed price in writing.", "24–48 h"], ["Design", "A clickable preview you approve before coding.", "Week 1–2"], ["Development", "Built in stages, with progress you can test.", "Week 2–6"], ["Launch & support", "Go-live, training and monthly support.", "Ongoing"]],
      faqKick: "FAQ", faq: [["Can I pay in installments?", "Yes. 6 months interest-free, or 12 and 18 months with a small financing fee."], ["Are the domain and hosting mine?", "Yes. Everything is in your name; I manage it while you have the plan."], ["How long does a project take?", "A website 2–3 weeks; stores and systems 4–10 weeks depending on scope."], ["What happens after 12 months?", "You move to a maintenance plan from RD$1,500/mo with hosting, backups and support."]] },
    contact: { kick: "Contact", title: ["Let's talk about", "your project"], lede: "I reply within 24 hours.", name: "Name", biz: "Business", phone: "WhatsApp", type: "Project type", msg: "Tell me what you need", send: "Send request", wa: "Message on WhatsApp", sent: "Request sent! I'll be in touch soon.", need: "Fill in name and WhatsApp.", where: "Location", hours: "Mon–Sat · 9:00–19:00" },
    quote: { title: "Your quote", sent: "Sent", items: "Includes", open: "Open in quote builder", clear: "Clear", plan: "in" },
    footer: { tag: "Innovative Software Solutions", credit: "Designed and built by Steliant" },
  },
};
let lang = store.get("sp-lang") || ((navigator.language || "es").startsWith("en") ? "en" : "es");
const t = () => T[lang];
const get = (p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), t());
const P = (p) => p[lang] || p.es;
